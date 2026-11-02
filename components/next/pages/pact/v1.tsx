// One step at a time: the stakes and Day 1, then the rules, then your signature; after signing the countdown to Day 1 is the hero.
'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { AccountMenu, PlainFrame } from '@/components/next/frames';
import { useBackend } from '@/components/next/backend';
import {
  ActionBar,
  Button,
  CountUp,
  GlassCard,
  Glide,
  StatButton,
} from '@/components/next/ui';
import { HoldToSign, SealRing, SOLID_BAR, Terms } from './parts';
import { cn } from '@/lib/utils';
import { afterSheets } from './after-sheets';
import { PactSheets } from './sheets';
import { RuleList } from './rows';
import { SignatureLine } from './signature-line';
import { usePact, type PactFlow } from './use-pact';

const STEPS = 3;

/** Sign the pact: three short steps, then the countdown. */
export default function PactV1() {
  const flow = usePact();
  const { live } = useBackend();
  const signed = !!flow.yours.signedAt;
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Once someone moves between steps, each new step's title takes focus (not on first load).
  const [moved, setMoved] = useState(false);
  // While Hold to sign is held, your line inks in step with the button.
  const [holding, setHolding] = useState(false);
  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setMoved(true);
    window.scrollTo({ top: 0 });
  };
  const sign = () => {
    // The countdown starts at the top of the page.
    window.scrollTo({ top: 0 });
    setDirection(1);
    setMoved(true);
    flow.sign();
  };
  const last = step === STEPS - 1;
  const action = signed ? 'signed' : last ? 'sign' : 'next';
  return (
    <PlainFrame
      back={
        signed
          ? undefined
          : step > 0
            ? { onClick: () => go(step - 1) }
            : // In the live app the invite has been accepted, so Back goes to Your challenges.
              { to: live ? 'home' : 'invite' }
      }
      aside={<AccountMenu cancel={!signed} person={flow.you} />}
    >
      <Glide id={signed ? 'signed' : step} direction={direction}>
        {signed ? (
          <Signed flow={flow} focus={moved} />
        ) : step === 0 ? (
          <StartsAndStakes flow={flow} focus={moved} />
        ) : step === 1 ? (
          <Rules flow={flow} focus={moved} />
        ) : (
          <SignStep flow={flow} focus={moved} holding={holding} />
        )}
      </Glide>

      {/* One bar for every step: Next turns into Hold to sign, then Go to Overview, in the same place.
          From 640px it is a compact bar centred under the page, the same width on every step. */}
      <ActionBar className={cn(SOLID_BAR, 'sm:mx-auto sm:w-96')}>
        <Glide id={action} direction={direction} className="w-full">
          {action === 'signed' ? (
            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
              <Button
                variant="primary"
                size="lg"
                iconEnd={ArrowRight}
                className="w-full sm:w-auto sm:flex-1"
                onClick={flow.goToOverview}
              >
                Go to Overview
              </Button>
              <Button variant="quiet" onClick={() => flow.open('pact')}>
                See the pact
              </Button>
            </div>
          ) : action === 'sign' ? (
            <HoldToSign
              className="w-full"
              onSign={sign}
              onAsk={() => flow.open('sign')}
              onHoldChange={setHolding}
            />
          ) : (
            <Button
              variant="primary"
              size="lg"
              iconEnd={ArrowRight}
              className="w-full"
              onClick={() => go(step + 1)}
            >
              Next
            </Button>
          )}
        </Glide>
      </ActionBar>

      <PactSheets flow={flow} onSign={sign} />
    </PlainFrame>
  );
}

/** A step's title and "Step 1 of 3". It takes focus when the step is reached by Next or Back. */
function StepTitle({
  title,
  step,
  focus,
}: {
  title: string;
  step: number;
  focus: boolean;
}) {
  const ref = useFocusOnMount<HTMLHeadingElement>(focus);
  return (
    <header className="flex flex-col gap-2 pt-2">
      <h1 ref={ref} tabIndex={-1} className="nx-page-title outline-none">
        {title}
      </h1>
      <p className="text-nx-body text-nx-ink-2">
        Step {step} of {STEPS}
      </p>
    </header>
  );
}

function useFocusOnMount<T extends HTMLElement>(focus: boolean) {
  const ref = useRef<T>(null);
  // A step's `focus` only turns on as that step appears (Next, Back or signing moves on at once).
  useEffect(() => {
    if (!focus) return;
    return afterSheets(() => ref.current?.focus({ preventScroll: true }));
  }, [focus]);
  return ref;
}

/* ── Step 1: when it starts and what's at stake ─────────────────────────── */

function StartsAndStakes({ flow, focus }: { flow: PactFlow; focus: boolean }) {
  const c = flow.challenge;
  return (
    <div className="flex flex-col gap-7">
      <StepTitle title={`Sign the ${c.name} pact`} step={1} focus={focus} />
      <div className="flex flex-col gap-3">
        <StatButton
          size="lg"
          tone="accent"
          label="At stake"
          value={`~${flow.stakes}`}
          hint="Each gift, if you miss 1 in 10 check-ins"
          onClick={() => flow.open('step')}
        />
        <StatButton
          label="Day 1"
          value={flow.start}
          hint={`${c.days} days, to ${flow.end}`}
          onClick={() => flow.open('first')}
        />
      </div>
    </div>
  );
}

/* ── Step 2: the rules, one list ────────────────────────────────────────── */

function Rules({ flow, focus }: { flow: PactFlow; focus: boolean }) {
  return (
    <div className="flex flex-col gap-7">
      <StepTitle title="The rules" step={2} focus={focus} />
      <GlassCard>
        <RuleList flow={flow} />
      </GlassCard>
    </div>
  );
}

/* ── Step 3: what you both agree to, then the signature lines under it ─── */

/**
 * The promises sit right above the lines, in one card like a signed page, so they are on screen
 * as you sign. They are compact (15px) so Hold to sign never covers your line on a phone.
 */
function SignStep({
  flow,
  focus,
  holding,
}: {
  flow: PactFlow;
  focus: boolean;
  holding: boolean;
}) {
  const c = flow.challenge;
  return (
    <div className="flex flex-col gap-7">
      <StepTitle title="Your signature" step={3} focus={focus} />
      <GlassCard pad="none" className="flex flex-col px-5 pt-5 pb-4 sm:p-7">
        <section
          aria-labelledby="pact-promises"
          className="flex flex-col gap-2"
        >
          <h2
            id="pact-promises"
            className="font-nx-sans text-nx-2 font-semibold text-nx-ink-2"
          >
            What you both agree to
          </h2>
          <Terms terms={flow.terms} compact />
        </section>
        <div
          aria-hidden="true"
          className="my-4 border-t border-nx-line sm:my-6"
        />
        <h2 className="sr-only">Signatures</h2>
        <div className="flex flex-col gap-4 sm:gap-6">
          <SignatureLine signer={flow.theirs} timeZone={c.timeZone} />
          <SignatureLine
            signer={flow.yours}
            timeZone={c.timeZone}
            holding={holding}
          />
        </div>
      </GlassCard>
    </div>
  );
}

/* ── Signed: the countdown, then both signatures, small ─────────────────── */

function Signed({ flow, focus }: { flow: PactFlow; focus: boolean }) {
  const c = flow.challenge;
  const drawn = flow.justSigned;
  const ref = useFocusOnMount<HTMLHeadingElement>(focus);
  return (
    <div className="flex flex-col gap-8 pt-2">
      {flow.bothSigned ? (
        // The heading is the countdown itself, and the countdown opens what happens on Day 1.
        <h1
          ref={ref}
          tabIndex={-1}
          className="font-nx-sans font-normal outline-none"
        >
          <CountdownHero
            days={flow.countdown.days}
            hours={flow.countdown.hours}
            day={flow.start}
            onClick={() => flow.open('first')}
          />
        </h1>
      ) : (
        <header className="flex flex-col gap-2">
          <h1 ref={ref} tabIndex={-1} className="nx-page-title outline-none">
            You signed
          </h1>
          <p className="text-nx-body text-nx-ink-2">
            Waiting for {flow.theirs.person.name} to sign.
          </p>
        </header>
      )}

      <section
        aria-labelledby="pact-signed"
        className="nx-enter flex flex-col gap-3 [--nx-i:3]"
      >
        <h2 id="pact-signed" className="nx-section-title">
          {flow.bothSigned ? 'You both signed' : 'Signatures'}
        </h2>
        <GlassCard className="flex flex-col gap-4">
          {flow.bothSigned && drawn && <SealRing />}
          <SignatureLine size="sm" signer={flow.theirs} timeZone={c.timeZone} />
          <SignatureLine
            size="sm"
            signer={flow.yours}
            timeZone={c.timeZone}
            drawn={drawn}
          />
        </GlassCard>
      </section>
    </div>
  );
}

/** "Day 1 starts in 1 day 3 hours", large: both numbers count up, and it opens what happens on Day 1. */
function CountdownHero({
  days,
  hours,
  day,
  onClick,
}: {
  days: number;
  hours: number;
  /** "Monday, Nov 2" */
  day: string;
  onClick: () => void;
}) {
  const part = (n: number, one: string, many: string) => (
    <span className="flex items-baseline gap-2">
      <span className="font-nx-serif text-[64px] leading-none tracking-[-0.03em] text-nx-accent tabular-nums sm:text-[88px]">
        <CountUp value={n} />
      </span>
      <span className="font-nx-serif text-nx-h2 text-nx-ink">
        {n === 1 ? one : many}
      </span>
    </span>
  );
  return (
    <button
      type="button"
      onClick={onClick}
      className="nx-glass nx-tappable relative flex-col items-start gap-3 px-6 py-7 sm:px-8 sm:py-9"
    >
      <span className="pr-8 text-nx-lead text-nx-ink">Day 1 starts in</span>
      <span className="flex flex-wrap items-baseline gap-x-7 gap-y-2">
        {days > 0 && part(days, 'day', 'days')}
        {part(hours, 'hour', 'hours')}
      </span>
      <span className="text-nx-body text-nx-ink-2">{day}</span>
      <ChevronRight
        className="nx-row-chevron absolute top-7 right-5 sm:top-9 sm:right-7"
        size={22}
        aria-hidden="true"
      />
    </button>
  );
}
