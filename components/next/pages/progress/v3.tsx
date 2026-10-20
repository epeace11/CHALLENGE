// What needs work: habits from weakest to strongest, the calendar one tap away, the main action pinned.
'use client';
import { useState } from 'react';
import { ArrowRight, CalendarDays, Flame } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  ActionBar,
  Button,
  PageTitle,
  RowButton,
  Section,
  SegmentedControl,
  Stagger,
} from '@/components/next/ui';
import { formatRange, lastDay, streakToProtect } from '@/lib/next/selectors';
import { InlineBar } from './bar';
import { useDetail } from './detail';
import { DetailSheet } from './detail-sheet';
import {
  habitIcon,
  habitStats,
  mainAction,
  runLength,
  type HabitStat,
} from './data';
import styles from './progress.module.css';

/** Progress, version 3. */
export default function ProgressV3() {
  const world = useWorld();
  const { navigate } = useNav();
  const detail = useDetail();
  const [personId, setPersonId] = useState(world.me.id);
  const c = world.challenge;
  const stats = weakestFirst(habitStats(world, personId));
  const streak = streakToProtect(world, personId);
  const action = mainAction(world, personId);

  return (
    <AppFrame>
      <div className="flex flex-col gap-6">
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

        <Stagger key={personId} className="flex flex-col gap-2.5">
          {streak && (
            <RowButton
              leading={
                <span className="grid size-11 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                  <Flame size={22} aria-hidden="true" />
                </span>
              }
              title={`${runLength(streak.current, 'day')} in a row`}
              detail={streak.rule.title}
              onClick={() =>
                detail.show({ kind: 'habit', personId, ruleId: streak.rule.id })
              }
            />
          )}
          <RowButton
            leading={
              <span className="grid size-11 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                <CalendarDays size={22} aria-hidden="true" />
              </span>
            }
            title="See the calendar"
            detail={formatRange(c.start, lastDay(c))}
            onClick={() => detail.show({ kind: 'calendar', personId })}
          />
        </Stagger>

        <Section title="Weakest first" index={1}>
          <Stagger key={personId} className="flex flex-col gap-2.5">
            {stats.map((s) => {
              const Icon = habitIcon(s.rule);
              const settled = s.done + s.missed;
              return (
                <RowButton
                  key={s.rule.id}
                  leading={
                    <span className="grid size-11 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                  }
                  title={s.rule.title}
                  detail={
                    <>
                      <span className="block">{workLine(s)}</span>
                      {settled > 0 && (
                        <InlineBar
                          className="mt-2 max-w-60"
                          value={s.done}
                          max={settled}
                          tone="done"
                        />
                      )}
                    </>
                  }
                  onClick={() =>
                    detail.show({ kind: 'habit', personId, ruleId: s.rule.id })
                  }
                />
              );
            })}
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

/** Lowest hit rate first; ties go to more misses. Habits with nothing settled go last. */
function weakestFirst(stats: HabitStat[]) {
  return [...stats].sort(
    (a, b) => (a.rate ?? 2) - (b.rate ?? 2) || b.missed - a.missed,
  );
}

/** "Missed 4 of 18 days", "Done all 18 days", plus this week's count for a weekly habit. */
function workLine(s: HabitStat) {
  const settled = s.done + s.missed;
  const unit = s.weekly ? 'week' : 'day';
  const so =
    settled === 0
      ? 'Nothing settled yet'
      : s.missed === 0
        ? s.weekly
          ? `Met all ${runLength(settled, unit)}`
          : `Done all ${runLength(settled, unit)}`
        : `Missed ${s.missed} of ${runLength(settled, unit)}`;
  if (s.weekly && s.week)
    return `${so} · ${s.week.have} of ${s.week.need} this week`;
  return so;
}
