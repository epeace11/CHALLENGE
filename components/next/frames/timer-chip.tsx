'use client';
import { Pause, Timer } from 'lucide-react';
import type { TimerRun } from '@/lib/next/model';
import { formatClock, ruleById, timerSeconds } from '@/lib/next/selectors';
import { useClock } from '@/components/next/clock';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { cn } from '@/lib/utils';

/**
 * The viewer's timer going, in the top bar of every AppFrame page but the Timer page: the clock
 * while it runs ("Arabic · 12:30"), or Paused. One tap opens the Timer page. On phones the rule's
 * name is left out, so the challenge's name and day keep their room. A component of its own, so
 * only it changes each second.
 */
export function TimerChip({ run }: { run: TimerRun }) {
  const world = useWorld();
  const { navigate } = useNav();
  const running = !!run.runningSince;
  const { now } = useClock(running);
  const rule = ruleById(world.challenge, run.ruleId);
  const name = rule ? rule.title.split(', ')[0] : '';
  return (
    <button
      type="button"
      // A name that doesn't change each second, so a screen reader doesn't read the clock out as it
      // ticks; the time itself is on the Timer page.
      aria-label={`Timer${name ? `, ${name}` : ''}, ${running ? 'running' : 'paused'}`}
      // The pill is 32px tall; the button around it is the 44px target.
      className="group nx-press inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full"
      onClick={() => navigate('timer')}
    >
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-nx-2 font-semibold whitespace-nowrap tabular-nums transition-colors duration-200 ease-nx',
          running
            ? 'border-nx-accent-line bg-nx-accent-soft text-nx-accent group-hover:border-nx-accent'
            : 'border-nx-line-strong bg-nx-surface-2 text-nx-ink-2 group-hover:text-nx-ink',
        )}
      >
        {running ? (
          <Timer size={16} className="shrink-0" />
        ) : (
          <Pause size={16} className="shrink-0" />
        )}
        {name && (
          <>
            <span className="hidden max-w-44 truncate sm:block">{name}</span>
            <span className="hidden sm:block">·</span>
          </>
        )}
        <span>{running ? formatClock(timerSeconds(run, now)) : 'Paused'}</span>
      </span>
    </button>
  );
}
