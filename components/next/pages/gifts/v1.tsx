// Version 1: both gifts side by side first; tap one to see the points behind it, newest first.
'use client';
import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { AppFrame } from '@/components/next/frames';
import {
  Enter,
  GlassCard,
  Glide,
  PageTitle,
  Section,
  SegmentedControl,
} from '@/components/next/ui';
import { formatDay } from '@/lib/next/selectors';
import { giftFor, ledger } from './ledger';
import {
  Fold,
  GiftCard,
  HowSheet,
  PointRowButton,
  PointSheet,
  RequestDecision,
  StepButton,
  useSheetFor,
  type OpenPoint,
} from './parts';
import { useGifts } from './use-gifts';

const LIST = 'gift-points';

/** Gifts, version 1. */
export default function GiftsV1() {
  const gifts = useGifts();
  const { world } = gifts;
  const { me, partner } = world;
  const still = useReducedMotion();
  const [whose, setWhose] = useState(partner.id);
  const [how, setHow] = useState(false);
  const sheet = useSheetFor<OpenPoint>();

  const rows = [...ledger(world, whose)].reverse();
  const request = ledger(world, partner.id).find((r) => r.pending);

  /** Shows the points behind a gift: the list switches to the payer and scrolls into view. */
  const showPoints = (payerId: string) => {
    setWhose(payerId);
    document
      .getElementById(LIST)
      ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <AppFrame>
      <div className="flex flex-col gap-8 pb-4">
        <PageTitle title="Gifts" />

        <Enter index={1} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <GiftCard
              world={world}
              gift={giftFor(world, me)}
              onOpen={() => showPoints(partner.id)}
            />
            <GiftCard
              world={world}
              gift={giftFor(world, partner)}
              onOpen={() => showPoints(me.id)}
            />
          </div>
          <StepButton world={world} onClick={() => setHow(true)} />
          <Fold show={!!request}>
            {request && (
              <div className="pt-5">
                <GlassCard as="section" aria-label="Forgiveness request">
                  <p className="nx-kicker">
                    {partner.name} asks you to forgive
                  </p>
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
              </div>
            )}
          </Fold>
        </Enter>

        <Section title="Points" id={LIST} index={2}>
          <SegmentedControl
            label="Whose points"
            value={whose}
            onChange={setWhose}
            options={[
              { value: partner.id, label: `${partner.name}’s` },
              { value: me.id, label: 'Yours' },
            ]}
          />
          <Glide id={whose} direction={whose === me.id ? 1 : -1}>
            {rows.length ? (
              <ul className="flex flex-col gap-2.5">
                {rows.map((row) => (
                  <li key={row.point.id}>
                    <PointRowButton
                      row={row}
                      onOpen={() => sheet.show({ row, world })}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-2 text-nx-body text-nx-ink-2">No points yet.</p>
            )}
          </Glide>
        </Section>
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
