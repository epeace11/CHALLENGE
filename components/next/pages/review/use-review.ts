'use client';
import { useState } from 'react';
import type { World } from '@/lib/next/model';
import {
  approve,
  concede,
  decideForgiveness,
  dispute,
  rejectCorrection,
  replyToDispute,
  withdrawDispute,
} from '@/lib/next/actions';
import { useToast } from '@/components/next/ui';
import { useDemo } from '@/components/next/world';
import type { Outcome } from './motion';
import {
  reviewState,
  type AnswerItem,
  type DisputeItem,
  type ForgiveItem,
  type LateItem,
} from './queue';

/**
 * Everything a Review version does: each decision changes the sample world at once (so the tab
 * count, Overview and Gifts follow), shows a toast with Undo, and records its outcome so the item
 * leaves with the right stamp.
 */
export function useReview() {
  const { world, update, undo } = useDemo();
  const toast = useToast();
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const partner = world.partner.name;

  function act(
    ids: string[],
    outcome: Outcome | null,
    change: (w: World) => World,
    text: string,
  ) {
    if (outcome)
      setOutcomes((o) => {
        const next = { ...o };
        for (const id of ids) next[id] = outcome;
        return next;
      });
    update(change);
    // Approvals are routine and the stamp already confirms them, so their Undo stays up for 4 s;
    // decisions that move points or money keep the kit's 6 s.
    toast({
      text,
      action: { label: 'Undo', onClick: undo },
      duration: outcome === 'approved' ? 4000 : undefined,
    });
  }

  return {
    world,
    state: reviewState(world),
    outcomes,
    approve: (item: AnswerItem | LateItem) =>
      act(
        [item.id],
        'approved',
        (w) => approve(w, item.entry.id),
        item.kind === 'correction' ? 'Late answer approved' : 'Approved',
      ),
    approveAll: (items: AnswerItem[]) =>
      act(
        items.map((i) => i.id),
        'approved',
        (w) => items.reduce((acc, i) => approve(acc, i.entry.id), w),
        `Approved ${items.length} answers`,
      ),
    dispute: (item: AnswerItem, reason: string) =>
      act(
        [item.id],
        'disputed',
        (w) => dispute(w, item.entry.id, w.me.id, reason),
        `Dispute sent to ${partner}`,
      ),
    declineLate: (item: LateItem) =>
      act(
        [item.id],
        'declined',
        (w) => rejectCorrection(w, item.entry.id),
        'Late answer declined',
      ),
    forgive: (item: ForgiveItem) =>
      act(
        [item.id],
        'forgiven',
        (w) => decideForgiveness(w, item.request.id, 'approved'),
        'Point forgiven',
      ),
    decline: (item: ForgiveItem) =>
      act(
        [item.id],
        'declined',
        (w) => decideForgiveness(w, item.request.id, 'denied'),
        'Forgiveness declined',
      ),
    concede: (item: DisputeItem) =>
      act(
        [item.id],
        'conceded',
        (w) => concede(w, item.dispute.id),
        'Conceded. It’s a point now.',
      ),
    reply: (item: DisputeItem, text: string) =>
      act(
        [item.id],
        'replied',
        (w) => replyToDispute(w, item.dispute.id, text),
        'Reply sent. The dispute stays open.',
      ),
    /** Takes back a dispute the viewer raised on the partner's answer. */
    withdraw: (disputeId: string) =>
      act([], null, (w) => withdrawDispute(w, disputeId), 'Dispute withdrawn'),
  };
}

export type Review = ReturnType<typeof useReview>;
