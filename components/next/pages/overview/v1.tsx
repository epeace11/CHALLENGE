// Numbers first. Thursday's check-ins as one big number in the card with the Log button, then number buttons for review, gym and both gifts, then the week.
'use client';
import { Fragment, useMemo, useState } from 'react';
import { ArrowRight, CircleCheck, Clock3 } from 'lucide-react';
import type { DateString } from '@/lib/next/model';
import {
  formatDuration,
  formatMoney,
  plural,
  settling,
} from '@/lib/next/selectors';
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
  Section,
  StatButton,
} from '@/components/next/ui';
import { EndAskCard, LeaveSheet, endAskFrom } from '../settings/parts';
import { useAccount, useEndAsk } from '../settings/hooks';
import { overviewOf, shortTitle } from './data';
import { BeforeStart } from './before-start';
import { DaySheet, WeekLegend, WeekStrip } from './week';

/** Overview, version 1. Before Day 1 it shows the wait instead. */
export default function OverviewV1() {
  const world = useWorld();
  if (world.today < world.challenge.start)
    return (
      <AppFrame>
        <BeforeStart world={world} />
      </AppFrame>
    );
  return <Running />;
}

/** The partner asked to end the challenge early. It waits on you, so it comes first. */
function EndAsk() {
  const world = useWorld();
  const ending = useEndAsk();
  const account = useAccount(world);
  const [open, setOpen] = useState(false);
  if (!endAskFrom(world)) return null;
  return (
    <>
      <EndAskCard
        world={world}
        onKeep={ending.decline}
        onEnd={() => setOpen(true)}
      />
      <LeaveSheet
        world={world}
        open={open}
        onOpenChange={setOpen}
        onLeave={account.leave}
      />
    </>
  );
}

/** The last day is over but it isn't settled: there's no result until it is. */
function Settling() {
  const world = useWorld();
  const { navigate } = useNav();
  const over = settling(world);
  if (!over) return null;
  const partner = world.partner.name;
  return (
    <Enter index={1}>
      <GlassCard className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-nx-serif text-nx-h2">
            {over.disputes
              ? `Settle ${plural(over.disputes, 'dispute')} to see who won`
              : over.toReview
                ? `Review ${plural(over.toReview, 'answer')} to see who won`
                : `Waiting for ${partner} to review your answers`}
          </h2>
          <p className="text-nx-body text-nx-ink-2">
            {over.disputes
              ? 'The last day is over. The person who answered concedes, or the person who disputed it withdraws.'
              : over.toReview
                ? 'The last day is over. Answers nobody reviews count as approved after 48 hours.'
                : 'The last day is over. Answers nobody reviews count as approved after 48 hours, and then you’ll see who won.'}
          </p>
        </div>
        {over.yours > 0 && (
          <Button
            variant="primary"
            size="lg"
            iconEnd={ArrowRight}
            className="w-full sm:w-auto sm:self-start"
            onClick={() => navigate('review')}
          >
            Go to Review
          </Button>
        )}
      </GlassCard>
    </Enter>
  );
}

function Running() {
  const world = useWorld();
  const { navigate } = useNav();
  const o = useMemo(() => overviewOf(world), [world]);
  const [day, setDay] = useState<DateString | null>(null);
  const partner = world.partner.name;
  const gym = o.gym;

  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <PageTitle title={o.today} />

        <EndAsk />
        <Settling />

        {/* One column in order of what matters now. */}
        <div className="flex flex-col gap-8">
          {/* What matters now: logging Thursday, or reviewing once it is logged. */}
          <Enter index={1} className="flex flex-col gap-3">
            {o.left > 0 ? (
              <>
                {/* What is left and the button that logs it, as one: the card itself does
                    nothing, so there is one thing to tap. */}
                <GlassCard className="flex flex-col gap-5">
                  {/* The day is named once, on the button ("Log yesterday" under today's date). */}
                  <div className="flex flex-col gap-2">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-nx-serif text-nx-num-lg leading-none text-nx-accent tabular-nums">
                        <CountUp value={o.left} />
                      </span>
                      <span className="text-nx-lead text-nx-ink">
                        left to log
                      </span>
                    </p>
                    {/* Which ones, as plain words (they are not buttons); a name never breaks. */}
                    <p className="text-nx-body text-nx-ink">
                      {o.open.map((r, i) => (
                        <Fragment key={r.id}>
                          {i > 0 && '\u00a0· '}
                          <span className="inline-block">{shortTitle(r)}</span>
                        </Fragment>
                      ))}
                    </p>
                    <p className="flex items-center gap-1.5 text-nx-2 text-nx-ink-2">
                      <Clock3
                        size={16}
                        className="shrink-0"
                        aria-hidden="true"
                      />
                      {formatDuration(o.msLeft)} left, until {o.closes}
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    full
                    iconEnd={ArrowRight}
                    onClick={() => navigate('log')}
                  >
                    Log {o.dayName}
                  </Button>
                </GlassCard>
              </>
            ) : o.firstDay ? (
              <>
                {/* Day 1: nothing can be logged until tomorrow, so the card says when, and what. */}
                <GlassCard className="flex flex-col gap-2">
                  <p className="font-nx-serif text-nx-h3">Nothing to log yet</p>
                  <p className="text-nx-body text-nx-ink">{o.answerToday}</p>
                  <p className="text-nx-2 text-nx-ink-2">
                    {o.todayRules.map((r, i) => (
                      <Fragment key={r.id}>
                        {i > 0 && '\u00a0· '}
                        <span className="inline-block">{shortTitle(r)}</span>
                      </Fragment>
                    ))}
                  </p>
                </GlassCard>
                <Button
                  variant="primary"
                  size="lg"
                  full
                  iconEnd={ArrowRight}
                  onClick={() => navigate('practice')}
                >
                  Try a practice day
                </Button>
              </>
            ) : (
              <>
                <GlassCard className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-nx-done-soft text-nx-done">
                    <CircleCheck size={26} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-nx-serif text-nx-h3">
                      {o.day
                        ? `${o.dayName[0].toUpperCase()}${o.dayName.slice(1)} is logged`
                        : 'Nothing to log'}
                    </p>
                    {/* With something to review, the button under the card says what is next. */}
                    {o.waiting === 0 && (
                      <p className="text-nx-2 text-nx-ink-2">
                        Nothing waits for you either.
                      </p>
                    )}
                  </div>
                </GlassCard>
                {o.waiting > 0 ? (
                  <Button
                    variant="primary"
                    size="lg"
                    full
                    iconEnd={ArrowRight}
                    onClick={() => navigate('review')}
                  >
                    Review {partner}’s answers
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="lg"
                    full
                    iconEnd={ArrowRight}
                    onClick={() => navigate('progress')}
                  >
                    See your progress
                  </Button>
                )}
              </>
            )}
          </Enter>

          <div className="-mt-5 flex flex-col gap-8">
            {/* On Day 1 nobody has a point or anything to review yet, so those numbers wait. */}
            {!o.firstDay && (
              <Section title="Gifts" index={2}>
                {/* The hints say whose points set each gift; the line under them gives both counts. */}
                <div className="grid grid-cols-2 gap-3">
                  <StatButton
                    label="You get"
                    value={o.mine.gets}
                    format={formatMoney}
                    hint={`From ${partner}’s points`}
                    onClick={() => navigate('gifts')}
                  />
                  <StatButton
                    label={`${partner} gets`}
                    value={o.theirs.gets}
                    format={formatMoney}
                    hint="From your points"
                    onClick={() => navigate('gifts')}
                  />
                </div>
                {/* Both numbers and who's ahead (fewer points is ahead); it wraps on narrow phones. */}
                <Button
                  variant="quiet"
                  className="-ml-3 self-start text-left whitespace-normal"
                  onClick={() => navigate('gifts')}
                >
                  {o.aheadLine}
                </Button>
              </Section>
            )}

            <Enter index={3} className="grid gap-3 sm:grid-cols-2">
              {!o.firstDay && (
                <StatButton
                  label="Waiting for you"
                  value={o.waiting}
                  tone={o.waiting > 0 ? 'wait' : 'default'}
                  hint={o.waiting > 0 ? o.waitingSummary : 'Nothing to review'}
                  onClick={() => navigate('review')}
                />
              )}
              {gym ? (
                <StatButton
                  label={`${gym.name} this week`}
                  value={`${gym.me.have} of ${gym.me.need}`}
                  tone={gym.me.met ? 'done' : 'default'}
                  hint={
                    <>
                      <ProgressBar
                        value={gym.me.have}
                        max={gym.me.need}
                        segments
                        size="sm"
                        tone={gym.me.met ? 'done' : 'accent'}
                        label={`${gym.name} this week: ${gym.me.have} of ${gym.me.need}`}
                        className="mt-1 mb-2 w-36"
                      />
                      {[
                        gym.me.met
                          ? 'Done for the week'
                          : `${plural(gym.me.daysLeft, 'day')} left`,
                        gym.partner &&
                          `${partner} ${gym.partner.have} of ${gym.partner.need}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </>
                  }
                  onClick={() => navigate('log')}
                />
              ) : (
                o.streak && (
                  <StatButton
                    label="Your streak"
                    value={plural(o.streak.current, 'day')}
                    hint={shortTitle(o.streak.rule)}
                    onClick={() => navigate('progress')}
                  />
                )
              )}
            </Enter>
          </div>

          <Section title="This week" index={4}>
            <GlassCard pad="sm" className="flex flex-col gap-3">
              <WeekStrip
                days={o.week}
                onOpen={setDay}
                className="-mx-4 sm:mx-0"
              />
              <WeekLegend days={o.week} className="px-1 pb-1" />
            </GlassCard>
          </Section>
        </div>
      </div>
      <DaySheet day={day} onClose={() => setDay(null)} />
    </AppFrame>
  );
}
