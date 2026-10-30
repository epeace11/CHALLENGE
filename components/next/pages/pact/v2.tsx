// Signature lines first: Hold to sign sits under your empty line, and signing settles in place into the seal, the countdown and Go to Overview.
'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Gift, ScrollText } from 'lucide-react';
import { formatDate, lastDay } from '@/lib/next/selectors';
import { AccountMenu, PlainFrame } from '@/components/next/frames';
import { useBackend } from '@/components/next/backend';
import {
  Button,
  DURATION,
  EASE,
  GlassCard,
  PageTitle,
  Presence,
  Section,
  motion,
  useReducedMotion,
} from '@/components/next/ui';
import { CountdownButton, HoldToSign, SealRing } from './parts';
import { afterSheets } from './after-sheets';
import { PactSheets } from './sheets';
import { ListRow, RowDivider, RulesDisclosure } from './rows';
import { SignatureLine } from './signature-line';
import { usePact, type PactFlow } from './use-pact';

/** Sign the pact, version 2: the page is the two signature lines. */
export default function PactV2() {
  const flow = usePact();
  const { live } = useBackend();
  const signed = !!flow.yours.signedAt;
  // While Hold to sign is held, your line inks in step with the button.
  const [holding, setHolding] = useState(false);
  // Signing stays on this page: nothing scrolls, the lines fill in where they are.
  const sign = flow.sign;
  const title = signed
    ? flow.bothSigned
      ? 'You both signed'
      : 'You signed'
    : 'Sign the pact';
  return (
    <PlainFrame
      // In the live app the invite has been accepted, so Back goes to Your challenges.
      back={signed ? undefined : { to: live ? 'home' : 'invite' }}
      aside={<AccountMenu cancel={!signed} />}
    >
      <div className="flex flex-col gap-5">
        <PageTitle
          title={
            <motion.span
              key={title}
              className="inline-block"
              initial={flow.justSigned ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.base, ease: EASE }}
            >
              {title}
            </motion.span>
          }
        />

        <Section index={1}>
          <Facts flow={flow} />
        </Section>

        <Section index={2}>
          <Signatures
            flow={flow}
            holding={holding}
            onHoldChange={setHolding}
            onSign={sign}
          />
        </Section>

        {signed && <AfterSigning flow={flow} />}

        <Section index={3}>
          <GlassCard pad="none" className="flex flex-col p-1.5">
            <ListRow
              icon={ScrollText}
              title="What you both agree to"
              detail={`${flow.terms.length} promises`}
              onClick={() => flow.open('pact')}
            />
            <RowDivider />
            <RulesDisclosure flow={flow} />
          </GlassCard>
        </Section>
      </div>

      <PactSheets flow={flow} onSign={sign} />
    </PlainFrame>
  );
}

/* ── When it starts and what's at stake: said once, each opening its sheet ── */

function Facts({ flow }: { flow: PactFlow }) {
  const c = flow.challenge;
  return (
    <GlassCard pad="none" className="flex flex-col p-1.5">
      <ListRow
        icon={CalendarDays}
        title={`Starts ${flow.start}`}
        detail={`${c.name} · ${c.days} days, to ${formatDate(lastDay(c))}`}
        onClick={() => flow.open('first')}
      />
      <RowDivider />
      <ListRow
        icon={Gift}
        title={`About ${flow.stakes} each gift`}
        detail="If you miss 1 in 10"
        onClick={() => flow.open('step')}
      />
    </GlassCard>
  );
}

/* ── The two lines: theirs signed, yours empty with Hold to sign under it ── */

function Signatures({
  flow,
  holding,
  onHoldChange,
  onSign,
}: {
  flow: PactFlow;
  holding: boolean;
  onHoldChange: (holding: boolean) => void;
  onSign: () => void;
}) {
  const still = useReducedMotion();
  const c = flow.challenge;
  const signed = !!flow.yours.signedAt;
  return (
    <GlassCard pad="lg" className="flex flex-col gap-6">
      {flow.bothSigned && flow.justSigned && <SealRing />}
      <h2 className="sr-only">Signatures</h2>
      <SignatureLine signer={flow.theirs} timeZone={c.timeZone} />
      <div>
        <SignatureLine
          signer={flow.yours}
          timeZone={c.timeZone}
          drawn={flow.justSigned}
          holding={holding}
        />
        {/* Hold to sign folds away once your name is on the line. */}
        <Presence initial={false}>
          {!signed && (
            <motion.div
              key="hold"
              className="-mx-1.5 -mb-1.5 overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: still ? 0 : DURATION.base, ease: EASE }}
            >
              {/* Indented to start where the line starts, past the avatar. */}
              <div className="pt-5 pr-1.5 pb-1.5 pl-[60px]">
                <HoldToSign
                  className="w-full sm:w-auto sm:min-w-64"
                  onSign={onSign}
                  onAsk={() => flow.open('sign')}
                  onHoldChange={onHoldChange}
                />
              </div>
            </motion.div>
          )}
        </Presence>
      </div>
    </GlassCard>
  );
}

/* ── After signing: the countdown, then Go to Overview ─────────────────── */

/**
 * Under the signatures once you've signed: the countdown, then Go to Overview, in the page like
 * Hold to sign was (no pinned bar). Once your name is on the line, the page scrolls only as far as
 * it takes to show Go to Overview; where it already shows, nothing moves.
 */
function AfterSigning({ flow }: { flow: PactFlow }) {
  const still = useReducedMotion();
  const go = useRef<HTMLButtonElement>(null);
  const justSigned = flow.justSigned;
  useEffect(() => {
    if (!justSigned) return;
    return afterSheets(
      () => {
        const el = go.current;
        if (!el) return;
        el.scrollIntoView({
          block: 'nearest',
          behavior: still ? 'auto' : 'smooth',
        });
        // Hold to sign (or the Sign sheet) is gone, so focus moves on to the next step.
        if (document.activeElement === document.body)
          el.focus({ preventScroll: true });
      },
      still ? 0 : 300,
    );
  }, [justSigned, still]);
  return (
    <>
      {flow.bothSigned ? (
        <CountdownButton
          className="nx-enter [--nx-i:5]"
          days={flow.countdown.days}
          hours={flow.countdown.hours}
          day={flow.start}
          onClick={() => flow.open('first')}
        />
      ) : (
        <p className="nx-enter text-center text-nx-body text-nx-ink-2 [--nx-i:5]">
          Waiting for {flow.theirs.person.name} to sign.
        </p>
      )}
      <Button
        ref={go}
        variant="primary"
        size="lg"
        iconEnd={ArrowRight}
        className="nx-enter w-full scroll-mb-4 [--nx-i:6] sm:w-auto sm:min-w-56 sm:self-end"
        onClick={flow.goToOverview}
      >
        Go to Overview
      </Button>
    </>
  );
}
