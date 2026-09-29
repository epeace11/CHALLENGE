// Version 1: signatures first, with Sign right on your line and the countdown appearing where you signed; the promises and rules follow below.
'use client';
import { useCallback } from 'react';
import { ArrowRight, CalendarDays, Gift, PenLine } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  Button,
  Enter,
  GlassCard,
  PageTitle,
  Section,
  useReducedMotion,
} from '@/components/next/ui';
import {
  CountdownButton,
  FactButton,
  GroupLabel,
  RuleLine,
  SealRing,
  SignatureRow,
  Terms,
} from './parts';
import { PactSheets } from './sheets';
import { usePact } from './use-pact';

/** Sign the pact, version 1. */
export default function PactV1() {
  const flow = usePact();
  const still = useReducedMotion();
  const c = flow.challenge;
  const { yours, theirs } = flow;
  const { justSigned } = flow;
  // Once signed here, bring the countdown and Go to Overview into view, clear of the toast.
  // Stable, so it runs when the block appears and not on every render.
  const reveal = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && justSigned)
        el.scrollIntoView({
          block: 'nearest',
          behavior: still ? 'auto' : 'smooth',
        });
    },
    [justSigned, still],
  );

  return (
    <PlainFrame
      width="narrow"
      back={yours.signedAt ? undefined : { to: 'invite' }}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <PageTitle
            kicker={c.name}
            title="Sign the pact"
            detail="Both of you sign before Day 1."
          />
          <Enter index={1} className="flex flex-wrap gap-2">
            <FactButton icon={CalendarDays} onClick={() => flow.open('first')}>
              Starts {flow.start}
            </FactButton>
            <FactButton icon={Gift} onClick={() => flow.open('step')}>
              {flow.step} step
            </FactButton>
          </Enter>
        </div>

        <Section index={2} className="gap-5">
          <GlassCard pad="lg" className="flex flex-col">
            {flow.bothSigned && flow.justSigned && <SealRing />}
            <h2 className="sr-only">Signatures</h2>
            <div className="flex flex-col gap-6">
              <SignatureRow signer={theirs} timeZone={c.timeZone} />
              <SignatureRow
                signer={yours}
                timeZone={c.timeZone}
                drawn={flow.justSigned}
              >
                {!yours.signedAt && (
                  <Button
                    variant="primary"
                    size="lg"
                    full
                    icon={PenLine}
                    className="mt-4"
                    onClick={flow.sign}
                  >
                    Sign
                  </Button>
                )}
              </SignatureRow>
            </div>
          </GlassCard>

          {yours.signedAt && (
            <div
              ref={reveal}
              className="nx-enter flex scroll-mb-28 flex-col gap-3 [--nx-i:2]"
            >
              {flow.bothSigned ? (
                <CountdownButton
                  days={flow.countdown.days}
                  hours={flow.countdown.hours}
                  day={flow.start}
                  onClick={() => flow.open('first')}
                />
              ) : (
                <p className="text-nx-body text-nx-ink-2">
                  Waiting for {theirs.person.name} to sign.
                </p>
              )}
              <Button
                variant="primary"
                size="lg"
                full
                iconEnd={ArrowRight}
                onClick={flow.goToOverview}
              >
                Go to Overview
              </Button>
            </div>
          )}
        </Section>

        <Section title="What you both agree to" index={3}>
          <GlassCard>
            <Terms terms={flow.terms} />
          </GlassCard>
        </Section>

        <Section title="The rules" index={4}>
          <GlassCard className="flex flex-col gap-5">
            {flow.groups.map((g) => (
              <section key={g.key} aria-label={g.title}>
                <GroupLabel group={g} />
                {g.rules.map((r) => (
                  <RuleLine key={r.id} rule={r} onOpen={flow.openRule} />
                ))}
              </section>
            ))}
          </GlassCard>
        </Section>
      </div>

      <PactSheets flow={flow} />
    </PlainFrame>
  );
}
