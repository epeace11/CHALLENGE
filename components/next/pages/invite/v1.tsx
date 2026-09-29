// Version 1: the whole invite on one page, the rules in one card grouped by who they are for, Accept pinned to the bottom.
'use client';
import { ArrowRight, CalendarDays, Gift } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  GlassCard,
  PairAvatars,
  Presence,
  Section,
} from '@/components/next/ui';
import {
  FactButton,
  GroupLabel,
  HowLines,
  RuleRow,
  SentCard,
  SignedIn,
  SOLID_BAR,
} from './parts';
import { InviteSheets } from './sheets';
import { useInvite } from './use-invite';

/** Invite, version 1. */
export default function InviteV1() {
  const flow = useInvite();
  const { challenge: c, inviter, you } = flow;
  return (
    <PlainFrame width="narrow">
      <div className="relative flex flex-col gap-8 pt-4">
        <header className="nx-enter flex flex-col items-start gap-5">
          <span aria-hidden="true">
            <PairAvatars people={[inviter, you]} size="lg" />
          </span>
          <h1 className="nx-page-title">
            {inviter.name} invited you to{' '}
            <span className="text-nx-accent">{c.name}</span>
          </h1>
          <div className="flex flex-wrap gap-2">
            <FactButton icon={CalendarDays} onClick={() => flow.open('dates')}>
              Starts {flow.start} · {c.days} days
            </FactButton>
            <FactButton icon={Gift} onClick={() => flow.open('gift')}>
              {flow.step} step
            </FactButton>
          </div>
        </header>

        <Section title="The rules" index={1}>
          <GlassCard pad="none" className="overflow-hidden">
            {flow.groups.map((g) => (
              <section
                key={g.key}
                aria-label={g.title}
                className="border-t border-nx-line pb-2 first:border-t-0"
              >
                <GroupLabel group={g} className="px-4 pt-5 pb-1 sm:px-5" />
                <ul>
                  {g.rules.map((r) => (
                    <li key={r.id}>
                      <RuleRow rule={r} onOpen={flow.openRule} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </GlassCard>
        </Section>

        <Section title="How it works" index={2}>
          <GlassCard pad="sm">
            <HowLines flow={flow} className="mx-0" />
          </GlassCard>
        </Section>

        <Presence mode="popLayout" initial={false}>
          {flow.sent && (
            <SentCard
              key="sent"
              sent={flow.sent}
              to={inviter.name}
              onTakeBack={flow.takeBack}
            />
          )}
        </Presence>

        <SignedIn
          flow={flow}
          className="nx-enter border-t border-nx-line pt-5 [--nx-i:3]"
        />
      </div>

      <ActionBar className={SOLID_BAR}>
        <Button
          variant="primary"
          size="lg"
          iconEnd={ArrowRight}
          className="w-full sm:w-auto"
          onClick={flow.accept}
        >
          Accept and continue
        </Button>
        {!flow.sent && (
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => flow.suggest()}
          >
            Suggest a change
          </Button>
        )}
      </ActionBar>

      <InviteSheets flow={flow} />
    </PlainFrame>
  );
}
