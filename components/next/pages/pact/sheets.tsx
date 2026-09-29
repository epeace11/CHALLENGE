'use client';
import type { ReactNode } from 'react';
import {
  formatMoney,
  formatTarget,
  formatWhen,
  giftTotal,
} from '@/lib/next/selectors';
import { Avatar, Button, Sheet } from '@/components/next/ui';
import { RuleIcon, RuleLine, StepBars, Terms } from './parts';
import type { PactFlow } from './use-pact';

/** Every sheet the pact opens. Each version renders this once. */
export function PactSheets({ flow }: { flow: PactFlow }) {
  return (
    <>
      <FirstDaySheet flow={flow} />
      <StepSheet flow={flow} />
      <RuleSheet flow={flow} />
      <WholePactSheet flow={flow} />
    </>
  );
}

const onOpenChange = (flow: PactFlow) => (open: boolean) => {
  if (!open) flow.close();
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
      <dt className="text-nx-2 text-nx-ink-2">{label}</dt>
      <dd className="text-nx-body text-nx-ink">{children}</dd>
    </div>
  );
}

/* ── Day 1 and the first check-in ──────────────────────────────────────── */

function FirstDaySheet({ flow }: { flow: PactFlow }) {
  const c = flow.challenge;
  return (
    <Sheet
      open={flow.sheet === 'first'}
      onOpenChange={onOpenChange(flow)}
      title={`Day 1 is ${flow.start}`}
      description={`${c.name} runs ${c.days} days, to ${flow.end}, on ${flow.place} time.`}
      footer={
        <>
          <Button onClick={flow.practice}>Try a practice day</Button>
          <Button variant="primary" onClick={flow.close}>
            Close
          </Button>
        </>
      }
    >
      <dl className="flex flex-col divide-y divide-nx-line">
        <Fact label="First check-in">
          For {flow.firstCheckin.day}, by {flow.firstCheckin.until}
        </Fact>
        <Fact label="After that">
          Every day, check in for the day before, by {flow.deadlineClock}.
        </Fact>
      </dl>
    </Sheet>
  );
}

/* ── The dollar step ────────────────────────────────────────────────────── */

function StepSheet({ flow }: { flow: PactFlow }) {
  const { step } = flow.challenge;
  const n = 6;
  return (
    <Sheet
      open={flow.sheet === 'step'}
      onOpenChange={onOpenChange(flow)}
      title={`The ${flow.step} step`}
      description="Each miss is a point, and each point costs one step more than the one before."
      footer={
        <Button variant="primary" onClick={flow.close}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <StepBars step={step} count={n} />
        <p className="text-nx-body text-nx-ink">
          So {n} misses cost {formatMoney(giftTotal(n, step, null))} in all.
          When it ends, each of you buys the other a gift worth your own points.
        </p>
        <p className="text-nx-body text-nx-ink-2">
          A point {flow.inviter.name} forgives costs nothing.
        </p>
      </div>
    </Sheet>
  );
}

/* ── One rule ───────────────────────────────────────────────────────────── */

function RuleSheet({ flow }: { flow: PactFlow }) {
  const { rule } = flow;
  const group = rule
    ? flow.groups.find((g) => g.rules.some((r) => r.id === rule.id))
    : undefined;
  const proof =
    rule?.proof === 'required'
      ? 'Needed with every answer'
      : rule?.proof === 'optional'
        ? 'Optional'
        : 'Not needed';
  return (
    <Sheet
      open={flow.sheet === 'rule'}
      onOpenChange={onOpenChange(flow)}
      title={rule?.title ?? 'Rule'}
      description={rule?.description}
      footer={
        <Button variant="primary" onClick={flow.close}>
          Close
        </Button>
      }
    >
      {rule && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3.5">
            <RuleIcon rule={rule} />
            <p className="text-nx-body text-nx-ink">{rule.question}</p>
          </div>
          <dl className="flex flex-col divide-y divide-nx-line">
            <Fact label="For">{group?.title}</Fact>
            <Fact label="When">
              {rule.kind === 'weekly'
                ? `${formatWhen(rule)}, Monday to Sunday`
                : formatWhen(rule)}
            </Fact>
            {rule.target && (
              <Fact label="Target">{formatTarget(rule.target)}</Fact>
            )}
            {rule.kind === 'weekly' && (
              <Fact label="How it counts">
                A day without it costs nothing. Each day short of{' '}
                {rule.weeklyTarget} when the week ends is a point.
              </Fact>
            )}
            <Fact label="Screenshot">{proof}</Fact>
          </dl>
        </div>
      )}
    </Sheet>
  );
}

/* ── The whole pact, after signing ─────────────────────────────────────── */

function WholePactSheet({ flow }: { flow: PactFlow }) {
  const c = flow.challenge;
  return (
    <Sheet
      open={flow.sheet === 'pact'}
      onOpenChange={onOpenChange(flow)}
      title={`The ${c.name} pact`}
      description={`Starts ${flow.start}. ${flow.step} step.`}
      footer={
        <Button variant="primary" onClick={flow.close}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-7">
        <Terms terms={flow.terms} />
        {flow.signers.map((s) => (
          <section key={s.person.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-3 pb-1">
              <Avatar person={s.person} size="sm" decorative />
              <h3 className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2">
                {s.you ? 'You' : s.person.name}
              </h3>
            </div>
            {s.rules.map((r) => (
              <RuleLine key={r.id} rule={r} />
            ))}
          </section>
        ))}
      </div>
    </Sheet>
  );
}
