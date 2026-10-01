// The month calendar comes first, one person at a time (You or Jordan), then habits and badges.
'use client';
import { useState } from 'react';
import { ArrowRight, Flame } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  GlassCard,
  PageTitle,
  RowButton,
  Section,
  SegmentedControl,
  Stagger,
  TapCard,
} from '@/components/next/ui';
import {
  badges,
  calendar,
  formatRange,
  formatWeekday,
  lastDay,
  nextBadge,
  openDay,
} from '@/lib/next/selectors';
import { InlineBar } from './bar';
import { DayGrid, Legend, Medal } from './day-grid';
import { useDetail } from './detail';
import { DetailSheet } from './detail-sheet';
import {
  LEGEND,
  habitIcon,
  habitStats,
  lockWords,
  mainAction,
  percent,
  runLength,
  type HabitStat,
} from './data';
import styles from './progress.module.css';

/** Progress, version 1. */
export default function ProgressV1() {
  const world = useWorld();
  const { navigate } = useNav();
  const detail = useDetail();
  const [personId, setPersonId] = useState(world.me.id);
  const isMe = personId === world.me.id;
  const c = world.challenge;
  const days = calendar(world, personId).map((d) => ({
    day: d.day,
    tone: d.color,
  }));
  const stats = habitStats(world, personId);
  const earned = badges(world, personId).filter((b) => b.earned);
  const next = nextBadge(world, personId);
  const action = mainAction(world, personId);
  const open = openDay(world);

  return (
    <AppFrame>
      <div className="flex flex-col gap-8 pb-6">
        <div className="flex flex-col gap-5">
          <PageTitle title="Progress" />
          <SegmentedControl
            label="Whose progress"
            value={personId}
            onChange={setPersonId}
            options={[
              { value: world.me.id, label: 'You' },
              { value: world.partner.id, label: world.partner.name },
            ]}
            className={`nx-enter w-full sm:max-w-sm ${styles.seg}`}
          />
        </div>

        <div className="grid gap-8">
          <Section
            title="Calendar"
            index={1}
            action={
              <span className="text-nx-2 text-nx-ink-2">
                {formatRange(c.start, lastDay(c))}
              </span>
            }
          >
            <GlassCard pad="sm" className="flex flex-col gap-4 sm:p-5">
              {action && (
                <div className="flex flex-col gap-3 border-b border-nx-line pb-4 sm:flex-row sm:items-center">
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
              )}
              <DayGrid
                key={personId}
                days={days}
                weekStart={c.weekStart}
                today={world.today}
                label={
                  isMe ? 'Your calendar' : `${world.partner.name}’s calendar`
                }
                onOpen={(day) => detail.show({ kind: 'day', personId, day })}
              />
              <Legend tones={LEGEND} />
            </GlassCard>
          </Section>

          <div className="flex flex-col gap-8">
            <Section title="Habits" index={2}>
              <Stagger key={personId} className="flex flex-col gap-2.5">
                {stats.map((s) => {
                  const Icon = habitIcon(s.rule);
                  return (
                    <RowButton
                      key={s.rule.id}
                      leading={
                        <span className="grid size-11 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                          <Icon size={22} aria-hidden="true" />
                        </span>
                      }
                      title={s.rule.title}
                      detail={<HabitLine stat={s} />}
                      onClick={() =>
                        detail.show({
                          kind: 'habit',
                          personId,
                          ruleId: s.rule.id,
                        })
                      }
                    />
                  );
                })}
              </Stagger>
            </Section>

            <Section title="Badges" index={3}>
              {next && next.progress && (
                <TapCard
                  onClick={() =>
                    detail.show({ kind: 'badge', personId, badgeId: next.id })
                  }
                >
                  <span className="flex items-center gap-4">
                    <Medal id={next.id} earned={false} size={52} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-nx-2 font-semibold text-nx-accent">
                        Next badge
                      </span>
                      <span className="text-nx-body font-semibold">
                        {next.title}
                      </span>
                      <span className="text-nx-2 text-nx-ink-2">
                        {next.progress.have} of {next.progress.need}{' '}
                        {next.progress.unit}
                      </span>
                    </span>
                  </span>
                  <InlineBar
                    className="mt-4"
                    value={next.progress.have}
                    max={next.progress.need}
                  />
                </TapCard>
              )}
              <RowButton
                leading={
                  earned.length > 0 ? (
                    <span className="flex -space-x-3">
                      {earned.slice(0, 3).map((b) => (
                        <Medal
                          key={b.id}
                          id={b.id}
                          earned
                          size={40}
                          className="ring-2 ring-nx-surface"
                        />
                      ))}
                    </span>
                  ) : undefined
                }
                title={
                  earned.length === 1
                    ? '1 badge earned'
                    : `${earned.length} badges earned`
                }
                detail={
                  earned.length > 2
                    ? `${earned[0].title}, ${earned[1].title} and ${earned.length - 2} more`
                    : earned.length > 0
                      ? earned.map((b) => b.title).join(' and ')
                      : 'How each one is earned'
                }
                onClick={() => detail.show({ kind: 'badges', personId })}
              />
            </Section>
          </div>
        </div>
      </div>
      <DetailSheet detail={detail} />
    </AppFrame>
  );
}

/** "6 days in a row · done 92% of days", or this week's count for a weekly habit. */
function HabitLine({ stat: s }: { stat: HabitStat }) {
  if (s.weekly && s.week)
    return (
      <>
        {s.week.have} of {s.week.need} this week
        {s.week.met ? '' : `, ${runLength(s.week.daysLeft, 'day')} left`}
        {s.current > 0 ? ` · ${runLength(s.current, 'week')} in a row` : ''}
      </>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      {s.current > 0 && (
        <span className="inline-flex items-center gap-1">
          <Flame size={16} className="text-nx-accent" aria-hidden="true" />
          {runLength(s.current, 'day')} in a row
        </span>
      )}
      {s.current > 0 && s.rate !== null && <span aria-hidden="true">·</span>}
      {s.rate !== null ? (
        <span>done {percent(s.rate)} of days</span>
      ) : (
        <span>Nothing settled yet</span>
      )}
    </span>
  );
}
