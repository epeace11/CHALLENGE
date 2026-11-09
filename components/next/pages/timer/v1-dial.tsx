// Version 1's dial: today's time as a stopwatch, inside a ring that closes at the day's target.
'use client';
import type { ReactNode } from 'react';
import type { TimerFlow } from './use-timer';
import { formatClock, formatNumber } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import styles from './v1.module.css';

type Progress = NonNullable<TimerFlow['progress']>;

/** Whole minutes in the rule's own unit, as its title says them: "20 min", "60 min", "90 min". */
export const min = (n: number) => `${formatNumber(n)} min`;

/** How the ring reads: on the way, at or past the target (good), or past a limit (bad). */
export function toneOf(p: Progress): 'accent' | 'done' | 'missed' {
  if (p.limit) return p.met ? 'accent' : 'missed';
  return p.met ? 'done' : 'accent';
}

/** Whole minutes past the target (past a limit, for an "or less" rule); 0 when not past it. */
export function overOf(p: Progress) {
  if (!p.target) return 0;
  return Math.max(0, p.minutes - p.target.value);
}

/**
 * The dial: the day's time on the clock (earlier sessions plus the one going), with the target
 * under it. The ring fills toward the target, turns the done colour once it is reached (the
 * missed colour once a limit is passed), and time past it goes round again on top, darker.
 */
export function Dial({
  progress: p,
  state,
  label,
  status,
}: {
  progress: Progress;
  state: 'idle' | 'running' | 'paused';
  /** What the ring measures, for screen readers: "Arabic today". */
  label: string;
  /** The third line: the session going, or what's left to go. */
  status?: ReactNode;
}) {
  const tone = toneOf(p);
  const over = overOf(p);
  const target = p.target?.value ?? 0;
  const share = p.targetSeconds ? Math.min(1, p.seconds / p.targetSeconds) : 0;
  // Past the target (or past a limit), the extra time laps the ring again, a full lap per target.
  const past = p.limit ? !p.met : p.met;
  const extra = past ? (p.seconds - p.targetSeconds) / p.targetSeconds : 0;
  const lap = extra > 0 ? extra % 1 || 1 : 0;
  const clock = formatClock(p.seconds);

  const of = min(target);
  const words = p.limit
    ? over > 0
      ? `${min(p.minutes)}, ${min(over)} over your ${of} limit`
      : `${min(p.minutes)} of your ${of} limit`
    : p.met
      ? `${min(p.minutes)}, your ${of} reached${over > 0 ? ` and ${min(over)} over` : ''}`
      : `${min(p.minutes)} of ${of}`;

  return (
    <div
      className={styles.dial}
      data-tone={tone}
      data-state={state}
      data-over={lap > 0 || undefined}
    >
      {/* The ring and clock are drawn for the eye; screen readers get the minutes as a bar. */}
      <progress
        className="sr-only"
        aria-label={label}
        aria-valuetext={words}
        max={target || 1}
        value={Math.min(p.minutes, target)}
      />
      <svg className={styles.ring} viewBox="0 0 200 200" aria-hidden="true">
        <g transform="rotate(-90 100 100)">
          <circle className={styles.track} cx="100" cy="100" r="92" />
          <circle
            className={styles.arc}
            cx="100"
            cy="100"
            r="92"
            pathLength={100}
            strokeDashoffset={100 - share * 100}
            data-empty={share === 0 || undefined}
          />
          <circle
            className={styles.lap}
            cx="100"
            cy="100"
            r="92"
            pathLength={100}
            strokeDashoffset={100 - lap * 100}
            data-empty={lap === 0 || undefined}
          />
        </g>
      </svg>
      <div className={styles.face}>
        <span
          className={styles.digits}
          data-long={clock.length > 5 || undefined}
          aria-hidden="true"
        >
          {clock}
        </span>
        <span aria-hidden="true" className="contents">
          <FaceLine progress={p} tone={tone} over={over} target={target} />
        </span>
        <span className="mt-1 flex min-h-[22px] items-center justify-center gap-2 text-nx-2 text-nx-ink-2">
          {status}
        </span>
      </div>
    </div>
  );
}

/** Under the clock: the target, or how far past it ("+10 min over your 20"). */
function FaceLine({
  progress: p,
  tone,
  over,
  target,
}: {
  progress: Progress;
  tone: 'accent' | 'done' | 'missed';
  over: number;
  target: number;
}) {
  const line = 'text-nx-2 text-nx-ink-2';
  if (over > 0 && tone !== 'accent')
    return (
      <span
        className={cn(
          line,
          'flex flex-wrap items-center justify-center gap-x-1.5',
        )}
      >
        <span className={styles.over} data-tone={tone}>
          +{min(over)}
        </span>
        <span>{p.limit ? 'over your limit' : `over your ${target}`}</span>
      </span>
    );
  if (p.limit) return <span className={line}>of your {min(target)} limit</span>;
  if (p.met)
    return (
      <span className={cn(line, 'font-semibold text-nx-done')}>
        {min(target)} reached
      </span>
    );
  return <span className={line}>of {min(target)}</span>;
}
