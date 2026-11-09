// Gifts first: both gifts side by side (each opens the points behind it, at the end), then the whole challenge, the three weakest habits, the simple month with its own You / Jordan switch, a badges row each, and the points.
'use client';
import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import styles from './progress.module.css';
import { AppFrame } from '@/components/next/frames';
import {
  Glide,
  PageTitle,
  Section,
  SegmentedControl,
} from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import { useDetail } from './detail';
import { DetailSheet } from './detail-sheet';
import { giftFor, ledger } from './gifts-ledger';
import {
  GiftCard,
  HowSheet,
  PointRowButton,
  PointSheet,
  StepButton,
  useSheetFor,
  type OpenPoint,
} from './gifts-parts';
import {
  BadgesBoth,
  ByHabit,
  CalendarCard,
  CalendarSwitch,
  MainAction,
  WholeChallenge,
  useCalendar,
} from './parts';

const POINTS = 'progress-points';

/**
 * Progress, with the gifts (once a page of their own) at the top: who gets what, then how each of
 * you is doing, then every point behind the gifts. Forgiveness requests are decided in Review.
 */
export default function ProgressV1() {
  const world = useWorld();
  const { me, partner } = world;
  const still = useReducedMotion();
  const detail = useDetail();
  const cal = useCalendar();
  const [whose, setWhose] = useState(partner.id);
  const [how, setHow] = useState(false);
  const sheet = useSheetFor<OpenPoint>();
  const rows = [...ledger(world, whose)].reverse();

  /** Shows the points behind a gift: the list switches to the payer and scrolls into view. */
  const showPoints = (payerId: string) => {
    setWhose(payerId);
    document
      .getElementById(POINTS)
      ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <AppFrame>
      <div className={`flex flex-col gap-8 ${styles.palette}`}>
        <div className="flex flex-col gap-5">
          <PageTitle title="Progress" />
          <MainAction />
        </div>
        <Section title="Gifts" index={1}>
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
        </Section>
        <Section title="The whole challenge" index={2}>
          <WholeChallenge cal={cal} />
        </Section>
        <Section title="By habit, worst first" index={3}>
          <ByHabit detail={detail} />
        </Section>
        <Section title="Calendar" index={4}>
          <CalendarCard
            cal={cal}
            detail={detail}
            top={<CalendarSwitch cal={cal} />}
          />
        </Section>
        <Section title="Badges" index={5}>
          <BadgesBoth detail={detail} />
        </Section>
        <Section title="Points" id={POINTS} index={6}>
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
      <DetailSheet detail={detail} bothPeople />
      <PointSheet key={sheet.target?.row.point.id} sheet={sheet} />
      <HowSheet open={how} onOpenChange={setHow} world={world} />
    </AppFrame>
  );
}
