// The end of a day: the main action, the streak, short rule names.
'use client';
import { ArrowRight, ListChecks } from 'lucide-react';
import type { DateString, Rule, World } from '@/lib/next/model';
import { reviewQueue, streaks } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { Button } from '@/components/next/ui';
import type { EndActionsProps } from './page';

/** "Social media and games" for "Social media and games, 60 min or less". */
export const shortTitle = (rule: Rule) => rule.title.split(',')[0];

/**
 * The longest daily streak still going once `day` is answered (3 days or more), like
 * streakToProtect but counting the day just logged even when it is today.
 */
export function streakAfter(w: World, personId: string, day: DateString) {
  const top = streaks(w, personId, day)
    .filter((s) => s.unit === 'day')
    .sort((a, b) => b.current - a.current)[0];
  return top && top.current >= 3 ? top : null;
}

/** Review the partner's answers when something waits for you, else Overview; the day's answers second. */
export function NextActions({ ci, showAnswers }: EndActionsProps) {
  const { navigate } = useNav();
  const review = reviewQueue(ci.world, ci.me).count > 0;
  return (
    <>
      <Button
        variant="primary"
        size="lg"
        full
        iconEnd={ArrowRight}
        className="sm:w-auto sm:min-w-56"
        onClick={() => navigate(review ? 'review' : 'overview')}
      >
        {review ? `Review ${ci.partner}’s answers` : 'Go to Overview'}
      </Button>
      <Button icon={ListChecks} onClick={showAnswers}>
        See answers
      </Button>
    </>
  );
}
