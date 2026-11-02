'use client';
import { useState, type CSSProperties } from 'react';
import type { DateString, DayColor, World } from '@/lib/next/model';
import {
  dayColor,
  dayMisses,
  formatDay,
  formatRange,
  formatWeekday,
  missesLine,
  weekOf,
  weekProgress,
} from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Avatar,
  Button,
  DayIcon,
  Sheet,
  StatusPill,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import {
  COLOR_WORDS,
  dayActions,
  dayRows,
  type DayRow,
  type WeekDay,
} from './data';

/**
 * This week as a strip: a column per day (Monday to Sunday), with a day square for each person
 * showing how the day went (the kit's one way to draw a day: colour and icon). Each past day is one
 * button that opens the day sheet with both people's answers. Today and later days are shown but
 * do nothing.
 */

/** One person's day: the day square, and on a missed day how many it missed beside the X. */
function Cell({
  color,
  misses,
}: {
  color: DayColor;
  misses: { missed: number } | null;
}) {
  return (
    <span
      className="nx-day h-8 w-full max-w-12 grid-flow-col gap-0.5 rounded-[10px] text-nx-min font-semibold tabular-nums"
      data-tone={color}
    >
      <DayIcon tone={color} size={misses ? 15 : 17} />
      {misses && <span className="leading-none">{misses.missed}</span>}
    </span>
  );
}

/** What a person's day was, in words: "missed 1 of 8", "done", "waiting". */
const dayWords = (
  color: DayColor,
  misses: { missed: number; due: number } | null,
) =>
  misses
    ? `missed ${misses.missed} of ${misses.due}`
    : COLOR_WORDS[color].toLowerCase();

export function WeekStrip({
  days,
  onOpen,
  className,
}: {
  days: WeekDay[];
  onOpen: (day: DateString) => void;
  className?: string;
}) {
  const world = useWorld();
  const say = (d: WeekDay) =>
    `${formatDay(d.day)}. You: ${dayWords(d.me, d.meMisses)}. ${world.partner.name}: ${dayWords(d.partner, d.partnerMisses)}.`;
  return (
    <div
      className={cn(
        // On phones the strip spans the card's padding and the days touch, so each day is a 44px target.
        'grid grid-cols-[24px_repeat(7,minmax(0,1fr))] sm:grid-cols-[32px_repeat(7,minmax(0,1fr))] sm:gap-x-2',
        className,
      )}
    >
      {/* Whose row is whose. */}
      <div
        className="flex flex-col items-center gap-1.5 py-2"
        aria-hidden="true"
      >
        <span className="h-5" />
        <span className="h-7" />
        {[world.me, world.partner].map((p) => (
          <span key={p.id} className="grid h-8 place-items-center">
            <Avatar
              person={p}
              size="sm"
              decorative
              className="[--nx-avatar:24px] sm:[--nx-avatar:32px]"
            />
          </span>
        ))}
      </div>
      {days.map((d, i) => {
        const inner = (
          <>
            <span
              className={cn(
                'h-5 text-nx-min leading-5',
                d.today ? 'font-semibold text-nx-accent' : 'text-nx-ink-2',
              )}
            >
              {/* One letter on the narrowest phones, where three would touch. */}
              <span className="min-[360px]:hidden">{d.short[0]}</span>
              <span className="hidden min-[360px]:inline">{d.short}</span>
            </span>
            <span
              className={cn(
                'grid h-7 min-w-7 place-items-center rounded-full px-1 text-nx-2 leading-none font-semibold',
                d.today
                  ? 'text-nx-on-accent [background:var(--nx-fill)]'
                  : 'text-nx-ink',
              )}
            >
              {d.date}
            </span>
            <Cell color={d.me} misses={d.meMisses} />
            <Cell color={d.partner} misses={d.partnerMisses} />
          </>
        );
        const style = { ['--nx-i' as string]: i } as CSSProperties;
        const base =
          'nx-enter flex min-w-0 flex-col items-center gap-1.5 rounded-nx-sm pt-2 pr-0.5 pb-2 pl-0.5';
        return d.opens ? (
          <button
            key={d.day}
            type="button"
            className={cn(base, 'nx-press hover:bg-nx-sunken')}
            style={style}
            aria-label={`${say(d)} Open this day.`}
            onClick={() => onOpen(d.day)}
          >
            {inner}
          </button>
        ) : (
          <div key={d.day} className={base} style={style}>
            <span className="sr-only">
              {d.today ? `Today, ${formatDay(d.day)}` : formatDay(d.day)}:
              nothing to show yet.
            </span>
            <span className="contents" aria-hidden="true">
              {inner}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** What the squares mean, only for the ones on screen. */
export function WeekLegend({
  days,
  className,
}: {
  days: WeekDay[];
  className?: string;
}) {
  const shown = (
    ['done', 'excused', 'missed', 'review', 'open'] as DayColor[]
  ).filter((c) => days.some((d) => d.me === c || d.partner === c));
  if (!shown.length) return null;
  return (
    <ul
      className={cn(
        'flex flex-wrap gap-x-4 gap-y-1.5 text-nx-min text-nx-ink-2',
        className,
      )}
      aria-hidden="true"
    >
      {shown.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span className="nx-day size-5 rounded-md" data-tone={c}>
            <DayIcon tone={c} size={12} />
          </span>
          {COLOR_WORDS[c]}
        </li>
      ))}
    </ul>
  );
}

/**
 * Both people's answers on one day, one tap from the week strip. Its one main action is what Maya
 * can do about that day: log it while it is open, or review what waits from it.
 */
export function DaySheet({
  day,
  onClose,
}: {
  day: DateString | null;
  onClose: () => void;
}) {
  const world = useWorld();
  const { navigate } = useNav();
  // Keep showing the last day while the sheet slides away.
  const [shown, setShown] = useState<DateString | null>(day);
  if (day && day !== shown) setShown(day);
  const d = day ?? shown;
  const acts = d ? dayActions(world, d) : { open: 0, review: 0 };
  const people = [world.me, world.partner];

  const footer =
    acts.open > 0 || acts.review > 0 ? (
      <>
        {acts.review > 0 && (
          <Button
            variant={acts.open > 0 ? 'secondary' : 'primary'}
            onClick={() => navigate('review')}
          >
            Review
          </Button>
        )}
        {acts.open > 0 && d && (
          <Button variant="primary" onClick={() => navigate('log')}>
            Log {formatWeekday(d)}
          </Button>
        )}
      </>
    ) : (
      <Button onClick={onClose}>Close</Button>
    );

  return (
    <Sheet
      open={!!day}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={d ? formatDay(d) : 'Day'}
      footer={footer}
    >
      {d && (
        <div className="flex flex-col gap-6">
          {people.map((p) => {
            const rows = dayRows(world, p.id, d);
            // Daily check-ins first (the missed count counts these), then weekly ones by the week.
            const daily = rows.filter((r) => r.rule.kind !== 'weekly');
            const weekly = rows.filter((r) => r.rule.kind === 'weekly');
            const mine = p.id === world.me.id;
            const misses =
              dayColor(world, p.id, d) === 'missed'
                ? dayMisses(world, p.id, d)
                : null;
            return (
              <section key={p.id} aria-label={mine ? 'You' : p.name}>
                <h3 className="flex items-center gap-2.5 font-nx-serif text-nx-h3">
                  <Avatar person={p} size="sm" decorative />
                  {mine ? 'You' : p.name}
                  {misses && (
                    <span className="ml-auto font-nx-sans text-nx-2 font-semibold text-nx-missed">
                      {missesLine(misses)}
                    </span>
                  )}
                </h3>
                <ul className="mt-1 divide-y divide-nx-line">
                  {daily.map((r) => (
                    <li key={r.rule.id} className="flex flex-col gap-2 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <p className="text-nx-body text-nx-ink">{r.title}</p>
                          {r.answer && (
                            <p className="text-nx-2 text-nx-ink-2">
                              {r.answer}
                            </p>
                          )}
                        </div>
                        <StatusPill
                          status={r.pill.status}
                          label={r.pill.label}
                          className="mt-0.5"
                        />
                      </div>
                      {r.said ? (
                        <p className="rounded-nx-sm bg-nx-sunken px-3 py-2 text-nx-2 text-nx-ink">
                          {r.said.by}: “{r.said.text}”
                        </p>
                      ) : (
                        r.note && (
                          <p className="text-nx-2 text-nx-ink-2">
                            Note: {r.note}
                          </p>
                        )
                      )}
                    </li>
                  ))}
                </ul>
                {weekly.length > 0 && (
                  <WeeklyRows personId={p.id} day={d} rows={weekly} />
                )}
              </section>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/** "This week", or the week's dates when the day is in an earlier one: "Nov 9 – 15". */
function weekName(world: World, day: DateString) {
  const week = weekOf(world.challenge, day);
  if (!week) return 'That week';
  return world.today >= week.start && world.today <= week.end
    ? 'This week'
    : formatRange(week.start, week.end);
}

/**
 * A day's weekly check-ins (gym), in their own small group under the daily ones: the week's count
 * ("2 of 4") and that day's answer (Went, No visit).
 */
function WeeklyRows({
  personId,
  day,
  rows,
}: {
  personId: string;
  day: DateString;
  rows: DayRow[];
}) {
  const world = useWorld();
  const name = weekName(world, day);
  return (
    <div className="mt-2 flex flex-col">
      <h4 className="pt-2 font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
        {name}
      </h4>
      <ul className="divide-y divide-nx-line">
        {rows.map((r) => {
          const week = weekProgress(world, personId, r.rule.id, day);
          const label =
            r.pill.status === 'done'
              ? 'Went'
              : r.pill.status === 'none'
                ? 'No visit'
                : r.pill.label;
          return (
            <li key={r.rule.id} className="flex flex-col gap-2 py-3">
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-nx-body text-nx-ink">{r.title}</p>
                  {week && (
                    <p className="text-nx-2 text-nx-ink-2">
                      {week.have} of {week.need}
                    </p>
                  )}
                </div>
                <StatusPill
                  status={r.pill.status}
                  label={label}
                  className="mt-0.5"
                />
              </div>
              {r.said && (
                <p className="rounded-nx-sm bg-nx-sunken px-3 py-2 text-nx-2 text-nx-ink">
                  {r.said.by}: “{r.said.text}”
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
