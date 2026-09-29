'use client';
import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, Send } from 'lucide-react';
import type {
  DateString,
  ProofNeed,
  RuleKind,
  Weekday,
} from '@/lib/next/model';
import {
  formatDay,
  formatDayShort,
  formatWeekdays,
} from '@/lib/next/selectors';
import {
  Button,
  NumberField,
  SegmentedControl,
  Sheet,
  TextField,
} from '@/components/next/ui';
import { useWorld } from '@/components/next/world';
import {
  EVERY_DAY,
  blankDraft,
  changesOf,
  daysKeyOf,
  draftOfRule,
  ideas,
  rulesByWho,
  startOptions,
  type Proposal,
  type ProposalKind,
  type RuleDraft,
} from './facts';
import styles from './rules.module.css';

/** Options as chips that wrap: one is always chosen. Native radios, so arrow keys work. */
export function Choices<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: ReactNode;
  value: T;
  options: { value: T; label: ReactNode; detail?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.choicesLegend}>{legend}</legend>
      <div className={styles.choiceRow}>
        {options.map((o) => (
          <label key={o.value} className={styles.choice}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            <span>{o.label}</span>
            {o.detail && (
              <span className={styles.choiceDetail}>{o.detail}</span>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const DAY_PRESETS: { value: string; days: Weekday[] }[] = [
  { value: 'every', days: EVERY_DAY },
  { value: 'sun-thu', days: [0, 1, 2, 3, 4] },
  { value: 'mon-fri', days: [1, 2, 3, 4, 5] },
  { value: 'weekends', days: [0, 6] },
];
const daysKey = (days: Weekday[]) =>
  DAY_PRESETS.find((p) => daysKeyOf(p.days) === daysKeyOf(days))?.value ??
  'custom';

type Start = 'tomorrow' | 'next' | 'other';

/**
 * "Propose a change": add a rule (named, or picked from the library), change one, or retire one;
 * its details; and the day it starts (tomorrow by default). It waits for the partner's approval.
 * Mount it with a new `key` for each opening so the form starts fresh.
 */
export function ProposalSheet({
  open,
  onOpenChange,
  preset,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset: { kind: ProposalKind; ruleId?: string };
  onSend: (p: Omit<Proposal, 'id' | 'sentAt'>) => void;
}) {
  const world = useWorld();
  const c = world.challenge,
    partner = world.partner.name;
  const dates = startOptions(world);
  const firstRule = preset.ruleId ?? c.rules[0]?.id ?? '';
  const ruleOf = (id: string) => c.rules.find((r) => r.id === id);

  const [kind, setKind] = useState<ProposalKind>(preset.kind);
  const [ruleId, setRuleId] = useState(firstRule);
  const [draft, setDraft] = useState<RuleDraft>(() => {
    const r = ruleOf(firstRule);
    return preset.kind === 'add' || !r ? blankDraft() : draftOfRule(r);
  });
  const [start, setStart] = useState<Start>('tomorrow');
  const [other, setOther] = useState<DateString>(dates.tomorrow);
  const [note, setNote] = useState('');
  const selectId = useId(),
    dateId = useId();

  const rule = ruleOf(ruleId);
  const patch = (p: Partial<RuleDraft>) => setDraft((d) => ({ ...d, ...p }));
  const switchKind = (k: ProposalKind) => {
    setKind(k);
    if (k === 'add') setDraft(blankDraft());
    else if (rule) setDraft(draftOfRule(rule));
  };
  const from =
    start === 'tomorrow'
      ? dates.tomorrow
      : start === 'next' && dates.nextWeek
        ? dates.nextWeek
        : other;

  // Why Send is off. An empty name speaks for itself, so it is not said.
  const problem = (() => {
    if (kind === 'add' && !draft.title.trim()) return '';
    if (kind !== 'add' && !rule) return 'Choose a rule first.';
    if (kind !== 'retire' && draft.kind === 'number') {
      if (!draft.target || draft.target <= 0) return 'Set the target.';
      if (!draft.unit.trim()) return 'Say what the number counts.';
    }
    if (kind === 'change' && rule && changesOf(world, rule, draft).length === 0)
      return 'Change something first.';
    if (!from || from < dates.first || from > dates.last)
      return `Pick a day from ${formatDayShort(dates.first)} to ${formatDayShort(dates.last)}.`;
    return null;
  })();

  const send = () => {
    if (problem !== null) return;
    onSend({
      kind,
      ...(kind === 'add' ? {} : { ruleId }),
      ...(kind === 'retire'
        ? {}
        : {
            draft: {
              ...draft,
              title: draft.title.trim(),
              unit: draft.unit.trim(),
            },
          }),
      from,
      note: note.trim(),
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Propose a change"
      description={`${partner} approves it before it counts.`}
      footer={
        <>
          {!!problem && (
            <output className="block text-center text-nx-2 font-semibold text-nx-wait order-last sm:order-first sm:mr-auto sm:self-center sm:text-left">
              {problem}
            </output>
          )}
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            icon={Send}
            disabled={problem !== null}
            onClick={send}
          >
            Send to {partner}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-7">
        <SegmentedControl
          label="What to propose"
          value={kind}
          onChange={switchKind}
          options={[
            { value: 'add', label: 'Add a rule' },
            { value: 'change', label: 'Change' },
            { value: 'retire', label: 'Retire' },
          ]}
        />

        {kind === 'add' ? (
          <div className="flex flex-col gap-4">
            <TextField
              label="Rule"
              value={draft.title}
              onChange={(title) => patch({ title })}
              placeholder="Screens off by 10 pm"
              maxLength={80}
            />
            <div className="flex flex-col gap-2">
              <p className={styles.fieldLabel}>Or pick one from the library</p>
              <div className={styles.choiceRow}>
                {ideas(world, 4).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={styles.choice}
                    aria-pressed={draft.title === r.title}
                    onClick={() => setDraft({ ...draftOfRule(r), who: 'both' })}
                  >
                    <span className="font-semibold">{r.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor={selectId} className={styles.fieldLabel}>
              Rule
            </label>
            <div className={styles.control}>
              <select
                id={selectId}
                className={styles.input}
                value={ruleId}
                onChange={(e) => {
                  setRuleId(e.target.value);
                  const r = ruleOf(e.target.value);
                  if (r) setDraft(draftOfRule(r));
                }}
              >
                {rulesByWho(world).map((g) => (
                  <optgroup key={g.key} label={g.title}>
                    {g.rules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                size={20}
                aria-hidden="true"
                className={styles.selectChevron}
              />
            </div>
          </div>
        )}

        {kind !== 'retire' && <RuleFields draft={draft} patch={patch} />}

        <div className="flex flex-col gap-3">
          <Choices<Start>
            legend={kind === 'retire' ? 'Stops counting from' : 'Starts'}
            value={start}
            onChange={setStart}
            options={[
              {
                value: 'tomorrow',
                label: 'Tomorrow',
                detail: formatDayShort(dates.tomorrow),
              },
              ...(dates.nextWeek
                ? [
                    {
                      value: 'next' as const,
                      label: 'Next week',
                      detail: formatDayShort(dates.nextWeek),
                    },
                  ]
                : []),
              { value: 'other', label: 'Another day' },
            ]}
          />
          {start === 'other' && (
            <div className="nx-enter flex flex-col gap-2">
              <label htmlFor={dateId} className={styles.fieldLabel}>
                Day
              </label>
              <input
                id={dateId}
                type="date"
                className={styles.input}
                value={other}
                min={dates.first}
                max={dates.last}
                onChange={(e) => setOther(e.target.value)}
              />
              {other >= dates.first && other <= dates.last && (
                <p className="text-nx-2 text-nx-ink-2">{formatDay(other)}</p>
              )}
            </div>
          )}
        </div>

        <TextField
          label={`Note to ${partner} (optional)`}
          multiline
          rows={2}
          maxLength={500}
          value={note}
          onChange={setNote}
        />
      </div>
    </Sheet>
  );
}

/** Who a rule is for, how it is answered, on which days, and whether it needs a screenshot. */
function RuleFields({
  draft,
  patch,
}: {
  draft: RuleDraft;
  patch: (p: Partial<RuleDraft>) => void;
}) {
  const world = useWorld();
  const custom = daysKey(draft.days) === 'custom';
  return (
    <>
      <Choices
        legend="For"
        value={draft.who}
        onChange={(who) => patch({ who })}
        options={[
          { value: 'both', label: 'Both of you' },
          { value: world.me.id, label: world.me.name },
          { value: world.partner.id, label: world.partner.name },
        ]}
      />
      <Choices<RuleKind>
        legend="How you answer"
        value={draft.kind}
        onChange={(kind) =>
          patch(kind === 'weekly' ? { kind, days: EVERY_DAY } : { kind })
        }
        options={[
          { value: 'yesno', label: 'Yes or No' },
          { value: 'number', label: 'A number' },
          { value: 'weekly', label: 'Days a week' },
        ]}
      />
      {draft.kind === 'number' && (
        <div className="nx-enter flex flex-col gap-4">
          <Choices<'>=' | '<='>
            legend="Done when the number is"
            value={draft.op}
            onChange={(op) => patch({ op })}
            options={[
              { value: '>=', label: 'At least' },
              { value: '<=', label: 'At most' },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Target"
              value={draft.target}
              onChange={(target) => patch({ target })}
              unit={draft.unit.trim() || undefined}
              decimals
            />
            <TextField
              label="Counted in"
              value={draft.unit}
              onChange={(unit) => patch({ unit })}
              placeholder="min, pages, steps"
              maxLength={16}
            />
          </div>
        </div>
      )}
      {draft.kind === 'weekly' ? (
        <NumberField
          className="nx-enter"
          label="Days a week"
          value={draft.perWeek}
          onChange={(n) => patch({ perWeek: n ?? 1 })}
          step={1}
          min={1}
          max={7}
        />
      ) : (
        <Choices
          legend="Days"
          value={daysKey(draft.days)}
          onChange={(key) => {
            const preset = DAY_PRESETS.find((p) => p.value === key);
            if (preset) patch({ days: preset.days });
          }}
          options={[
            { value: 'every', label: 'Every day' },
            { value: 'sun-thu', label: 'Sun–Thu' },
            { value: 'mon-fri', label: 'Mon–Fri' },
            { value: 'weekends', label: 'Weekends' },
            ...(custom
              ? [{ value: 'custom', label: formatWeekdays(draft.days) }]
              : []),
          ]}
        />
      )}
      <Choices<ProofNeed>
        legend="Screenshot"
        value={draft.proof}
        onChange={(proof) => patch({ proof })}
        options={[
          { value: 'none', label: 'Not needed' },
          { value: 'optional', label: 'Optional' },
          { value: 'required', label: 'Required' },
        ]}
      />
    </>
  );
}
