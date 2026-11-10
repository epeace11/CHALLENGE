// One step at a time: the stakes and Day 1, then the rules, your own limit when a rule has one, then your signature; after signing the countdown to Day 1 is the hero.
'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { AccountMenu, PlainFrame } from '@/components/next/frames';
import { formatTarget } from '@/lib/next/selectors';
import {
  ActionBar,
  Button,
  CountUp,
  GlassCard,
  Glide,
  NumberField,
  StatButton,
} from '@/components/next/ui';
import { HoldToSign, SealRing, SOLID_BAR, Terms } from './parts';
import { cn } from '@/lib/utils';
import { afterSheets } from './after-sheets';
import { PactSheets } from './sheets';
import { RuleList } from './rows';
import { SignatureLine } from './signature-line';
import { forgetPactFromInvite, pactFromInvite } from './entry';
import { usePact, type PactFlow } from './use-pact';

/** Sign the pact: three or four short steps, then the countdown. */
export default function PactV1() {
  const flow = usePact();
  const signed = !!flow.yours.signedAt;
  // Straight from Invite's Accept, it opens after the rules: your limit, or the signature (see entry.ts).
  const [step, setStep] = useState(() => (pactFromInvite() ? 2 : 0));
  useEffect(forgetPactFromInvite, []);
  // A limit left empty says so when Next is pressed.
  const [limitShown, setLimitShown] = useState(false);
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
  const at = flow.steps[step];
  const action = signed ? 'signed' : at === 'sign' ? 'sign' : 'next';
  const next = () => {
    if (at === 'limits' && !flow.limitsSet) return setLimitShown(true);
    go(step + 1);
  };
  return (
    <PlainFrame
      back={
        signed
          ? undefined
          : step > 0
            ? { onClick: () => go(step - 1) }
            : // Set up for the one who set it up; otherwise the invite has been accepted.
              { to: flow.back }
      }
      aside={<AccountMenu cancel={!signed} person={flow.you} />}
    >
      <Glide id={signed ? 'signed' : step} direction={direction}>
        {signed ? (
          <Signed flow={flow} focus={moved} />
        ) : at === 'start' ? (
          <StartsAndStakes flow={flow} focus={moved} />
        ) : at === 'rules' ? (
          <Rules flow={flow} focus={moved} />
        ) : at === 'limits' ? (
          <Limits flow={flow} focus={moved} shown={limitShown} />
        ) : (
          <SignStep flow={flow} focus={moved} holding={holding} />
        )}
      </Glide>

      {/* One bar for every step: Next turns into Hold to sign, then where to go next, in the same place.
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
                onClick={flow.next.go}
              >
                {flow.next.label}
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
              onClick={next}
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
  flow,
  step,
  focus,
}: {
  title: string;
  flow: PactFlow;
  step: PactFlow['steps'][number];
  focus: boolean;
}) {
  const ref = useFocusOnMount<HTMLHeadingElement>(focus);
  return (
    <header className="flex flex-col gap-2 pt-2">
      <h1 ref={ref} tabIndex={-1} className="nx-page-title outline-none">
        {title}
      </h1>
      <p className="text-nx-body text-nx-ink-2">
        Step {flow.steps.indexOf(step) + 1} of {flow.steps.length}
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
      <StepTitle
        title={`Sign the ${c.name} pact`}
        flow={flow}
        step="start"
        focus={focus}
      />
      <div className="flex flex-col gap-3">
        <StatButton
          size="lg"
          tone="accent"
          label="At stake"
          value={`~${flow.stakes}`}
          hint={`Each gift, if you miss 1 in ${flow.missEvery} check-ins`}
          onClick={() => flow.open('step')}
        />
        <StatButton
          label="Day 1"
          value={flow.start}
          hint={
            flow.moved
              ? `The day after you both sign · ${c.days} days`
              : `${c.days} days, to ${flow.end}`
          }
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
      <StepTitle title="The rules" flow={flow} step="rules" focus={focus} />
      <GlassCard>
        <RuleList flow={flow} />
      </GlassCard>
    </div>
  );
}

/* ── Step 3, when a rule has one: your own limit ─────────────────────────── */

/** Each rule where each of you sets your own target: yours, starting from the suggestion. */
function Limits({
  flow,
  focus,
  shown,
}: {
  flow: PactFlow;
  focus: boolean;
  /** Next was pressed with a limit empty. */
  shown: boolean;
}) {
  const word = flow.limitWord;
  const many = flow.limitRules.length > 1;
  return (
    <div className="flex flex-col gap-7">
      <StepTitle
        title={`Your ${word}${many ? 's' : ''}`}
        flow={flow}
        step="limits"
        focus={focus}
      />
      <GlassCard className="flex flex-col gap-6">
        {flow.limitRules.map((rule) => {
          const value = flow.limits[rule.id] ?? null;
          return (
            <NumberField
              key={rule.id}
              label={rule.title}
              value={value}
              onChange={(v) => flow.setLimit(rule.id, v)}
              unit={rule.target?.unit}
              hint={`${rule.target ? `Suggested: ${formatTarget(rule.target)}. ` : ''}Yours can’t change after you sign.`}
              error={
                shown && !(value !== null && value > 0)
                  ? `Enter your ${word}.`
                  : undefined
              }
            />
          );
        })}
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
      <StepTitle title="Your signature" flow={flow} step="sign" focus={focus} />
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
          {flow.limitLine && (
            <p className="text-nx-2 font-semibold text-nx-ink">
              {flow.limitLine}
            </p>
          )}
        </section>
        <div
          aria-hidden="true"
          className="my-4 border-t border-nx-line sm:my-6"
        />
        <h2 className="sr-only">Signatures</h2>
        {/* Whoever set it up signs first, so their line is on top. */}
        <div className="flex flex-col gap-4 sm:gap-6">
          {inOrder(flow, [
            <SignatureLine
              key="theirs"
              signer={flow.theirs}
              timeZone={c.timeZone}
            />,
            <SignatureLine
              key="yours"
              signer={flow.yours}
              timeZone={c.timeZone}
              holding={holding}
            />,
          ])}
        </div>
      </GlassCard>
    </div>
  );
}

/** The two signature lines, the first signer's on top: the partner's, or yours when you set it up. */
const inOrder = (flow: PactFlow, [theirs, yours]: [ReactNode, ReactNode]) =>
  flow.setterUp ? [yours, theirs] : [theirs, yours];

/* ── Signed: the countdown, then both signatures, small ─────────────────── */

function Signed({ flow, focus }: { flow: PactFlow; focus: boolean }) {
  const c = flow.challenge;
  const drawn = flow.justSigned;
  const ref = useFocusOnMount<HTMLHeadingElement>(focus);
  return (
    <div className="flex flex-col gap-8 pt-2">
      {flow.bothSigned && flow.started ? (
        // Read back after Day 1 (Rules and help's The pact): the signatures under it say by whom.
        <h1 ref={ref} tabIndex={-1} className="nx-page-title outline-none">
          The {c.name} pact
        </h1>
      ) : flow.bothSigned ? (
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
          {/* Before the partner joins, the Invite button below says what is next. */}
          {!flow.partnerPending && (
            <p className="text-nx-body text-nx-ink-2">
              Waiting for {flow.theirs.person.name} to sign.
            </p>
          )}
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
          {inOrder(flow, [
            <SignatureLine
              key="theirs"
              size="sm"
              signer={flow.theirs}
              timeZone={c.timeZone}
            />,
            <SignatureLine
              key="yours"
              size="sm"
              signer={flow.yours}
              timeZone={c.timeZone}
              drawn={drawn}
            />,
          ])}
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
