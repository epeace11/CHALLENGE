'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Point, Rule, World } from '@/lib/next/model';
import {
  approve,
  askForgiveness,
  concede,
  decideForgiveness,
  dispute,
  forgivePoint,
  rejectCorrection,
  replyToDispute,
  withdrawDispute,
} from '@/lib/next/actions';
import { formatDate } from '@/lib/next/selectors';
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
  /**
   * Where it was decided, so its Undo line shows there: the card (the line sits above it), the
   * forgiveness rows under it, or the "Waiting for Jordan" sheet (and above the card once it closes).
   */
  from: 'card' | 'points' | 'waiting';
  command: Command | Command[];
  change: (w: World) => World;
  /** The words of a dispute, reply or forgiveness ask, kept if the write fails. */
  text?: string;
};

/** Why the Undo window's clock is stopped: a pointer or finger is on Undo, or focus is. */
export type Pause = 'pointer' | 'focus';

/** A point in an Undo line: "No eating out, Nov 18" (one rule can have several points). */
const pointAbout = (point: Point, rule: Rule) =>
  `${shortTitle(rule)}, ${formatDate(point.day)}`;

/**
 * Everything a Review version does. Each decision shows at once (the item leaves with its stamp)
 * but waits UNDO_MS before it is sent, so Undo can take it back without a pop-up and without the
 * database having to reverse anything. The next decision, leaving the page or hiding the app sends
 * the one waiting straight away. The 5 seconds stand still while the viewer is on Undo (`pause`).
 * A write that fails (the live app says so) brings its item back, with any words in `unsent`.
 */
export function useReview() {
  const world = useWorld();
  const backend = useBackend();
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [held, setHeld] = useState<Held | null>(null);
  const heldRef = useRef<Held | null>(null);
  const timer = useRef<number | null>(null);
  // When the decision waiting is sent, the time it still had while its clock is stopped, and why.
  const due = useRef(0);
  const left = useRef(0);
  const pauses = useRef(new Set<Pause>());
  const send = useRef(backend.save);
  useEffect(() => {
    send.current = backend.save;
  });
  /** Words of a write that failed, by item id, so its sheet opens with them again. */
  const [unsent, setUnsent] = useState<Record<string, string>>({});

  /** Sends the decision waiting, if any. */
  const flush = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    pauses.current.clear();
    const h = heldRef.current;
    heldRef.current = null;
    setHeld(null);
    if (!h) return;
    void send.current(h.command, h.change).then((ok) => {
      const id = h.ids[0];
      if (ok) {
        if (h.text !== undefined) setUnsent(({ [id]: _, ...rest }) => rest);
        return;
      }
      // Not saved: the item is back in the queue without its stamp, and its words are kept.
      setOutcomes((o) => {
        const next = { ...o };
        for (const x of h.ids) delete next[x];
        return next;
      });
      if (h.text !== undefined) setUnsent((u) => ({ ...u, [id]: h.text! }));
    });
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

  function act(decision: Omit<Held, 'from'> & { from?: Held['from'] }) {
    const h: Held = { from: 'card', ...decision };
    flush();
    setOutcomes((o) => {
      const next = { ...o };
      for (const id of h.ids) next[id] = h.outcome;
      return next;
    });
    heldRef.current = h;
    setHeld(h);
    due.current = performance.now() + UNDO_MS;
    timer.current = window.setTimeout(flush, UNDO_MS);
  }

  /**
   * Stops the Undo window's clock while a pointer or finger is on Undo, or focus is, so nobody has
   * to beat the 5 seconds (WCAG 2.2.1); once both are off it, it runs on with the time it had left.
   * Hiding the app or leaving the page still sends it.
   */
  const pause = useCallback(
    (why: Pause, on: boolean) => {
      if (!heldRef.current) return;
      const reasons = pauses.current;
      const was = reasons.size > 0;
      if (on) reasons.add(why);
      else reasons.delete(why);
      if (!was && reasons.size > 0) {
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = null;
        left.current = Math.max(0, due.current - performance.now());
      } else if (was && reasons.size === 0) {
        due.current = performance.now() + left.current;
        timer.current = window.setTimeout(flush, left.current);
      }
    },
    [flush],
  );

  /** Takes back the decision waiting: nothing was sent, and its item comes back without its stamp. */
  const undo = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    pauses.current.clear();
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
  const shown = useMemo(
    () => (held ? held.change(world) : world),
    [held, world],
  );
  const state = useMemo(() => reviewState(shown), [shown]);

  return {
    world: shown,
    state,
    outcomes,
    unsent,
    held,
    undo,
    pause,
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
        text: reason,
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
    concede: (item: DisputeItem, from: Held['from'] = 'card') =>
      act({
        ids: [item.id],
        outcome: 'conceded',
        from,
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
        text,
      }),
    /** Forgives one of the partner's points nobody asked about (from the forgiveness rows). */
    forgivePoint: (point: Point, rule: Rule) =>
      act({
        ids: [`point:${point.id}`],
        outcome: 'forgiven',
        about: pointAbout(point, rule),
        from: 'points',
        command: { type: 'forgivePoint', pointId: point.id },
        change: (w) => forgivePoint(w, point.id),
      }),
    /** Asks the partner to forgive one of the viewer's points (from the forgiveness rows). */
    askForgiveness: (point: Point, rule: Rule, reason: string) =>
      act({
        ids: [`point:${point.id}`],
        outcome: 'asked',
        about: pointAbout(point, rule),
        from: 'points',
        command: { type: 'askForgiveness', pointId: point.id, reason },
        change: (w) => askForgiveness(w, point.id, reason),
        text: reason,
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
