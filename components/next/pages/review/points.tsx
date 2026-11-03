'use client';
import { useRef, useState } from 'react';
import { HandHeart } from 'lucide-react';
import type { Point, Rule, World } from '@/lib/next/model';
import { forgivePoint } from '@/lib/next/actions';
import {
  activePoints,
  formatDay,
  formatMoney,
  gets,
  pendingRequestFor,
  plural,
  ruleById,
} from '@/lib/next/selectors';
import {
  Avatar,
  Button,
  ReasonSheet,
  RowButton,
  Sheet,
} from '@/components/next/ui';
import { UndoLine, useFocusLater, useSheetFor } from './parts';
import { missWhy } from './queue';
import type { Review } from './use-review';

/** A point that still counts and has no request waiting on it. */
type Open = { point: Point; rule: Rule; why: string };

function openPoints(w: World, personId: string): Open[] {
  return activePoints(w, personId).flatMap((point) => {
    const rule = ruleById(w.challenge, point.ruleId);
    if (!rule || pendingRequestFor(w, point.id)) return [];
    const entry = point.entryId
      ? w.entries.find((e) => e.id === point.entryId)
      : undefined;
    return [{ point, rule, why: missWhy(w, point, rule, entry) }];
  });
}

/**
 * "You have 6 points", or "9 points · 8 not asked about yet" under a row whose title already names
 * whose they are: the total always matches Overview and Gifts.
 */
function pointsDetail(total: number, open: number, who?: string) {
  const has = who ? `${who} ${plural(total, 'point')}` : plural(total, 'point');
  return open === total ? has : `${has} · ${open} not asked about yet`;
}

/**
 * What forgiving one of the partner's points does to the gift the viewer gets. Any one does the
 * same, since a gift is set by how many points there are.
 */
function forgiveCost(w: World, rows: Open[]) {
  const now = gets(w, w.me.id);
  const off = rows[0]
    ? now - gets(forgivePoint(w, rows[0].point.id), w.me.id)
    : 0;
  const which = rows.length === 1 ? 'Forgiving it' : 'Forgiving any one';
  return off > 0
    ? `${which} takes ${formatMoney(off)} off the gift you get.`
    : `${which} leaves the gift you get at ${formatMoney(now)}.`;
}

/**
 * Forgiveness that nobody has asked about yet, under the queue: ask the partner to forgive one of
 * your points (a miss you never logged, a short gym week), or forgive one of theirs. Each row opens
 * the list of points; picking one asks for a reason, or shows what forgiving it does to the gift.
 * Both wait in the review's Undo window like every decision, with their Undo line here.
 */
export function PointActions({ review }: { review: Review }) {
  const { world, held } = review;
  const partner = world.partner;
  const mine = openPoints(world, world.me.id);
  const theirs = openPoints(world, partner.id);
  const [list, setList] = useState<'mine' | 'theirs' | null>(null);
  const [shownList, setShownList] = useState<'mine' | 'theirs'>('mine');
  const asking = useSheetFor<Open>();
  const forgiving = useSheetFor<Open>();

  const openList = (which: 'mine' | 'theirs') => {
    setShownList(which);
    setList(which);
  };
  const rows = shownList === 'mine' ? mine : theirs;
  const pick = (row: Open) => {
    setList(null);
    if (shownList === 'mine') asking.show(row);
    else forgiving.show(row);
  };
  const forgiveNow = forgiving.target
    ? {
        now: gets(world, world.me.id),
        after: gets(
          forgivePoint(world, forgiving.target.point.id),
          world.me.id,
        ),
      }
    : null;

  // Focus after a decision here: back to the row it came from (the sheet does that as it closes),
  // or to the Undo line when that row has gone. After Undo, back to the row.
  const section = useRef<HTMLElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const focusLater = useFocusLater();
  const rowFor = (which: 'mine' | 'theirs') =>
    section.current?.querySelector<HTMLElement>(`[data-points="${which}"]`);
  const afterDecision = () =>
    focusLater(() => {
      const at = document.activeElement;
      return !at || at === document.body ? line.current : null;
    });
  const undo = () => {
    const which = held?.outcome === 'asked' ? 'mine' : 'theirs';
    review.undo();
    focusLater(() => rowFor(which));
  };
  const heldHere = held?.from === 'points' ? held : null;

  if (!mine.length && !theirs.length && !heldHere) return null;
  return (
    <section
      ref={section}
      className="flex flex-col gap-2.5"
      aria-label="Forgiveness"
    >
      {heldHere && (
        <UndoLine
          ref={line}
          held={heldHere}
          onUndo={undo}
          onPause={review.pause}
        />
      )}
      {mine.length > 0 && (
        <RowButton
          data-points="mine"
          glass={false}
          leading={<Avatar person={world.me} decorative />}
          title={`Ask ${partner.name} to forgive a point`}
          detail={pointsDetail(
            activePoints(world, world.me.id).length,
            mine.length,
            'You have',
          )}
          onClick={() => openList('mine')}
        />
      )}
      {theirs.length > 0 && (
        <RowButton
          data-points="theirs"
          glass={false}
          leading={<Avatar person={partner} decorative />}
          title={`Forgive one of ${partner.name}’s points`}
          detail={pointsDetail(
            activePoints(world, partner.id).length,
            theirs.length,
          )}
          onClick={() => openList('theirs')}
        />
      )}

      <Sheet
        open={list !== null}
        onOpenChange={(next) => !next && setList(null)}
        title={
          shownList === 'mine'
            ? 'Which of your points?'
            : `Which of ${partner.name}’s points?`
        }
        description={
          shownList === 'theirs' && rows.length > 0
            ? forgiveCost(world, rows)
            : undefined
        }
        footer={<Button onClick={() => setList(null)}>Cancel</Button>}
      >
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.point.id}>
              <RowButton
                glass={false}
                title={row.rule.title}
                detail={`${formatDay(row.point.day)} · ${row.why}`}
                onClick={() => pick(row)}
              />
            </li>
          ))}
        </ul>
      </Sheet>

      <ReasonSheet
        key={`ask:${asking.target?.point.id}`}
        open={asking.open}
        onOpenChange={asking.setOpen}
        title={`Ask ${partner.name} to forgive it`}
        description={
          asking.target
            ? `${asking.target.rule.title} · ${formatDay(asking.target.point.day)} · ${asking.target.why}`
            : undefined
        }
        // The title asks it; the field only needs a name, as Dispute's does.
        label="Your reason"
        submit="Ask"
        missing="Write your reason first."
        onSubmit={(reason) => {
          const target = asking.target;
          asking.setOpen(false);
          if (!target) return;
          review.askForgiveness(target.point, target.rule, reason);
          afterDecision();
        }}
      />

      <Sheet
        open={forgiving.open}
        onOpenChange={forgiving.setOpen}
        title={`Forgive ${partner.name}’s point?`}
        description={
          forgiving.target
            ? `${forgiving.target.rule.title} · ${formatDay(forgiving.target.point.day)} · ${forgiving.target.why}`
            : undefined
        }
        footer={
          <>
            <Button onClick={() => forgiving.setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              icon={HandHeart}
              onClick={() => {
                const target = forgiving.target;
                forgiving.setOpen(false);
                if (!target) return;
                review.forgivePoint(target.point, target.rule);
                afterDecision();
              }}
            >
              Forgive
            </Button>
          </>
        }
      >
        {forgiveNow && (
          <p className="text-nx-body text-nx-ink-2">
            {forgiveNow.now === forgiveNow.after
              ? `The gift you get stays ${formatMoney(forgiveNow.now)}.`
              : `The gift you get goes from ${formatMoney(forgiveNow.now)} to ${formatMoney(forgiveNow.after)}.`}
          </p>
        )}
      </Sheet>
    </section>
  );
}
