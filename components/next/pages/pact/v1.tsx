// Read first: when it starts and what a gift could come to, the terms, then one list of rules with both signatures under it.
// Hold to sign, pinned to the bottom; signing glides to a countdown screen.
'use client';
import { ArrowRight } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { AccountMenu, PlainFrame } from '@/components/next/frames';
import { useBackend } from '@/components/next/backend';
import {
  ActionBar,
  Button,
  GlassCard,
  Glide,
  PageTitle,
  PairAvatars,
  Section,
  StatButton,
} from '@/components/next/ui';
import {
  CheckBadge,
  CountdownButton,
  HoldToSign,
  RuleLine,
  SealRing,
  SignatureRow,
  SOLID_BAR,
  Terms,
} from './parts';
import { PactSheets } from './sheets';
import { usePact, type PactFlow } from './use-pact';

/** Sign the pact, version 2. */
export default function PactV2() {
  const flow = usePact();
  const { live } = useBackend();
  const signed = !!flow.yours.signedAt;
  return (
    <PlainFrame
      // In the live app the invite has been accepted, so Back goes to Your challenges.
      back={signed ? undefined : { to: live ? 'home' : 'invite' }}
      aside={<AccountMenu cancel={!signed} />}
    >
      <Glide id={signed ? 'signed' : 'sign'} direction={signed ? 1 : -1}>
        {signed ? <Signed flow={flow} /> : <ToSign flow={flow} />}
      </Glide>

      {/* One bar for both screens: Sign turns into Go to Overview in the same place, and the
          toast after signing rises above it instead of covering it. */}
      <ActionBar className={SOLID_BAR}>
        <Glide
          id={signed ? 'signed' : 'sign'}
          direction={signed ? 1 : -1}
          className="w-full"
        >
          {signed ? (
            <div className="flex flex-col gap-2 sm:flex-row-reverse sm:items-center">
              <Button
                variant="primary"
                size="lg"
                iconEnd={ArrowRight}
                className="w-full sm:w-auto sm:min-w-56"
                onClick={flow.goToOverview}
              >
                Go to Overview
              </Button>
              <Button variant="quiet" onClick={() => flow.open('pact')}>
                See the pact
              </Button>
            </div>
          ) : (
            <div className="flex sm:justify-end">
              <HoldToSign
                className="w-full sm:w-auto sm:min-w-56"
                onSign={() => {
                  // The signed screen starts at the top of the page.
                  window.scrollTo({ top: 0 });
                  flow.sign();
                }}
              />
            </div>
          )}
        </Glide>
      </ActionBar>

      <PactSheets flow={flow} />
    </PlainFrame>
  );
}

/* ── Before signing: read, then Sign from the bar ──────────────────────── */

function ToSign({ flow }: { flow: PactFlow }) {
  const c = flow.challenge;
  return (
    <div className="flex flex-col gap-9">
      <PageTitle
        kicker={c.name}
        title="Sign the pact"
        detail="Both of you sign before Day 1."
      />

      <Section index={1}>
        <div className="grid grid-cols-2 gap-3">
          <StatButton
            label="Starts"
            value={flow.startDate}
            hint={`${flow.startWeekday} · ${c.days} days`}
            onClick={() => flow.open('first')}
          />
          <StatButton
            label="At stake"
            value={`~${flow.stakes}`}
            hint="Each gift, if you miss 1 in 10"
            onClick={() => flow.open('step')}
          />
        </div>
      </Section>

      <Section title="What you both agree to" index={2}>
        <GlassCard>
          <Terms terms={flow.terms} />
        </GlassCard>
      </Section>

      <Section title="The rules" index={3}>
        <GlassCard className="flex flex-col">
          {c.rules.map((r) => (
            <RuleLine
              key={r.id}
              rule={r}
              tag={ruleTag(r, flow)}
              onOpen={flow.openRule}
            />
          ))}
          <div className="mt-3 flex flex-col gap-4 border-t border-nx-line pt-4">
            {flow.signers.map((s) => (
              <SignatureRow
                key={s.person.id}
                signer={s}
                timeZone={c.timeZone}
              />
            ))}
          </div>
        </GlassCard>
      </Section>
    </div>
  );
}

/** One list for both of you: a rule only one person checks in on says whose it is. */
function ruleTag(rule: Rule, flow: PactFlow) {
  if (rule.who === 'both') return undefined;
  return rule.who === flow.you.id
    ? 'Only you'
    : `Only ${flow.theirs.person.name}`;
}

/* ── After signing: the signatures and the countdown (Go to Overview is in the bar) */

function Signed({ flow }: { flow: PactFlow }) {
  const c = flow.challenge;
  const drawn = flow.justSigned;
  return (
    <div className="flex flex-col gap-6 pt-4">
      <header className="nx-enter flex flex-col items-center gap-5 text-center">
        <span className="relative" aria-hidden="true">
          <PairAvatars people={[flow.theirs.person, flow.you]} size="lg" />
          {flow.bothSigned && (
            <CheckBadge
              drawn={drawn}
              className="absolute -right-2.5 -bottom-1.5 shadow-[0_0_0_3px_var(--nx-page)]"
            />
          )}
        </span>
        <h1 className="nx-page-title">
          {flow.bothSigned ? 'You both signed' : 'You signed'}
        </h1>
      </header>

      <GlassCard className="nx-enter flex flex-col gap-6 [--nx-i:1]">
        {flow.bothSigned && drawn && <SealRing />}
        <h2 className="sr-only">Signatures</h2>
        <SignatureRow signer={flow.theirs} timeZone={c.timeZone} />
        <SignatureRow signer={flow.yours} timeZone={c.timeZone} drawn={drawn} />
      </GlassCard>

      {flow.bothSigned ? (
        <CountdownButton
          className="nx-enter [--nx-i:2]"
          days={flow.countdown.days}
          hours={flow.countdown.hours}
          day={flow.start}
          onClick={() => flow.open('first')}
        />
      ) : (
        <p className="nx-enter text-center text-nx-body text-nx-ink-2 [--nx-i:2]">
          Waiting for {flow.theirs.person.name} to sign.
        </p>
      )}
    </div>
  );
}
