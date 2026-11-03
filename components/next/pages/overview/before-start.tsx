'use client';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { World } from '@/lib/next/model';
import { daysBetween } from '@/lib/next/calendar';
import { answerLine, formatDay } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { Button, Enter, PageTitle } from '@/components/next/ui';

/**
 * Overview before Day 1, once both have signed: when it starts and when its first check-in is
 * answered, a practice day to try the check-in, and the rules. The top bar already says "Starts…".
 */
export function BeforeStart({ world }: { world: World }) {
  const { navigate } = useNav();
  const c = world.challenge;
  const days = daysBetween(world.today, c.start);
  return (
    <div className="flex flex-col gap-8">
      <PageTitle
        title={
          days === 1 ? 'Day 1 is tomorrow' : `Day 1 is ${formatDay(c.start)}`
        }
        detail={`You’ve both signed. ${answerLine(world, c.start)}`}
      />
      <Enter index={1} className="flex flex-col gap-3">
        <Button
          variant="primary"
          size="lg"
          full
          iconEnd={ArrowRight}
          onClick={() => navigate('practice')}
        >
          Try a practice day
        </Button>
        <Button
          variant="quiet"
          icon={BookOpen}
          className="-ml-3 self-start"
          onClick={() => navigate('rules')}
        >
          Read the rules
        </Button>
      </Enter>
    </div>
  );
}
