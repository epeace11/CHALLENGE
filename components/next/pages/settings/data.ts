import type { Challenge, Person, World } from '@/lib/next/model';
import { activePoints, formatMoney, giftTotal } from '@/lib/next/selectors';

/**
 * Settings on the sample world: renaming yourself, reminder times, the challenge change you propose
 * to your partner, and the export file. Pure functions; nothing leaves the browser.
 */

/** A new name for one person, everywhere the world shows it. */
export function renamePerson(w: World, personId: string, name: string): World {
  const trimmed = name.trim();
  const rename = (p: Person): Person =>
    p.id === personId && trimmed
      ? {
          ...p,
          name: trimmed,
          initial: trimmed.charAt(0).toUpperCase(),
        }
      : p;
  return {
    ...w,
    me: rename(w.me),
    partner: rename(w.partner),
    couple: {
      ...w.couple,
      people: [rename(w.couple.people[0]), rename(w.couple.people[1])],
    },
  };
}

/** Reminder times to pick from: every half hour, 5 pm to 11:30 pm (the day locks at 11:59 pm). */
export const TIMES = Array.from({ length: 14 }, (_, i) => {
  const minutes = 17 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

/** "8:00 pm" from "20:00". */
export function formatClock(time: string) {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export type Reminders = { on: boolean; first: string; second: string };

export const DEFAULT_REMINDERS: Reminders = {
  on: true,
  first: '20:00',
  second: '22:00',
};

/** "8:00 pm and 10:00 pm", or "Off". */
export const remindersLine = (r: Reminders) =>
  r.on ? `${formatClock(r.first)} and ${formatClock(r.second)}` : 'Off';

/** The challenge settings a couple changes together: one person proposes, the other accepts. */
export type Terms = { name: string; step: number; cap: number | null };

export const termsOf = (c: Challenge): Terms => ({
  name: c.name,
  step: c.step,
  cap: c.cap,
});

/** "The first point costs $1, the second $2". */
export const stepLine = (step: number) =>
  `The first point costs ${formatMoney(step)}, the second ${formatMoney(2 * step)}`;

export const capLine = (cap: number | null) =>
  cap === null ? 'No cap' : `No gift goes over ${formatMoney(cap)}`;

/** What would change, in plain words: "Dollar step: $1 → $2". Empty when nothing would. */
export function changesOf(now: Terms, next: Terms) {
  const out: string[] = [];
  if (next.name.trim() !== now.name) out.push(`Name: ${next.name.trim()}`);
  if (next.step !== now.step)
    out.push(
      `Dollar step: ${formatMoney(now.step)} → ${formatMoney(next.step)}`,
    );
  if (next.cap !== now.cap)
    out.push(
      `Cap: ${now.cap === null ? 'none' : formatMoney(now.cap)} → ${next.cap === null ? 'none' : formatMoney(next.cap)}`,
    );
  return out;
}

/** Whether the terms can be proposed, and why not. */
export function termsError(t: Terms) {
  if (!t.name.trim())
    return { field: 'name' as const, text: 'Give it a name.' };
  if (!(t.step > 0))
    return { field: 'step' as const, text: 'The step has to be more than $0.' };
  if (t.cap !== null && !(t.cap >= t.step))
    return {
      field: 'cap' as const,
      text: `The cap has to be at least ${formatMoney(t.step)}.`,
    };
  return null;
}

/** Where both gifts would stand today under other terms. */
export function giftsUnder(w: World, t: Pick<Terms, 'step' | 'cap'>) {
  return {
    me: giftTotal(activePoints(w, w.partner.id).length, t.step, t.cap),
    partner: giftTotal(activePoints(w, w.me.id).length, t.step, t.cap),
  };
}

/** Everything the viewer logged, as a JSON file to download. */
export function exportFile(w: World) {
  const mine = <T extends { personId: string }>(list: T[]) =>
    list.filter((x) => x.personId === w.me.id);
  const data = {
    exportedOn: w.today,
    you: { name: w.me.name, email: w.me.email },
    challenge: {
      name: w.challenge.name,
      start: w.challenge.start,
      days: w.challenge.days,
      step: w.challenge.step,
      cap: w.challenge.cap,
      rules: w.challenge.rules.map((r) => r.title),
    },
    answers: mine(w.entries).map((e) => ({
      day: e.day,
      rule: w.challenge.rules.find((r) => r.id === e.ruleId)?.title ?? e.ruleId,
      done: e.done,
      value: e.value,
      status: e.status,
      note: e.note,
      screenshots: e.proofs.length,
    })),
    points: mine(w.points).map((p) => ({
      day: p.day,
      rule: w.challenge.rules.find((r) => r.id === p.ruleId)?.title ?? p.ruleId,
      forgiven: p.forgiven,
    })),
    notes: mine(w.journal).map((n) => ({ day: n.day, text: n.text })),
    finished: w.past.map((p) => ({
      name: p.challenge.name,
      start: p.challenge.start,
      days: p.challenge.days,
    })),
  };
  const slug = w.me.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'me';
  return {
    filename: `the-challenge-${slug}.json`,
    text: JSON.stringify(data, null, 2),
  };
}
