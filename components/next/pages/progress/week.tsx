'use client';
import type { DateString, Rule, World } from '@/lib/next/model';
import {
  dateRange,
  formatDayShort,
  weekday,
  type Week,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { TODAY_CELL, TONE, habitDays } from './data';
import styles from './progress.module.css';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * One week of one habit for one person: seven marks in the challenge's week order, each coloured by
 * its tone with an icon and the weekday's letter, so colour is never the only signal. Settled and
 * open days are 48px buttons that open the day; days ahead are marked, days the habit skips are
 * faint, and days outside the challenge are left empty.
 */
export function WeekMarks({
  world,
  personId,
  rule,
  week,
  onOpen,
  label,
}: {
  world: World;
  personId: string;
  rule: Rule;
  week: Week;
  onOpen: (day: DateString) => void;
  /** Names the row for screen readers ("Your week"). */
  label: string;
}) {
  const c = world.challenge;
  const byDay = new Map(
    habitDays(world, personId, rule)
      .filter((d) => d.day >= week.start && d.day <= week.end)
      .map((d) => [d.day, d]),
  );
  // A partial week keeps its days in their weekday columns.
  const lead = (weekday(week.start) - c.weekStart + 7) % 7;
  const slots: (DateString | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...dateRange(week.start, week.end),
  ];
  while (slots.length < 7) slots.push(null);
  return (
    <ul className={styles.marks} aria-label={label}>
      {slots.map((day, i) => {
        if (!day) return <li key={`empty-${i}`} aria-hidden="true" />;
        const d = byDay.get(day);
        const letter = LETTER[weekday(day)];
        if (!d || d.tone === null)
          return (
            <li
              key={day}
              className={cn(
                styles.mark,
                'bg-nx-sunken text-nx-ink-2 opacity-45',
              )}
            >
              <span aria-hidden="true">{letter}</span>
              <span className="sr-only">{`${formatDayShort(day)}: not asked`}</span>
            </li>
          );
        const tone = TONE[d.tone];
        const Icon = tone.icon;
        const isToday = day === world.today;
        const words = `${formatDayShort(day)}: ${isToday ? 'today' : d.label || tone.words}`;
        const inside = (
          <>
            <span aria-hidden="true">{letter}</span>
            {Icon ? (
              <Icon size={15} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  isToday ? 'bg-nx-accent' : 'bg-transparent',
                )}
                aria-hidden="true"
              />
            )}
            <span className="sr-only">{words}</span>
          </>
        );
        return (
          <li key={day} className="flex min-w-0 flex-col">
            {d.tone === 'ahead' ? (
              <span
                className={cn(styles.mark, isToday ? TODAY_CELL : tone.cell)}
              >
                {inside}
              </span>
            ) : (
              <button
                type="button"
                className={cn(styles.mark, tone.cell)}
                onClick={() => onOpen(day)}
              >
                {inside}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
