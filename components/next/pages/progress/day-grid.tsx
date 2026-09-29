'use client';
import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import type { DateString, Weekday } from '@/lib/next/model';
import { formatDay, weekday } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { BADGE_ICON, TODAY_CELL, TONE, type Tone } from './data';
import styles from './progress.module.css';

const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export type GridDay = {
  day: DateString;
  /** Null on days with nothing asked: shown faint, not tappable. */
  tone: Tone | null;
  /** Words for screen readers after the date ("Missed"); the tone's words by default. */
  label?: string;
};

/**
 * Days in week rows (the challenge's weeks start on `weekStart`), each coloured by its tone with an
 * icon, so colour is never the only signal. Days that can be opened are buttons at least 50px tall;
 * days still ahead and today are marked, not tappable. Rows fade in one after another.
 */
export function DayGrid({
  days,
  weekStart,
  today,
  marked,
  onOpen,
  label,
  className,
}: {
  days: GridDay[];
  weekStart: Weekday;
  today: DateString;
  /** A day to ring, such as the day this grid was opened from. */
  marked?: DateString;
  onOpen: (day: DateString) => void;
  /** Names the grid for screen readers ("Your calendar"). */
  label: string;
  className?: string;
}) {
  if (days.length === 0) return null;
  const lead = (weekday(days[0].day) - weekStart + 7) % 7;
  const order = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  return (
    <fieldset className={cn('min-w-0', className)}>
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
          const date = Number(d.day.slice(8));
          const month =
            date === 1 ? MONTH[Number(d.day.slice(5, 7)) - 1] : null;
          if (d.tone === null)
            return (
              <span
                key={d.day}
                aria-hidden="true"
                className={cn(styles.cell, 'text-nx-ink-2 opacity-45')}
                style={style}
              >
                {date}
              </span>
            );
          const tone = TONE[d.tone];
          const Icon = tone.icon;
          const isToday = d.day === today;
          const words = `${formatDay(d.day)}: ${isToday ? 'today' : (d.label ?? tone.words)}`;
          const inside = (
            <>
              <span aria-hidden="true">{date}</span>
              {Icon ? (
                <Icon size={15} strokeWidth={2.6} aria-hidden="true" />
              ) : isToday ? (
                <span
                  className="size-1.5 rounded-full bg-nx-accent"
                  aria-hidden="true"
                />
              ) : month ? (
                <span className="text-nx-min font-semibold" aria-hidden="true">
                  {month}
                </span>
              ) : null}
              <span className="sr-only">{words}</span>
            </>
          );
          if (d.tone === 'ahead')
            return (
              <span
                key={d.day}
                className={cn(styles.cell, isToday ? TODAY_CELL : tone.cell)}
                style={style}
              >
                {inside}
              </span>
            );
          return (
            <button
              key={d.day}
              type="button"
              className={cn(styles.cell, tone.cell)}
              style={style}
              data-marked={marked === d.day || undefined}
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

/** What the colours mean: a swatch with the same icon as the grid, and a word. */
export function Legend({
  tones,
  className,
}: {
  tones: { tone: Tone; label: string }[];
  className?: string;
}) {
  // Size and colour stay outside cn(): tailwind-merge reads text-nx-2 and text-nx-ink-2 as one group.
  return (
    <ul
      className={`text-nx-2 text-nx-ink-2 ${cn('flex flex-wrap gap-x-4 gap-y-2', className)}`}
    >
      {tones.map(({ tone, label }) => {
        const Icon = TONE[tone].icon;
        return (
          <li key={tone} className="inline-flex items-center gap-2">
            <span
              className={cn(
                'inline-grid size-6 place-items-center rounded-md',
                TONE[tone].cell,
              )}
              aria-hidden="true"
            >
              {Icon && <Icon size={13} strokeWidth={2.8} />}
            </span>
            {label}
          </li>
        );
      })}
    </ul>
  );
}

/** A badge as a medal: the accent once earned, a dashed ring until then. Decorative. */
export function Medal({
  id,
  earned,
  size = 48,
  className,
}: {
  id: string;
  earned: boolean;
  size?: number;
  className?: string;
}) {
  const Icon = BADGE_ICON[id] ?? Sparkles;
  return (
    <span
      className={cn(styles.medal, className)}
      data-earned={earned}
      style={{ ['--medal' as string]: `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.9} />
    </span>
  );
}
