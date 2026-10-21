'use client';
import { useId, useState, type ReactNode } from 'react';
import { ArrowRight, Flame } from 'lucide-react';
import type { Badge, Person, Rule, World } from '@/lib/next/model';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Avatar,
  Button,
  GlassCard,
  RowButton,
  SegmentedControl,
  StackedBar,
  Stagger,
  TapCard,
  useReducedMotion,
} from '@/components/next/ui';
import {
  badges,
  calendar,
  formatDate,
  formatWeekday,
  openDay,
  rulesFor,
  shift,
} from '@/lib/next/selectors';
import { InlineBar } from './bar';
import { Medal } from './day-grid';
import type { Detail } from './detail';
import {
  barParts,
  countsLine,
  habitCounts,
  habitStats,
  lockWords,
  mainAction,
  percent,
  wholeCounts,
  type HabitStat,
} from './data';
import { SimpleLegend, SimpleMonth } from './simple-month';
import styles from './progress.module.css';

/**
 * The parts both new Progress versions share: the main action, the simple month, the whole
 * challenge, each habit worst first, and badges. The versions differ only in their order.
 */

const youOr = (w: World, p: Person) => (p.id === w.me.id ? 'You' : p.name);

/** The open day and the one filled button, or what waits on the viewer. Nothing when nothing does. */
export function MainAction() {
  const world = useWorld();
  const { navigate } = useNav();
  const action = mainAction(world, world.me.id);
  const open = openDay(world);
  if (!action) return null;
  return (
    <div className="nx-enter flex flex-col gap-3 sm:flex-row sm:items-center">
      <p className="flex-1 text-nx-body text-nx-ink">
        {action.page === 'log' && open
          ? `${formatWeekday(open)} is open ${lockWords(world, open)}.`
          : `${world.partner.name} is waiting on your review.`}
      </p>
      <Button
        variant="primary"
        iconEnd={ArrowRight}
        className="w-full sm:w-auto"
        onClick={() => navigate(action.page)}
      >
        {action.label}
      </Button>
    </div>
  );
}

/**
 * Whose calendar shows, and a way to bring it into view: the whole-challenge rows call `show` to
 * switch the calendar to that person and scroll to it (a jump under reduced motion).
 */
export function useCalendar() {
  const world = useWorld();
  const [personId, setPersonId] = useState(world.me.id);
  const anchor = useId();
  const still = useReducedMotion();
  return {
    personId,
    setPersonId,
    anchor,
    show: (id: string) => {
      setPersonId(id);
      const el = document.getElementById(anchor);
      if (!el) return;
      el.scrollIntoView({
        behavior: still ? 'auto' : 'smooth',
        block: 'start',
      });
      el.focus({ preventScroll: true });
    },
  };
}

export type CalendarState = ReturnType<typeof useCalendar>;

/** The You / partner switch for the calendar. */
export function CalendarSwitch({
  cal,
  className,
}: {
  cal: CalendarState;
  className?: string;
}) {
  const world = useWorld();
  return (
    <SegmentedControl
      label="Whose calendar"
      value={cal.personId}
      onChange={cal.setPersonId}
      options={[
        { value: world.me.id, label: 'You' },
        { value: world.partner.id, label: world.partner.name },
      ]}
      className={`w-full sm:max-w-sm ${styles.seg} ${className ?? ''}`}
    />
  );
}

/** The simple month for whoever the switch shows, then the legend. A day opens its check-ins. */
export function CalendarCard({
  cal,
  detail,
  top,
}: {
  cal: CalendarState;
  detail: Detail;
  /** Something above the month inside the card (the switch, in the original order). */
  top?: ReactNode;
}) {
  const world = useWorld();
  const isMe = cal.personId === world.me.id;
  return (
    <div id={cal.anchor} tabIndex={-1} className="scroll-mt-24 outline-none">
      <GlassCard pad="sm" className="flex flex-col gap-4 sm:p-5">
        {top}
        <SimpleMonth
          key={cal.personId}
          days={calendar(world, cal.personId)}
          weekStart={world.challenge.weekStart}
          today={world.today}
          label={isMe ? 'Your calendar' : `${world.partner.name}’s calendar`}
          onOpen={(day) =>
            detail.show({ kind: 'day', personId: cal.personId, day })
          }
        />
        <SimpleLegend />
      </GlassCard>
    </div>
  );
}

/** One row per person: the counts and a bar of every check-in; a row shows that person's calendar. */
export function WholeChallenge({ cal }: { cal: CalendarState }) {
  const world = useWorld();
  return (
    <Stagger className="flex flex-col gap-2.5">
      {[world.me, world.partner].map((p) => {
        const counts = wholeCounts(world, p.id);
        const line = countsLine(counts);
        return (
          <RowButton
            key={p.id}
            leading={<Avatar person={p} decorative />}
            title={youOr(world, p)}
            aria-label={`${youOr(world, p)}: ${line}. Show the calendar`}
            detail={
              <>
                <span className="block">{line}</span>
                <StackedBar
                  className="mt-2.5"
                  parts={barParts(counts)}
                  label={line}
                />
              </>
            }
            onClick={() => cal.show(p.id)}
          />
        );
      })}
    </Stagger>
  );
}

/** Lowest hit rate first (either person's), ties to more misses; habits with nothing settled last. */
function worstFirst(world: World) {
  const c = world.challenge;
  const people = [world.me, world.partner];
  const stats = new Map(
    people.map((p) => [
      p.id,
      new Map(habitStats(world, p.id).map((s) => [s.rule.id, s])),
    ]),
  );
  const rules = c.rules.filter((r) =>
    people.some((p) => rulesFor(c, p.id).some((x) => x.id === r.id)),
  );
  const rows = rules.map((rule) => {
    const of = people
      .map((p) => ({ person: p, stat: stats.get(p.id)?.get(rule.id) }))
      .filter((x): x is { person: Person; stat: HabitStat } => !!x.stat);
    const rate = Math.min(...of.map((x) => x.stat.rate ?? 2));
    const missed = of.reduce((n, x) => n + x.stat.missed, 0);
    return { rule, of, rate, missed };
  });
  return rows.sort((a, b) => a.rate - b.rate || b.missed - a.missed);
}

/** Whose habit it is when only one person has it: "Only you", "Jordan only". */
function onlyWho(world: World, rule: Rule) {
  if (rule.who === 'both') return null;
  return rule.who === world.me.id ? 'Only you' : `${world.partner.name} only`;
}

/**
 * Every habit, worst first: one card per habit with a thin bar per person, the hit rate and the
 * streak going now. The card opens the habit, with a chip to switch between the two of you.
 */
export function ByHabit({ detail }: { detail: Detail }) {
  const world = useWorld();
  return (
    <Stagger className="flex flex-col gap-2.5">
      {worstFirst(world).map(({ rule, of }) => {
        const only = onlyWho(world, rule);
        return (
          <TapCard
            key={rule.id}
            pad="sm"
            className="sm:p-5"
            onClick={() =>
              detail.show({
                kind: 'habit',
                personId: of[0].person.id,
                ruleId: rule.id,
              })
            }
          >
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-nx-body font-semibold text-nx-ink">
                {rule.title}
              </span>
              {only && <span className="text-nx-2 text-nx-ink-2">{only}</span>}
            </span>
            <span className="mt-3 flex flex-col gap-2.5">
              {of.map(({ person, stat }) => (
                <HabitLine
                  key={person.id}
                  world={world}
                  person={person}
                  rule={rule}
                  stat={stat}
                />
              ))}
            </span>
          </TapCard>
        );
      })}
    </Stagger>
  );
}

function HabitLine({
  world,
  person,
  rule,
  stat,
}: {
  world: World;
  person: Person;
  rule: Rule;
  stat: HabitStat;
}) {
  const counts = habitCounts(world, person.id, rule);
  const unit = stat.unit === 'week' ? 'week' : 'day';
  return (
    <span className="flex w-full items-center gap-2">
      <span
        className="w-4 shrink-0 text-nx-2 font-semibold text-nx-ink-2"
        aria-hidden="true"
      >
        {person.name[0]}
      </span>
      <StackedBar
        size="sm"
        className="min-w-0 flex-1"
        parts={barParts(counts)}
        label={`${person.name}: ${countsLine(counts)}`}
      />
      <span className="w-11 shrink-0 text-right text-nx-2 font-semibold text-nx-ink tabular-nums">
        {stat.rate === null ? '' : percent(stat.rate)}
      </span>
      <span className="inline-flex w-11 shrink-0 items-center justify-end gap-1 text-nx-2 text-nx-ink-2 tabular-nums">
        {stat.current > 0 && (
          <>
            <Flame size={16} className="text-nx-accent" aria-hidden="true" />
            {stat.current}
            <span className="sr-only">{` ${unit}s in a row`}</span>
          </>
        )}
      </span>
    </span>
  );
}

/** Earned in the last week: marked New. */
const isNew = (world: World, b: Badge) =>
  !!b.earnedOn && b.earnedOn >= shift(world.today, -7);

/**
 * Both people's badges: a row with how many are earned (it opens the full list), the earned ones as
 * a grid, and the ones still to earn with how close each is. Every badge opens what it is for.
 */
export function BadgesBoth({ detail }: { detail: Detail }) {
  const world = useWorld();
  return (
    <div className="flex flex-col gap-8">
      {[world.me, world.partner].map((p) => {
        const all = badges(world, p.id);
        const earned = all.filter((b) => b.earned);
        const rest = all.filter((b) => !b.earned);
        const open = (badgeId: string) =>
          detail.show({ kind: 'badge', personId: p.id, badgeId });
        return (
          <section
            key={p.id}
            className="flex flex-col gap-3"
            aria-label={`${youOr(world, p)}: badges`}
          >
            <RowButton
              leading={<Avatar person={p} decorative />}
              title={youOr(world, p)}
              detail={
                <>
                  <span className="block">
                    {earned.length} of {all.length} earned
                  </span>
                  <InlineBar
                    className="mt-2"
                    value={earned.length}
                    max={all.length}
                  />
                </>
              }
              onClick={() => detail.show({ kind: 'badges', personId: p.id })}
            />
            {earned.length > 0 && (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {earned.map((b) => (
                  <li key={b.id} className="flex">
                    <button
                      type="button"
                      className="nx-card nx-press flex min-h-11 flex-1 flex-col items-center gap-2 px-3 py-4 text-center"
                      onClick={() => open(b.id)}
                    >
                      <Medal id={b.id} earned size={52} />
                      <span className="text-nx-body font-semibold text-nx-ink">
                        {b.title}
                      </span>
                      <span className="text-nx-2 text-nx-ink-2">
                        {b.earnedOn ? formatDate(b.earnedOn) : ''}
                      </span>
                      {isNew(world, b) && (
                        <span className="rounded-full bg-nx-accent-soft px-2.5 py-0.5 text-nx-min font-semibold text-nx-accent">
                          New
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {rest.length > 0 && (
              <>
                <h3 className="mt-2 text-nx-2 font-semibold text-nx-ink-2">
                  Still to earn
                </h3>
                <ul className="flex flex-col gap-2">
                  {rest.map((b) => (
                    <li key={b.id}>
                      <RowButton
                        glass={false}
                        leading={<Medal id={b.id} earned={false} size={44} />}
                        title={b.title}
                        detail={
                          b.progress ? (
                            <>
                              <span className="block">
                                {b.progress.have} of {b.progress.need}{' '}
                                {b.progress.unit}
                              </span>
                              <InlineBar
                                className="mt-2"
                                value={b.progress.have}
                                max={b.progress.need}
                              />
                            </>
                          ) : (
                            b.how
                          )
                        }
                        onClick={() => open(b.id)}
                      />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
