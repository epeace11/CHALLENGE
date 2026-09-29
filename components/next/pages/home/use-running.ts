'use client';
import { useWorld } from '@/components/next/world';
import {
  checkinProgress,
  dayNumber,
  formatDuration,
  formatRange,
  formatWeekday,
  lastDay,
  reviewQueue,
  timeLeft,
} from '@/lib/next/selectors';

/** The running challenge as Your challenges shows it: its day, what is left to log and what waits for review. */
export function useRunning() {
  const world = useWorld();
  const c = world.challenge;
  const progress = checkinProgress(world, world.me.id);
  const waiting = reviewQueue(world, world.me.id).count;
  const day = progress.day;
  return {
    name: c.name,
    range: formatRange(c.start, lastDay(c)),
    day: dayNumber(c, world.today),
    days: c.days,
    left: progress.left,
    /** The open day: "Thursday". */
    openDay: day ? formatWeekday(day) : null,
    /** "4h 29m left" to log it. */
    leftHint: !day
      ? 'Nothing to log'
      : progress.left
        ? `${formatDuration(timeLeft(world, day))} left`
        : `All logged`,
    waiting,
    waitingHint: waiting ? `From ${world.partner.name}` : 'Nothing waiting',
  };
}
