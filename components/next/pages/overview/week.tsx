'use client';
import { useState, type CSSProperties } from 'react';
import {
  Check,
  CircleDashed,
  Clock3,
  HeartHandshake,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { DateString, DayColor } from '@/lib/next/model';
import { formatDay, formatWeekday } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Avatar, Button, Sheet, StatusPill } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { COLOR_WORDS, dayActions, dayRows, type WeekDay } from './data';

/**
 * This week as a strip: a column per day (Monday to Sunday), with a row for each person coloured
 * by how the day went. Each past day is one button that opens the day sheet with both people's
 * answers. Today and later days are shown but do nothing.
 */

const TONE: Record<DayColor, string> = {
  done: 'bg-nx-done-soft text-nx-done',
  excused: 'bg-nx-excused-soft text-nx-excused',
  missed: 'bg-nx-missed-soft text-nx-missed',
  review: 'bg-nx-wait-soft text-nx-wait',
  open: 'border-[1.5px] border-dashed border-nx-accent-line bg-nx-accent-soft text-nx-accent',
  ahead: 'bg-nx-sunken',
};

const ICON: Partial<Record<DayColor, LucideIcon>> = {
  done: Check,
  excused: HeartHandshake,
  missed: X,
  review: Clock3,
  open: CircleDashed,
};

function Cell({ color }: { color: DayColor }) {
  const Icon = ICON[color];
  return (
    <span
      className={cn(
        'grid h-8 w-full max-w-12 place-items-center rounded-[10px] transition-colors duration-200 ease-nx',
        TONE[color],
      )}
    >
      {Icon && <Icon size={17} strokeWidth={2.5} aria-hidden="true" />}
    </span>
  );
}

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
    `${formatDay(d.day)}. You: ${COLOR_WORDS[d.me].toLowerCase()}. ${world.partner.name}: ${COLOR_WORDS[d.partner].toLowerCase()}.`;
  return (
    <div
      className={cn(
        'grid grid-cols-[32px_repeat(7,minmax(0,1fr))] gap-x-1 sm:gap-x-2',
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
        <Avatar person={world.me} size="sm" decorative />
        <Avatar person={world.partner} size="sm" decorative />
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
                  ? 'text-nx-on-accent [background:var(--nx-primary)]'
                  : 'text-nx-ink',
              )}
            >
              {d.date}
            </span>
            <Cell color={d.me} />
            <Cell color={d.partner} />
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

/** What the colours mean, only for the ones on screen. */
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
      {shown.map((c) => {
        const Icon = ICON[c]!;
        return (
          <li key={c} className="flex items-center gap-1.5">
            <span
              className={cn(
                'grid size-5 place-items-center rounded-md',
                TONE[c],
              )}
            >
              <Icon size={13} strokeWidth={2.6} />
            </span>
            {COLOR_WORDS[c]}
          </li>
        );
      })}
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
            const mine = p.id === world.me.id;
            return (
              <section key={p.id} aria-label={mine ? 'You' : p.name}>
                <h3 className="flex items-center gap-2.5 font-nx-serif text-nx-h3">
                  <Avatar person={p} size="sm" decorative />
                  {mine ? 'You' : p.name}
                </h3>
                <ul className="mt-1 divide-y divide-nx-line">
                  {rows.map((r) => (
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
              </section>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
