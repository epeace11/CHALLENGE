'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Instant } from '@/lib/next/model';
import { ms } from '@/lib/next/calendar';
import { useBackend } from './backend';
import { useWorld } from './world';

/** When this page first ran: the preview's sample clock starts at `world.now` and runs in real time from here. */
const opened = typeof performance === 'undefined' ? 0 : performance.now();

/**
 * The time now, for a timer. The live app reads the real clock. The preview's world is frozen
 * (Friday, Nov 20, 7:30 pm), so its clock is that moment plus the real time since the preview opened:
 * a timer started there runs, and the sample world stays the same on every load.
 *
 * `now` (epoch ms) moves on each whole second while `ticking`, and catches up at once when the app
 * comes back from the background. Times on screen are worked out from timestamps (`timerSeconds`),
 * so nothing drifts while the page is hidden. `at()` is the moment to pass to a timer action.
 */
export function useClock(ticking: boolean) {
  const world = useWorld();
  const { live } = useBackend();
  const read = useCallback(
    () => (live ? Date.now() : ms(world.now) + (performance.now() - opened)),
    [live, world.now],
  );
  // The first render uses the world's moment, so the server's HTML and the first client render agree.
  const [now, setNow] = useState(() => ms(world.now));
  useEffect(() => {
    const tick = () => {
      const next = read();
      setNow((was) =>
        Math.floor(next / 1000) === Math.floor(was / 1000) ? was : next,
      );
    };
    tick();
    if (!ticking) return;
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [ticking, read]);
  const at = useCallback((): Instant => new Date(read()).toISOString(), [read]);
  return { now, at };
}
