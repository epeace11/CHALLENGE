// Version 2: the two gifts are the switch; the chosen one opens as an itemized receipt, oldest point first, so $1, $2, $3… add up on screen.
'use client';
import { useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, ChevronRight } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import { useNav } from '@/components/next/nav';
import {
  Button,
  CountUp,
  DURATION,
  EASE,
  Enter,
  GlassCard,
  Glide,
  PageTitle,
} from '@/components/next/ui';
import type { World } from '@/lib/next/model';
import { formatMoney, leader, nameOf, plural } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { giftFor, ledger, type Gift } from './ledger';
import {
  Fold,
  HowSheet,
  NextMissLine,
  PointSheet,
  ReceiptLine,
  RequestDecision,
  StepButton,
  useSheetFor,
  type OpenPoint,
} from './parts';
import { useGifts } from './use-gifts';

type Side = 'me' | 'partner';

/** Gifts, version 2. */
export default function GiftsV2() {
  const gifts = useGifts();
  const { world } = gifts;
  const { me, partner } = world;
  const { navigate } = useNav();
  const [side, setSide] = useState<Side>('me');
  const [how, setHow] = useState(false);
  const sheet = useSheetFor<OpenPoint>();

  const both: Record<Side, Gift> = {
    me: giftFor(world, me),
    partner: giftFor(world, partner),
  };
  const gift = both[side];
  const rows = ledger(world, gift.payer.id);
  const lead = leader(world);

  return (
    <AppFrame>
      <div className="flex flex-col gap-5 pb-4">
        <PageTitle title="Gifts" />

        <Enter index={1} className="flex flex-col gap-1">
          <GiftSwitch
            world={world}
            gifts={both}
            value={side}
            onChange={setSide}
          />
          <Button
            variant="quiet"
            iconEnd={ChevronRight}
            className="-ml-3 self-start"
            onClick={() => navigate('progress')}
          >
            {lead.personId
              ? `${nameOf(world, lead.personId)} is ahead by ${plural(lead.margin, 'point')}`
              : 'You’re tied on points'}
          </Button>
        </Enter>

        <Enter index={2}>
          <Glide id={side} direction={side === 'me' ? -1 : 1}>
            <GlassCard
              pad="lg"
              as="section"
              aria-label={`What ${gift.recipient.name} gets, point by point`}
            >
              <h2 className="nx-section-title">
                {gift.payer.id === me.id
                  ? 'Your points'
                  : `${gift.payer.name}’s points`}
              </h2>
              {rows.length ? (
                <ol className="mt-3 border-t border-nx-line">
                  {rows.map((row) => (
                    <ReceiptLine
                      key={row.point.id}
                      row={row}
                      onOpen={() => sheet.show({ row, world })}
                    >
                      {gift.payer.id === partner.id && (
                        <Fold show={!!row.pending}>
                          <RequestDecision
                            world={world}
                            row={row}
                            gifts={gifts}
                            onHow={() => setHow(true)}
                            className="pt-1 pb-5"
                          />
                        </Fold>
                      )}
                    </ReceiptLine>
                  ))}
                </ol>
              ) : (
                <p className="py-4 text-nx-body text-nx-ink-2">
                  No points yet.
                </p>
              )}
              <NextMissLine
                world={world}
                gift={gift}
                onClick={() => setHow(true)}
              />
            </GlassCard>
          </Glide>
        </Enter>

        <StepButton world={world} onClick={() => setHow(true)} />
      </div>

      <PointSheet
        key={sheet.target?.row.point.id}
        sheet={sheet}
        gifts={gifts}
      />
      <HowSheet open={how} onOpenChange={setHow} world={world} />
    </AppFrame>
  );
}

/**
 * The two gifts side by side, recipient first ("Maya gets $45"). They are one choice: the one picked
 * has an accent ring that slides across, and its receipt shows below. Native radios, so arrow keys work.
 */
function GiftSwitch({
  world,
  gifts,
  value,
  onChange,
}: {
  world: World;
  gifts: Record<Side, Gift>;
  value: Side;
  onChange: (side: Side) => void;
}) {
  const name = useId();
  const still = useReducedMotion();
  return (
    <fieldset className="grid min-w-0 grid-cols-2 gap-3">
      <legend className="sr-only">Which gift to show</legend>
      {(['me', 'partner'] as const).map((side) => {
        const gift = gifts[side];
        const on = value === side;
        return (
          <label
            key={side}
            className="nx-glass nx-press relative flex min-w-0 cursor-pointer flex-col items-start gap-1 p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-nx-accent sm:p-5"
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={on}
              onChange={() => onChange(side)}
            />
            {on && (
              <motion.span
                layoutId={`${name}-ring`}
                className="pointer-events-none absolute -inset-px rounded-nx-lg border-2 border-nx-accent"
                transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'absolute top-3.5 right-3.5 grid size-6 place-items-center rounded-full transition-colors duration-200 ease-nx',
                on
                  ? '[background:var(--nx-primary)] text-nx-on-accent'
                  : 'border border-nx-line-strong text-transparent',
              )}
              aria-hidden="true"
            >
              <Check size={15} strokeWidth={3} />
            </span>
            <span className="pr-7 text-nx-body font-semibold">
              {gift.recipient.name} gets
            </span>
            <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
              <span className="font-nx-serif text-nx-num-lg leading-none tabular-nums">
                <CountUp value={gift.amount} format={formatMoney} />
              </span>
              <span className="font-nx-serif text-nx-h3">gift</span>
            </span>
            <span className="text-nx-2 text-nx-ink-2">
              from{' '}
              {gift.payer.id === world.me.id ? 'your' : `${gift.payer.name}’s`}{' '}
              {plural(gift.points, 'point')}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
