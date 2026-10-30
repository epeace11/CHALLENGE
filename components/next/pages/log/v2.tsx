// What happens next: the logged day leads into what Jordan reviews, the day's points and the streak, as rows.
'use client';
import { Check, Flame, Gift, type LucideIcon } from 'lucide-react';
import type { DateString, World } from '@/lib/next/model';
import {
  activePoints,
  formatMoney,
  formatWeekday,
  pendingRequestFor,
  plural,
  pointCost,
  ruleById,
  waitingOnPartner,
} from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { Avatar, Enter, RowButton, Stagger } from '@/components/next/ui';
import { cn } from '@/lib/utils';
import { NextActions, shortTitle, streakAfter } from './end';
import { CheckinPage, type EndProps } from './page';
import styles from './log.module.css';

export default function LogV2() {
  return <CheckinPage end={WhatNext} endActions={NextActions} />;
}

/** "a, b and c". */
const list = (parts: string[]) =>
  parts.length < 2
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/** "your 2 answers and 1 request": what waits on the partner, by kind ("your answer" for one). */
function waitingWords(w: World, personId: string) {
  const q = waitingOnPartner(w, personId);
  const kinds: [number, string][] = [
    [q.answers.length + q.corrections.length, 'answer'],
    [q.forgiveness.length, 'request'],
    [q.disputes.length, 'dispute'],
  ];
  const shown = kinds.filter(([n]) => n > 0);
  const words =
    q.count === 1 && shown.length === 1
      ? shown[0][1]
      : list(shown.map(([n, word]) => plural(n, word)));
  return { count: q.count, words: `your ${words}` };
}

/** The points `personId` got for `day`: how many, what they add to the gift, and for which rules. */
function dayPoints(w: World, personId: string, day: DateString) {
  const points = activePoints(w, personId).filter((p) => p.day === day);
  const names = [
    ...new Set(
      points.map((p) => {
        const rule = ruleById(w.challenge, p.ruleId);
        return rule ? shortTitle(rule) : '';
      }),
    ),
  ].filter(Boolean);
  return {
    count: points.length,
    cost: points.reduce((sum, p) => sum + pointCost(w, p), 0),
    names,
    asked: points.some((p) => !!pendingRequestFor(w, p.id)),
  };
}

/** A round icon in a tone, the size of an avatar, to lead a row. */
function Mark({
  icon: Icon,
  tone,
}: {
  icon: LucideIcon;
  tone: 'done' | 'missed' | 'accent';
}) {
  return (
    <span
      className={cn(
        'grid size-10 place-items-center rounded-full',
        tone === 'done' && 'bg-nx-done-soft text-nx-done',
        tone === 'missed' && 'bg-nx-missed-soft text-nx-missed',
        tone === 'accent' && 'bg-nx-accent-soft text-nx-accent',
      )}
    >
      <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

function WhatNext({ ci, headingRef }: EndProps) {
  const { navigate } = useNav();
  const { world, me } = ci;
  const day = ci.day ?? '';
  const waiting = waitingWords(world, me);
  const points = dayPoints(world, me, day);
  const streak = streakAfter(world, me, day);
  return (
    <section className="flex flex-col gap-5 pt-5 pb-4">
      <Enter className="flex items-center gap-3.5">
        <span className={styles.doneMark} data-size="sm">
          <Check size={26} strokeWidth={2.6} aria-hidden="true" />
        </span>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 font-nx-serif text-nx-h1 text-balance outline-none"
        >
          {formatWeekday(day)} is logged
        </h2>
      </Enter>
      <Stagger start={1} className="flex flex-col gap-2.5">
        {waiting.count > 0 && (
          <RowButton
            leading={<Avatar person={world.partner} decorative />}
            title={`${ci.partner} reviews ${waiting.words} next`}
            onClick={() => navigate('review')}
          />
        )}
        <RowButton
          leading={
            <Mark icon={Gift} tone={points.count > 0 ? 'missed' : 'done'} />
          }
          title={
            points.count > 0
              ? `${plural(points.count, 'new point')} · ${formatMoney(points.cost)}`
              : `No new points for ${formatWeekday(day)}`
          }
          detail={
            points.count > 0
              ? [
                  points.names.join(', '),
                  points.asked && `You asked ${ci.partner} to forgive it`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : undefined
          }
          onClick={() => navigate('gifts')}
        />
        {streak && (
          <RowButton
            leading={<Mark icon={Flame} tone="accent" />}
            title={`${plural(streak.current, 'day')} in a row`}
            detail={shortTitle(streak.rule)}
            onClick={() => navigate('progress')}
          />
        )}
      </Stagger>
      <Enter index={4}>
        <p className="text-nx-2 text-nx-ink-2">
          You can change an answer until {ci.lockLabel(day)}.
        </p>
      </Enter>
    </section>
  );
}
