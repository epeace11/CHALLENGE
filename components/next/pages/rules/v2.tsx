// Version 2: two tabs. Rules shows every detail on its card (two columns on laptops); How it works holds the deadline, stakes and answers.
'use client';
import { useState } from 'react';
import { Camera, CalendarDays, ListChecks, Plus } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  GlassCard,
  Glide,
  PageTitle,
  Section,
  SegmentedControl,
  StatusPill,
  TapCard,
} from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import type { Rule } from '@/lib/next/model';
import { cn } from '@/lib/utils';
import {
  GROUP_ICON,
  answerLabel,
  proofLabel,
  rulesByWho,
  whenLabel,
} from './facts';
import {
  GroupMark,
  HowItWorks,
  RuleSheet,
  StakesRows,
  WaitingProposals,
  useProposals,
  type Proposals,
} from './parts';
import styles from './rules.module.css';

type Tab = 'rules' | 'help';

export default function RulesV2() {
  const world = useWorld();
  const proposals = useProposals();
  const [tab, setTab] = useState<Tab>('rules');
  const [open, setOpen] = useState<Rule | null>(null);
  const groups = rulesByWho(world);

  return (
    <AppFrame wide>
      <div className="flex flex-col gap-6 pb-2">
        <PageTitle title="Rules and help" />
        <SegmentedControl<Tab>
          label="Show"
          className="nx-enter max-w-md"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'rules', label: 'Rules' },
            { value: 'help', label: 'How it works' },
          ]}
        />

        <div className={styles.clipX}>
          <Glide id={tab} direction={tab === 'help' ? 1 : -1}>
            {tab === 'rules' ? (
              <div className="flex flex-col gap-9 pt-2">
                <WaitingProposals proposals={proposals} />
                {groups.map((g, i) => (
                  <Section
                    key={g.key}
                    index={i}
                    title={
                      <span className="flex items-center gap-3">
                        <GroupMark people={g.people} />
                        {g.title}
                      </span>
                    }
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      {g.rules.map((r) => (
                        <RuleCard
                          key={r.id}
                          rule={r}
                          proposals={proposals}
                          onOpen={() => setOpen(r)}
                        />
                      ))}
                    </div>
                  </Section>
                ))}
              </div>
            ) : (
              <div className="grid items-start gap-9 pt-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <Section title="Deadline and stakes">
                  <StakesRows />
                </Section>
                <Section title="Questions" index={1}>
                  <GlassCard pad="sm" className="px-4 py-1 sm:px-5">
                    <HowItWorks />
                  </GlassCard>
                </Section>
              </div>
            )}
          </Glide>
        </div>

        <ActionBar>
          <Button
            variant="primary"
            size="lg"
            full
            icon={Plus}
            className="sm:w-auto sm:min-w-72"
            onClick={() => proposals.propose('add')}
          >
            Propose a change
          </Button>
        </ActionBar>
      </div>
      <RuleSheet
        rule={open}
        onClose={() => setOpen(null)}
        proposals={proposals}
      />
      {proposals.sheet}
    </AppFrame>
  );
}

/** A rule with everything on the card: what is asked, the days, how you answer, the screenshot. */
function RuleCard({
  rule,
  proposals,
  onOpen,
}: {
  rule: Rule;
  proposals: Proposals;
  onOpen: () => void;
}) {
  const Icon = GROUP_ICON[rule.group];
  const proof = proofLabel(rule);
  const pending = proposals.pendingFor(rule.id);
  return (
    <TapCard onClick={onOpen} className="h-full">
      <span className="flex items-start gap-3.5">
        <span className={styles.groupIcon}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col gap-1 pt-0.5">
          <span className="font-nx-serif text-nx-h3 text-nx-ink">
            {rule.title}
          </span>
          <span className="text-nx-2 text-nx-ink-2">“{rule.question}”</span>
        </span>
      </span>
      <span className={cn(styles.facts, 'mt-4')}>
        <span className={styles.fact}>
          <CalendarDays size={16} aria-hidden="true" />
          {whenLabel(rule)}
        </span>
        <span className={styles.fact}>
          <ListChecks size={16} aria-hidden="true" />
          {answerLabel(rule)}
        </span>
        {proof && (
          <span className={styles.fact}>
            <Camera size={16} aria-hidden="true" />
            {proof}
          </span>
        )}
      </span>
      {pending && (
        <span className="mt-3 flex">
          <StatusPill
            status="review"
            label={pending.kind === 'retire' ? 'Retiring' : 'Change waiting'}
          />
        </span>
      )}
    </TapCard>
  );
}
