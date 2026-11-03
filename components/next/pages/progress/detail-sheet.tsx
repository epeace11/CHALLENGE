'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import type { DateString, Rule, World } from '@/lib/next/model';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  DayIcon,
  Glide,
  PersonChip,
  ProgressBar,
  RowButton,
  Sheet,
  type DayTone,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import {
  badges,
  formatDate,
  formatDay,
  formatRange,
  formatWhen,
  isClosed,
  nameOf,
  ruleById,
  rulesFor,
  streaks,
  weekTarget,
  weeksOf,
  countsForWeek,
} from '@/lib/next/selectors';
import { Medal } from './medal';
import { SimpleLegend, SimpleMonth, type SquareTone } from './simple-month';
import styles from './progress.module.css';
import type { Detail, DetailView } from './detail';
import {
  CheckinDetail,
  DayCheckins,
  dayFooter,
} from '@/components/next/ui/day-sheet';
import {
  DOT,
  habitDays,
  habitStats,
  habitTally,
  pointsLine,
  runLength,
  sheetAction,
  type MainAction,
} from './data';
import { HabitCard, worstFirst } from './parts';

function titleOf(w: World, view: DetailView) {
  switch (view.kind) {
    case 'habit':
      return ruleById(w.challenge, view.ruleId)?.title ?? 'Habit';
    case 'day':
      return formatDay(view.day);
    case 'checkin':
      return ruleById(w.challenge, view.ruleId)?.title ?? 'Check-in';
    case 'badge':
      return (
        badges(w, view.personId).find((b) => b.id === view.badgeId)?.title ??
        'Badge'
      );
    case 'badges':
      return view.personId === w.me.id
        ? 'Your badges'
        : `${nameOf(w, view.personId)}’s badges`;
    case 'habits':
      return `All ${worstFirst(w).length} habits`;
  }
}

/** What the Back arrow names: a check-in by its day too, since its title is the habit's. */
function backLabel(w: World, view: DetailView) {
  const title = titleOf(w, view);
  return view.kind === 'checkin' ? `${title}, ${formatDay(view.day)}` : title;
}

/** Whether both people have a habit, so its sheet can switch between their days. */
const bothHave = (w: World, ruleId: string) =>
  [w.me, w.partner].every((p) =>
    rulesFor(w.challenge, p.id).some((r) => r.id === ruleId),
  );

/** The line under the title. It says whose it is (the partner's), once, and nothing else repeats it. */
function describe(w: World, view: DetailView, bothPeople?: boolean) {
  if (view.kind === 'habits') return 'Worst first.';
  const whose =
    view.personId === w.me.id ? null : nameOf(w, view.personId) || null;
  const line = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(' · ') || undefined;
  switch (view.kind) {
    case 'habit': {
      const rule = ruleById(w.challenge, view.ruleId);
      if (!rule) return undefined;
      // The chips say whose days these are when both have the habit. A weekly habit's title
      // already says how often, so it gets what counts instead.
      return line(
        bothPeople && bothHave(w, rule.id) ? null : whose,
        rule.kind === 'weekly' ? rule.description : formatWhen(rule),
      );
    }
    case 'day':
      // The chips say whose check-ins these are, and the line beside them until when it is open.
      return undefined;
    case 'checkin':
      return line(whose, formatDay(view.day));
    case 'badge':
      return line(whose);
    default:
      return undefined;
  }
}

/** The footer: a day and a check-in have the day sheet's buttons (as on Overview), a habit its one action. */
function footerOf(
  w: World,
  view: DetailView,
  go: (page: MainAction['page']) => void,
): ReactNode {
  if (view.kind === 'day') return dayFooter(w, view.day, go);
  if (view.kind === 'checkin')
    return dayFooter(w, view.day, go, {
      personId: view.personId,
      ruleId: view.ruleId,
    });
  const action =
    view.kind === 'habit'
      ? sheetAction(w, view.personId, { ruleId: view.ruleId })
      : null;
  return action ? (
    <Button
      variant="primary"
      iconEnd={ArrowRight}
      onClick={() => go(action.page)}
    >
      {action.label}
    </Button>
  ) : undefined;
}

/**
 * Details one tap away on Progress: a habit and its days, a day and its check-ins, a badge, or all
 * badges. Tapping inside moves further in (a habit's day, a day's habit) with a Back button, and the
 * content glides between views. The footer holds the one action that fits, if any.
 */
export function DetailSheet({
  detail,
  bothPeople,
}: {
  detail: Detail;
  /** A habit shared by both people gets You and partner chips that switch whose days show. */
  bothPeople?: boolean;
}) {
  const world = useWorld();
  const { navigate } = useNav();
  const top = detail.stack[detail.stack.length - 1];
  const prev = detail.stack[detail.stack.length - 2];
  const body = useRef<HTMLDivElement>(null);
  const depth = detail.stack.length;

  // After moving in or back, put focus at the top of the new view.
  useEffect(() => {
    if (depth > 0) body.current?.focus({ preventScroll: true });
  }, [depth]);

  if (!top) return null;
  const go = (page: MainAction['page']) => {
    detail.close();
    navigate(page);
  };

  return (
    <Sheet
      open={detail.isOpen}
      onOpenChange={(open) => {
        if (!open) detail.close();
      }}
      title={titleOf(world, top)}
      description={describe(world, top, bothPeople)}
      back={
        prev
          ? { label: backLabel(world, prev), onClick: detail.back }
          : undefined
      }
      footer={footerOf(world, top, go)}
    >
      <div ref={body} tabIndex={-1} className="outline-none">
        {/* A day's chips switch whose check-ins show in place, so they don't glide. */}
        <Glide
          id={`${depth}-${JSON.stringify(top.kind === 'day' ? { ...top, personId: '' } : top)}`}
          direction={detail.dir}
        >
          <ViewBody
            world={world}
            view={top}
            from={
              prev?.kind === 'day' || prev?.kind === 'checkin'
                ? prev.day
                : undefined
            }
            push={detail.push}
            replace={detail.replace}
            go={go}
            swap={bothPeople ? detail.replace : undefined}
          />
        </Glide>
      </div>
    </Sheet>
  );
}

function ViewBody({
  world,
  view,
  from,
  push,
  replace,
  go,
  swap,
}: {
  world: World;
  view: DetailView;
  /** The day this view was opened from, if it was a day. */
  from?: DateString;
  push: (v: DetailView) => void;
  /** Swaps this view for another in place (a day's chips switch whose check-ins show). */
  replace: (v: DetailView) => void;
  go: (page: MainAction['page']) => void;
  swap?: (v: DetailView) => void;
}) {
  switch (view.kind) {
    case 'habit':
      return (
        <HabitBody
          world={world}
          view={view}
          from={from}
          push={push}
          swap={swap}
        />
      );
    case 'day':
      return (
        <DayCheckins
          world={world}
          day={view.day}
          personId={view.personId}
          onPerson={(personId) => replace({ ...view, personId })}
          onOpen={(personId, ruleId) =>
            push({ kind: 'checkin', personId, ruleId, day: view.day })
          }
          onGo={go}
        />
      );
    case 'checkin':
      return (
        <CheckinDetail
          world={world}
          personId={view.personId}
          ruleId={view.ruleId}
          day={view.day}
          onHabit={() =>
            push({
              kind: 'habit',
              personId: view.personId,
              ruleId: view.ruleId,
            })
          }
        />
      );
    case 'badge':
      return <BadgeBody world={world} view={view} push={push} />;
    case 'badges':
      return <BadgesBody world={world} view={view} push={push} />;
    case 'habits':
      return <HabitsBody world={world} push={push} />;
  }
}

/** Every habit, worst first, as the page shows its first three; a card opens that habit. */
function HabitsBody({
  world,
  push,
}: {
  world: World;
  push: (v: DetailView) => void;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {worstFirst(world).map((row) => (
        <li key={row.rule.id} className="flex">
          <HabitCard
            row={row}
            glass={false}
            onOpen={(personId) =>
              push({ kind: 'habit', personId, ruleId: row.rule.id })
            }
          />
        </li>
      ))}
    </ul>
  );
}

function HabitBody({
  world,
  view,
  from,
  push,
  swap,
}: {
  world: World;
  view: Extract<DetailView, { kind: 'habit' }>;
  from?: DateString;
  push: (v: DetailView) => void;
  /** Given, a habit both people have shows a chip for each that switches to theirs. */
  swap?: (v: DetailView) => void;
}) {
  const rule = ruleById(world.challenge, view.ruleId);
  const stat = habitStats(world, view.personId).find(
    (s) => s.rule.id === view.ruleId,
  );
  if (!rule || !stat) return null;
  const tally = habitTally(world, view.personId, rule);
  const days = habitDays(world, view.personId, rule);
  const squares = days.map((d) => ({
    day: d.day,
    color: (d.tone ?? 'off') as SquareTone,
  }));
  const tones = new Set(squares.map((d) => d.color));
  const c = world.challenge;
  const shared = swap && bothHave(world, rule.id);
  const week = stat.weekly ? stat.week : null;
  // How it stands, to the right of the chips: the count, then points and the run.
  const head = week
    ? `${week.have} of ${week.need} this week`
    : tally.of === 0
      ? 'Nothing settled yet'
      : `${tally.done} of ${runLength(tally.of, 'day')} done`;
  const sub = week
    ? week.met
      ? 'Done for the week'
      : `${week.left} more, ${runLength(week.daysLeft, 'day')} left`
    : [
        // The same points as Overview and Gifts: one asked about is still a point.
        tally.points > 0 || tally.forgiven > 0 ? pointsLine(tally) : '',
        stat.current > 0
          ? `${runLength(stat.current, 'day')} in a row${stat.best > stat.current ? `, best ${stat.best}` : ''}`
          : stat.best > 0
            ? `Best run ${runLength(stat.best, 'day')}`
            : '',
      ]
        .filter(Boolean)
        .join(DOT);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {shared && (
          <fieldset className="flex gap-2">
            <legend className="sr-only">Whose days</legend>
            {[world.me, world.partner].map((p) => (
              <PersonChip
                key={p.id}
                person={p}
                pressed={p.id === view.personId}
                onClick={() => swap({ ...view, personId: p.id })}
              >
                {p.id === world.me.id ? 'You' : p.name}
              </PersonChip>
            ))}
          </fieldset>
        )}
        <div className={cn('min-w-0', shared && 'sm:ml-auto sm:text-right')}>
          <p className="text-nx-body font-semibold">{head}</p>
          {sub && <p className="text-nx-2 text-nx-ink-2">{sub}</p>}
        </div>
      </div>
      <div className={`flex flex-col gap-3 ${styles.palette}`}>
        {week && (
          <WeekSquares world={world} personId={view.personId} rule={rule} />
        )}
        <SimpleMonth
          days={squares}
          weekStart={c.weekStart}
          today={world.today}
          marked={from}
          compact
          label={`${rule.title}, day by day`}
          onOpen={(day) => push({ kind: 'day', personId: view.personId, day })}
        />
        <SimpleLegend tones={tones} />
      </div>
    </div>
  );
}

/**
 * A weekly habit's weeks in one row of squares, drawn like the calendar's days: met, short (with
 * how many it was short by), this week, or still ahead.
 */
function WeekSquares({
  world,
  personId,
  rule,
}: {
  world: World;
  personId: string;
  rule: Rule;
}) {
  const c = world.challenge;
  const weeks = weeksOf(c).map((week) => {
    const need = weekTarget(rule, week, c);
    const have = world.entries.filter(
      (e) =>
        e.personId === personId &&
        e.ruleId === rule.id &&
        e.day >= week.start &&
        e.day <= week.end &&
        countsForWeek(e),
    ).length;
    const short =
      need > 0 && have < need && isClosed(c, week.end, world.now)
        ? need - have
        : 0;
    const [tone, words]: [DayTone, string] = !need
      ? ['none', 'nothing needed']
      : week.start > world.today
        ? ['ahead', `needs ${need}`]
        : have >= need
          ? ['done', 'met']
          : short
            ? ['missed', `short by ${short}`]
            : ['open', `${have} of ${need} so far`];
    return { week, tone, words, short };
  });
  return (
    <div className="flex items-center gap-3">
      <p className="text-nx-2 font-semibold text-nx-ink-2">Weeks</p>
      <ul
        className={cn(styles.weeks, 'min-w-0 flex-1')}
        style={{ ['--weeks' as string]: weeks.length }}
      >
        {weeks.map(({ week, tone, words, short }) => (
          <li
            key={week.start}
            className={cn('nx-day', styles.week)}
            data-tone={tone}
          >
            <span aria-hidden="true">{formatDate(week.start)}</span>
            <span className="flex items-center gap-0.5" aria-hidden="true">
              <DayIcon tone={tone} size={14} />
              {short > 0 && (
                <span className="text-nx-min leading-none font-semibold">
                  {short}
                </span>
              )}
            </span>
            <span className="sr-only">{`${formatRange(week.start, week.end)}: ${words}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BadgeBody({
  world,
  view,
  push,
}: {
  world: World;
  view: Extract<DetailView, { kind: 'badge' }>;
  push: (v: DetailView) => void;
}) {
  const badge = badges(world, view.personId).find((b) => b.id === view.badgeId);
  if (!badge) return null;
  // Streak badges build on the longest daily run going now.
  const run = view.badgeId.startsWith('streak')
    ? streaks(world, view.personId)
        .filter((s) => s.unit === 'day')
        .sort((a, b) => b.current - a.current)[0]
    : undefined;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Medal id={badge.id} earned={badge.earned} size={72} />
        <div className="min-w-0">
          <p className="text-nx-body">{badge.how}.</p>
          {/* A badge with a count says how close it is below, which already says it isn't earned. */}
          {(badge.earned || !badge.progress) && (
            <p className="mt-1 text-nx-2 text-nx-ink-2">
              {badge.earned && badge.earnedOn
                ? `Earned ${formatDay(badge.earnedOn)}`
                : 'Not earned yet'}
            </p>
          )}
        </div>
      </div>
      {!badge.earned && badge.progress && (
        <div className="flex flex-col gap-2">
          <ProgressBar
            value={badge.progress.have}
            max={badge.progress.need}
            size="lg"
            label={`${badge.title}: ${badge.progress.have} of ${badge.progress.need} ${badge.progress.unit}`}
          />
          <p className="text-nx-body">
            {badge.progress.have} of {badge.progress.need} {badge.progress.unit}
          </p>
        </div>
      )}
      {/* The habit carrying the run; its length is the count above, so the row only names it. */}
      {!badge.earned && run && run.current > 0 && (
        <RowButton
          glass={false}
          title={run.rule.title}
          aria-label={`${run.rule.title}: ${runLength(run.current, 'day')} in a row now`}
          onClick={() =>
            push({
              kind: 'habit',
              personId: view.personId,
              ruleId: run.rule.id,
            })
          }
        />
      )}
    </div>
  );
}

function BadgesBody({
  world,
  view,
  push,
}: {
  world: World;
  view: Extract<DetailView, { kind: 'badges' }>;
  push: (v: DetailView) => void;
}) {
  const all = badges(world, view.personId);
  const earned = all.filter((b) => b.earned);
  const rest = all.filter((b) => !b.earned);
  // Two to a row, so nine badges fit without scrolling. How to earn one is a tap away. Under the
  // Earned heading a badge shows only its date: "Earned Nov 8" would say Earned again.
  const row = (b: (typeof all)[number]): ReactNode => (
    <li key={b.id} className="flex">
      <RowButton
        glass={false}
        chevron={false}
        className="w-full gap-2.5 px-3 py-2.5"
        leading={<Medal id={b.id} earned={b.earned} size={36} />}
        title={b.title}
        detail={
          b.earned && b.earnedOn
            ? formatDate(b.earnedOn)
            : b.progress && b.progress.have > 0
              ? `${b.progress.have} of ${b.progress.need} ${b.progress.unit}`
              : undefined
        }
        onClick={() =>
          push({ kind: 'badge', personId: view.personId, badgeId: b.id })
        }
      />
    </li>
  );
  const group = (name: string, list: typeof all) =>
    list.length > 0 && (
      <section className="flex flex-col gap-2" aria-label={name}>
        <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
          {name}
        </h3>
        <ul className="grid grid-cols-2 gap-2">{list.map(row)}</ul>
      </section>
    );
  return (
    <div className="flex flex-col gap-4">
      {group('Earned', earned)}
      {group('Not yet', rest)}
    </div>
  );
}
