// Numbers first. Thursday's check-ins as one big number above the Log button, then number buttons for review, gym and both gifts, then the week.
'use client';
import { useMemo, useState } from 'react';
import { ArrowRight, CircleCheck, Clock3 } from 'lucide-react';
import type { DateString } from '@/lib/next/model';
import { formatDuration, formatMoney, plural } from '@/lib/next/selectors';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  Enter,
  GlassCard,
  PageTitle,
  ProgressBar,
  Section,
  StatButton,
} from '@/components/next/ui';
import { overviewOf, shortTitle } from './data';
import { DaySheet, WeekLegend, WeekStrip } from './week';

/** Overview, version 1. */
export default function OverviewV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const o = useMemo(() => overviewOf(world), [world]);
  const [day, setDay] = useState<DateString | null>(null);
  const partner = world.partner.name;
  const gym = o.gym;

  return (
    <AppFrame>
      <div className="flex flex-col gap-8 pb-4">
        <PageTitle title={o.today} />

        {/* One column in order of what matters now. */}
        <div className="flex flex-col gap-8">
          {/* What matters now: logging Thursday, or reviewing once it is logged. */}
          <Enter index={1} className="flex flex-col gap-3">
            {o.left > 0 ? (
              <>
                <StatButton
                  size="lg"
                  tone="accent"
                  label={`Left to log for ${o.dayName}`}
                  value={o.left}
                  hint={
                    <>
                      <span className="flex items-center gap-1.5">
                        <Clock3
                          size={16}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                        {formatDuration(o.msLeft)} left, until {o.closes}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        {o.open.map((r) => (
                          <span
                            key={r.id}
                            className="rounded-full bg-nx-sunken px-3 py-1 text-nx-min text-nx-ink"
                          >
                            {shortTitle(r)}
                          </span>
                        ))}
                      </span>
                    </>
                  }
                  onClick={() => navigate('log')}
                />
                <Button
                  variant="primary"
                  size="lg"
                  full
                  iconEnd={ArrowRight}
                  onClick={() => navigate('log')}
                >
                  Log {o.dayName}
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
                      {o.day ? `${o.dayName} is logged` : 'Nothing to log'}
                    </p>
                    <p className="text-nx-2 text-nx-ink-2">
                      {o.waiting > 0
                        ? `${partner}’s answers are next.`
                        : 'Nothing waits for you either.'}
                    </p>
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
            <Enter index={2} className="grid gap-3 sm:grid-cols-2">
              <StatButton
                label="Waiting for you"
                value={o.waiting}
                tone={o.waiting > 0 ? 'wait' : 'default'}
                hint={o.waiting > 0 ? o.waitingSummary : 'Nothing to review'}
                onClick={() => navigate('review')}
              />
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

            <Section
              title="Gifts"
              index={3}
              action={
                <Button
                  variant="quiet"
                  className="-mr-3"
                  onClick={() => navigate('gifts')}
                >
                  {o.aheadLine}
                </Button>
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <StatButton
                  label="Your gift"
                  value={o.mine.gets}
                  format={formatMoney}
                  hint={`From ${partner}’s ${plural(o.theirs.points, 'point')}`}
                  onClick={() => navigate('gifts')}
                />
                <StatButton
                  label={`${partner}’s gift`}
                  value={o.theirs.gets}
                  format={formatMoney}
                  hint={`From your ${plural(o.mine.points, 'point')}`}
                  onClick={() => navigate('gifts')}
                />
              </div>
            </Section>
          </div>

          <Section title="This week" index={4}>
            <GlassCard pad="sm" className="flex flex-col gap-3">
              <WeekStrip days={o.week} onOpen={setDay} />
              <WeekLegend days={o.week} className="px-1 pb-1" />
            </GlassCard>
          </Section>
        </div>
      </div>
      <DaySheet day={day} onClose={() => setDay(null)} />
    </AppFrame>
  );
}
