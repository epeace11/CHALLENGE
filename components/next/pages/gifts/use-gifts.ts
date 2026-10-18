'use client';
import type { World } from '@/lib/next/model';
import {
  askForgiveness,
  decideForgiveness,
  forgivePoint,
} from '@/lib/next/actions';
import {
  useBackend,
  useUndoAction,
  type Command,
} from '@/components/next/backend';
import { useToast } from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import type { PointRow } from './ledger';

/**
 * What the Gifts versions do. Each change goes into the sample world at once (the gift amounts
 * count to their new value, and Review and Overview follow) with a toast that can undo it.
 */
export function useGifts() {
  const world = useWorld();
  const backend = useBackend();
  const undoAction = useUndoAction();
  const toast = useToast();
  const act = (command: Command, change: (w: World) => World, text: string) => {
    backend.act(command, change);
    toast({ text, ...undoAction() });
  };
  return {
    world,
    /** Forgives the partner's point, deciding their request when they asked. */
    forgive: (row: PointRow) => {
      const request = row.pending;
      act(
        request
          ? {
              type: 'decideForgiveness',
              requestId: request.id,
              decision: 'approved',
            }
          : { type: 'forgivePoint', pointId: row.point.id },
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
          {
            type: 'decideForgiveness',
            requestId: request.id,
            decision: 'denied',
          },
          (w) => decideForgiveness(w, request.id, 'denied'),
          'Forgiveness declined',
        );
    },
    /** Asks the partner to forgive one of the viewer's points. */
    ask: (row: PointRow, reason: string) =>
      act(
        { type: 'askForgiveness', pointId: row.point.id, reason },
        (w) => askForgiveness(w, row.point.id, reason),
        `Asked ${world.partner.name} to forgive it`,
      ),
  };
}

export type Gifts = ReturnType<typeof useGifts>;
