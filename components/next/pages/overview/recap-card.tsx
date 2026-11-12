'use client';
import { ChevronRight } from 'lucide-react';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { Button, Enter, TapCard } from '@/components/next/ui';
import { headline, recapOf } from '../recap/data';
import { useRecapSeen } from '../recap/seen';

/**
 * Last week's recap, on Overview only (it isn't in More). Once a week is over it arrives as a card
 * under what matters now, until it's opened; after that, `quiet` shows it as one line under the week.
 */
export function LastWeek({ quiet = false }: { quiet?: boolean }) {
  const world = useWorld();
  const { navigate } = useNav();
  const v = recapOf(world);
  const seen = useRecapSeen(world.challenge.id, v?.recap.weekStart ?? null);
  if (!v || seen !== quiet) return null;
  if (quiet)
    return (
      <Button
        variant="quiet"
        iconEnd={ChevronRight}
        className="-ml-3 self-start"
        onClick={() => navigate('recap')}
      >
        Last week’s recap
      </Button>
    );
  return (
    <Enter index={2}>
      <TapCard className="w-full text-left" onClick={() => navigate('recap')}>
        <span className="flex flex-col gap-1">
          <span className="text-nx-2 text-nx-ink-2">Recap · {v.range}</span>
          <span className="font-nx-serif text-nx-h3 text-nx-ink">
            {headline(world, v)}
          </span>
          <span className="text-nx-2 text-nx-ink-2">
            Points: you {v.mine.points}, {world.partner.name} {v.theirs.points}
          </span>
        </span>
      </TapCard>
    </Enter>
  );
}
