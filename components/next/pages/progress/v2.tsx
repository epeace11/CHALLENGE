// Version 2: the streak to protect comes first and largest, habits are cards ranked by streak, and the main action rides in a bar at the bottom.
'use client';
import { useState } from 'react';
import { ArrowRight, ChevronRight, Flame } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  ActionBar,
  Button,
  CountUp,
  GlassCard,
  PageTitle,
  PersonChip,
  Section,
  Stagger,
  TapCard,
} from '@/components/next/ui';
import {
  badges,
  calendar,
  nextBadge,
  streakToProtect,
} from '@/lib/next/selectors';
import { InlineBar } from './bar';
import { DayGrid, Legend, Medal } from './day-grid';
import { useDetail } from './detail';
import { DetailSheet } from './detail-sheet';
import {
  LEGEND,
  habitIcon,
  habitStats,
  mainAction,
  percent,
  runLength,
} from './data';
import styles from './progress.module.css';

/** Progress, version 2. */
export default function ProgressV2() {
  const world = useWorld();
  const { navigate } = useNav();
  const detail = useDetail();
  const [personId, setPersonId] = useState(world.me.id);
  const isMe = personId === world.me.id;
  const c = world.challenge;
  const protect = streakToProtect(world, personId);
  const next = nextBadge(world, personId);
  // A streak badge is earned by the streak shown first, so it rides along with it.
  const streakBadge =
    protect && next && next.progress && next.id.startsWith('streak')
      ? next
      : null;
  const ordered = [...habitStats(world, personId)].sort(
    (a, b) => Number(b.weekly) - Number(a.weekly) || b.current - a.current,
  );
  const earned = badges(world, personId).filter((b) => b.earned);
  const tiles = [...(next && !streakBadge ? [next] : []), ...earned];
  const action = mainAction(world, personId);

  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <PageTitle title="Progress" />
          <fieldset className="nx-enter flex min-w-0 flex-wrap gap-2">
            <legend className="sr-only">Whose progress</legend>
            <PersonChip
              person={world.me}
              pressed={isMe}
              onClick={() => setPersonId(world.me.id)}
            >
              You
            </PersonChip>
            <PersonChip
              person={world.partner}
              pressed={!isMe}
              onClick={() => setPersonId(world.partner.id)}
            />
          </fieldset>
        </div>

        {protect && (
          <GlassCard key={`hero-${personId}`} pad="none" className="nx-enter">
            <button
              type="button"
              className="nx-press flex w-full items-start gap-4 rounded-nx-lg p-6 text-left sm:p-8"
              onClick={() =>
                detail.show({
                  kind: 'habit',
                  personId,
                  ruleId: protect.rule.id,
                })
              }
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="nx-kicker">
                  {isMe
                    ? 'Your streak to protect'
                    : `${world.partner.name}’s streak to protect`}
                </span>
                <span
                  className={`${styles.rise} flex items-baseline gap-3 pt-1`}
                >
                  <span className="font-nx-serif text-nx-num-xl text-nx-accent">
                    <CountUp value={protect.current} />
                  </span>
                  <span className="text-nx-lead text-nx-ink-2">
                    days in a row
                  </span>
                </span>
                <span className="text-nx-lead font-semibold">
                  {protect.rule.title}
                </span>
              </span>
              <ChevronRight
                className="nx-row-chevron mt-1"
                size={22}
                aria-hidden="true"
              />
            </button>
            {streakBadge && streakBadge.progress && (
              <button
                type="button"
                className="nx-press flex w-full items-center gap-4 rounded-b-nx-lg border-t border-nx-line px-6 py-4 text-left sm:px-8"
                onClick={() =>
                  detail.show({
                    kind: 'badge',
                    personId,
                    badgeId: streakBadge.id,
                  })
                }
              >
                <Medal id={streakBadge.id} earned={false} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-nx-2 text-nx-ink-2">
                    {moreDays(
                      streakBadge.progress.need - streakBadge.progress.have,
                    )}{' '}
                    for the {streakBadge.title} badge
                  </span>
                  <InlineBar
                    value={streakBadge.progress.have}
                    max={streakBadge.progress.need}
                  />
                </span>
                <ChevronRight
                  className="nx-row-chevron"
                  size={20}
                  aria-hidden="true"
                />
              </button>
            )}
          </GlassCard>
        )}

        <Section title="Habits" index={1}>
          <Stagger key={personId} className="grid gap-3 sm:grid-cols-2">
            {ordered.map((s) => {
              const Icon = habitIcon(s.rule);
              return (
                <TapCard
                  key={s.rule.id}
                  className="h-full"
                  onClick={() =>
                    detail.show({ kind: 'habit', personId, ruleId: s.rule.id })
                  }
                >
                  <span className="flex flex-col gap-3">
                    <span className="flex items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="text-nx-body font-semibold">
                        {s.rule.title}
                      </span>
                    </span>
                    {s.weekly && s.week ? (
                      <span className="flex flex-col gap-2">
                        <span className="flex items-baseline gap-2">
                          <span className="font-nx-serif text-nx-num">
                            {s.week.have} of {s.week.need}
                          </span>
                          <span className="text-nx-2 text-nx-ink-2">
                            this week
                          </span>
                        </span>
                        <InlineBar
                          value={s.week.have}
                          max={s.week.need}
                          segments
                          tone={s.week.met ? 'done' : 'accent'}
                        />
                        <span className="text-nx-2 text-nx-ink-2">
                          {s.week.met
                            ? 'Done for the week'
                            : `${s.week.left} more to go, ${runLength(s.week.daysLeft, 'day')} left`}
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-col gap-1">
                        <span className="flex items-center gap-2">
                          <Flame
                            size={22}
                            className={
                              s.current > 0 ? 'text-nx-accent' : 'text-nx-ink-2'
                            }
                            aria-hidden="true"
                          />
                          <span className="font-nx-serif text-nx-num">
                            {s.current}
                          </span>
                          <span className="text-nx-2 text-nx-ink-2">
                            {s.current === 1 ? 'day' : 'days'} in a row
                          </span>
                        </span>
                        <span className="text-nx-2 text-nx-ink-2">
                          {s.rate !== null
                            ? `Done ${percent(s.rate)} of days`
                            : 'Nothing settled yet'}
                        </span>
                      </span>
                    )}
                  </span>
                </TapCard>
              );
            })}
          </Stagger>
        </Section>

        <Section title="Calendar" index={2}>
          <GlassCard pad="sm" className="flex flex-col gap-4 sm:p-5">
            <DayGrid
              key={personId}
              days={calendar(world, personId).map((d) => ({
                day: d.day,
                tone: d.color,
              }))}
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

        <Section
          title="Badges"
          index={3}
          action={
            <Button
              variant="quiet"
              onClick={() => detail.show({ kind: 'badges', personId })}
            >
              See all
            </Button>
          }
        >
          <Stagger
            key={personId}
            className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3"
          >
            {tiles.map((b) => (
              <button
                key={b.id}
                type="button"
                className="nx-card nx-tappable h-full flex-col items-center gap-2 px-3 py-4 text-center"
                onClick={() =>
                  detail.show({ kind: 'badge', personId, badgeId: b.id })
                }
              >
                <Medal id={b.id} earned={b.earned} size={48} />
                <span className="text-nx-2 font-semibold text-nx-ink">
                  {b.title}
                </span>
                {!b.earned && b.progress && (
                  <span className="text-nx-2 text-nx-ink-2">
                    {b.progress.have} of {b.progress.need}
                  </span>
                )}
              </button>
            ))}
          </Stagger>
        </Section>
      </div>

      {action && (
        <ActionBar>
          <Button
            variant="primary"
            size="lg"
            full
            iconEnd={ArrowRight}
            onClick={() => navigate(action.page)}
          >
            {action.label}
          </Button>
        </ActionBar>
      )}
      <DetailSheet detail={detail} />
    </AppFrame>
  );
}

/** "12 more days", "1 more day". */
const moreDays = (n: number) => `${n} more ${n === 1 ? 'day' : 'days'}`;
