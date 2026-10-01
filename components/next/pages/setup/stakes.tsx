'use client';
import type { ReactNode } from 'react';
import type { Person } from '@/lib/next/model';
import { formatMoney, giftTotal, plural } from '@/lib/next/selectors';
import { Button, NumberField, Sheet, Toggle } from '@/components/next/ui';
import { StepPicker } from './fields';
import { DEFAULT_CAP, STEPS, stepLine } from './draft';

type Stakes = {
  gift: number;
  perPerson: {
    personId: string;
    checkins: number;
    misses: number;
    gift: number;
  }[];
};

/**
 * The stakes: what the first point costs (the nth costs n times that), then `readout` (the stakes
 * preview), then an optional cap on each gift.
 */
export function StakesFields({
  step,
  capOn,
  cap,
  onChange,
  capError,
  readout,
}: {
  step: number;
  capOn: boolean;
  cap: number | null;
  onChange: (next: {
    step?: number;
    capOn?: boolean;
    cap?: number | null;
  }) => void;
  capError?: ReactNode;
  readout?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <StepPicker
        label="First point costs"
        steps={STEPS}
        value={step}
        onChange={(s) => onChange({ step: s })}
        hint={stepLine(step)}
      />
      {readout}
      <div className="flex flex-col gap-3">
        <Toggle
          checked={capOn}
          onChange={(on) =>
            onChange(
              on ? { capOn: true, cap: cap ?? DEFAULT_CAP } : { capOn: false },
            )
          }
          label="Cap each gift"
          description="No gift goes over the amount you set."
        />
        {capOn && (
          <NumberField
            label="Most a gift can reach"
            value={cap}
            onChange={(v) => onChange({ cap: v })}
            unit="dollars"
            step={10}
            min={1}
            max={100000}
            error={capError}
          />
        )}
      </div>
    </div>
  );
}

/** How the stakes preview is worked out, in plain sentences. */
function StakesExplained({
  step,
  cap,
  stakes,
  people,
  days,
}: {
  step: number;
  cap: number | null;
  stakes: Stakes;
  people: Person[];
  days: number;
}) {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const [a, b] = stakes.perPerson;
  return (
    <div className="flex flex-col gap-4 text-nx-body">
      <p>
        Each miss is a point. {stepLine(step)} Six points cost{' '}
        {formatMoney(giftTotal(6, step, cap))}.
      </p>
      <p>
        When the challenge ends, each of you buys the other a gift worth your
        own points.
      </p>
      {a && b && (
        <p className="text-nx-ink-2">
          With these rules, {nameOf(a.personId)} has{' '}
          {plural(a.checkins, 'check-in')} in {plural(days, 'day')} and{' '}
          {nameOf(b.personId)} has {formatCount(b.checkins)}. Missing 1 in 10
          means {formatCount(a.misses)} misses for {nameOf(a.personId)} (a{' '}
          {formatMoney(a.gift)} gift) and {formatCount(b.misses)} for{' '}
          {nameOf(b.personId)} (a {formatMoney(b.gift)} gift).
        </p>
      )}
      {cap !== null && (
        <p className="text-nx-ink-2">No gift goes over {formatMoney(cap)}.</p>
      )}
    </div>
  );
}

const formatCount = (n: number) => n.toLocaleString('en-US');

/** "How the gift adds up": the explanation behind the stakes preview, one tap away. */
export function StakesHowSheet({
  open,
  onOpenChange,
  ...explained
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & Parameters<typeof StakesExplained>[0]) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="How the gift adds up"
      footer={
        <Button variant="primary" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      }
    >
      <StakesExplained {...explained} />
    </Sheet>
  );
}
