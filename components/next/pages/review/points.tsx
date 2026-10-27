'use client';
import { useState } from 'react';
import { HandHeart } from 'lucide-react';
import type { Point, Rule, World } from '@/lib/next/model';
import { askForgiveness, forgivePoint } from '@/lib/next/actions';
import {
  activePoints,
  formatDay,
  formatMoney,
  gets,
  pendingRequestFor,
  plural,
  ruleById,
} from '@/lib/next/selectors';
import { useBackend, useUndoAction } from '@/components/next/backend';
import {
  Avatar,
  Button,
  RowButton,
  Sheet,
  useToast,
} from '@/components/next/ui';
import { ReasonSheet, useSheetFor } from './parts';
import { missWhy } from './queue';

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

/** "Jordan has 9 points", or "Jordan has 9 points · 8 not asked about yet": the total always matches Overview and Gifts. */
function pointsDetail(who: string, total: number, open: number) {
  const has = `${who} ${plural(total, 'point')}`;
  return open === total ? has : `${has} · ${open} not asked about yet`;
}

/**
 * Forgiveness that nobody has asked about yet, under the queue: ask the partner to forgive one of
 * your points (a miss you never logged, a short gym week), or forgive one of theirs. Each row opens
 * the list of points; picking one asks for a reason, or shows what forgiving it does to the gift.
 */
export function PointActions({ world }: { world: World }) {
  const backend = useBackend();
  const undoAction = useUndoAction();
  const toast = useToast();
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

  if (!mine.length && !theirs.length) return null;
  return (
    <section className="flex flex-col gap-2.5" aria-label="Forgiveness">
      {mine.length > 0 && (
        <RowButton
          glass={false}
          leading={<Avatar person={world.me} decorative />}
          title={`Ask ${partner.name} to forgive a point`}
          detail={pointsDetail(
            'You have',
            activePoints(world, world.me.id).length,
            mine.length,
          )}
          onClick={() => openList('mine')}
        />
      )}
      {theirs.length > 0 && (
        <RowButton
          glass={false}
          leading={<Avatar person={partner} decorative />}
          title={`Forgive one of ${partner.name}’s points`}
          detail={pointsDetail(
            `${partner.name} has`,
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
        label={`Why should ${partner.name} forgive it?`}
        submit="Ask"
        missing="Write your reason first."
        onSubmit={(reason) => {
          const row = asking.target;
          asking.setOpen(false);
          if (!row) return;
          backend.act(
            { type: 'askForgiveness', pointId: row.point.id, reason },
            (w) => askForgiveness(w, row.point.id, reason),
          );
          toast({ text: `Asked ${partner.name}`, ...undoAction() });
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
                const row = forgiving.target;
                forgiving.setOpen(false);
                if (!row) return;
                backend.act(
                  { type: 'forgivePoint', pointId: row.point.id },
                  (w) => forgivePoint(w, row.point.id),
                );
                toast({ text: 'Point forgiven', ...undoAction() });
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
              ? `Your gift stays ${formatMoney(forgiveNow.now)}.`
              : `Your gift goes from ${formatMoney(forgiveNow.now)} to ${formatMoney(forgiveNow.after)}.`}
            {backend.live && ' This can’t be taken back.'}
          </p>
        )}
      </Sheet>
    </section>
  );
}
