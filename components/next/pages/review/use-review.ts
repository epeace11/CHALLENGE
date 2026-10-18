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
import {
  useBackend,
  useUndoAction,
  type Command,
} from '@/components/next/backend';
import { useToast } from '@/components/next/ui';
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
 * count, Overview and Gifts follow), shows a toast with Undo, and records its outcome so the item
 * leaves with the right stamp.
 */
export function useReview() {
  const world = useWorld();
  const backend = useBackend();
  const undoAction = useUndoAction();
  const toast = useToast();
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const partner = world.partner.name;

  function act(
    ids: string[],
    outcome: Outcome | null,
    command: Command | Command[],
    change: (w: World) => World,
    text: string,
  ) {
    if (outcome)
      setOutcomes((o) => {
        const next = { ...o };
        for (const id of ids) next[id] = outcome;
        return next;
      });
    backend.act(command, change);
    // Approvals are routine and the stamp already confirms them, so their Undo stays up for 4 s;
    // decisions that move points or money keep the kit's 6 s.
    toast({
      text,
      ...undoAction(),
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
        { type: 'approve', entryId: item.entry.id },
        (w) => approve(w, item.entry.id),
        item.kind === 'correction' ? 'Late answer approved' : 'Approved',
      ),
    approveAll: (items: AnswerItem[]) =>
      act(
        items.map((i) => i.id),
        'approved',
        items.map((i) => ({ type: 'approve', entryId: i.entry.id }) as const),
        (w) => items.reduce((acc, i) => approve(acc, i.entry.id), w),
        `Approved ${items.length} answers`,
      ),
    dispute: (item: AnswerItem, reason: string) =>
      act(
        [item.id],
        'disputed',
        { type: 'dispute', entryId: item.entry.id, comment: reason },
        (w) => dispute(w, item.entry.id, w.me.id, reason),
        `Dispute sent to ${partner}`,
      ),
    declineLate: (item: LateItem) =>
      act(
        [item.id],
        'declined',
        { type: 'rejectCorrection', entryId: item.entry.id },
        (w) => rejectCorrection(w, item.entry.id),
        'Late answer declined',
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
        'Point forgiven',
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
        'Forgiveness declined',
      ),
    concede: (item: DisputeItem) =>
      act(
        [item.id],
        'conceded',
        { type: 'concede', disputeId: item.dispute.id },
        (w) => concede(w, item.dispute.id),
        'Conceded. It’s a point now.',
      ),
    reply: (item: DisputeItem, text: string) =>
      act(
        [item.id],
        'replied',
        { type: 'replyToDispute', disputeId: item.dispute.id, reply: text },
        (w) => replyToDispute(w, item.dispute.id, text),
        'Reply sent. The dispute stays open.',
      ),
    /** Takes back a dispute the viewer raised on the partner's answer. */
    withdraw: (disputeId: string) =>
      act(
        [],
        null,
        { type: 'withdrawDispute', disputeId },
        (w) => withdrawDispute(w, disputeId),
        'Dispute withdrawn',
      ),
  };
}

export type Review = ReturnType<typeof useReview>;
