'use client';
import { useId, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronRight, Flame } from 'lucide-react';
import type { Person, Rule, World } from '@/lib/next/model';
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
  useReducedMotion,
} from '@/components/next/ui';
import {
  badges,
  calendar,
  formatWeekdays,
  keepNumbersWithWords,
  nextBadge,
  openDay,
  streaks,
} from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import type { Detail } from './detail';
import {
  barParts,
  habitStats,
  habitTally,
  lockWords,
  mainAction,
  runLength,
  tallyLine,
  wholeTally,
  type HabitStat,
  type Tally,
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
        {/* The button names the day ("Log Thursday"), so the line only says until when. */}
        {action.page === 'log' && open
          ? `Open ${lockWords(world, open)}.`
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
        {/* On phones the month spans most of the card's padding, so each day is a 44px target;
            under 360px all of it, to come as close as seven days can. */}
        <div className="-mx-3 max-[360px]:-mx-4 sm:mx-0">
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
        </div>
        <SimpleLegend />
      </GlassCard>
    </div>
  );
}

/** One row per person: the counts and a bar of every check-in so far; a row shows that person's calendar. */
export function WholeChallenge({ cal }: { cal: CalendarState }) {
  const world = useWorld();
  return (
    <Stagger className="flex flex-col gap-2.5">
      {[world.me, world.partner].map((p) => {
        const tally = wholeTally(world, p.id);
        const line = tallyLine(tally);
        return (
          <RowButton
            key={p.id}
            leading={<Avatar person={p} decorative />}
            title={youOr(world, p)}
            aria-label={`${youOr(world, p)}: ${line}. Show the calendar`}
            detail={
              <>
                <span className="block">{keepNumbersWithWords(line)}</span>
                <StackedBar
                  className="mt-2.5"
                  parts={barParts(tally)}
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

/** A habit's rows for each person who has it, with their tallies. */
type HabitRow = {
  rule: Rule;
  of: { person: Person; tally: Tally; stat: HabitStat }[];
};

/** How often it was done, over what has settled (points against it; forgiven and waiting aside). */
const rateOf = (t: Tally) => {
  const misses = t.unit === 'week' ? (t.short ?? 0) : t.points;
  return t.done + misses ? t.done / (t.done + misses) : 2;
};

/** Lowest rate first (either person's), ties to more points; habits with nothing settled last. */
export function worstFirst(world: World): HabitRow[] {
  const c = world.challenge;
  const people = [world.me, world.partner];
  const stats = new Map(
    people.map((p) => [
      p.id,
      new Map(habitStats(world, p.id).map((s) => [s.rule.id, s])),
    ]),
  );
  const rows = c.rules.flatMap((rule) => {
    const of = people.flatMap((person) => {
      const stat = stats.get(person.id)?.get(rule.id);
      return stat
        ? [{ person, stat, tally: habitTally(world, person.id, rule) }]
        : [];
    });
    if (!of.length) return [];
    const rate = Math.min(...of.map((x) => rateOf(x.tally)));
    const points = of.reduce((n, x) => n + x.tally.points, 0);
    return [{ rule, of, rate, points }];
  });
  return rows
    .sort((a, b) => a.rate - b.rate || b.points - a.points)
    .map(({ rule, of }) => ({ rule, of }));
}

/** Whose habit it is when only one person has it: "Only you", "Only Jordan" (as Invite and the pact say). */
function onlyWho(world: World, rule: Rule) {
  if (rule.who === 'both') return null;
  return rule.who === world.me.id ? 'Only you' : `Only ${world.partner.name}`;
}

/**
 * One habit as a card that is one button: its name, a thin bar per person and the streak going now.
 * Glass on the page, plain in a sheet.
 */
export function HabitCard({
  row,
  onOpen,
  glass = true,
}: {
  row: HabitRow;
  onOpen: (personId: string) => void;
  glass?: boolean;
}) {
  const world = useWorld();
  const { rule, of } = row;
  const only = onlyWho(world, rule);
  return (
    <button
      type="button"
      className={cn(
        glass ? 'nx-glass' : 'nx-card',
        'nx-tappable nx-pad-sm relative items-start gap-4 sm:p-5',
      )}
      onClick={() => onOpen(of[0].person.id)}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-nx-body font-semibold text-nx-ink">
            {rule.title}
          </span>
          {only && <span className="text-nx-2 text-nx-ink-2">{only}</span>}
        </span>
        <span className="mt-3 flex flex-col gap-2.5">
          {of.map(({ person, tally, stat }) => (
            <HabitLine
              key={person.id}
              person={person}
              tally={tally}
              stat={stat}
            />
          ))}
        </span>
      </span>
      <ChevronRight
        className="nx-row-chevron mt-0.5"
        size={22}
        aria-hidden="true"
      />
    </button>
  );
}

/** How many habit cards the page shows before "All 8 habits". */
const SHOWN = 3;

/**
 * The three weakest habits, worst first, then a row that opens every habit in the sheet. A card
 * opens its habit, with a chip to switch between the two of you.
 */
export function ByHabit({ detail }: { detail: Detail }) {
  const world = useWorld();
  const rows = worstFirst(world);
  return (
    <Stagger className="flex flex-col gap-2.5">
      {rows.slice(0, SHOWN).map((row) => (
        <HabitCard
          key={row.rule.id}
          row={row}
          onOpen={(personId) =>
            detail.show({ kind: 'habit', personId, ruleId: row.rule.id })
          }
        />
      ))}
      {rows.length > SHOWN && (
        <RowButton
          title={`All ${rows.length} habits`}
          onClick={() => detail.show({ kind: 'habits' })}
        />
      )}
    </Stagger>
  );
}

function HabitLine({
  person,
  tally,
  stat,
}: {
  person: Person;
  tally: Tally;
  stat: HabitStat;
}) {
  const weekly = stat.unit === 'week';
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
        parts={barParts(tally)}
        label={`${person.name}: ${tallyLine(tally)}`}
      />
      {/* A weekly streak says "weeks", so it never reads as days. */}
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-end gap-1 text-nx-2 whitespace-nowrap text-nx-ink-2 tabular-nums',
          weekly ? 'w-20' : 'w-11',
        )}
      >
        {stat.current > 0 && (
          <>
            <Flame size={16} className="text-nx-accent" aria-hidden="true" />
            {weekly ? (
              runLength(stat.current, 'week')
            ) : (
              <>
                {stat.current}
                <span className="sr-only">
                  {` ${stat.current === 1 ? 'day' : 'days'}`}
                </span>
              </>
            )}
            <span className="sr-only"> in a row</span>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * How close the next badge is, in days: "On a roll, 5 of 7 days". Unbroken counts the days the rule
 * with the longest run asks for, so a rule that skips days says which: "Unbroken, 10 of 22 Sun–Thu
 * days" beside "Unbroken, 18 of 30 days".
 */
function nextLine(
  world: World,
  personId: string,
  next: NonNullable<ReturnType<typeof nextBadge>>,
) {
  const { have, need, unit } = next.progress!;
  const run =
    next.id === 'streak-all'
      ? streaks(world, personId)
          .filter((s) => s.unit === 'day')
          .sort((a, b) => b.current - a.current)[0]
      : undefined;
  const days =
    run && run.rule.days.length < 7
      ? `${formatWeekdays(run.rule.days)} days`
      : unit.includes('day')
        ? 'days'
        : '';
  return `${next.title}, ${have} of ${need}${days ? ` ${days}` : ''}`;
}

/**
 * One row per person: how many badges are earned and the next one with how close it is. A row
 * opens that person's badges.
 */
export function BadgesBoth({ detail }: { detail: Detail }) {
  const world = useWorld();
  return (
    <Stagger className="flex flex-col gap-2.5">
      {[world.me, world.partner].map((p) => {
        const all = badges(world, p.id);
        const earned = all.filter((b) => b.earned).length;
        const next = nextBadge(world, p.id);
        const line = [
          `${earned} of ${all.length} earned`,
          next?.progress ? `next:\u00a0${nextLine(world, p.id, next)}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <RowButton
            key={p.id}
            leading={<Avatar person={p} decorative />}
            title={youOr(world, p)}
            detail={line}
            aria-label={`${youOr(world, p)}: badges, ${line}`}
            onClick={() => detail.show({ kind: 'badges', personId: p.id })}
          />
        );
      })}
    </Stagger>
  );
}
