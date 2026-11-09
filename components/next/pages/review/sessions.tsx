'use client';
import { Timer } from 'lucide-react';
import type {
  DateString,
  Instant,
  Rule,
  TimerSession,
  World,
} from '@/lib/next/model';
import {
  formatMinutes,
  formatTime,
  plural,
  sessionsOf,
  timedMinutes,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';

/**
 * A timed rule's answer says it came from the timer under the answer, and lists the day's sessions
 * where a screenshot would go: each one's start and end and its length.
 */

/** The partner's sessions behind an answer: only for a rule with the timer on. */
export const answerSessions = (
  world: World,
  rule: Rule,
  personId: string,
  day: DateString,
): TimerSession[] =>
  rule.timed ? sessionsOf(world, personId, rule.id, day) : [];

/** "12:05–12:25 pm", or "11:50 am – 12:10 pm" across noon or midnight. */
export function timeRange(start: Instant, end: Instant, timeZone: string) {
  const from = formatTime(start, timeZone),
    to = formatTime(end, timeZone);
  const half = (t: string) => t.slice(-2);
  return half(from) === half(to)
    ? `${from.slice(0, -3)}–${to}`
    : `${from} – ${to}`;
}

/** A session's length in whole minutes, the way its day's answer counts them. */
const lengthOf = (seconds: number) =>
  seconds < 60 ? 'Under 1 min' : formatMinutes(seconds);

/**
 * The line over the sessions: "From the timer: 2 sessions" while the answer is what they add up to
 * (the answer already says the total), else "Timed 30 min in 2 sessions" (changed by hand).
 */
export function sessionsLine(sessions: TimerSession[], value?: number) {
  const seconds = sessions.reduce((sum, s) => sum + s.seconds, 0);
  const count = plural(sessions.length, 'session');
  return value === timedMinutes(seconds)
    ? `From the timer: ${count}`
    : `Timed ${formatMinutes(seconds)} in ${count}`;
}

/**
 * Under the answer, where it came from (like the target line), with the timer's icon. The sessions
 * themselves are listed where a screenshot would be (`SessionList`).
 */
export function SessionsLine({
  sessions,
  value,
}: {
  sessions: TimerSession[];
  /** The answer they are behind. */
  value?: number;
}) {
  if (!sessions.length) return null;
  return (
    <p className="flex items-center gap-1.5 text-nx-2 font-semibold text-nx-ink">
      <Timer size={18} className="shrink-0 text-nx-accent" aria-hidden="true" />
      {sessionsLine(sessions, value)}
    </p>
  );
}

/** Each session's start and end, and its length, as a quiet list. */
export function SessionList({
  sessions,
  timeZone,
  className,
}: {
  sessions: TimerSession[];
  timeZone: string;
  className?: string;
}) {
  if (!sessions.length) return null;
  return (
    <ul
      aria-label="Timer sessions"
      className={cn(
        'flex flex-col rounded-nx bg-nx-sunken px-4 py-1',
        className,
      )}
    >
      {sessions.map((s) => (
        <li
          key={s.id}
          className="flex items-baseline justify-between gap-4 border-b border-nx-line py-1.5 text-nx-body tabular-nums last:border-b-0"
        >
          <span className="min-w-0 text-nx-ink">
            {timeRange(s.startedAt, s.endedAt, timeZone)}
          </span>
          <span className="shrink-0 text-nx-2 text-nx-ink-2">
            {lengthOf(s.seconds)}
          </span>
        </li>
      ))}
    </ul>
  );
}
