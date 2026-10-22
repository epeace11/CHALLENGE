'use client';
import { ArrowRight, BookOpen } from 'lucide-react';
import type { World } from '@/lib/next/model';
import { daysBetween } from '@/lib/next/calendar';
import { formatDay, plural } from '@/lib/next/selectors';
import { useNav } from '@/components/next/nav';
import { Button, Enter, PageTitle, StatButton } from '@/components/next/ui';

/**
 * Overview before Day 1, once both have signed: how long until it starts, a practice day to try the
 * check-in, and the rules. Nothing counts yet.
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
        detail={`You’ve both signed. Nothing counts until then.`}
      />
      <Enter index={1} className="flex flex-col gap-3">
        <StatButton
          size="lg"
          tone="accent"
          label="Day 1 starts in"
          value={plural(days, 'day')}
          hint={`${formatDay(c.start)}. See what happens that day.`}
          onClick={() => navigate('rules')}
        />
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
