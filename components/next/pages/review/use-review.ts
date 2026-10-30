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
import { useBackend, type Command } from '@/components/next/backend';
import { useWorld } from '@/components/next/world';
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
 * count, Overview and Gifts follow) and records its outcome so the item leaves with the right stamp.
 */
export function useReview() {
  const world = useWorld();
  const backend = useBackend();
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});

  function act(
    ids: string[],
    outcome: Outcome | null,
    command: Command | Command[],
    change: (w: World) => World,
  ) {
    if (outcome)
      setOutcomes((o) => {
        const next = { ...o };
        for (const id of ids) next[id] = outcome;
        return next;
      });
    backend.act(command, change);
  }

  return {
    world,
    state: reviewState(world),
    outcomes,
    approve: (item: AnswerItem | LateItem) =>
      act(
        [item.id],
        'approved',
        { type: 'approve', entryId: item.entry.id },
        (w) => approve(w, item.entry.id),
      ),
    approveAll: (items: AnswerItem[]) =>
      act(
        items.map((i) => i.id),
        'approved',
        items.map((i) => ({ type: 'approve', entryId: i.entry.id }) as const),
        (w) => items.reduce((acc, i) => approve(acc, i.entry.id), w),
      ),
    dispute: (item: AnswerItem, reason: string) =>
      act(
        [item.id],
        'disputed',
        { type: 'dispute', entryId: item.entry.id, comment: reason },
        (w) => dispute(w, item.entry.id, w.me.id, reason),
      ),
    declineLate: (item: LateItem) =>
      act(
        [item.id],
        'declined',
        { type: 'rejectCorrection', entryId: item.entry.id },
        (w) => rejectCorrection(w, item.entry.id),
      ),
    forgive: (item: ForgiveItem) =>
      act(
        [item.id],
        'forgiven',
        {
          type: 'decideForgiveness',
          requestId: item.request.id,
          decision: 'approved',
        },
        (w) => decideForgiveness(w, item.request.id, 'approved'),
      ),
    decline: (item: ForgiveItem) =>
      act(
        [item.id],
        'declined',
        {
          type: 'decideForgiveness',
          requestId: item.request.id,
          decision: 'denied',
        },
        (w) => decideForgiveness(w, item.request.id, 'denied'),
      ),
    concede: (item: DisputeItem) =>
      act(
        [item.id],
        'conceded',
        { type: 'concede', disputeId: item.dispute.id },
        (w) => concede(w, item.dispute.id),
      ),
    reply: (item: DisputeItem, text: string) =>
      act(
        [item.id],
        'replied',
        { type: 'replyToDispute', disputeId: item.dispute.id, reply: text },
        (w) => replyToDispute(w, item.dispute.id, text),
      ),
    /** Takes back a dispute the viewer raised on the partner's answer. */
    withdraw: (disputeId: string) =>
      act([], null, { type: 'withdrawDispute', disputeId }, (w) =>
        withdrawDispute(w, disputeId),
      ),
  };
}

export type Review = ReturnType<typeof useReview>;
