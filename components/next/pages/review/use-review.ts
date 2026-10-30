'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  shortTitle,
  type AnswerItem,
  type DisputeItem,
  type ForgiveItem,
  type LateItem,
} from './queue';

/** How long a decision can still be undone before it is sent. */
const UNDO_MS = 5000;

/** A decision in its Undo window: already on screen, not sent yet. */
export type Held = {
  ids: string[];
  outcome: Outcome;
  /** What it was about: "10,000 steps", "2 answers". */
  about: string;
  command: Command | Command[];
  change: (w: World) => World;
};

/**
 * Everything a Review version does. Each decision shows at once (the item leaves with its stamp)
 * but waits UNDO_MS before it is sent, so Undo can take it back without a pop-up and without the
 * database having to reverse anything. The next decision, leaving the page or hiding the app sends
 * the one waiting straight away.
 */
export function useReview() {
  const world = useWorld();
  const backend = useBackend();
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [held, setHeld] = useState<Held | null>(null);
  const heldRef = useRef<Held | null>(null);
  const timer = useRef<number | null>(null);
  const send = useRef(backend.act);
  useEffect(() => {
    send.current = backend.act;
  });

  /** Sends the decision waiting, if any. */
  const flush = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const h = heldRef.current;
    heldRef.current = null;
    setHeld(null);
    if (h) send.current(h.command, h.change);
  }, []);

  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  function act(h: Held) {
    flush();
    setOutcomes((o) => {
      const next = { ...o };
      for (const id of h.ids) next[id] = h.outcome;
      return next;
    });
    heldRef.current = h;
    setHeld(h);
    timer.current = window.setTimeout(flush, UNDO_MS);
  }

  /** Takes back the decision waiting: nothing was sent, and its item comes back without its stamp. */
  const undo = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    const h = heldRef.current;
    heldRef.current = null;
    setHeld(null);
    if (h)
      setOutcomes((o) => {
        const next = { ...o };
        for (const id of h.ids) delete next[id];
        return next;
      });
  };

  // The page shows the world as if the decision waiting were already made.
  const shown = held ? held.change(world) : world;

  return {
    world: shown,
    state: reviewState(shown),
    outcomes,
    held,
    undo,
    approve: (item: AnswerItem | LateItem) =>
      act({
        ids: [item.id],
        outcome: 'approved',
        about: shortTitle(item.rule),
        command: { type: 'approve', entryId: item.entry.id },
        change: (w) => approve(w, item.entry.id),
      }),
    approveAll: (items: AnswerItem[]) =>
      act({
        ids: items.map((i) => i.id),
        outcome: 'approved',
        about: `${items.length} answers`,
        command: items.map(
          (i) => ({ type: 'approve', entryId: i.entry.id }) as const,
        ),
        change: (w) => items.reduce((acc, i) => approve(acc, i.entry.id), w),
      }),
    dispute: (item: AnswerItem, reason: string) =>
      act({
        ids: [item.id],
        outcome: 'disputed',
        about: shortTitle(item.rule),
        command: { type: 'dispute', entryId: item.entry.id, comment: reason },
        change: (w) => dispute(w, item.entry.id, w.me.id, reason),
      }),
    declineLate: (item: LateItem) =>
      act({
        ids: [item.id],
        outcome: 'declined',
        about: shortTitle(item.rule),
        command: { type: 'rejectCorrection', entryId: item.entry.id },
        change: (w) => rejectCorrection(w, item.entry.id),
      }),
    forgive: (item: ForgiveItem) =>
      act({
        ids: [item.id],
        outcome: 'forgiven',
        about: shortTitle(item.rule),
        command: {
          type: 'decideForgiveness',
          requestId: item.request.id,
          decision: 'approved',
        },
        change: (w) => decideForgiveness(w, item.request.id, 'approved'),
      }),
    decline: (item: ForgiveItem) =>
      act({
        ids: [item.id],
        outcome: 'declined',
        about: shortTitle(item.rule),
        command: {
          type: 'decideForgiveness',
          requestId: item.request.id,
          decision: 'denied',
        },
        change: (w) => decideForgiveness(w, item.request.id, 'denied'),
      }),
    concede: (item: DisputeItem) =>
      act({
        ids: [item.id],
        outcome: 'conceded',
        about: shortTitle(item.rule),
        command: { type: 'concede', disputeId: item.dispute.id },
        change: (w) => concede(w, item.dispute.id),
      }),
    reply: (item: DisputeItem, text: string) =>
      act({
        ids: [item.id],
        outcome: 'replied',
        about: shortTitle(item.rule),
        command: {
          type: 'replyToDispute',
          disputeId: item.dispute.id,
          reply: text,
        },
        change: (w) => replyToDispute(w, item.dispute.id, text),
      }),
    /** Takes back a dispute the viewer raised on the partner's answer (sent at once). */
    withdraw: (disputeId: string) => {
      flush();
      backend.act({ type: 'withdrawDispute', disputeId }, (w) =>
        withdrawDispute(w, disputeId),
      );
    },
  };
}

export type Review = ReturnType<typeof useReview>;
