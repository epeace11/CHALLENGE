// Version 2: rules first; stakes and details are short summary rows that each open a sheet to change.
'use client';
import { useState, type ReactNode } from 'react';
import { ArrowRight, ChevronRight, PencilLine, Plus } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  GlassCard,
  PageTitle,
  Section,
  StatButton,
  useReducedMotion,
  useToast,
} from '@/components/next/ui';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import {
  formatDeadline,
  formatMoney,
  openDay,
  plural,
} from '@/lib/next/selectors';
import {
  draftDays,
  matchingRule,
  rangeLine,
  stepShort,
  zoneCity,
  zoneRegion,
  draftCap,
} from './draft';
import { RuleBuilderSheet } from './builder-sheet';
import { LibrarySheet } from './library-sheet';
import { RuleList } from './rule-list';
import {
  DatesSheet,
  DeadlineSheet,
  NameSheet,
  StakesSheet,
  TimeZoneSheet,
} from './sheets';
import { useDraft } from './use-draft';
import styles from './setup.module.css';

type Open =
  | 'name'
  | 'dates'
  | 'deadline'
  | 'zone'
  | 'stakes'
  | 'library'
  | 'builder'
  | null;

/** Set up and rules, version 2. */
export default function SetupV2() {
  const world = useWorld();
  const { me, partner } = world;
  const { navigate } = useNav();
  const toast = useToast();
  const still = useReducedMotion();
  const { draft, patch, stakes, people, saveRule, removeRule, restoreRule } =
    useDraft();
  const [open, setOpen] = useState<Open>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [rulesError, setRulesError] = useState<string>();
  const sheet = (name: Exclude<Open, null>) => ({
    open: open === name,
    onOpenChange: (next: boolean) => setOpen(next ? name : null),
  });

  const remove = (rule: Rule) => {
    const removed = removeRule(rule.id);
    if (removed)
      toast({
        text: `Removed “${rule.title}”`,
        action: {
          label: 'Undo',
          onClick: () => restoreRule(removed.rule, removed.index),
        },
      });
  };
  const add = (rule: Rule) => {
    saveRule(rule);
    setRulesError(undefined);
  };
  const build = (rule: Rule | null) => {
    setEditing(rule);
    setOpen('builder');
  };

  const invite = () => {
    if (draft.rules.length) return navigate('invite');
    setRulesError('Add at least one rule.');
    document
      .getElementById('setup-rules')
      ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };

  const days = draftDays(draft);
  const detected = draft.timeZone === world.challenge.timeZone;

  return (
    <PlainFrame back={{ to: 'start' }}>
      <div className="flex flex-col gap-10 pb-2">
        <PageTitle title={`Set up ${draft.name}`} />

        <Section id="setup-rules" title="Rules" index={1}>
          <RuleList
            rules={draft.rules}
            me={me}
            partner={partner}
            variant="rows"
            onEdit={build}
          />
          {rulesError && (
            <p className="nx-field-error" role="alert">
              {rulesError}
            </p>
          )}
          <div className="grid gap-3 pt-1 sm:grid-cols-2">
            <Button icon={Plus} onClick={() => setOpen('library')}>
              Add a rule
            </Button>
            <Button icon={PencilLine} onClick={() => build(null)}>
              Build your own
            </Button>
          </div>
        </Section>

        <Section title="Stakes" index={2}>
          <StatButton
            size="lg"
            tone="accent"
            label="Miss 1 in 10 check-ins and each gift will be about"
            value={stakes.gift}
            format={formatMoney}
            hint={stepShort(draft.step, draftCap(draft))}
            onClick={() => setOpen('stakes')}
          />
        </Section>

        <Section title="Details" index={3}>
          <GlassCard pad="none">
            <div className={styles.list}>
              <SettingRow
                label="Name"
                value={draft.name}
                onClick={() => setOpen('name')}
              />
              <SettingRow
                label="Dates"
                value={`${rangeLine(draft.start, days)} · ${plural(days, 'day')}`}
                onClick={() => setOpen('dates')}
              />
              <SettingRow
                label="Deadline"
                value={`Log by ${formatDeadline(draft.deadline)}`}
                onClick={() => setOpen('deadline')}
              />
              <SettingRow
                label="Time zone"
                value={
                  <>
                    {zoneCity(draft.timeZone)}
                    <span className="font-normal text-nx-ink-2">
                      {' '}
                      · {zoneRegion(draft.timeZone)}
                      {detected && ' · Detected'}
                    </span>
                  </>
                }
                onClick={() => setOpen('zone')}
              />
            </div>
          </GlassCard>
        </Section>
      </div>

      <ActionBar>
        <Button
          variant="primary"
          size="lg"
          full
          iconEnd={ArrowRight}
          onClick={invite}
        >
          Invite {partner.name}
        </Button>
      </ActionBar>

      <NameSheet
        {...sheet('name')}
        value={draft.name}
        onSave={(name) => patch({ name })}
      />
      <DatesSheet
        {...sheet('dates')}
        start={draft.start}
        days={draft.days}
        onSave={(next) => patch(next)}
      />
      <DeadlineSheet
        {...sheet('deadline')}
        value={draft.deadline}
        onSave={(deadline) => patch({ deadline })}
      />
      <TimeZoneSheet
        {...sheet('zone')}
        value={draft.timeZone}
        detected={world.challenge.timeZone}
        now={world.now}
        onSave={(timeZone) => patch({ timeZone })}
      />
      <StakesSheet
        {...sheet('stakes')}
        draft={draft}
        people={people}
        onSave={(next) => patch(next)}
      />
      <LibrarySheet
        {...sheet('library')}
        library={world.library}
        rules={draft.rules}
        onToggle={(rule) => {
          const existing = matchingRule(draft.rules, rule);
          if (existing) remove(existing);
          else add(rule);
        }}
      />
      <RuleBuilderSheet
        {...sheet('builder')}
        rule={editing}
        rules={draft.rules}
        me={me}
        partner={partner}
        day={openDay(world) ?? world.today}
        onSave={(rule, isNew) => {
          add(rule);
          setOpen(null);
          toast(isNew ? `Added “${rule.title}”` : `Saved “${rule.title}”`);
        }}
        onRemove={(rule) => {
          setOpen(null);
          remove(rule);
        }}
      />
    </PlainFrame>
  );
}

/** One setting as a row: what it is, its value, and a chevron; the row opens its sheet. */
function SettingRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.listRow} onClick={onClick}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-nx-2 text-nx-ink-2">{label}</span>
        <span className="text-nx-body font-semibold text-nx-ink">{value}</span>
      </span>
      <ChevronRight
        className={styles.listChevron}
        size={22}
        aria-hidden="true"
      />
    </button>
  );
}
