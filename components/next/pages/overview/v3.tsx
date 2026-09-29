// Version 3: side by side. Your Thursday next to what Jordan sent you, then a card each for you and Jordan (gift, gym, streak), then the week.
'use client';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import type { DateString, Person } from '@/lib/next/model';
import { formatDuration, formatMoney, plural } from '@/lib/next/selectors';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Avatar,
  Button,
  CountUp,
  GlassCard,
  PageTitle,
  ProgressBar,
  Section,
} from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { overviewOf, shortTitle, type Overview } from './data';
import { DaySheet, WeekLegend, WeekStrip } from './week';

/** One of the two panels at the top. The one with the main action is the filled button. */
function Panel({
  primary,
  who,
  value,
  what,
  detail,
  action,
  onClick,
}: {
  primary: boolean;
  who: ReactNode;
  value: ReactNode;
  what: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  const inside = (
    <span className="flex h-full w-full flex-col items-start gap-1 text-left">
      <span className="flex w-full items-center gap-2 text-nx-2 font-semibold">
        <span className="flex min-w-0 flex-1 items-center gap-2">{who}</span>
        <ArrowRight
          size={20}
          className={cn('shrink-0', !primary && 'text-nx-accent')}
          aria-hidden="true"
        />
      </span>
      <span className="mt-2 font-nx-serif text-nx-num-lg leading-none">
        {value}
      </span>
      <span className="text-nx-body">{what}</span>
      <span className={cn('text-nx-2', !primary && 'text-nx-ink-2')}>
        {detail}
      </span>
      <span
        className={cn(
          'mt-auto pt-4 text-nx-body font-semibold',
          !primary && 'text-nx-accent',
        )}
      >
        {action}
      </span>
    </span>
  );
  const box = 'h-full min-h-[208px] w-full rounded-nx-lg p-4 sm:p-5';
  return primary ? (
    <Button
      variant="primary"
      className={cn(
        box,
        'items-stretch justify-start whitespace-normal [&>.nx-btn-label]:w-full',
      )}
      onClick={onClick}
    >
      {inside}
    </Button>
  ) : (
    <button
      type="button"
      className={cn(box, 'nx-glass nx-tappable flex-col')}
      onClick={onClick}
    >
      {inside}
    </button>
  );
}

/** A number in a person card: a full-width button that says where it goes. */
function CardRow({
  label,
  value,
  hint,
  children,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="nx-press flex w-full flex-col items-start gap-1 border-t border-nx-line pt-3.5 pr-3 pb-3.5 pl-3 text-left hover:bg-nx-sunken focus-visible:-outline-offset-2 sm:pr-5 sm:pl-5"
      onClick={onClick}
    >
      <span className="flex w-full items-center gap-2">
        <span className="min-w-0 flex-1 text-nx-2 text-nx-ink-2">{label}</span>
        <ChevronRight
          size={20}
          className="shrink-0 text-nx-accent"
          aria-hidden="true"
        />
      </span>
      <span className="font-nx-serif text-nx-h2 leading-none text-nx-ink">
        {value}
      </span>
      {children}
      {hint && <span className="text-nx-2 text-nx-ink-2">{hint}</span>}
    </button>
  );
}

function PersonCard({
  person,
  mine,
  o,
  index,
}: {
  person: Person;
  mine: boolean;
  o: Overview;
  index: number;
}) {
  const world = useWorld();
  const { navigate } = useNav();
  const s = mine ? o.mine : o.theirs;
  const other = mine ? o.theirs : o.mine;
  const gym = o.gym && (mine ? o.gym.me : o.gym.partner);
  const streak = mine ? o.streak : o.partnerStreak;
  const ahead = o.lead.personId === person.id;
  // The card is a subgrid of the two-card grid, so each row lines up with the same row in the
  // other person's card even when one wraps to two lines.
  return (
    <GlassCard
      pad="none"
      className="nx-enter row-span-4 grid min-w-0 grid-rows-subgrid overflow-hidden"
      style={{ ['--nx-i' as string]: index } as CSSProperties}
    >
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-4 pb-2 sm:px-5">
        <Avatar person={person} decorative className="hidden sm:inline-grid" />
        <h3 className="font-nx-serif text-nx-h3">
          {mine ? 'You' : person.name}
        </h3>
        {ahead && (
          <span className="rounded-full bg-nx-done-soft px-2.5 py-0.5 text-nx-min font-semibold text-nx-done">
            Ahead
          </span>
        )}
      </div>
      <CardRow
        label={mine ? 'Your gift' : `${person.name}’s gift`}
        value={<CountUp value={s.gets} format={formatMoney} />}
        hint={
          mine
            ? `From ${world.partner.name}’s ${plural(other.points, 'point')}`
            : `From your ${plural(other.points, 'point')}`
        }
        onClick={() => navigate('gifts')}
      />
      {o.gym && gym ? (
        <CardRow
          label={`${o.gym.name} this week`}
          value={`${gym.have} of ${gym.need}`}
          hint={
            gym.met
              ? 'Done for the week'
              : `${plural(gym.daysLeft, 'day')} left`
          }
          onClick={() => navigate(mine ? 'log' : 'progress')}
        >
          <ProgressBar
            value={gym.have}
            max={gym.need}
            segments
            size="sm"
            tone={gym.met ? 'done' : 'accent'}
            label={`${mine ? 'Your' : `${person.name}’s`} ${o.gym.name.toLowerCase()} this week: ${gym.have} of ${gym.need}`}
            className="my-1 w-full max-w-40"
          />
        </CardRow>
      ) : (
        <span />
      )}
      {streak ? (
        <CardRow
          label="Streak"
          value={plural(streak.current, 'day')}
          hint={shortTitle(streak.rule)}
          onClick={() => navigate('progress')}
        />
      ) : (
        <span />
      )}
    </GlassCard>
  );
}

/** Overview, version 3. */
export default function OverviewV3() {
  const world = useWorld();
  const { navigate } = useNav();
  const o = useMemo(() => overviewOf(world), [world]);
  const [day, setDay] = useState<DateString | null>(null);
  const partner = world.partner;
  const logFirst = o.left > 0;

  return (
    <AppFrame>
      <div className="flex flex-col gap-8 pb-4">
        <PageTitle title={o.today} />

        <Section
          title={o.day ? o.dayLong : 'Today'}
          index={1}
          className="gap-2"
        >
          {o.day && (
            <p className="-mt-2 text-nx-2 text-nx-ink-2">
              Open until {o.closes}
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Panel
              primary={logFirst || o.waiting === 0}
              who="You"
              value={
                o.left > 0 ? (
                  <CountUp value={o.left} />
                ) : (
                  <Check size={44} strokeWidth={2.2} aria-label="Done" />
                )
              }
              what={o.left > 0 ? 'left to log' : 'all logged'}
              detail={
                o.left > 0
                  ? `${formatDuration(o.msLeft)} to go`
                  : o.onPartner > 0
                    ? `Waiting for ${partner.name}’s review`
                    : 'All reviewed'
              }
              action={o.left > 0 ? `Log ${o.dayName}` : 'See your answers'}
              onClick={() => navigate('log')}
            />
            <Panel
              primary={!logFirst && o.waiting > 0}
              who={partner.name}
              value={<CountUp value={o.waiting} />}
              what="waiting for you"
              detail={
                o.partnerDone
                  ? `Logged ${o.dayName}`
                  : `${plural(o.partnerLeft, 'check-in')} left to log`
              }
              action="Review"
              onClick={() => navigate('review')}
            />
          </div>
        </Section>

        <Section title={`You and ${partner.name}`} index={2}>
          <div className="grid grid-cols-2 grid-rows-[repeat(4,auto)] gap-x-3 gap-y-0">
            <PersonCard person={world.me} mine o={o} index={3} />
            <PersonCard person={partner} mine={false} o={o} index={4} />
          </div>
        </Section>

        <Section title="This week" index={5}>
          <GlassCard pad="sm" className="flex flex-col gap-3">
            <WeekStrip days={o.week} onOpen={setDay} />
            <WeekLegend days={o.week} className="px-1 pb-1" />
          </GlassCard>
        </Section>
      </div>
      <DaySheet day={day} onClose={() => setDay(null)} />
    </AppFrame>
  );
}
