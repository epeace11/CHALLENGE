'use client';
import { useState } from 'react';
import type { Rule } from '@/lib/next/model';
import {
  pauseTimer,
  removeSession,
  resumeTimer,
  setTimed,
  startTimer,
  stopTimer,
} from '@/lib/next/actions';
import {
  appliesOn,
  loggedSeconds,
  sessionsOf,
  timeableRules,
  timedDays,
  timedProgress,
  timedRules,
  timerDay,
  timerOf,
  timerSeconds,
} from '@/lib/next/selectors';
import { useBackend } from '@/components/next/backend';
import { useClock } from '@/components/next/clock';
import { useWorld } from '@/components/next/world';

/**
 * Everything a Timer version does, for the viewer (`world.me`). Shared by every version; each
 * version only lays it out. Times come from timestamps, so they stay right on another page, in the
 * background, or after the phone sleeps. Every change shows at once (no pop-ups); the live app
 * saves it, and a failed write says so and puts the page back.
 *
 * - `rule` is the rule on screen: the one being timed; else the one picked; else the first not yet
 *   at its target today; else the first.
 * - `today` is the timer's day (the day a session started on is the day it counts toward).
 * - A day's total becomes that day's answer by itself once the day is over (the live app's database
 *   does it), and the partner reviews it with its sessions. It can still be changed on Check in.
 */
export function useTimer() {
  const world = useWorld();
  const backend = useBackend();
  const me = world.me.id;
  const run = timerOf(world, me);
  const { now, at } = useClock(!!run?.runningSince);
  const today = timerDay(world, now);
  const rules = timedRules(world, me);
  const [picked, setPicked] = useState<string | null>(null);

  /** Where `r` stands today: seconds, minutes, target, diff (past or short of it), met, limit. */
  const todayOf = (r: Rule) => timedProgress(world, me, r, today, now);
  const rule =
    (run && rules.find((r) => r.id === run.ruleId)) ||
    rules.find((r) => r.id === picked) ||
    rules.find((r) => !todayOf(r).met) ||
    rules[0] ||
    null;

  return {
    world,
    /** Epoch ms, moving each second while a timer runs. */
    now,
    today,
    /** The viewer's rules with the timer on. */
    rules,
    rule,
    /** Shows another timed rule (while nothing is being timed). */
    pick: (ruleId: string) => setPicked(ruleId),
    todayOf,
    /** The viewer's timer going (running or paused), on whichever rule; null when none. */
    run,
    running: !!run?.runningSince,
    paused: !!run && !run.runningSince,
    /** Seconds on the clock of the session going (0 when none). */
    elapsed: run ? timerSeconds(run, now) : 0,
    /** Today for the rule on screen, the session going included. */
    progress: rule ? todayOf(rule) : null,
    /** The rule on screen asks something today. Time on another day is kept but isn't an answer. */
    asksToday: !!rule && appliesOn(rule, today, world.challenge),
    /**
     * Today's stopped sessions on the rule on screen, in seconds: what is logged so far. A session
     * still going counts once it stops.
     */
    logged: rule ? loggedSeconds(world, me, rule.id, today) : 0,
    /** Today's finished sessions on the rule on screen, oldest first. */
    sessions: rule ? sessionsOf(world, me, rule.id, today) : [],
    /** Each day of the rule on screen so far, newest first: seconds, sessions and the answer saved. */
    history: rule ? timedDays(world, me, rule, now) : [],
    /** The viewer's rules counted in minutes that the timer could be turned on for. */
    timeable: timeableRules(world, me),

    /** Starts timing `ruleId` (the rule on screen by default). A timer already going stops and is saved. */
    start: (ruleId: string | undefined = rule?.id) => {
      if (!ruleId) return;
      const t = at();
      setPicked(ruleId);
      backend.act({ type: 'startTimer', ruleId }, (w) =>
        startTimer(w, me, ruleId, t),
      );
    },
    pause: () => {
      const t = at();
      backend.act({ type: 'pauseTimer' }, (w) => pauseTimer(w, me, t));
    },
    resume: () => {
      const t = at();
      backend.act({ type: 'resumeTimer' }, (w) => resumeTimer(w, me, t));
    },
    /** Stops the timer and saves its time as a session toward the day it started. */
    stop: () => {
      const t = at();
      backend.act({ type: 'stopTimer' }, (w) => stopTimer(w, me, t));
    },
    /** Takes away a session timed by mistake. */
    remove: (sessionId: string) =>
      backend.act({ type: 'removeSession', sessionId }, (w) =>
        removeSession(w, sessionId),
      ),
    /** Turns the timer on or off for a rule counted in minutes; turning it off saves a timer going on it. */
    setTimed: (ruleId: string, timed: boolean) => {
      const t = at();
      backend.act({ type: 'setTimed', ruleId, timed }, (w) =>
        setTimed(w, ruleId, timed, t),
      );
    },
  };
}

export type TimerFlow = ReturnType<typeof useTimer>;
