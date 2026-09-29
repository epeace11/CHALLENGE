import {
  BookOpen,
  CalendarCheck,
  Check,
  CircleDashed,
  Clock3,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  HeartHandshake,
  House,
  Minus,
  Moon,
  PiggyBank,
  Rocket,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
  Trophy,
  Utensils,
  Wine,
  X,
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

export const TONE: Record<
  Tone,
  { cell: string; icon: LucideIcon | null; words: string }
> = {
  done: {
    cell: 'bg-nx-done-soft text-nx-done',
    icon: Check,
    words: 'done',
  },
  missed: {
    cell: 'bg-nx-missed-soft text-nx-missed',
    icon: X,
    words: 'missed',
  },
  review: {
    cell: 'bg-nx-wait-soft text-nx-wait',
    icon: Clock3,
    words: 'waiting for review',
  },
  disputed: {
    cell: 'bg-nx-wait-soft text-nx-wait',
    icon: TriangleAlert,
    words: 'disputed',
  },
  excused: {
    cell: 'bg-nx-excused-soft text-nx-excused',
    icon: HeartHandshake,
    words: 'forgiven',
  },
  open: {
    cell: 'bg-nx-accent-soft text-nx-accent ring-2 ring-inset ring-nx-accent',
    icon: CircleDashed,
    words: 'open to log',
  },
  none: {
    cell: 'bg-nx-sunken text-nx-ink-2',
    icon: Minus,
    words: 'no visit',
  },
  ahead: {
    cell: 'bg-nx-ahead-soft text-nx-ahead',
    icon: null,
    words: 'not yet',
  },
};

/** Today in a calendar: not loggable yet, so marked rather than coloured. */
export const TODAY_CELL =
  'bg-nx-ahead-soft text-nx-accent ring-1 ring-inset ring-nx-accent-line';

/** The calendar's legend, in reading order. */
export const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'done', label: 'Done' },
  { tone: 'missed', label: 'Missed' },
  { tone: 'review', label: 'Waiting' },
  { tone: 'excused', label: 'Forgiven' },
  { tone: 'open', label: 'Open' },
];

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
  /** Settled days done and missed (weeks, for a weekly rule). */
  done: number;
  missed: number;
  /** done / (done + missed); null before anything settles. */
  rate: number | null;
  current: number;
  best: number;
  unit: 'day' | 'week';
  /** Weekly rules: this week so far. */
  week: ReturnType<typeof weekProgress>;
};

/** Every habit `personId` has, with its hit rate and streak, in the challenge's rule order. */
export function habitStats(w: World, personId: string): HabitStat[] {
  const c = w.challenge,
    yesterday = shift(w.today, -1),
    runs = streaks(w, personId);
  return rulesFor(c, personId).map((rule) => {
    const run = runs.find((s) => s.rule.id === rule.id);
    let done = 0,
      missed = 0;
    if (rule.kind === 'weekly') {
      // Closed weeks that met their target, against closed weeks that fell short.
      for (const week of weeksOf(c)) {
        const need = weekTarget(rule, week, c);
        if (!need || !isClosed(c, week.end, w.now)) continue;
        const have = w.entries.filter(
          (e) =>
            e.personId === personId &&
            e.ruleId === rule.id &&
            e.day >= week.start &&
            e.day <= week.end &&
            countsForWeek(e),
        ).length;
        if (have >= need) done++;
        else missed++;
      }
    } else {
      const { from, to } = ruleSpan(rule, c);
      const end = to < yesterday ? to : yesterday;
      for (let d = from; d <= end; d = shift(d, 1)) {
        if (!appliesOn(rule, d, c)) continue;
        const s = entryPill(w, rule, entryFor(w, personId, rule.id, d), d);
        if (s.status === 'done') done++;
        else if (s.status === 'missed') missed++;
      }
    }
    return {
      rule,
      weekly: rule.kind === 'weekly',
      done,
      missed,
      rate: done + missed ? done / (done + missed) : null,
      current: run?.current ?? 0,
      best: run?.best ?? 0,
      unit: run?.unit ?? 'day',
      week: rule.kind === 'weekly' ? weekProgress(w, personId, rule.id) : null,
    };
  });
}

/** "92%" */
export const percent = (rate: number) => `${Math.round(rate * 100)}%`;

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
