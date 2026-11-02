'use client';
import { createElement, useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { DateString, Rule, World } from '@/lib/next/model';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  Card,
  DayIcon,
  Glide,
  PersonChip,
  ProgressBar,
  ProofStrip,
  RowButton,
  Sheet,
  StatusPill,
  type DayTone,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import {
  badges,
  dateIn,
  formatAnswer,
  formatDate,
  formatDay,
  formatRange,
  formatTime,
  formatWhen,
  isClosed,
  nameOf,
  openDay,
  ruleById,
  rulesFor,
  streaks,
  weekOf,
  weekProgress,
  weekTarget,
  weeksOf,
  countsForWeek,
  dayColor,
  dayMisses,
  missesLine,
} from '@/lib/next/selectors';
import { Medal } from './medal';
import { SimpleLegend, SimpleMonth, type SquareTone } from './simple-month';
import styles from './progress.module.css';
import type { Detail, DetailView } from './detail';
import {
  DOT,
  dayCheckins,
  habitDays,
  habitIcon,
  habitStats,
  habitTally,
  lockWords,
  notesOn,
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
      return line(
        whose && `${whose}’s check-ins`,
        openDay(w) === view.day ? `Open ${lockWords(w, view.day)}` : null,
      );
    case 'checkin':
      return line(whose, formatDay(view.day));
    case 'badge':
      return line(whose);
    default:
      return undefined;
  }
}

function actionOf(w: World, view: DetailView): MainAction | null {
  if (view.kind === 'habit')
    return sheetAction(w, view.personId, { ruleId: view.ruleId });
  if (view.kind === 'day')
    return sheetAction(w, view.personId, { day: view.day });
  if (view.kind === 'checkin')
    return sheetAction(w, view.personId, {
      day: view.day,
      ruleId: view.ruleId,
    });
  return null;
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
  const action = actionOf(world, top);
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
      footer={
        action ? (
          <Button
            variant="primary"
            iconEnd={ArrowRight}
            onClick={() => go(action.page)}
          >
            {action.label}
          </Button>
        ) : undefined
      }
    >
      <div ref={body} tabIndex={-1} className="outline-none">
        <Glide id={`${depth}-${JSON.stringify(top)}`} direction={detail.dir}>
          <ViewBody
            world={world}
            view={top}
            from={
              prev?.kind === 'day' || prev?.kind === 'checkin'
                ? prev.day
                : undefined
            }
            push={detail.push}
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
  swap,
}: {
  world: World;
  view: DetailView;
  /** The day this view was opened from, if it was a day. */
  from?: DateString;
  push: (v: DetailView) => void;
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
      return <DayBody world={world} view={view} push={push} />;
    case 'checkin':
      return <CheckinBody world={world} view={view} push={push} />;
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

function DayBody({
  world,
  view,
  push,
}: {
  world: World;
  view: Extract<DetailView, { kind: 'day' }>;
  push: (v: DetailView) => void;
}) {
  const rows = dayCheckins(world, view.personId, view.day);
  // Daily check-ins first, which the missed count counts; weekly ones after, by the week.
  const daily = rows.filter((r) => r.rule.kind !== 'weekly');
  const weekly = rows.filter((r) => r.rule.kind === 'weekly');
  const notes = notesOn(world, view.day);
  const misses =
    dayColor(world, view.personId, view.day) === 'missed'
      ? dayMisses(world, view.personId, view.day)
      : null;
  const open = (ruleId: string) =>
    push({ kind: 'checkin', personId: view.personId, ruleId, day: view.day });
  return (
    <div className="flex flex-col gap-4">
      {misses && (
        <p className="text-nx-body font-semibold text-nx-missed">
          {missesLine(misses)}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-nx-line">
        {daily.map(({ rule, entry, pill }) => {
          // An open or unlogged check-in has no answer; its pill says so. A Yes beside Done (or a
          // No beside Missed) would say the same thing twice.
          const answer =
            pill.status === 'open' || !entry ? null : formatAnswer(rule, entry);
          const plain =
            rule.kind === 'yesno' &&
            (pill.status === 'done' || pill.status === 'missed');
          const shown =
            answer && answer !== pill.label && !plain ? answer : null;
          return (
            <CheckinRow
              key={rule.id}
              rule={rule}
              sub={[shown, entry?.note ? `“${entry.note}”` : null]
                .filter(Boolean)
                .join(DOT)}
              pill={
                (pill.status !== 'none' || !shown) && (
                  <StatusPill status={pill.status} label={pill.label} />
                )
              }
              onClick={() => open(rule.id)}
            />
          );
        })}
      </ul>
      {weekly.length > 0 && (
        <WeeklyGroup
          world={world}
          personId={view.personId}
          day={view.day}
          rows={weekly}
          onOpen={open}
        />
      )}
      {notes.length > 0 && (
        <section className="flex flex-col gap-1.5" aria-label="Notes">
          <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
            Notes
          </h3>
          {notes.map((n) => (
            <p key={n.id} className="text-pretty text-nx-body">
              {n.text}{' '}
              <span className="text-nx-2 text-nx-ink-2">
                {n.personId === world.me.id ? 'You' : nameOf(world, n.personId)}
                {DOT}
                {formatTime(n.createdAt, world.challenge.timeZone)}
              </span>
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * One check-in in a day's list, a single line where it fits: the habit's icon and name (a number
 * answer or the note under it), how it stands, and a chevron. The rows share one divided list.
 */
function CheckinRow({
  rule,
  sub,
  pill,
  label,
  onClick,
}: {
  rule: Rule;
  sub?: ReactNode;
  pill: ReactNode;
  label?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="nx-press flex min-h-14 w-full items-center gap-3 py-2 text-left"
        aria-label={label}
        onClick={onClick}
      >
        <span className="shrink-0 text-nx-accent">
          {createElement(habitIcon(rule), { size: 20, 'aria-hidden': true })}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-pretty text-nx-body font-semibold text-nx-ink">
            {rule.title}
          </span>
          {sub && (
            <span className="text-pretty text-nx-2 text-nx-ink-2">{sub}</span>
          )}
        </span>
        {pill}
        <ChevronRight
          size={20}
          aria-hidden="true"
          className="shrink-0 text-nx-accent"
        />
      </button>
    </li>
  );
}

/** "This week", or the week's dates when it is an earlier one: "Nov 9 – 15". */
function weekName(world: World, day: DateString) {
  const week = weekOf(world.challenge, day);
  if (!week) return 'That week';
  return world.today >= week.start && world.today <= week.end
    ? 'This week'
    : formatRange(week.start, week.end);
}

/**
 * Weekly check-ins on a day, in their own small group under the daily ones: the week's count
 * ("2 of 4") and that day's answer (Went, No visit). A row opens that check-in.
 */
function WeeklyGroup({
  world,
  personId,
  day,
  rows,
  onOpen,
}: {
  world: World;
  personId: string;
  day: DateString;
  rows: ReturnType<typeof dayCheckins>;
  onOpen: (ruleId: string) => void;
}) {
  const name = weekName(world, day);
  return (
    <section className="flex flex-col" aria-label={name}>
      <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
        {name}
      </h3>
      <ul className="flex flex-col divide-y divide-nx-line">
        {rows.map(({ rule, pill }) => {
          const week = weekProgress(world, personId, rule.id, day);
          const label =
            pill.status === 'done'
              ? 'Went'
              : pill.status === 'none'
                ? 'No visit'
                : pill.label;
          return (
            <CheckinRow
              key={rule.id}
              rule={rule}
              sub={week ? `${week.have} of ${week.need}` : undefined}
              pill={<StatusPill status={pill.status} label={label} />}
              label={`${rule.title}: ${week ? `${week.have} of ${week.need} ${name === 'This week' ? 'this week' : `the week of ${name}`}` : ''}, ${formatDay(day)}: ${label}`}
              onClick={() => onOpen(rule.id)}
            />
          );
        })}
      </ul>
    </section>
  );
}

/**
 * One check-in on one day: the answer and how it stands, its screenshots (tap for full screen), the
 * note, a correction or dispute on it, and a way on to every day of that habit.
 */
function CheckinBody({
  world,
  view,
  push,
}: {
  world: World;
  view: Extract<DetailView, { kind: 'checkin' }>;
  push: (v: DetailView) => void;
}) {
  const row = dayCheckins(world, view.personId, view.day).find(
    (r) => r.rule.id === view.ruleId,
  );
  if (!row) return null;
  const { rule, entry, pill } = row;
  const answer =
    pill.status === 'open' || !entry ? null : formatAnswer(rule, entry);
  const shown = answer && answer !== pill.label ? answer : null;
  const disputes = entry
    ? world.disputes.filter((d) => d.entryId === entry.id)
    : [];
  const tz = world.challenge.timeZone;
  const who = (id: string) => (id === world.me.id ? 'You' : nameOf(world, id));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {shown && <span className="text-nx-lead font-semibold">{shown}</span>}
        <StatusPill status={pill.status} label={pill.label} />
      </div>
      {entry && entry.proofs.length > 0 && <ProofStrip proofs={entry.proofs} />}
      {entry?.note ? (
        <Card pad="sm">
          <p className="text-nx-body">{entry.note}</p>
        </Card>
      ) : null}
      {entry?.correction && (
        <Card pad="sm" className="flex flex-col gap-2">
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            Late correction, waiting for review
          </p>
          <p className="text-nx-body">
            {formatAnswer(rule, { ...entry, ...entry.correction })}
            {entry.correction.note ? ` · ${entry.correction.note}` : ''}
          </p>
          {entry.correction.proofs.length > 0 && (
            <ProofStrip proofs={entry.correction.proofs} />
          )}
        </Card>
      )}
      {disputes.map((d) => (
        <Card key={d.id} pad="sm" className="flex flex-col gap-1.5">
          <p className="text-nx-2 font-semibold text-nx-ink-2">
            {who(d.raisedBy)} disputed it
            {d.status === 'conceded'
              ? ' · conceded'
              : d.status === 'withdrawn'
                ? ' · withdrawn'
                : ''}
          </p>
          <p className="text-nx-body">“{d.comment}”</p>
          {d.reply && (
            <p className="text-nx-body text-nx-ink-2">Reply: “{d.reply}”</p>
          )}
        </Card>
      ))}
      {entry?.loggedAt && (
        <p className="text-nx-2 text-nx-ink-2">
          Logged {formatDate(dateIn(tz, entry.loggedAt))} at{' '}
          {formatTime(entry.loggedAt, tz)}
        </p>
      )}
      <Button
        variant="quiet"
        iconEnd={ChevronRight}
        className="-ml-3 self-start"
        onClick={() =>
          push({ kind: 'habit', personId: view.personId, ruleId: rule.id })
        }
      >
        Every day of this habit
      </Button>
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
          <p className="mt-1 text-nx-2 text-nx-ink-2">
            {badge.earned && badge.earnedOn
              ? `Earned ${formatDay(badge.earnedOn)}`
              : 'Not earned yet'}
          </p>
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
      {!badge.earned && run && run.current > 0 && (
        <RowButton
          glass={false}
          title={run.rule.title}
          detail={`${runLength(run.current, 'day')} in a row now`}
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
  // Two to a row, so nine badges fit without scrolling. How to earn one is a tap away.
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
            ? `Earned ${formatDate(b.earnedOn)}`
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
