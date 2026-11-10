'use client';
import { Timer } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import {
  appliesOn,
  formatNumber,
  loggedProgress,
  timedRules,
  timerDay,
  timerOf,
} from '@/lib/next/selectors';
import { useClock } from '@/components/next/clock';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Enter, RowButton } from '@/components/next/ui';
import { shortTitle } from './data';

/**
 * How far the viewer is today on their timed rules, as one row that opens the Timer page: "Arabic",
 * "12 of 20 min today"; with several, a line each ("Arabic: 12 of 20 min today"). Only stopped
 * sessions count: a timer going adds its time when it stops (the top bar shows its clock meanwhile).
 * Nothing when no rule asked today has the timer on.
 */
export function TimerRow({ index }: { index: number }) {
  const world = useWorld();
  const { navigate } = useNav();
  const me = world.me.id;
  const run = timerOf(world, me);
  const { now } = useClock(!!run?.runningSince);
  // The timer's day: the day a session started counts toward, which can pass midnight while it runs.
  const today = timerDay(world, now);
  const rules = timedRules(world, me).filter(
    (r) => r.id === run?.ruleId || appliesOn(r, today, world.challenge),
  );
  if (!rules.length) return null;

  /**
   * "12 of 20 min today" and "25 min today, target met"; for a limit, "48 min today, 60 or less"
   * and "65 min today, over 60".
   */
  const sofar = (r: Rule) => {
    const p = loggedProgress(world, me, r, today);
    const min = `${p.minutes} min today`;
    if (!p.target) return min;
    const target = formatNumber(p.target.value);
    if (p.limit)
      return p.met ? `${min}, ${target} or less` : `${min}, over ${target}`;
    return p.met ? `${min}, target met` : `${p.minutes} of ${target} min today`;
  };
  const one = rules.length === 1;

  return (
    <Enter index={index}>
      <RowButton
        leading={
          <span className="grid size-10 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
            <Timer size={20} aria-hidden="true" />
          </span>
        }
        title={
          one ? (
            <>
              <span className="sr-only">Timer, </span>
              {shortTitle(rules[0])}
            </>
          ) : (
            'Timer'
          )
        }
        detail={
          one
            ? sofar(rules[0])
            : rules.map((r) => (
                <span key={r.id} className="block">
                  {shortTitle(r)}: {sofar(r)}
                </span>
              ))
        }
        onClick={() => navigate('timer')}
      />
    </Enter>
  );
}
