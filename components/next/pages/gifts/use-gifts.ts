'use client';
import type { World } from '@/lib/next/model';
import {
  askForgiveness,
  decideForgiveness,
  forgivePoint,
} from '@/lib/next/actions';
import { useToast } from '@/components/next/ui';
import { useDemo } from '@/components/next/world';
import type { PointRow } from './ledger';

/**
 * What the Gifts versions do. Each change goes into the sample world at once (the gift amounts
 * count to their new value, and Review and Overview follow) with a toast that can undo it.
 */
export function useGifts() {
  const { world, update, undo } = useDemo();
  const toast = useToast();
  const act = (change: (w: World) => World, text: string) => {
    update(change);
    toast({ text, action: { label: 'Undo', onClick: undo } });
  };
  return {
    world,
    /** Forgives the partner's point, deciding their request when they asked. */
    forgive: (row: PointRow) => {
      const request = row.pending;
      act(
        (w) =>
          request
            ? decideForgiveness(w, request.id, 'approved')
            : forgivePoint(w, row.point.id),
        'Point forgiven',
      );
    },
    /** Turns down the partner's request; the point stays. */
    decline: (row: PointRow) => {
      const request = row.pending;
      if (request)
        act(
          (w) => decideForgiveness(w, request.id, 'denied'),
          'Forgiveness declined',
        );
    },
    /** Asks the partner to forgive one of the viewer's points. */
    ask: (row: PointRow, reason: string) =>
      act(
        (w) => askForgiveness(w, row.point.id, reason),
        `Asked ${world.partner.name} to forgive it`,
      ),
  };
}

export type Gifts = ReturnType<typeof useGifts>;
