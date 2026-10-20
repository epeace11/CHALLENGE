// Scoreboard: both gifts head to head with who is ahead, then everyone's points by day in one list.
'use client';
import { useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import {
  Avatar,
  CountUp,
  Enter,
  GlassCard,
  PageTitle,
  Section,
  StatusPill,
} from '@/components/next/ui';
import type { Person, World } from '@/lib/next/model';
import { formatDay, formatMoney, plural } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { giftFor, ledger, type Gift, type PointRow } from './ledger';
import {
  Fold,
  HowSheet,
  PointSheet,
  RequestDecision,
  Struck,
  nextMissText,
  useSheetFor,
  type OpenPoint,
} from './parts';
import { PayerSheet } from './payer-sheet';
import { useGifts } from './use-gifts';

const LIST = 'gift-points';

/** Gifts, version 2. */
export default function GiftsV2() {
  const gifts = useGifts();
  const { world } = gifts;
  const { me, partner } = world;
  const still = useReducedMotion();
  const [how, setHow] = useState(false);
  const sheet = useSheetFor<OpenPoint>();
  const payer = useSheetFor<string>();

  const mine = ledger(world, me.id);
  const theirs = ledger(world, partner.id);
  const request = theirs.find((r) => r.pending);
  const days = byDay([...mine, ...theirs]);

  const showList = () =>
    document
      .getElementById(LIST)
      ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });

  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <PageTitle title="Gifts" />

        <Enter index={1} className="flex flex-col gap-5">
          <GlassCard as="section" aria-label="Score" className="flex flex-col">
            <div className="grid grid-cols-2 gap-2">
              {[giftFor(world, me), giftFor(world, partner)].map((gift) => (
                <GiftScore
                  key={gift.recipient.id}
                  world={world}
                  gift={gift}
                  onOpen={() => payer.show(gift.payer.id)}
                  onHow={() => setHow(true)}
                />
              ))}
            </div>
            <LeadBar
              world={world}
              mine={mine.filter((r) => !r.forgiven).length}
              theirs={theirs.filter((r) => !r.forgiven).length}
              onClick={showList}
            />
          </GlassCard>

          <Fold show={!!request}>
            {request && (
              <GlassCard as="section" aria-label="Forgiveness request">
                <p className="nx-kicker">{partner.name} asks you to forgive</p>
                <h2 className="mt-1 font-nx-serif text-nx-h3">
                  {request.rule.title}
                </h2>
                <p className="mt-1 text-nx-2 text-nx-ink-2">
                  {formatDay(request.point.day)} · {request.why}
                </p>
                <RequestDecision
                  world={world}
                  row={request}
                  gifts={gifts}
                  onHow={() => setHow(true)}
                  className="mt-4"
                />
              </GlassCard>
            )}
          </Fold>
        </Enter>

        <Section title="Points" id={LIST} index={2}>
          {days.length ? (
            <div className="flex flex-col gap-5">
              {days.map(([day, rows]) => (
                <section
                  key={day}
                  aria-label={formatDay(day)}
                  className="flex flex-col gap-2.5"
                >
                  <h3 className="text-nx-2 font-semibold text-nx-ink-2">
                    {formatDay(day)}
                  </h3>
                  <ul className="flex flex-col gap-2.5">
                    {rows.map((row) => (
                      <li key={row.point.id}>
                        <ScoreRow
                          world={world}
                          row={row}
                          onOpen={() => sheet.show({ row, world })}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="py-2 text-nx-body text-nx-ink-2">No points yet.</p>
          )}
        </Section>
      </div>

      <PayerSheet
        sheet={payer}
        world={world}
        onPoint={(row) => sheet.show({ row, world })}
        onHow={() => setHow(true)}
      />
      <PointSheet
        key={sheet.target?.row.point.id}
        sheet={sheet}
        gifts={gifts}
      />
      <HowSheet open={how} onOpenChange={setHow} world={world} />
    </AppFrame>
  );
}

/** Both people's points by day, newest day first; the viewer's first within a day. */
function byDay(rows: PointRow[]): [string, PointRow[]][] {
  const days = new Map<string, PointRow[]>();
  for (const row of rows)
    days.set(row.point.day, [...(days.get(row.point.day) ?? []), row]);
  return [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
}

/**
 * One side of the scoreboard: what this person gets, as a big button that opens the points behind
 * it, and what the payer's next miss would add, which opens "How gifts work".
 */
function GiftScore({
  world,
  gift,
  onOpen,
  onHow,
}: {
  world: World;
  gift: Gift;
  onOpen: () => void;
  onHow: () => void;
}) {
  const { recipient, amount } = gift;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <button
        type="button"
        className="nx-press flex min-h-11 flex-col items-start gap-2 rounded-nx px-3 py-3 text-left hover:bg-nx-accent-soft"
        onClick={onOpen}
      >
        <span className="flex items-center gap-2">
          <Avatar person={recipient} size="sm" decorative />
          <span className="text-nx-body font-semibold">
            {recipient.id === world.me.id
              ? 'You get'
              : `${recipient.name} gets`}
          </span>
        </span>
        <span className="flex items-center gap-1">
          <span className="font-nx-serif text-nx-num-lg leading-none tabular-nums">
            <CountUp value={amount} format={formatMoney} />
          </span>
          <ChevronRight
            size={22}
            className="shrink-0 text-nx-accent"
            aria-hidden="true"
          />
        </span>
      </button>
      <button
        type="button"
        className="nx-press flex min-h-11 items-center rounded-nx-sm px-3 py-1.5 text-left text-nx-2 text-nx-ink-2 hover:bg-nx-accent-soft"
        onClick={onHow}
      >
        {nextMissText(world, gift)}
      </button>
    </div>
  );
}

/**
 * Who is ahead, as one line from the middle toward the leader's side, with each person's points at
 * the ends. Fewer points is ahead. The whole thing scrolls to the points list.
 */
function LeadBar({
  world,
  mine,
  theirs,
  onClick,
}: {
  world: World;
  mine: number;
  theirs: number;
  onClick: () => void;
}) {
  const { me, partner } = world;
  const margin = Math.abs(mine - theirs);
  const lead: Person | null =
    mine === theirs ? null : mine < theirs ? me : partner;
  const share = margin / Math.max(mine, theirs, 1);
  const headline = !lead
    ? `Tied at ${plural(mine, 'point')}`
    : lead.id === me.id
      ? `You’re ahead by ${plural(margin, 'point')}`
      : `${partner.name} is ahead by ${plural(margin, 'point')}`;
  return (
    <button
      type="button"
      className="nx-press mt-3 flex min-h-11 flex-col gap-2.5 rounded-nx border-t border-nx-line px-3 pt-4 pb-3 text-left hover:bg-nx-accent-soft"
      onClick={onClick}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-nx-lead font-semibold">{headline}</span>
        <ChevronRight
          size={22}
          className="shrink-0 rotate-90 text-nx-accent"
          aria-hidden="true"
        />
      </span>
      <span
        className="relative block h-3 w-full overflow-hidden rounded-full bg-nx-sunken"
        aria-hidden="true"
      >
        <span
          className={cn(
            'absolute inset-y-0 bg-nx-done-bar transition-[width] duration-300 ease-nx motion-reduce:transition-none',
            lead?.id === me.id
              ? 'right-1/2 rounded-l-full'
              : 'left-1/2 rounded-r-full',
          )}
          style={{ width: `${share * 50}%` }}
        />
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-nx-line-strong" />
      </span>
      <span className="flex justify-between gap-3 text-nx-2 text-nx-ink-2">
        <span>You: {plural(mine, 'point')}</span>
        <span>
          {partner.name}: {plural(theirs, 'point')}
        </span>
      </span>
    </button>
  );
}

/** A point in the combined list: whose it is, the rule (struck once forgiven), why, and its cost. */
function ScoreRow({
  world,
  row,
  onOpen,
}: {
  world: World;
  row: PointRow;
  onOpen: () => void;
}) {
  const person = row.point.personId === world.me.id ? world.me : world.partner;
  return (
    <button
      type="button"
      className="nx-glass nx-tappable nx-row items-center"
      onClick={onOpen}
    >
      <Avatar person={person} size="sm" decorative />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Struck on={row.forgiven} className="text-nx-body font-semibold">
          {row.rule.title}
        </Struck>
        <span className="text-nx-2 text-nx-ink-2">
          {person.id === world.me.id ? 'Yours' : person.name} · {row.why}
        </span>
        {row.forgiven ? (
          <StatusPill status="forgiven" className="mt-1.5 self-start" />
        ) : row.pending ? (
          <StatusPill
            status="review"
            label="Forgiveness asked"
            className="mt-1.5 self-start"
          />
        ) : null}
      </span>
      <span
        className={cn(
          'shrink-0 font-nx-serif text-nx-h3 tabular-nums',
          row.forgiven ? 'text-nx-ink-2' : 'text-nx-ink',
        )}
      >
        {formatMoney(row.cost)}
      </span>
      <ChevronRight className="nx-row-chevron" size={22} aria-hidden="true" />
    </button>
  );
}
