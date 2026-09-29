// Version 2: a short list. The Log button is the whole top card, then one row each for review, gifts, the gym and a streak, then the week.
'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Clock3, Dumbbell, Flame, Gift, Inbox } from 'lucide-react';
import type { DateString } from '@/lib/next/model';
import { formatDuration, formatMoney, plural } from '@/lib/next/selectors';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  CountUp,
  Enter,
  GlassCard,
  PageTitle,
  ProgressBar,
  RowButton,
  Section,
  Stagger,
} from '@/components/next/ui';
import { IconBubble } from './bits';
import { overviewOf, shortTitle } from './data';
import { DaySheet, WeekLegend, WeekStrip } from './week';

/** The one main action as a big filled card: everything about it is inside the button. */
function MainCard({
  kicker,
  title,
  children,
  onClick,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      variant="primary"
      size="lg"
      full
      className="min-h-[136px] justify-start rounded-nx-lg pt-5 pr-6 pb-5 pl-6 text-left whitespace-normal [&>.nx-btn-label]:min-w-0 [&>.nx-btn-label]:flex-1"
      onClick={onClick}
    >
      <span className="flex flex-col gap-1">
        <span className="text-nx-2 font-semibold">{kicker}</span>
        <span className="flex items-center gap-3 font-nx-serif text-nx-h1 leading-tight">
          {title}
          <ArrowRight
            size={28}
            strokeWidth={2}
            className="shrink-0"
            aria-hidden="true"
          />
        </span>
        {children}
      </span>
    </Button>
  );
}

/** Overview, version 2. */
export default function OverviewV2() {
  const world = useWorld();
  const { navigate } = useNav();
  const o = useMemo(() => overviewOf(world), [world]);
  const [day, setDay] = useState<DateString | null>(null);
  const partner = world.partner.name;
  const gym = o.gym;

  const main =
    o.left > 0 ? (
      <MainCard
        kicker={o.dayLong}
        title={`Log ${o.dayName}`}
        onClick={() => navigate('log')}
      >
        <span className="text-nx-body">
          {plural(o.left, 'check-in')} left · {formatDuration(o.msLeft)} to go
        </span>
        <span className="flex items-center gap-1.5 text-nx-2">
          <Clock3 size={16} className="shrink-0" aria-hidden="true" />
          Closes at {o.closes}
        </span>
      </MainCard>
    ) : o.waiting > 0 ? (
      <MainCard
        kicker={o.day ? `${o.dayName} is logged` : 'Nothing to log'}
        title={`Review ${partner}’s answers`}
        onClick={() => navigate('review')}
      >
        <span className="text-nx-body">
          {plural(o.waiting, 'thing')} waiting
        </span>
      </MainCard>
    ) : (
      <MainCard
        kicker="Nothing to log or review"
        title="See your progress"
        onClick={() => navigate('progress')}
      />
    );

  return (
    <AppFrame>
      <div className="flex flex-col gap-8 pb-4">
        <PageTitle title={o.today} />

        <Enter index={1}>{main}</Enter>

        <Stagger className="flex flex-col gap-3" start={2}>
          <RowButton
            leading={
              <IconBubble icon={Inbox} tone={o.waiting > 0 ? 'wait' : 'done'} />
            }
            title={
              o.waiting > 0 ? (
                <>
                  <CountUp value={o.waiting} /> waiting for you
                </>
              ) : (
                'Nothing waiting for you'
              )
            }
            detail={
              o.waiting > 0
                ? o.waitingSummary
                : `${partner}’s answers show up here`
            }
            onClick={() => navigate('review')}
          />
          <RowButton
            leading={<IconBubble icon={Gift} />}
            title={
              <>
                Your gift is at{' '}
                <CountUp value={o.mine.gets} format={formatMoney} />
              </>
            }
            detail={
              <>
                {partner}’s is at{' '}
                <CountUp value={o.theirs.gets} format={formatMoney} />.{' '}
                {o.aheadLine}.
              </>
            }
            onClick={() => navigate('gifts')}
          />
          {gym && (
            <RowButton
              leading={
                <IconBubble
                  icon={Dumbbell}
                  tone={gym.me.met ? 'done' : 'accent'}
                />
              }
              title={`${gym.name} this week: ${gym.me.have} of ${gym.me.need}`}
              detail={[
                gym.me.met
                  ? 'Done for the week'
                  : `${gym.me.left} more to go, ${plural(gym.me.daysLeft, 'day')} left`,
                gym.partner &&
                  `${partner} ${gym.partner.have} of ${gym.partner.need}`,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <ProgressBar
                  value={gym.me.have}
                  max={gym.me.need}
                  segments
                  tone={gym.me.met ? 'done' : 'accent'}
                  label={`${gym.name} this week: ${gym.me.have} of ${gym.me.need}`}
                  className="w-28"
                />
              }
              onClick={() => navigate('log')}
            />
          )}
          {o.streak && (
            <RowButton
              leading={<IconBubble icon={Flame} tone="done" />}
              title={shortTitle(o.streak.rule)}
              detail={`${plural(o.streak.current, 'day')} in a row`}
              onClick={() => navigate('progress')}
            />
          )}
        </Stagger>

        <Section title="This week" index={6}>
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
