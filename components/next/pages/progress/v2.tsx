// This week only, both of you: one card per habit with your days and Jordan's, weeks glide back and forth.
'use client';
import { createElement, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  Button,
  GlassCard,
  Glide,
  IconButton,
  PageTitle,
  RowButton,
} from '@/components/next/ui';
import {
  formatRange,
  formatWeekday,
  nextBadge,
  openDay,
  rulesFor,
  weekOf,
  weekProgress,
  weeksOf,
  type Week,
} from '@/lib/next/selectors';
import { InlineBar } from './bar';
import { Medal } from './day-grid';
import { useDetail, type Detail } from './detail';
import { DetailSheet } from './detail-sheet';
import { habitIcon, lockWords, mainAction } from './data';
import { WeekMarks } from './week';

/** Progress, version 2. */
export default function ProgressV2() {
  const world = useWorld();
  const { navigate } = useNav();
  const detail = useDetail();
  const c = world.challenge;
  const weeks = weeksOf(c).filter((w) => w.start <= world.today);
  const current = weekOf(c, world.today) ?? weeks[weeks.length - 1];
  const [shown, setShown] = useState(current.index);
  const [dir, setDir] = useState<1 | -1>(1);
  const week = weeks.find((w) => w.index === shown) ?? current;
  const isCurrent = week.index === current.index;
  const go = (step: 1 | -1) => {
    setDir(step);
    setShown(week.index + step);
  };

  const people = [world.me.id, world.partner.id];
  const mine = new Set(rulesFor(c, world.me.id).map((r) => r.id));
  const theirs = new Set(rulesFor(c, world.partner.id).map((r) => r.id));
  const rules = c.rules.filter((r) => mine.has(r.id) || theirs.has(r.id));
  const action = mainAction(world, world.me.id);
  const open = openDay(world);
  const next = nextBadge(world, world.me.id);

  return (
    <AppFrame>
      <div className="flex flex-col gap-6">
        <PageTitle
          title={isCurrent ? 'This week' : `Week ${week.index}`}
          detail={formatRange(week.start, week.end)}
          action={
            <span className="flex gap-2">
              <IconButton
                icon={ChevronLeft}
                label="Previous week"
                disabled={week.index <= 1}
                onClick={() => go(-1)}
              />
              <IconButton
                icon={ChevronRight}
                label="Next week"
                disabled={isCurrent}
                onClick={() => go(1)}
              />
            </span>
          }
        />

        {action && (
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
        )}

        <Glide id={week.start} direction={dir}>
          <ul className="flex flex-col gap-3">
            {rules.map((rule) => (
              <li key={rule.id}>
                <HabitWeek
                  rule={rule}
                  week={week}
                  people={people.filter((p) =>
                    (p === world.me.id ? mine : theirs).has(rule.id),
                  )}
                  detail={detail}
                />
              </li>
            ))}
          </ul>
        </Glide>

        {next && next.progress && (
          <RowButton
            leading={<Medal id={next.id} earned={false} size={44} />}
            title={`Next badge: ${next.title}`}
            detail={`${next.progress.have} of ${next.progress.need} ${next.progress.unit}`}
            onClick={() =>
              detail.show({
                kind: 'badge',
                personId: world.me.id,
                badgeId: next.id,
              })
            }
          />
        )}
      </div>
      <DetailSheet detail={detail} />
    </AppFrame>
  );
}

/**
 * One habit's week: its name opens the habit, then a line of seven days for each person who has
 * it. A weekly habit (gym) also says how many of its target each person has, as a segmented bar.
 */
function HabitWeek({
  rule,
  week,
  people,
  detail,
}: {
  rule: Rule;
  week: Week;
  people: string[];
  detail: Detail;
}) {
  const world = useWorld();
  const weekly = rule.kind === 'weekly';
  const nameOf = (id: string) =>
    id === world.me.id ? 'You' : world.partner.name;
  const openHabit = (personId: string) =>
    detail.show({ kind: 'habit', personId, ruleId: rule.id });
  return (
    <GlassCard as="article" pad="sm" className="flex flex-col gap-3 sm:p-5">
      <button
        type="button"
        className="nx-press -m-1 flex min-h-12 items-center gap-3 rounded-nx-sm p-1 text-left"
        onClick={() => openHabit(people[0])}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent">
          {createElement(habitIcon(rule), { size: 22, 'aria-hidden': true })}
        </span>
        <span className="min-w-0 flex-1 text-nx-body font-semibold text-nx-ink">
          {rule.title}
        </span>
        <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
      </button>
      {people.map((personId) => {
        const progress = weekly
          ? weekProgress(world, personId, rule.id, week.start)
          : null;
        const name = nameOf(personId);
        return (
          <div key={personId} className="flex flex-col gap-1.5">
            {progress && progress.need > 0 ? (
              <button
                type="button"
                className="nx-press -mx-1 flex min-h-11 items-center gap-3 rounded-nx-sm px-1 text-left"
                onClick={() => openHabit(personId)}
              >
                <span className="text-nx-2 font-semibold text-nx-ink">
                  {name}: {progress.have} of {progress.need}
                </span>
                <InlineBar
                  className="flex-1"
                  value={progress.have}
                  max={progress.need}
                  tone={progress.met ? 'done' : 'accent'}
                  segments
                />
              </button>
            ) : (
              <span className="text-nx-2 font-semibold text-nx-ink-2">
                {name}
              </span>
            )}
            <WeekMarks
              world={world}
              personId={personId}
              rule={rule}
              week={week}
              label={`${rule.title}, ${personId === world.me.id ? 'your' : `${name}’s`} week`}
              onOpen={(day) => detail.show({ kind: 'day', personId, day })}
            />
          </div>
        );
      })}
    </GlassCard>
  );
}
