// One page. Rules as rows grouped by who, then the deadline and stakes, then short answers; Propose a change stays pinned.
'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  GlassCard,
  PageTitle,
  RowButton,
  Section,
  StatusPill,
} from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import type { Rule } from '@/lib/next/model';
import { GROUP_ICON, rulesByWho, whenLabel } from './facts';
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

export default function RulesV1() {
  const world = useWorld();
  const proposals = useProposals();
  const [open, setOpen] = useState<Rule | null>(null);
  const groups = rulesByWho(world);

  return (
    <AppFrame>
      <div className="flex flex-col gap-8 pb-2">
        <PageTitle title="Rules and help" />
        <WaitingProposals proposals={proposals} />

        {groups.map((g, i) => (
          <Section
            key={g.key}
            index={i + 1}
            title={
              <span className="flex items-center gap-3">
                <GroupMark people={g.people} />
                {g.title}
              </span>
            }
          >
            <div className="flex flex-col gap-2">
              {g.rules.map((r) => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  proposals={proposals}
                  onOpen={() => setOpen(r)}
                />
              ))}
            </div>
          </Section>
        ))}

        <Section title="Deadline and stakes" index={groups.length + 1}>
          <StakesRows />
        </Section>

        <Section title="How it works" index={groups.length + 2}>
          <GlassCard pad="sm" className="px-4 py-1 sm:px-5">
            <HowItWorks />
          </GlassCard>
        </Section>

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

/** One rule: its name, when it is asked, how it is answered, and whether it needs a screenshot. */
function RuleRow({
  rule,
  proposals,
  onOpen,
}: {
  rule: Rule;
  proposals: Proposals;
  onOpen: () => void;
}) {
  const Icon = GROUP_ICON[rule.group];
  const how =
    rule.kind === 'number'
      ? 'A number'
      : rule.kind === 'weekly'
        ? 'Yes or No each day'
        : 'Yes or No';
  const detail = [
    whenLabel(rule),
    how,
    rule.proof === 'required'
      ? 'Screenshot'
      : rule.proof === 'optional'
        ? 'Screenshot optional'
        : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const pending = proposals.pendingFor(rule.id);
  return (
    <RowButton
      leading={
        <span className={styles.groupIcon}>
          <Icon size={20} aria-hidden="true" />
        </span>
      }
      title={rule.title}
      detail={detail}
      trailing={
        pending ? (
          <StatusPill
            status="review"
            label={pending.kind === 'retire' ? 'Retiring' : 'Change waiting'}
          />
        ) : undefined
      }
      onClick={onOpen}
    />
  );
}
