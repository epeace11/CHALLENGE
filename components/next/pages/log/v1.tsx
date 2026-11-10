// Focus: one question fills the screen with Save pinned below; the logged day shows a square per check-in, then the streak.
'use client';
import { Flame } from 'lucide-react';
import { useNav } from '@/components/next/nav';
import { Enter } from '@/components/next/ui';
import { plural } from '@/lib/next/selectors';
import { DaySquares } from './day-squares';
import { NextActions, shortTitle, streakAfter } from './end';
import { CheckinPage, type EndProps } from './page';
import { LinkLine } from './question';

export default function LogV1() {
  return <CheckinPage end={AtAGlance} endActions={NextActions} />;
}

function AtAGlance({ ci, headingRef }: EndProps) {
  const { navigate } = useNav();
  const day = ci.day ?? '';
  const streak = streakAfter(ci.world, ci.me, day);
  // Compact on phones, so the streak shows above the pinned bar at 375×812 without scrolling.
  return (
    <section className="flex flex-col gap-4 pt-2 pb-4 sm:gap-5 sm:pt-4">
      <Enter>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="font-nx-serif text-nx-h2 text-balance outline-none sm:text-nx-h1"
        >
          {/* The day is on the button above, so the heading doesn't name it again. A day with no
              check-ins of yours (weekday-only rules, or every rule your partner's) says so. */}
          {ci.rules.length ? 'All logged' : 'Nothing to answer'}
        </h2>
      </Enter>
      <DaySquares ci={ci} />
      <Enter index={ci.rules.length + 1} className="flex flex-col gap-2">
        {streak && (
          <LinkLine
            icon={Flame}
            className="-mx-3 w-[calc(100%+24px)]"
            onClick={() => navigate('progress')}
          >
            {shortTitle(streak.rule)} ·{' '}
            <span className="whitespace-nowrap">
              {plural(streak.current, 'day')} in a row
            </span>
          </LinkLine>
        )}
        {/* The squares show how each answer stands; the line says until when one can change. */}
        {ci.rules.length > 0 && (
          <p className="text-nx-2 text-nx-ink-2">
            You can change an answer until {ci.lockLabel(day)}.
          </p>
        )}
      </Enter>
    </section>
  );
}
