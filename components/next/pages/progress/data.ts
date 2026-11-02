import {
  BookOpen,
  CalendarCheck,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  House,
  Moon,
  PiggyBank,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { DateString, Entry, Rule, World } from '@/lib/next/model';
import {
  appliesOn,
  challengeDays,
  countsForWeek,
  dateIn,
  entryFor,
  entryPill,
  formatTime,
  formatWeekday,
  isClosed,
  lockTime,
  openCheckins,
  openDay,
  pendingRequestFor,
  plural,
  pointOfEntry,
  reviewQueue,
  rulesFor,
  rulesOn,
  ruleSpan,
  shift,
  streaks,
  weekProgress,
  weekTarget,
  weeksOf,
  type PillStatus,
} from '@/lib/next/selectors';

/**
 * What the Progress versions show, worked out from the world: each habit's hit rate and streak,
 * a habit's days, a day's check-ins, and what the viewer can do about any of it.
 */

/** How a calendar cell or a habit's day looks. */
export type Tone =
  | 'done'
  | 'missed'
  | 'review'
  | 'disputed'
  | 'excused'
  | 'open'
  | 'none'
  | 'ahead';

/** A pill status as a cell tone. */
export const toneOf = (s: PillStatus): Tone =>
  s === 'forgiven' ? 'excused' : s;

/** An icon for a habit, by what it is about. */
export function habitIcon(rule: Rule): LucideIcon {
  switch (rule.group) {
    case 'Sleep':
      return Moon;
    case 'Screens':
      return Smartphone;
    case 'Food':
      return Utensils;
    case 'Drinks':
      return Wine;
    case 'Movement':
      return rule.kind === 'weekly' ? Dumbbell : Footprints;
    case 'Mind':
      return BookOpen;
    case 'Money':
      return PiggyBank;
    default:
      return House;
  }
}

/** A badge's icon, by badge id. */
export const BADGE_ICON: Record<string, LucideIcon> = {
  'first-clean-day': Sparkles,
  'clean-week': CalendarCheck,
  'streak-7': Flame,
  'streak-14': Flame,
  'streak-all': ShieldCheck,
  'full-week': Dumbbell,
  'week-won': Trophy,
  gracious: Heart,
  'strong-finish': Rocket,
};

export type HabitStat = {
  rule: Rule;
  weekly: boolean;
  current: number;
  best: number;
  unit: 'day' | 'week';
  /** Weekly rules: this week so far. */
  week: ReturnType<typeof weekProgress>;
};

/** Every habit `personId` has, with its streak (and this week, for a weekly one), in rule order. */
export function habitStats(w: World, personId: string): HabitStat[] {
  const runs = streaks(w, personId);
  return rulesFor(w.challenge, personId).map((rule) => {
    const run = runs.find((s) => s.rule.id === rule.id);
    return {
      rule,
      weekly: rule.kind === 'weekly',
      current: run?.current ?? 0,
      best: run?.best ?? 0,
      unit: run?.unit ?? 'day',
      week: rule.kind === 'weekly' ? weekProgress(w, personId, rule.id) : null,
    };
  });
}

/** "6 days" or "2 weeks". */
export const runLength = (n: number, unit: 'day' | 'week') =>
  `${n} ${unit}${n === 1 ? '' : 's'}`;

export type HabitDay = {
  day: DateString;
  /** Null on days the habit does not ask anything. */
  tone: Tone | null;
  label: string;
  entry?: Entry;
};

/** Each day of the challenge for one habit: its tone, or null when the habit is not asked that day. */
export function habitDays(w: World, personId: string, rule: Rule): HabitDay[] {
  const c = w.challenge;
  return challengeDays(c).map((day) => {
    if (!appliesOn(rule, day, c)) return { day, tone: null, label: '' };
    if (day >= w.today) return { day, tone: 'ahead', label: 'Not yet' };
    const entry = entryFor(w, personId, rule.id, day);
    const pill = entryPill(w, rule, entry, day);
    return { day, tone: toneOf(pill.status), label: pill.label, entry };
  });
}

/** The check-ins of one day for one person, with each answer's pill. */
export function dayCheckins(w: World, personId: string, day: DateString) {
  return rulesOn(w.challenge, personId, day).map((rule) => {
    const entry = entryFor(w, personId, rule.id, day);
    return { rule, entry, pill: entryPill(w, rule, entry, day) };
  });
}

/** Notes either person left on a day. */
export const notesOn = (w: World, day: DateString) =>
  w.journal
    .filter((n) => n.day === day)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/** "until 11:59 pm tonight" for the day being logged. */
export function lockWords(w: World, day: DateString) {
  const lock = lockTime(w.challenge, day),
    time = formatTime(lock, w.challenge.timeZone);
  return dateIn(w.challenge.timeZone, lock) === w.today
    ? `until ${time} tonight`
    : `until ${time}`;
}

/** What waits on the viewer, filtered to one person's day or habit. */
export function waitingOnMe(
  w: World,
  personId: string,
  match: { day?: DateString; ruleId?: string },
) {
  return reviewQueue(w, w.me.id).items.filter((item) => {
    const day = item.kind === 'forgiveness' ? item.point.day : item.entry.day;
    const owner =
      item.kind === 'forgiveness' ? item.point.personId : item.entry.personId;
    return (
      owner === personId &&
      (match.day === undefined || day === match.day) &&
      (match.ruleId === undefined || item.rule.id === match.ruleId)
    );
  });
}

export type MainAction = {
  label: string;
  page: 'log' | 'review';
};

/**
 * The one thing to do from Progress for whoever is on screen: log the open day while the viewer has
 * check-ins left, otherwise review what waits on the viewer. Null when nothing does.
 */
export function mainAction(w: World, personId: string): MainAction | null {
  const day = openDay(w);
  if (personId === w.me.id && day && openCheckins(w, w.me.id).length > 0)
    return { label: `Log ${formatWeekday(day)}`, page: 'log' };
  if (waitingOnMe(w, personId, {}).length > 0)
    return { label: 'Open Review', page: 'review' };
  return null;
}

/** The action for one day or one habit in its sheet, if there is one. */
export function sheetAction(
  w: World,
  personId: string,
  match: { day?: DateString; ruleId?: string },
): MainAction | null {
  const day = openDay(w);
  if (personId === w.me.id && day) {
    const open = openCheckins(w, w.me.id).filter(
      (r) =>
        (match.ruleId === undefined || r.id === match.ruleId) &&
        (match.day === undefined || match.day === day),
    );
    if (open.length > 0)
      return { label: `Log ${formatWeekday(day)}`, page: 'log' };
  }
  if (waitingOnMe(w, personId, match).length > 0)
    return { label: 'Open Review', page: 'review' };
  return null;
}

/**
 * One person's record so far, on one habit or the whole challenge. Points and forgiven points come
 * straight from the points (so they match Overview and Gifts; a point asked about is still a
 * point); done and waiting count only days whose logging has closed, and only weeks that are over,
 * so nothing still ahead is in the count. `of` is the sum of the parts.
 */
export type Tally = {
  /** Check-ins done (a weekly habit: weeks met). */
  done: number;
  /** Points: misses not forgiven, the ones asked about included. */
  points: number;
  forgiven: number;
  /** Points with a forgiveness request still waiting. */
  asked: number;
  /** Answers still waiting for a review or a dispute. */
  waiting: number;
  of: number;
  /** For a weekly habit's own count: weeks short, and weeks short with every point forgiven. */
  short?: number;
  excusedWeeks?: number;
  unit: 'check-in' | 'day' | 'week';
};

/** The points one person has (on one habit, if given): active, forgiven, and asked about. */
function pointsOf(w: World, personId: string, ruleId?: string) {
  const all = w.points.filter(
    (p) =>
      p.personId === personId &&
      !p.voided &&
      (ruleId === undefined || p.ruleId === ruleId),
  );
  const active = all.filter((p) => !p.forgiven);
  return {
    points: active.length,
    forgiven: all.length - active.length,
    asked: active.filter((p) => pendingRequestFor(w, p.id)).length,
  };
}

/** Done and waiting answers of a daily habit, on days whose logging has closed. Misses are points. */
function dailyDone(w: World, personId: string, rule: Rule) {
  const c = w.challenge,
    { from, to } = ruleSpan(rule, c);
  let done = 0,
    waiting = 0;
  for (let d = from; d <= to && d < w.today; d = shift(d, 1)) {
    if (!appliesOn(rule, d, c) || !isClosed(c, d, w.now)) continue;
    const entry = entryFor(w, personId, rule.id, d);
    // A miss with a point (asked about or not) is counted with the points.
    if (entry && pointOfEntry(w, entry.id)) continue;
    const s = entryPill(w, rule, entry, d).status;
    if (s === 'done') done++;
    else if (s === 'review' || s === 'disputed') waiting++;
  }
  return { done, waiting };
}

/** A weekly habit's weeks that are over: visits that counted (up to the target), and how each week went. */
function weeklyDone(w: World, personId: string, rule: Rule) {
  const c = w.challenge;
  let visits = 0,
    met = 0,
    short = 0,
    excused = 0;
  for (const week of weeksOf(c)) {
    const need = weekTarget(rule, week, c);
    if (!need || week.end >= w.today || !isClosed(c, week.end, w.now)) continue;
    const have = w.entries.filter(
      (e) =>
        e.personId === personId &&
        e.ruleId === rule.id &&
        e.day >= week.start &&
        e.day <= week.end &&
        countsForWeek(e),
    ).length;
    visits += Math.min(have, need);
    if (have >= need) {
      met++;
      continue;
    }
    const pts = w.points.filter(
      (p) =>
        p.personId === personId &&
        p.ruleId === rule.id &&
        !p.voided &&
        p.day >= week.start &&
        p.day <= week.end,
    );
    if (pts.length > 0 && pts.every((p) => p.forgiven)) excused++;
    else short++;
  }
  return { visits, met, short, excused };
}

/** One habit for one person: days for a daily habit, weeks for a weekly one. */
export function habitTally(w: World, personId: string, rule: Rule): Tally {
  const p = pointsOf(w, personId, rule.id);
  if (rule.kind === 'weekly') {
    const wk = weeklyDone(w, personId, rule);
    return {
      ...p,
      done: wk.met,
      waiting: 0,
      short: wk.short,
      excusedWeeks: wk.excused,
      of: wk.met + wk.short + wk.excused,
      unit: 'week',
    };
  }
  const d = dailyDone(w, personId, rule);
  return {
    ...p,
    ...d,
    of: d.done + d.waiting + p.points + p.forgiven,
    unit: 'day',
  };
}

/** Every habit of one person, as check-ins: each daily answer, and each weekly visit needed. */
export function wholeTally(w: World, personId: string): Tally {
  const p = pointsOf(w, personId);
  let done = 0,
    waiting = 0;
  for (const rule of rulesFor(w.challenge, personId)) {
    if (rule.kind === 'weekly') done += weeklyDone(w, personId, rule).visits;
    else {
      const d = dailyDone(w, personId, rule);
      done += d.done;
      waiting += d.waiting;
    }
  }
  return {
    ...p,
    done,
    waiting,
    of: done + waiting + p.points + p.forgiven,
    unit: 'check-in',
  };
}

/** Joins facts so a wrapped line ends with the dot instead of starting with it. */
const DOT = '\u00a0· ';

/** "9 points · 1 forgiven · 1 asked to forgive" (parts at 0 left out, but points). */
export function pointsLine(t: Tally) {
  return [
    plural(t.points, 'point'),
    t.forgiven > 0 ? `${t.forgiven} forgiven` : '',
    t.asked > 0 ? `${t.asked} asked to forgive` : '',
  ]
    .filter(Boolean)
    .join(DOT);
}

/**
 * "92 of 99 done · 6 points · 1 waiting", "15 of 17 days done · 2 points · 1 asked to forgive",
 * "1 of 2 weeks met · 1 point". Nothing still ahead is counted.
 */
export function tallyLine(t: Tally) {
  const head =
    t.unit === 'week'
      ? `${t.done} of ${plural(t.of, 'week')} met`
      : t.unit === 'day'
        ? `${t.done} of ${plural(t.of, 'day')} done`
        : `${t.done} of ${t.of} done`;
  // A habit with no points says nothing about them; the whole challenge always says how many.
  const quiet = t.unit !== 'check-in' && t.points === 0 && t.forgiven === 0;
  return [
    head,
    quiet ? '' : pointsLine(t),
    t.waiting > 0 ? `${t.waiting} waiting` : '',
  ]
    .filter(Boolean)
    .join(DOT);
}

/**
 * The parts of a StackedBar, in the legend's order: done, forgiven, points, waiting. A weekly habit
 * counts weeks (met, all forgiven, short).
 */
export const barParts = (t: Tally) =>
  t.unit === 'week'
    ? [
        { tone: 'done' as const, value: t.done },
        { tone: 'excused' as const, value: t.excusedWeeks ?? 0 },
        { tone: 'missed' as const, value: t.short ?? 0 },
      ]
    : [
        { tone: 'done' as const, value: t.done },
        { tone: 'excused' as const, value: t.forgiven },
        { tone: 'missed' as const, value: t.points },
        { tone: 'wait' as const, value: t.waiting },
      ];
