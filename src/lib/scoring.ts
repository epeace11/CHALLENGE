/**
 * Pure, timezone-aware scoring and calendar helpers. No I/O.
 *
 * Dates are ISO calendar dates (YYYY-MM-DD) in the challenge timezone.
 * Instants are ISO timestamps or luxon DateTimes.
 */
import { DateTime, Interval } from "luxon";
import type { Challenge, Rule, UserSlug } from "./types";

export const DEFAULT_TZ = "America/Toronto";

/** Total owed for n unforgiven points: the n-th point costs $n. */
export function dollarsFor(points: number): number {
  const n = Math.max(0, Math.floor(points));
  return (n * (n + 1)) / 2;
}

/** Weekly rule shortfall: max(0, target − done). */
export function weeklyShortfall(target: number, doneCount: number): number {
  return Math.max(0, target - doneCount);
}

/** Today's calendar date in the zone. */
export function todayIn(tz: string, now: DateTime = DateTime.now()): string {
  return now.setZone(tz).toISODate()!;
}

/** Does a rule apply to this user on this date? */
export function ruleAppliesTo(rule: Rule, slug: UserSlug, date: string): boolean {
  if (rule.applies_to !== "both" && rule.applies_to !== slug) return false;
  if (rule.cadence === "weekly") return true;
  const dow = DateTime.fromISO(date).weekday % 7; // luxon: 1=Mon..7=Sun → 0=Sun..6=Sat
  return rule.active_days.includes(dow);
}

/** The instant a logged day locks: deadline time on the following day. */
export function lockAt(challenge: Pick<Challenge, "timezone" | "log_deadline_time">, date: string): DateTime {
  const [h, m] = challenge.log_deadline_time.split(":").map(Number);
  return DateTime.fromISO(date, { zone: challenge.timezone })
    .plus({ days: 1 })
    .set({ hour: h, minute: m ?? 0, second: 0, millisecond: 0 });
}

export function isLocked(
  challenge: Pick<Challenge, "timezone" | "log_deadline_time">,
  date: string,
  now: DateTime = DateTime.now(),
  reopenUntil?: string | null,
): boolean {
  if (reopenUntil && now < DateTime.fromISO(reopenUntil)) return false;
  return now >= lockAt(challenge, date);
}

/**
 * Which day the log form should default to: yesterday until the deadline
 * passes, then today. Clamped to the challenge range.
 */
export function defaultLogDate(challenge: Challenge, now: DateTime = DateTime.now()): string {
  const local = now.setZone(challenge.timezone);
  const today = local.toISODate()!;
  const yesterday = local.minus({ days: 1 }).toISODate()!;
  const candidate = isLocked(challenge, yesterday, now) ? today : yesterday;
  return clampDate(candidate, challenge.start_date, challenge.end_date);
}

export function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

/** Every date from start to end inclusive. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  let d = DateTime.fromISO(start);
  const last = DateTime.fromISO(end);
  while (d <= last) {
    out.push(d.toISODate()!);
    d = d.plus({ days: 1 });
  }
  return out;
}

/** Sunday..Saturday bounds of the week containing `date`. */
export function weekBounds(date: string): { start: string; end: string } {
  const d = DateTime.fromISO(date);
  const dow = d.weekday % 7; // 0 = Sunday
  const start = d.minus({ days: dow });
  return { start: start.toISODate()!, end: start.plus({ days: 6 }).toISODate()! };
}

/**
 * Weeks (Sun→Sat) overlapping the challenge, clipped to its start/end.
 * The last one is the final partial week assessed at challenge end.
 */
export function challengeWeeks(challenge: Pick<Challenge, "start_date" | "end_date">): { start: string; end: string }[] {
  const weeks: { start: string; end: string }[] = [];
  let cursor = challenge.start_date;
  while (cursor <= challenge.end_date) {
    const { end } = weekBounds(cursor);
    const clippedEnd = end < challenge.end_date ? end : challenge.end_date;
    weeks.push({ start: cursor, end: clippedEnd });
    cursor = DateTime.fromISO(clippedEnd).plus({ days: 1 }).toISODate()!;
  }
  return weeks;
}

/** Days remaining in the challenge including today (0 once it has ended). */
export function daysRemaining(challenge: Challenge, now: DateTime = DateTime.now()): number {
  const today = DateTime.fromISO(todayIn(challenge.timezone, now));
  const end = DateTime.fromISO(challenge.end_date);
  const diff = Math.floor(Interval.fromDateTimes(today, end).length("days")) + 1;
  return Math.max(0, Number.isFinite(diff) ? diff : 0);
}

export function formatDate(date: string, format = "EEE MMM d"): string {
  return DateTime.fromISO(date).toFormat(format);
}

export function formatInstant(iso: string, tz: string, format = "MMM d, h:mm a"): string {
  return DateTime.fromISO(iso).setZone(tz).toFormat(format);
}

export function money(n: number): string {
  return `$${n.toLocaleString("en-CA")}`;
}
