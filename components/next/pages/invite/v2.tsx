// Version 2: the start date and the step as big tiles first, then each group of rules as its own list, signed in shown in the top bar.
'use client';
import { ArrowRight } from 'lucide-react';
import { formatDate, formatWeekday } from '@/lib/next/selectors';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Avatar,
  Button,
  Card,
  PageTitle,
  PairAvatars,
  Presence,
  RowButton,
  Section,
  Stagger,
  StatButton,
} from '@/components/next/ui';
import { ruleDetail } from './invite-data';
import { AccountMenu, HowLines, RuleIcon, SentCard, SOLID_BAR } from './parts';
import { InviteSheets } from './sheets';
import { useInvite } from './use-invite';

/** Invite, version 2. */
export default function InviteV2() {
  const flow = useInvite();
  const { challenge: c, inviter } = flow;
  const [, second, third] = flow.steps;
  return (
    <PlainFrame aside={<AccountMenu flow={flow} />}>
      <div className="relative flex flex-col gap-9">
        <PageTitle
          title={
            <>
              {inviter.name} invited you to{' '}
              <span className="text-nx-accent">{c.name}</span>
            </>
          }
        />

        <Section index={1}>
          <div className="grid grid-cols-2 gap-3">
            <StatButton
              label="Starts"
              value={formatDate(c.start)}
              hint={`${formatWeekday(c.start)} · ${c.days} days`}
              onClick={() => flow.open('dates')}
            />
            <StatButton
              label="Step"
              value={flow.step}
              hint={`Then ${second}, ${third} and so on`}
              onClick={() => flow.open('gift')}
            />
          </div>
          <Card pad="sm">
            <h2 className="sr-only">How it works</h2>
            <HowLines flow={flow} className="mx-0" />
          </Card>
        </Section>

        {flow.groups.map((g, i) => (
          <Section
            key={g.key}
            index={i + 2}
            title={
              <span className="flex items-center gap-3">
                <span aria-hidden="true" className="flex">
                  {g.people.length > 1 ? (
                    <PairAvatars people={g.people} size="sm" />
                  ) : (
                    <Avatar person={g.people[0]} size="sm" decorative />
                  )}
                </span>
                {g.title}
              </span>
            }
          >
            <Stagger as="ul" className="flex flex-col gap-2.5" start={1}>
              {g.rules.map((r) => (
                <RowButton
                  key={r.id}
                  leading={<RuleIcon rule={r} />}
                  title={r.title}
                  detail={ruleDetail(r)}
                  onClick={() => flow.openRule(r.id)}
                />
              ))}
            </Stagger>
          </Section>
        ))}

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
