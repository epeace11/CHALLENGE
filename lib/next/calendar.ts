import type { Challenge, DateString, Instant, Rule, Weekday } from './model.ts';

/**
 * Date maths for The Challenge. Calendar dates are 'YYYY-MM-DD' strings in the challenge's time
 * zone; instants are ISO strings or epoch milliseconds. Nothing here reads the clock: callers pass
 * `now` (the sample world's `now`), so every result is deterministic.
 */

const DAY = 864e5;

/** Epoch milliseconds of an instant. */
export const ms = (t: Instant | number) =>
  typeof t === 'number' ? t : Date.parse(t);

/** `date` moved by `n` days. */
export function shift(date: DateString, n: number): DateString {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (date: DateString) =>
  new Date(date + 'T12:00:00Z').getUTCDay() as Weekday;

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: DateString, b: DateString) =>
  Math.round(
    (Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY,
  );

/** Every date from `from` to `to`, both included. */
export function dateRange(from: DateString, to: DateString): DateString[] {
  const out: DateString[] = [];
  for (let d = from; d <= to; d = shift(d, 1)) out.push(d);
  return out;
}

/** The challenge's last day. */
export const lastDay = (c: Pick<Challenge, 'start' | 'days'>) =>
  shift(c.start, c.days - 1);

/** Every day of the challenge. */
export const challengeDays = (c: Pick<Challenge, 'start' | 'days'>) =>
  dateRange(c.start, lastDay(c));

/** The calendar date at `instant` in `timeZone`. */
export function dateIn(timeZone: string, instant: Instant | number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms(instant)));
}

/** Epoch milliseconds of wall-clock `time` ('HH:MM', 24-hour) on `date` in `timeZone`, daylight saving included. */
export function zonedTime(date: DateString, time: string, timeZone: string) {
  const [y, mo, d] = date.split('-').map(Number),
    [h, mi] = time.split(':').map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      parts.formatToParts(new Date(guess)).map((x) => [x.type, x.value]),
    );
    const shown = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour % 24,
      +p.minute,
    );
    if (shown === wanted) break;
    guess += wanted - shown;
  }
  return guess;
}

/** When logging for `day` closes: the deadline's time, `daysAfter` days later, in the challenge's time zone. */
export const lockTime = (
  c: Pick<Challenge, 'deadline' | 'timeZone'>,
  day: DateString,
) => zonedTime(shift(day, c.deadline.daysAfter), c.deadline.time, c.timeZone);

/** True once `day` can no longer be logged (only late corrections, which need the partner). */
export const isClosed = (
  c: Pick<Challenge, 'deadline' | 'timeZone'>,
  day: DateString,
  now: Instant | number,
) => ms(now) > lockTime(c, day);

/** A rule's first and last day, within the challenge. */
export function ruleSpan(rule: Rule, c: Pick<Challenge, 'start' | 'days'>) {
  const from =
      rule.startsOn && rule.startsOn > c.start ? rule.startsOn : c.start,
    end = lastDay(c),
    to = rule.endsOn && rule.endsOn < end ? rule.endsOn : end;
  return { from, to };
}

/** True when the rule asks something on `day` (its weekday, inside its dates). Ignores who it is for. */
export function appliesOn(
  rule: Rule,
  day: DateString,
  c: Pick<Challenge, 'start' | 'days'>,
) {
  const { from, to } = ruleSpan(rule, c);
  return day >= from && day <= to && rule.days.includes(weekday(day));
}

/** True when `personId` has the rule. */
export const ruleIsFor = (rule: Rule, personId: string) =>
  rule.who === 'both' || rule.who === personId;

/** One week of the challenge, clipped to its dates. `index` counts from 1. */
export type Week = {
  index: number;
  start: DateString;
  end: DateString;
  /** How many of its days fall inside the challenge (7 for a full week). */
  length: number;
};

/** The challenge's weeks, starting on `weekStart`. The first and last can be partial. */
export function weeksOf(
  c: Pick<Challenge, 'start' | 'days' | 'weekStart'>,
): Week[] {
  const out: Week[] = [],
    end = lastDay(c);
  let from = c.start;
  while (from <= end) {
    // Days until the next week begins.
    const gap = (c.weekStart - weekday(from) + 7) % 7 || 7,
      to = shift(from, gap - 1) < end ? shift(from, gap - 1) : end;
    out.push({
      index: out.length + 1,
      start: from,
      end: to,
      length: daysBetween(from, to) + 1,
    });
    from = shift(to, 1);
  }
  return out;
}

/** The week containing `day`, if it is inside the challenge. */
export const weekOf = (
  c: Pick<Challenge, 'start' | 'days' | 'weekStart'>,
  day: DateString,
) => weeksOf(c).find((w) => day >= w.start && day <= w.end);

/**
 * A weekly rule's target in `week`: the full target for a full week, otherwise the share of its
 * days, rounded down (4 a week needs 3 in a 6-day week, 1 in a 2-day week, none in a 1-day week).
 * Only days the rule applies count.
 */
export function weekTarget(
  rule: Rule,
  week: Week,
  c: Pick<Challenge, 'start' | 'days'>,
) {
  const target = rule.weeklyTarget ?? 0;
  const days = dateRange(week.start, week.end).filter((d) =>
    appliesOn(rule, d, c),
  ).length;
  const full = rule.days.length;
  return days >= full ? target : Math.floor((target * days) / full);
}
