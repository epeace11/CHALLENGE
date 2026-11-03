'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { DateString, DayColor } from '@/lib/next/model';
import { formatDay, ruleById } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Avatar, DayIcon, Glide, Sheet } from '@/components/next/ui';
import {
  CheckinDetail,
  DayCheckins,
  checkinLine,
  dayFooter,
  type DayPage,
} from '@/components/next/ui/day-sheet';
import { cn } from '@/lib/utils';
import { COLOR_WORDS, type WeekDay } from './data';

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
        // On phones the strip spans the card's padding and the days touch, so each day is a 44px
        // target; under 360px, where seven can't be, the avatars shrink to give the days the room.
        'grid grid-cols-[24px_repeat(7,minmax(0,1fr))] max-[360px]:grid-cols-[20px_repeat(7,minmax(0,1fr))] sm:grid-cols-[32px_repeat(7,minmax(0,1fr))] sm:gap-x-2',
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
              className="[--nx-avatar:24px] max-[360px]:[--nx-avatar:20px] sm:[--nx-avatar:32px]"
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
 * Both people's check-ins on one day, one tap from the week strip, one person at a time (a chip for
 * each). It is the same day sheet as Progress's: a row opens that check-in (with Back), or leads to
 * Check in or Review when that is where it is acted on. Its buttons are what Maya can do about the
 * day: log it while it is open, or review what waits from it.
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
  // Keep showing the last day while the sheet slides away; each opening starts on the day itself.
  const [shown, setShown] = useState<DateString | null>(day);
  const [last, setLast] = useState<DateString | null>(day);
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  const [whose, setWhose] = useState(world.me.id);
  // Counts steps in and back, so focus moves to the new view after each.
  const [steps, setSteps] = useState(0);
  if (day !== last) {
    setLast(day);
    if (day) {
      setShown(day);
      setRuleId(null);
      setDir(1);
    }
  }
  const d = day ?? shown;
  const rule = ruleId ? ruleById(world.challenge, ruleId) : undefined;
  const body = useRef<HTMLDivElement>(null);

  // After stepping into a check-in or back, put focus at the top of the new view.
  useEffect(() => {
    if (steps > 0) body.current?.focus({ preventScroll: true });
  }, [steps]);

  const go = (page: DayPage) => {
    onClose();
    navigate(page);
  };

  return (
    <Sheet
      open={!!day}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={rule ? rule.title : d ? formatDay(d) : 'Day'}
      description={rule && d ? checkinLine(world, whose, d) : undefined}
      back={
        rule && d
          ? {
              label: formatDay(d),
              onClick: () => {
                setDir(-1);
                setRuleId(null);
                setSteps((n) => n + 1);
              },
            }
          : undefined
      }
      footer={
        d
          ? dayFooter(
              world,
              d,
              go,
              rule ? { personId: whose, ruleId: rule.id } : undefined,
            )
          : undefined
      }
    >
      {d && (
        <div ref={body} tabIndex={-1} className="outline-none">
          <Glide id={rule ? `checkin-${rule.id}` : 'day'} direction={dir}>
            {rule ? (
              <CheckinDetail
                world={world}
                personId={whose}
                ruleId={rule.id}
                day={d}
              />
            ) : (
              <DayCheckins
                world={world}
                day={d}
                personId={whose}
                onPerson={setWhose}
                onOpen={(personId, id) => {
                  setWhose(personId);
                  setDir(1);
                  setRuleId(id);
                  setSteps((n) => n + 1);
                }}
                onGo={go}
              />
            )}
          </Glide>
        </div>
      )}
    </Sheet>
  );
}
