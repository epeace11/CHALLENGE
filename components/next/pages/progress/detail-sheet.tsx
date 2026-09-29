'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import type { DateString, World } from '@/lib/next/model';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  Card,
  Glide,
  PersonChip,
  ProgressBar,
  RowButton,
  Sheet,
  StatusPill,
} from '@/components/next/ui';
import {
  badges,
  formatAnswer,
  formatDate,
  formatDay,
  formatRange,
  formatTime,
  formatWhen,
  isClosed,
  nameOf,
  openDay,
  personById,
  ruleById,
  streaks,
  weekTarget,
  weeksOf,
  countsForWeek,
} from '@/lib/next/selectors';
import { DayGrid, Legend, Medal } from './day-grid';
import type { Detail, DetailView } from './detail';
import {
  LEGEND,
  dayCheckins,
  habitDays,
  habitIcon,
  habitStats,
  lockWords,
  notesOn,
  runLength,
  sheetAction,
  type MainAction,
  type Tone,
} from './data';

function titleOf(w: World, view: DetailView) {
  switch (view.kind) {
    case 'habit':
      return ruleById(w.challenge, view.ruleId)?.title ?? 'Habit';
    case 'day':
      return formatDay(view.day);
    case 'badge':
      return (
        badges(w, view.personId).find((b) => b.id === view.badgeId)?.title ??
        'Badge'
      );
    case 'badges':
      return view.personId === w.me.id
        ? 'Your badges'
        : `${nameOf(w, view.personId)}’s badges`;
  }
}

function describe(w: World, view: DetailView) {
  const whose =
    view.personId === w.me.id ? null : nameOf(w, view.personId) || null;
  switch (view.kind) {
    case 'habit': {
      const rule = ruleById(w.challenge, view.ruleId);
      if (!rule) return undefined;
      // A weekly habit's title already says how often, so it gets what counts instead.
      return [
        whose,
        rule.kind === 'weekly' ? rule.description : formatWhen(rule),
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'day':
      if (openDay(w) === view.day) return `Open ${lockWords(w, view.day)}`;
      return whose ? `${whose}’s check-ins` : undefined;
    default:
      return undefined;
  }
}

function actionOf(w: World, view: DetailView): MainAction | null {
  if (view.kind === 'habit')
    return sheetAction(w, view.personId, { ruleId: view.ruleId });
  if (view.kind === 'day')
    return sheetAction(w, view.personId, { day: view.day });
  return null;
}

/**
 * Details one tap away on Progress: a habit and its days, a day and its check-ins, a badge, or all
 * badges. Tapping inside moves further in (a habit's day, a day's habit) with a Back button, and the
 * content glides between views. The footer holds the one action that fits, if any.
 */
export function DetailSheet({ detail }: { detail: Detail }) {
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
      description={describe(world, top)}
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
        {prev && (
          <Button
            variant="quiet"
            icon={ChevronLeft}
            className="-mt-2 mb-2 -ml-3"
            onClick={detail.back}
          >
            {titleOf(world, prev)}
          </Button>
        )}
        <Glide id={`${depth}-${JSON.stringify(top)}`} direction={detail.dir}>
          <ViewBody
            world={world}
            view={top}
            from={prev?.kind === 'day' ? prev.day : undefined}
            push={detail.push}
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
}: {
  world: World;
  view: DetailView;
  /** The day this view was opened from, if it was a day. */
  from?: DateString;
  push: (v: DetailView) => void;
}) {
  switch (view.kind) {
    case 'habit':
      return <HabitBody world={world} view={view} from={from} push={push} />;
    case 'day':
      return <DayBody world={world} view={view} push={push} />;
    case 'badge':
      return <BadgeBody world={world} view={view} push={push} />;
    case 'badges':
      return <BadgesBody world={world} view={view} push={push} />;
  }
}

function Whose({ world, personId }: { world: World; personId: string }) {
  const person = personById(world, personId);
  if (!person || personId === world.me.id) return null;
  return <PersonChip person={person} className="self-start" />;
}

function HabitBody({
  world,
  view,
  from,
  push,
}: {
  world: World;
  view: Extract<DetailView, { kind: 'habit' }>;
  from?: DateString;
  push: (v: DetailView) => void;
}) {
  const rule = ruleById(world.challenge, view.ruleId);
  const stat = habitStats(world, view.personId).find(
    (s) => s.rule.id === view.ruleId,
  );
  if (!rule || !stat) return null;
  const days = habitDays(world, view.personId, rule);
  const tones = new Set(days.map((d) => d.tone));
  const legend: { tone: Tone; label: string }[] = [
    ...LEGEND.filter((l) => tones.has(l.tone)),
    ...(tones.has('disputed')
      ? [{ tone: 'disputed' as const, label: 'Disputed' }]
      : []),
    ...(tones.has('none')
      ? [{ tone: 'none' as const, label: 'No visit' }]
      : []),
  ];
  const c = world.challenge;
  return (
    <div className="flex flex-col gap-5">
      <Whose world={world} personId={view.personId} />
      {stat.weekly && stat.week ? (
        <div className="flex flex-col gap-3">
          <p className="text-nx-body">
            This week: {stat.week.have} of {stat.week.need}.{' '}
            {stat.week.met
              ? 'Done for the week.'
              : `${stat.week.left} more to go, ${runLength(stat.week.daysLeft, 'day')} left.`}
          </p>
          <ProgressBar
            value={stat.week.have}
            max={stat.week.need}
            segments
            tone={stat.week.met ? 'done' : 'accent'}
            label={`This week: ${stat.week.have} of ${stat.week.need}`}
          />
          <ul className="mt-1 flex flex-col divide-y divide-nx-line rounded-nx border border-nx-line">
            {weeksOf(c).map((week) => {
              const need = weekTarget(rule, week, c);
              const have = world.entries.filter(
                (e) =>
                  e.personId === view.personId &&
                  e.ruleId === rule.id &&
                  e.day >= week.start &&
                  e.day <= week.end &&
                  countsForWeek(e),
              ).length;
              const closed = isClosed(c, week.end, world.now);
              const started = week.start <= world.today;
              const pill = !need
                ? { status: 'none' as const, label: 'Nothing needed' }
                : !started
                  ? { status: 'none' as const, label: `Needs ${need}` }
                  : have >= need
                    ? { status: 'done' as const, label: 'Met' }
                    : closed
                      ? {
                          status: 'missed' as const,
                          label: `Short by ${need - have}`,
                        }
                      : { status: 'open' as const, label: 'This week' };
              return (
                <li
                  key={week.start}
                  className="flex min-h-14 items-center gap-3 px-4 py-2"
                >
                  <span className="flex-1 text-nx-body">
                    {formatRange(week.start, week.end)}
                  </span>
                  <StatusPill status={pill.status} label={pill.label} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="text-nx-body">
          {stat.rate === null
            ? 'Nothing settled yet.'
            : `Done on ${stat.done} of ${stat.done + stat.missed} days.`}{' '}
          {stat.current > 0
            ? `${runLength(stat.current, 'day')} in a row now${stat.best > stat.current ? `; best ${stat.best}.` : ', the longest yet.'}`
            : stat.best > 0
              ? `Best run: ${runLength(stat.best, 'day')}.`
              : ''}
        </p>
      )}
      <DayGrid
        days={days}
        weekStart={c.weekStart}
        today={world.today}
        marked={from}
        label={`${rule.title}, day by day`}
        onOpen={(day) => push({ kind: 'day', personId: view.personId, day })}
      />
      {legend.length > 0 && <Legend tones={legend} />}
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
  const notes = notesOn(world, view.day);
  return (
    <div className="flex flex-col gap-5">
      <Whose world={world} personId={view.personId} />
      <ul className="flex flex-col gap-2">
        {rows.map(({ rule, entry, pill }) => {
          const Icon = habitIcon(rule);
          // An open or unlogged check-in has no answer; its pill says so.
          const answer =
            pill.status === 'open' || !entry ? null : formatAnswer(rule, entry);
          const shown = answer && answer !== pill.label ? answer : null;
          return (
            <li key={rule.id}>
              <RowButton
                glass={false}
                leading={
                  <span className="grid size-10 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                }
                title={rule.title}
                detail={
                  <>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      {shown}
                      {(pill.status !== 'none' || !shown) && (
                        <StatusPill status={pill.status} label={pill.label} />
                      )}
                    </span>
                    {entry?.note ? (
                      <span className="mt-1.5 block">“{entry.note}”</span>
                    ) : null}
                  </>
                }
                onClick={() =>
                  push({
                    kind: 'habit',
                    personId: view.personId,
                    ruleId: rule.id,
                  })
                }
              />
            </li>
          );
        })}
      </ul>
      {notes.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Notes">
          <h3 className="font-nx-serif text-nx-h3">Notes</h3>
          {notes.map((n) => (
            <Card key={n.id} pad="sm">
              <p className="text-nx-body">{n.text}</p>
              <p className="mt-1 text-nx-2 text-nx-ink-2">
                {n.personId === world.me.id ? 'You' : nameOf(world, n.personId)}{' '}
                · {formatTime(n.createdAt, world.challenge.timeZone)}
              </p>
            </Card>
          ))}
        </section>
      )}
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
      <Whose world={world} personId={view.personId} />
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
  const row = (b: (typeof all)[number]): ReactNode => (
    <li key={b.id}>
      <RowButton
        glass={false}
        leading={<Medal id={b.id} earned={b.earned} size={44} />}
        title={b.title}
        detail={
          b.earned && b.earnedOn
            ? `Earned ${formatDate(b.earnedOn)}`
            : b.progress && b.progress.have > 0
              ? `${b.progress.have} of ${b.progress.need} ${b.progress.unit}`
              : b.how
        }
        onClick={() =>
          push({ kind: 'badge', personId: view.personId, badgeId: b.id })
        }
      />
    </li>
  );
  return (
    <div className="flex flex-col gap-5">
      <Whose world={world} personId={view.personId} />
      {earned.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Earned">
          <h3 className="font-nx-serif text-nx-h3">Earned</h3>
          <ul className="flex flex-col gap-2">{earned.map(row)}</ul>
        </section>
      )}
      {rest.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="Not yet">
          <h3 className="font-nx-serif text-nx-h3">Not yet</h3>
          <ul className="flex flex-col gap-2">{rest.map(row)}</ul>
        </section>
      )}
    </div>
  );
}
