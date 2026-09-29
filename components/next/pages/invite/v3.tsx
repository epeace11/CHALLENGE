// Version 3: compact, the rules behind a Both of you / You / Maya switch, and the actions right under them instead of pinned.
'use client';
import { useState } from 'react';
import { ArrowRight, CalendarDays, Gift } from 'lucide-react';
import { PlainFrame } from '@/components/next/frames';
import {
  Avatar,
  Button,
  Enter,
  GlassCard,
  Glide,
  Presence,
  SegmentedControl,
} from '@/components/next/ui';
import type { RuleGroupView } from './invite-data';
import { FactButton, HowLines, RuleRow, SentCard, SignedIn } from './parts';
import { InviteSheets } from './sheets';
import { useInvite } from './use-invite';

type GroupKey = RuleGroupView['key'];

/** Invite, version 3. */
export default function InviteV3() {
  const flow = useInvite();
  const { challenge: c, inviter, groups } = flow;
  const [shown, setShown] = useState<GroupKey>(groups[0]?.key ?? 'both');
  const [direction, setDirection] = useState<1 | -1>(1);
  const index = Math.max(
    0,
    groups.findIndex((g) => g.key === shown),
  );
  const group = groups[index];
  const show = (key: GroupKey) => {
    const next = groups.findIndex((g) => g.key === key);
    setDirection(next >= index ? 1 : -1);
    setShown(key);
  };

  return (
    <PlainFrame width="narrow">
      <div className="relative flex flex-col gap-7 pt-4">
        <header className="nx-enter flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <Avatar person={inviter} size="lg" decorative />
            <h1 className="nx-page-title min-w-0 flex-1">
              {inviter.name} invited you to{' '}
              <span className="text-nx-accent">{c.name}</span>
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <FactButton icon={CalendarDays} onClick={() => flow.open('dates')}>
              Starts {flow.start} · {c.days} days
            </FactButton>
            <FactButton icon={Gift} onClick={() => flow.open('gift')}>
              {flow.step} step
            </FactButton>
          </div>
        </header>

        <Enter index={1}>
          <GlassCard pad="none" className="overflow-hidden">
            <h2 className="sr-only">The rules</h2>
            <div className="px-3 pt-3 sm:px-4 sm:pt-4">
              <SegmentedControl
                label="Rules for"
                value={group?.key ?? shown}
                onChange={show}
                options={groups.map((g) => ({ value: g.key, label: g.short }))}
              />
            </div>
            {group && (
              <Glide id={group.key} direction={direction}>
                <ul className="py-2">
                  {group.rules.map((r) => (
                    <li key={r.id}>
                      <RuleRow rule={r} onOpen={flow.openRule} />
                    </li>
                  ))}
                </ul>
              </Glide>
            )}
          </GlassCard>
        </Enter>

        <Enter index={2}>
          <h2 className="sr-only">How it works</h2>
          <HowLines flow={flow} />
        </Enter>

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

        <Enter index={3} className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            full
            iconEnd={ArrowRight}
            onClick={flow.accept}
          >
            Accept and continue
          </Button>
          {!flow.sent && (
            <Button size="lg" full onClick={() => flow.suggest()}>
              Suggest a change
            </Button>
          )}
        </Enter>

        <Enter index={4}>
          <SignedIn flow={flow} />
        </Enter>
      </div>

      <InviteSheets flow={flow} />
    </PlainFrame>
  );
}
