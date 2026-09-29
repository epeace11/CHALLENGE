'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { DateString, Entry, Proof, Rule } from '@/lib/next/model';
import { saveCheckin, type CheckinInput } from '@/lib/next/actions';
import { screenTimeShot, stepsShot } from '@/lib/next/shots';
import {
  dateIn,
  entryFor,
  formatDuration,
  formatNumber,
  formatTime,
  formatWeekday,
  isAnswered,
  isClosed,
  lockTime,
  meetsTarget,
  openCheckins,
  openDays,
  rulesOn,
  shift,
  timeLeft,
} from '@/lib/next/selectors';
import { useToast } from '@/components/next/ui';
import { useDemo, useWorld } from '@/components/next/world';

/**
 * The state every Check in version shares: which day is on screen, the check-in being answered,
 * drafts (nothing is saved until Save), skipping, jumping to or changing an answer, and one Save
 * per check-in. Versions differ only in how they lay this out.
 */

export type Draft = {
  /** Yes or No (Yes-or-No and weekly rules). */
  done: boolean | null;
  /** Number rules. */
  value: number | null;
  note: string;
  /** The note field is open (a note already written keeps it open). */
  noteOpen: boolean;
  proofs: Proof[];
  /** With a miss: send "Ask Jordan to forgive this" along with the answer. */
  forgive: boolean;
  reason: string;
};

/** What the draft amounts to: a Yes, a miss (a point), a weekly No (costs nothing), or nothing yet. */
export type Outcome = 'yes' | 'miss' | 'rest' | null;

const BLANK: Draft = {
  done: null,
  value: null,
  note: '',
  noteOpen: false,
  proofs: [],
  forgive: false,
  reason: '',
};

/** A draft that starts from what was saved (or the late answer waiting on it). */
export function draftFrom(entry: Entry | undefined): Draft {
  if (!entry) return BLANK;
  const from = entry.correction ?? (entry.status === 'unlogged' ? null : entry);
  if (!from) return BLANK;
  return {
    ...BLANK,
    done: from.done,
    value: from.value ?? null,
    note: from.note,
    noteOpen: !!from.note,
    proofs: from.proofs,
  };
}

export function outcomeOf(rule: Rule, d: Draft): Outcome {
  if (rule.kind === 'number') {
    if (d.value === null || !rule.target) return null;
    return meetsTarget(rule.target, d.value) ? 'yes' : 'miss';
  }
  if (d.done === null) return null;
  if (d.done) return 'yes';
  return rule.kind === 'weekly' ? 'rest' : 'miss';
}

/** Why Save is off, and whether to say so (an empty answer speaks for itself). */
export function problemOf(
  rule: Rule,
  d: Draft,
  late: boolean,
): { text: string; show: boolean } | null {
  const o = outcomeOf(rule, d);
  if (o === null)
    return {
      text:
        rule.kind === 'number'
          ? 'Enter a number to save.'
          : 'Choose Yes or No.',
      show: false,
    };
  if (o === 'yes' && rule.proof === 'required' && d.proofs.length === 0)
    return { text: 'Add the screenshot to save.', show: true };
  if (o === 'miss' && !late && d.forgive && !d.reason.trim())
    return {
      text: 'Say why, or turn off the forgiveness request.',
      show: true,
    };
  return null;
}

/** "Minutes", "Pages", "Steps": the number field's label. */
export function unitLabel(rule: Rule) {
  const unit = rule.target?.unit ?? '';
  const words: Record<string, string> = {
    min: 'Minutes',
    h: 'Hours',
    L: 'Litres',
  };
  return words[unit] ?? unit.charAt(0).toUpperCase() + unit.slice(1);
}

/** How far the − and + buttons move a number rule. */
export function stepFor(rule: Rule) {
  const unit = rule.target?.unit;
  if (unit === 'steps') return 500;
  if (unit === 'min') return 5;
  if (unit === 'h' || unit === 'L') return 0.5;
  return 1;
}

/** A sample screenshot for the preview (a phone's photo picker in the real app). */
function sampleShot(
  rule: Rule,
  value: number | null,
  day: DateString,
  n: number,
): Proof {
  const id = `proof-added-${rule.id}-${day}-${n}`;
  if (rule.target?.unit === 'steps') {
    const steps = value ?? 10480;
    return {
      id,
      src: stepsShot(steps, day),
      alt: `Step count screenshot, ${formatNumber(steps)} steps`,
    };
  }
  const minutes = value ?? 45;
  return {
    id,
    src: screenTimeShot(minutes, day),
    alt: `Screen Time screenshot, ${formatNumber(minutes)} minutes of social media and games`,
  };
}

export type Checkin = ReturnType<typeof useCheckin>;

/** Elements the page owns: the top of the question area and the question's heading. */
export type Anchors = {
  top: RefObject<HTMLElement | null>;
  heading: RefObject<HTMLElement | null>;
};

export function useCheckin({ top, heading }: Anchors) {
  const world = useWorld();
  const { update, undo } = useDemo();
  const toast = useToast();
  const c = world.challenge,
    me = world.me.id,
    partner = world.partner.name;

  const loggable = openDays(world);
  const [picked, setPicked] = useState<DateString | null>(null);
  const day = picked ?? loggable[0] ?? null;
  const late = day ? isClosed(c, day, world.now) : false;
  const rules = day ? rulesOn(c, me, day) : [];
  const open = day && !late ? openCheckins(world, me, day) : [];

  const [skipped, setSkipped] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [direction, setDirection] = useState<1 | -1>(1);
  const shots = useRef(0);

  // Skipped check-ins wait at the end of the line.
  const queue = [
    ...open.filter((r) => !skipped.includes(r.id)),
    ...skipped
      .map((id) => open.find((r) => r.id === id))
      .filter((r): r is Rule => !!r),
  ];
  const focused = focus ? rules.find((r) => r.id === focus) : undefined;
  /** The check-in on screen: one being changed or jumped to, else the next open one. */
  const current = focused ?? (late ? undefined : queue[0]);
  const entryOf = (rule: Rule) =>
    day ? entryFor(world, me, rule.id, day) : undefined;
  /** True while changing an answer already saved. */
  const changing = !!current && isAnswered(entryOf(current));

  const key = (rule: Rule) => `${day}|${rule.id}`;
  const draftOf = (rule: Rule) => drafts[key(rule)] ?? draftFrom(entryOf(rule));
  const change = (rule: Rule, patch: Partial<Draft>) => {
    const k = key(rule),
      base = draftFrom(entryOf(rule));
    setDrafts((all) => ({ ...all, [k]: { ...(all[k] ?? base), ...patch } }));
  };
  /** True when a saved answer's draft still says what was saved: Save would send nothing new. */
  const unchanged = (rule: Rule) => {
    const entry = entryOf(rule);
    if (!isAnswered(entry)) return false;
    const d = draftOf(rule),
      base = draftFrom(entry);
    const ids = (x: Draft) => x.proofs.map((p) => p.id).join();
    return (
      d.done === base.done &&
      d.value === base.value &&
      d.note.trim() === base.note.trim() &&
      ids(d) === ids(base) &&
      !(d.forgive && d.reason.trim())
    );
  };
  /** Save does something: the answer is complete and differs from what was saved. */
  const canSave = (rule: Rule) =>
    !problemOf(rule, draftOf(rule), late) && !unchanged(rule);
  const drop = (rule: Rule) => {
    const k = key(rule);
    setDrafts((all) => {
      const next = { ...all };
      delete next[k];
      return next;
    });
  };

  // After Save or Skip, keyboard and screen reader focus moves to the next question.
  const moved = useRef(false);
  const currentKey = current ? key(current) : 'none';
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    heading.current?.focus({ preventScroll: true });
  }, [currentKey, heading]);
  /** The top of the question area, scrolled back into view after a Save far down a long card. */
  const scrollBack = (always: boolean) =>
    requestAnimationFrame(() => {
      const el = top.current;
      if (!el || (!always && el.getBoundingClientRect().top >= 0)) return;
      const still = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      el.scrollIntoView({
        block: 'start',
        behavior: still ? 'auto' : 'smooth',
      });
    });
  /** After an action that changes the question on screen. */
  const reveal = () => {
    moved.current = true;
    scrollBack(false);
  };
  /** Brings the question on screen into view and focuses it. */
  const showCurrent = () => {
    scrollBack(true);
    heading.current?.focus({ preventScroll: true });
  };

  const save = (rule: Rule) => {
    // A card still gliding away keeps its buttons for a moment; only the one on screen saves.
    if (!day || rule.id !== current?.id || !canSave(rule)) return;
    const d = draftOf(rule),
      o = outcomeOf(rule, d);
    const ask = o === 'miss' && !late && d.forgive ? d.reason.trim() : '';
    const input: CheckinInput = {
      personId: me,
      ruleId: rule.id,
      day,
      note: d.note.trim(),
      proofs: d.proofs,
      ...(rule.kind === 'number'
        ? { value: d.value ?? undefined }
        : { done: d.done === true }),
      ...(ask ? { forgiveness: ask } : {}),
    };
    update((w) => saveCheckin(w, input));
    const k = key(rule);
    drop(rule);
    setFocus(null);
    setSkipped((s) => s.filter((id) => id !== rule.id));
    setDirection(1);
    reveal();
    toast({
      text: late
        ? `Late answer sent to ${partner}`
        : ask
          ? `Saved. ${partner} will see your request.`
          : 'Saved',
      action: {
        label: 'Undo',
        onClick: () => {
          undo();
          setDrafts((all) => ({ ...all, [k]: d }));
        },
      },
    });
  };

  const skip = (rule: Rule) => {
    if (rule.id !== current?.id) return;
    setSkipped((s) => [...s.filter((id) => id !== rule.id), rule.id]);
    setFocus(null);
    setDirection(1);
    reveal();
  };

  /** Opens one check-in: an open one to answer now, or a saved one to change. */
  const openRule = (ruleId: string) => {
    setFocus(ruleId);
    setDirection(1);
    reveal();
  };

  /** Stops changing a saved answer and forgets the draft. */
  const cancel = () => {
    if (current) drop(current);
    setFocus(null);
    setDirection(-1);
  };

  const pickDay = (next: DateString) => {
    if (next === day) return;
    setDirection(day && next < day ? -1 : 1);
    setPicked(next);
    setFocus(null);
    setSkipped([]);
  };

  const addProof = (rule: Rule) => {
    const d = draftOf(rule);
    shots.current += 1;
    change(rule, {
      proofs: [
        ...d.proofs,
        sampleShot(rule, d.value, day ?? '', shots.current),
      ],
    });
  };
  const removeProof = (rule: Rule, proofId: string) =>
    change(rule, {
      proofs: draftOf(rule).proofs.filter((p) => p.id !== proofId),
    });

  /** "11:59 pm tonight", or "11:59 pm Saturday" for a day that locks later. */
  const lockLabel = (d: DateString) => {
    const lock = lockTime(c, d);
    // "11:59 pm" never breaks across lines.
    const time = formatTime(lock, c.timeZone).replace(' ', '\u00a0'),
      on = dateIn(c.timeZone, lock);
    if (on === world.today) return `${time} tonight`;
    if (on === shift(world.today, 1)) return `${time} tomorrow`;
    return `${time} ${formatWeekday(on)}`;
  };

  return {
    world,
    me,
    partner,
    /** Days that can still be answered, oldest first. */
    loggable,
    day,
    /** The day on screen is past its deadline: changes are late answers. */
    late,
    rules,
    open,
    /** Open check-ins in the order they come up (skipped ones last). */
    queue,
    left: open.length,
    due: rules.length,
    answered: rules.length - open.length,
    current,
    changing,
    direction,
    entryOf,
    draftOf,
    canSave,
    change,
    save,
    skip,
    openRule,
    cancel,
    pickDay,
    showCurrent,
    addProof,
    removeProof,
    lockLabel,
    /** Time left to answer the day on screen, as "4h 29m" that never breaks across lines. */
    timeLeftLabel: formatDuration(day ? timeLeft(world, day) : 0).replace(
      ' ',
      '\u00a0',
    ),
  };
}
