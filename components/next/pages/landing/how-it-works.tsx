'use client';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  Button,
  Card,
  CountUp,
  NumberField,
  Sheet,
} from '@/components/next/ui';
import { formatMoney, giftTotal } from '@/lib/next/selectors';
import { STEPS } from './content';

/** The dollar amount of the first point in the example (most themes start at $1). */
const EXAMPLE_STEP = 1;
/** Six misses: $1 + $2 + … + $6 = $21. */
const EXAMPLE_MISSES = 6;

/** "$1 + $2 + $3 + $4 + $5 + $6"; past six, "$1 + $2 + $3 + … + $9". */
function breakdown(misses: number) {
  const cost = (n: number) => formatMoney(n * EXAMPLE_STEP);
  const parts =
    misses <= 6
      ? Array.from({ length: misses }, (_, i) => cost(i + 1))
      : [cost(1), cost(2), cost(3), '…', cost(misses)];
  return parts.join(' + ');
}

/** Try a number of misses and watch the gift add up. */
function GiftExample() {
  const [misses, setMisses] = useState(EXAMPLE_MISSES);
  const total = giftTotal(misses, EXAMPLE_STEP);
  return (
    <Card className="flex flex-col gap-4">
      <NumberField
        label="If you miss"
        unit={misses === 1 ? 'check-in' : 'check-ins'}
        value={misses}
        onChange={(n) => setMisses(n ?? 0)}
        step={1}
        min={0}
        max={30}
      />
      <div className="flex flex-col gap-1.5" aria-live="polite">
        <p className="text-nx-2 font-semibold">The gift you owe your partner</p>
        <p className="font-nx-serif text-nx-num text-nx-accent">
          <CountUp value={total} format={formatMoney} />
        </p>
        {misses > 0 && (
          <p className="text-nx-2 text-nx-ink-2">{breakdown(misses)}</p>
        )}
      </div>
    </Card>
  );
}

/** "How it works": the four parts in plain words, and what misses cost. */
export function HowItWorksSheet({
  open,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="How it works"
      footer={
        <Button variant="primary" iconEnd={ArrowRight} onClick={onStart}>
          Start a challenge
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <ol className="flex flex-col gap-5">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-nx-sm bg-nx-accent-soft text-nx-accent"
                aria-hidden="true"
              >
                <Icon size={20} />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-nx-body font-semibold">{title}</p>
                <p className="text-nx-2 text-nx-ink-2">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <GiftExample />
      </div>
    </Sheet>
  );
}
