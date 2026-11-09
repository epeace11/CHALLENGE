'use client';
import { setGoals } from '@/lib/next/actions';
import { GOAL_LENGTH, GOALS_MAX, goalsOf } from '@/lib/next/selectors';
import { useBackend } from '@/components/next/backend';
import { useWorld } from '@/components/next/world';

/**
 * Goals on Overview, shared by every version: the viewer's own (on their Overview), the partner's
 * (one tap away, in a sheet), and saving the viewer's list. Goals belong to this challenge and are
 * words only: nothing is scored and nothing is ticked off. A save shows at once (no pop-up); the
 * live app saves it, and a failed write says so.
 */
export function useGoals() {
  const world = useWorld();
  const backend = useBackend();
  const me = world.me.id;
  return {
    mine: goalsOf(world, me),
    theirs: goalsOf(world, world.partner.id),
    partner: world.partner,
    /** False until the partner has joined: there are no goals of theirs to show. */
    hasPartner: !world.partnerPending,
    /** Saves the viewer's goals in this order; resolves false when the live app couldn't. */
    save: (texts: string[]) => {
      const goals = texts
        .map((t) => t.trim().slice(0, GOAL_LENGTH))
        .filter(Boolean)
        .slice(0, GOALS_MAX);
      return backend.save({ type: 'setGoals', goals }, (w) =>
        setGoals(w, me, goals),
      );
    },
  };
}

export type GoalsFlow = ReturnType<typeof useGoals>;
