'use client';
import type { CSSProperties } from 'react';
import type { DateString, DayColor, Weekday } from '@/lib/next/model';
import { formatDay, weekday } from '@/lib/next/selectors';
import { DayIcon, type DayTone } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import styles from './progress.module.css';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A square's tone: a calendar day's, or a habit's day (disputed days take the waiting colour; 'off'
 * is a day the habit doesn't ask for). The kit's day tones.
 */
export type SquareTone = DayTone;

/** What each colour means, in the order of the bars. One list for the calendar and the bars. */
export const SIMPLE_LEGEND: { tone: SquareTone; label: string }[] = [
  { tone: 'done', label: 'Done' },
  { tone: 'excused', label: 'Forgiven' },
  { tone: 'missed', label: 'Missed' },
  { tone: 'review', label: 'Waiting' },
  { tone: 'open', label: 'Open' },
  { tone: 'ahead', label: 'Not yet' },
];

/** Only in a weekly habit's calendar: days without a visit, which cost nothing. */
const NO_VISIT = { tone: 'none' as const, label: 'No visit' };

const WORDS: Record<SquareTone, string> = {
  ...(Object.fromEntries(
    SIMPLE_LEGEND.map((l) => [l.tone, l.label.toLowerCase()]),
  ) as Record<DayColor, string>),
  disputed: 'disputed',
  none: 'no visit',
  off: 'not asked that day',
};

/**
 * The challenge's days in week rows, each a day square with its date and the status icon under it.
 * Settled and open days are buttons (48px tall, 56px from 640px) that open the day; days still
 * ahead and today are not. Rows fade in one after another.
 */
export function SimpleMonth({
  days,
  weekStart,
  today,
  label,
  marked,
  onOpen,
}: {
  days: { day: DateString; color: SquareTone }[];
  weekStart: Weekday;
  today: DateString;
  /** A day to ring, such as the day the calendar was opened from. */
  marked?: DateString;
  /** Names the calendar for screen readers ("Your calendar"). */
  label: string;
  onOpen: (day: DateString) => void;
}) {
  if (days.length === 0) return null;
  const lead = (weekday(days[0].day) - weekStart + 7) % 7;
  const order = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className={styles.grid} aria-hidden="true">
        {order.map((d, i) => (
          <span key={i} className={styles.weekday}>
            {LETTER[d]}
          </span>
        ))}
      </div>
      <div className={cn(styles.grid, 'mt-1')}>
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} aria-hidden="true" />
        ))}
        {days.map((d, i) => {
          const style = {
            ['--row' as string]: Math.floor((lead + i) / 7),
          } as CSSProperties;
          const isToday = d.day === today;
          const inside = (
            <>
              <span aria-hidden="true">{Number(d.day.slice(8))}</span>
              <DayIcon tone={d.color} size={14} />
              <span className="sr-only">
                {`${formatDay(d.day)}: ${isToday ? 'today' : WORDS[d.color]}`}
              </span>
            </>
          );
          if (d.color === 'ahead' || d.color === 'off')
            return (
              <span
                key={d.day}
                className={cn('nx-day', styles.square)}
                data-tone="ahead"
                data-today={isToday || d.day === marked || undefined}
                style={style}
              >
                {inside}
              </span>
            );
          return (
            <button
              key={d.day}
              type="button"
              className={cn('nx-day', styles.square)}
              data-tone={d.color}
              data-today={isToday || d.day === marked || undefined}
              style={style}
              onClick={() => onOpen(d.day)}
            >
              {inside}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The one legend: a small day square of each tone, with its icon, and its word. */
export function SimpleLegend({
  tones,
  className,
}: {
  /** Only these colours, for a calendar that doesn't use them all (a habit's). */
  tones?: Set<SquareTone>;
  className?: string;
}) {
  const items = tones
    ? [
        ...SIMPLE_LEGEND.filter((l) => tones.has(l.tone)),
        ...(tones.has('none') ? [NO_VISIT] : []),
      ]
    : SIMPLE_LEGEND;
  // Size and colour stay outside cn(): tailwind-merge reads text-nx-2 and text-nx-ink-2 as one group.
  return (
    <ul
      className={`text-nx-2 text-nx-ink-2 ${cn('flex flex-wrap gap-x-4 gap-y-2', className)}`}
    >
      {items.map(({ tone, label }) => (
        <li key={tone} className="inline-flex items-center gap-2">
          <span
            className={cn('nx-day', styles.swatch)}
            data-tone={tone}
            aria-hidden="true"
          >
            <DayIcon tone={tone} size={12} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
