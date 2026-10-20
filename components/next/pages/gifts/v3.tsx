// Plain sentences: who owes whom what, then the request and next misses that could change it.
'use client';
import { useState } from 'react';
import { AppFrame } from '@/components/next/frames';
import {
  Avatar,
  CountUp,
  Enter,
  GlassCard,
  PageTitle,
  RowButton,
  Section,
} from '@/components/next/ui';
import type { Person } from '@/lib/next/model';
import { formatDay, formatMoney } from '@/lib/next/selectors';
import { giftFor, ledger } from './ledger';
import {
  Fold,
  HowSheet,
  PointSheet,
  RequestDecision,
  nextMissText,
  useSheetFor,
  type OpenPoint,
} from './parts';
import { PayerSheet } from './payer-sheet';
import { useGifts } from './use-gifts';

/** Gifts, version 3. */
export default function GiftsV3() {
  const gifts = useGifts();
  const { world } = gifts;
  const { me, partner } = world;
  const [how, setHow] = useState(false);
  const sheet = useSheetFor<OpenPoint>();
  const payer = useSheetFor<string>();

  const toMe = giftFor(world, me);
  const fromMe = giftFor(world, partner);
  const request = ledger(world, partner.id).find((r) => r.pending);

  /** One gift as a sentence: "Jordan owes you a $45 gift". */
  const sentence = (from: Person, to: Person, amount: number) => (
    <RowButton
      className="py-5"
      leading={<Avatar person={from} decorative />}
      onClick={() => payer.show(from.id)}
      title={
        <span className="text-nx-lead leading-snug font-normal">
          {from.id === me.id ? 'You owe' : `${from.name} owes`}{' '}
          {to.id === me.id ? 'you' : to.name} a{' '}
          <b className="font-nx-serif text-nx-h2 font-normal whitespace-nowrap tabular-nums">
            <CountUp value={amount} format={formatMoney} />
          </b>{' '}
          gift
        </span>
      }
    />
  );

  return (
    <AppFrame>
      <div className="flex flex-col gap-8">
        <PageTitle title="Gifts" />

        <Enter index={1} className="flex flex-col gap-3">
          {sentence(partner, me, toMe.amount)}
          {sentence(me, partner, fromMe.amount)}
        </Enter>

        <Section title="What could change it" index={2}>
          <Fold show={!!request}>
            {request && (
              <div className="pb-1">
                <GlassCard as="section" aria-label="Forgiveness request">
                  <h3 className="text-nx-body font-semibold">
                    {partner.name} asks you to forgive {request.rule.title}
                  </h3>
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
              </div>
            )}
          </Fold>
          {[fromMe, toMe].map((gift) => (
            <RowButton
              key={gift.payer.id}
              leading={<Avatar person={gift.payer} size="sm" decorative />}
              title={nextMissText(world, gift)}
              onClick={() => setHow(true)}
            />
          ))}
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
