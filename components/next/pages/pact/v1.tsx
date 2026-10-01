// Read first, each person's rules on their own card with their signature, Sign pinned to the bottom; signing glides to a countdown screen.
'use client';
import { ArrowRight, PenLine } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Avatar,
  Button,
  GlassCard,
  Glide,
  PageTitle,
  PairAvatars,
  Section,
  StatButton,
} from '@/components/next/ui';
import type { Signer } from './pact-data';
import {
  CheckBadge,
  CountdownButton,
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
  const signed = !!flow.yours.signedAt;
  return (
    <PlainFrame back={signed ? undefined : { to: 'invite' }}>
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
              <Button
                variant="primary"
                size="lg"
                icon={PenLine}
                className="w-full sm:w-auto sm:min-w-56"
                onClick={() => {
                  // The signed screen starts at the top of the page.
                  window.scrollTo({ top: 0 });
                  flow.sign();
                }}
              >
                Sign
              </Button>
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
  const [, second, third] = flow.steps;
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
            label="Step"
            value={flow.step}
            hint={`Then ${second}, ${third} and so on`}
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
        <div className="grid gap-4 md:grid-cols-2">
          {flow.signers.map((s) => (
            <PersonCard key={s.person.id} signer={s} flow={flow} />
          ))}
        </div>
      </Section>
    </div>
  );
}

/** One person: every rule they check in on, and their signature at the bottom. */
function PersonCard({ signer, flow }: { signer: Signer; flow: PactFlow }) {
  const name = signer.you ? 'You' : signer.person.name;
  const tag = (r: Rule) =>
    r.who === 'both'
      ? undefined
      : signer.you
        ? 'Only you'
        : `Only ${signer.person.name}`;
  return (
    <GlassCard as="article" className="flex flex-col" aria-label={name}>
      <header className="flex items-center gap-3 pb-2">
        <Avatar person={signer.person} decorative />
        <h3 className="font-nx-serif text-nx-h3">{name}</h3>
      </header>
      <div className="flex flex-1 flex-col">
        {signer.rules.map((r) => (
          <RuleLine key={r.id} rule={r} tag={tag(r)} onOpen={flow.openRule} />
        ))}
      </div>
      <SignatureRow
        signer={signer}
        timeZone={flow.challenge.timeZone}
        avatar={false}
        className="mt-3"
      />
    </GlassCard>
  );
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
