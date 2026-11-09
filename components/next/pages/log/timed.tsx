'use client';
import type { Instant, Rule } from '@/lib/next/model';
import {
  formatMinutes,
  formatTime,
  formatWeekday,
  isAnswered,
  plural,
} from '@/lib/next/selectors';
import { Button, Sheet } from '@/components/next/ui';
import { shortTitle } from './end';
import type { Checkin } from './use-checkin';

/** "7:00–7:18 am", or "11:50 am – 12:10 pm" across noon or midnight. */
function timeRange(start: Instant, end: Instant, timeZone: string) {
  const from = formatTime(start, timeZone),
    to = formatTime(end, timeZone);
  const half = (t: string) => t.slice(-2);
  return half(from) === half(to)
    ? `${from.slice(0, -3)}–${to}`
    : `${from} – ${to}`;
}

/**
 * Under a timed rule's number, where it came from: "From the timer: 30 min in 2 sessions" (saved by
 * itself, or filled in from the sessions before an answer is saved), or "Timed 30 min in 2
 * sessions" once it was saved by hand. Null for a day with no sessions.
 */
export function timedLine(ci: Checkin, rule: Rule) {
  const timed = ci.timedOf(rule);
  if (!timed) return null;
  const entry = ci.entryOf(rule);
  const total = `${formatMinutes(timed.seconds)} in ${plural(timed.sessions.length, 'session')}`;
  return isAnswered(entry) && !entry?.fromTimer
    ? `Timed ${total}`
    : `From the timer: ${total}`;
}

/** The day's timer sessions on a rule, each with its start, end and length. */
export function TimedSheet({
  ci,
  rule,
  open,
  onOpenChange,
}: {
  ci: Checkin;
  rule: Rule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const timed = ci.timedOf(rule);
  const zone = ci.world.challenge.timeZone;
  return (
    <Sheet
      open={open && !!timed}
      onOpenChange={onOpenChange}
      title={`${shortTitle(rule)} on ${ci.day ? formatWeekday(ci.day) : ''}`}
      footer={
        <Button variant="primary" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <ul className="flex flex-col rounded-nx bg-nx-sunken px-4 py-1">
        {timed?.sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-baseline justify-between gap-4 border-b border-nx-line py-3 text-nx-body tabular-nums last:border-b-0"
          >
            <span className="min-w-0 text-nx-ink">
              {timeRange(s.startedAt, s.endedAt, zone)}
            </span>
            <span className="shrink-0 text-nx-2 text-nx-ink-2">
              {s.seconds < 60 ? 'Under 1 min' : formatMinutes(s.seconds)}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
