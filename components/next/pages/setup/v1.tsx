// One calm form in three sections (Details, Stakes, Rules), everything changed in place.
'use client';
import { useState } from 'react';
import { ArrowRight, PencilLine, Plus } from 'lucide-react';
import type { Rule } from '@/lib/next/model';
import { PlainFrame } from '@/components/next/frames';
import {
  ActionBar,
  Button,
  GlassCard,
  NumberField,
  PageTitle,
  Section,
  SegmentedControl,
  StatButton,
  TextField,
  useReducedMotion,
  useToast,
} from '@/components/next/ui';
import { useNav } from '@/components/next/nav';
import { useWorld } from '@/components/next/world';
import { formatMoney, openDay } from '@/lib/next/selectors';
import { DateField, Labeled } from './fields';
import {
  DEADLINES,
  MAX_DAYS,
  MIN_DAYS,
  deadlineId,
  deadlineLine,
  draftCap,
  draftDays,
  matchingRule,
  rangeLine,
  zoneCity,
  zoneRegion,
} from './draft';
import { RuleBuilderSheet } from './builder-sheet';
import { LibrarySheet } from './library-sheet';
import { RuleList } from './rule-list';
import { TimeZoneSheet } from './sheets';
import { StakesFields, StakesHowSheet } from './stakes';
import { useDraft } from './use-draft';

type Open = 'zone' | 'how' | 'library' | 'builder' | null;
type Errors = Partial<Record<'name' | 'days' | 'cap' | 'rules', string>>;

/** Set up and rules, version 1. */
export default function SetupV1() {
  const world = useWorld();
  const { me, partner } = world;
  const { navigate } = useNav();
  const toast = useToast();
  const still = useReducedMotion();
  const { draft, patch, stakes, people, saveRule, removeRule, restoreRule } =
    useDraft();
  const [open, setOpen] = useState<Open>(null);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const sheet = (name: Exclude<Open, null>) => ({
    open: open === name,
    onOpenChange: (next: boolean) => setOpen(next ? name : null),
  });
  const clear = (key: keyof Errors) => {
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

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
  const toggleLibrary = (rule: Rule) => {
    const existing = matchingRule(draft.rules, rule);
    if (existing) remove(existing);
    else {
      saveRule(rule);
      clear('rules');
    }
  };
  const build = (rule: Rule | null) => {
    setEditing(rule);
    setOpen('builder');
  };

  const invite = () => {
    const found: Errors = {
      name: draft.name.trim() ? undefined : 'Name the challenge.',
      days: draft.days ? undefined : 'Enter how many days it runs.',
      cap:
        draft.capOn && !draft.cap
          ? 'Enter the most a gift can reach, or switch the cap off.'
          : undefined,
      rules: draft.rules.length ? undefined : 'Add at least one rule.',
    };
    setErrors(found);
    const first =
      found.name || found.days
        ? 'details'
        : found.cap
          ? 'stakes'
          : found.rules
            ? 'rules'
            : null;
    if (!first) return navigate('invite');
    document
      .getElementById(`setup-${first}`)
      ?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <PlainFrame back={{ to: 'start' }}>
      <div className="flex flex-col gap-10 pb-2">
        <PageTitle title={`Set up ${draft.name.trim() || 'your challenge'}`} />

        <Section id="setup-details" title="Details" index={1}>
          <GlassCard className="flex flex-col gap-6">
            <TextField
              label="Name"
              value={draft.name}
              onChange={(name) => {
                patch({ name });
                clear('name');
              }}
              maxLength={40}
              error={errors.name}
            />
            <div className="grid items-start gap-6 sm:grid-cols-2">
              <DateField
                label="First day"
                value={draft.start}
                onChange={(start) => patch({ start })}
              />
              <NumberField
                label="Length"
                value={draft.days}
                onChange={(days) => {
                  patch({ days });
                  clear('days');
                }}
                unit="days"
                step={1}
                min={MIN_DAYS}
                max={MAX_DAYS}
                hint={rangeLine(draft.start, draftDays(draft))}
                error={errors.days}
              />
            </div>
            <Labeled
              label="Log each day by 11:59 pm"
              hint={deadlineLine(draft.deadline)}
            >
              <SegmentedControl
                label="Log each day by 11:59 pm"
                value={deadlineId(draft.deadline)}
                onChange={(id) => {
                  const chosen = DEADLINES.find((d) => d.id === id);
                  if (chosen) patch({ deadline: chosen.deadline });
                }}
                options={DEADLINES.map((d) => ({
                  value: d.id,
                  label: d.label,
                }))}
              />
            </Labeled>
            <div className="flex items-center gap-3 border-t border-nx-line pt-5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="nx-field-label">Time zone</p>
                <p className="flex flex-wrap items-center gap-x-2 text-nx-body">
                  {zoneCity(draft.timeZone)}
                  <span className="text-nx-2 text-nx-ink-2">
                    {zoneRegion(draft.timeZone)}
                    {draft.timeZone === world.challenge.timeZone &&
                      ' · Detected'}
                  </span>
                </p>
              </div>
              <Button
                variant="quiet"
                aria-label="Change time zone"
                onClick={() => setOpen('zone')}
              >
                Change
              </Button>
            </div>
          </GlassCard>
        </Section>

        <Section id="setup-stakes" title="Stakes" index={2}>
          <GlassCard>
            <StakesFields
              step={draft.step}
              capOn={draft.capOn}
              cap={draft.cap}
              capError={errors.cap}
              onChange={(next) => {
                patch(next);
                clear('cap');
              }}
              readout={
                <StatButton
                  glass={false}
                  size="lg"
                  tone="accent"
                  label="Miss 1 in 10 check-ins and each gift will be about"
                  value={stakes.gift}
                  format={formatMoney}
                  hint="See how it adds up"
                  onClick={() => setOpen('how')}
                />
              }
            />
          </GlassCard>
        </Section>

        <Section id="setup-rules" title="Rules" index={3}>
          <RuleList
            rules={draft.rules}
            me={me}
            partner={partner}
            variant="actions"
            onEdit={build}
            onRemove={remove}
          />
          {errors.rules && (
            <p className="nx-field-error" role="alert">
              {errors.rules}
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

      <TimeZoneSheet
        {...sheet('zone')}
        value={draft.timeZone}
        detected={world.challenge.timeZone}
        now={world.now}
        onSave={(timeZone) => patch({ timeZone })}
      />
      <StakesHowSheet
        {...sheet('how')}
        step={draft.step}
        cap={draftCap(draft)}
        stakes={stakes}
        people={people}
        days={draftDays(draft)}
      />
      <LibrarySheet
        {...sheet('library')}
        library={world.library}
        rules={draft.rules}
        onToggle={toggleLibrary}
      />
      <RuleBuilderSheet
        {...sheet('builder')}
        rule={editing}
        rules={draft.rules}
        me={me}
        partner={partner}
        day={openDay(world) ?? world.today}
        onSave={(rule, isNew) => {
          saveRule(rule);
          clear('rules');
          setOpen(null);
          toast(isNew ? `Added “${rule.title}”` : `Saved “${rule.title}”`);
        }}
      />
    </PlainFrame>
  );
}
