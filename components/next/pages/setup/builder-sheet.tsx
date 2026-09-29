'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type {
  DateString,
  Person,
  ProofNeed,
  Rule,
  Target,
  Weekday,
} from '@/lib/next/model';
import { EVERY_DAY } from '@/lib/next/catalog';
import { formatWeekdays } from '@/lib/next/selectors';
import {
  Button,
  NumberField,
  SegmentedControl,
  Sheet,
  TextField,
} from '@/components/next/ui';
import { CheckinPreview } from './checkin-preview';
import { Labeled, WeekdayPicker } from './fields';
import { newRuleId, whoName } from './draft';

type Form = {
  title: string;
  question: string;
  who: string;
  /** Certain days of the week, or a number of days each week. */
  schedule: 'days' | 'weekly';
  days: Weekday[];
  perWeek: number | null;
  answer: 'yesno' | 'number';
  op: Target['op'];
  value: number | null;
  unit: string;
  proof: ProofNeed;
};

type Errors = Partial<
  Record<'title' | 'question' | 'days' | 'perWeek' | 'value', string>
>;

const BLANK: Form = {
  title: '',
  question: '',
  who: 'both',
  schedule: 'days',
  days: EVERY_DAY,
  perWeek: 3,
  answer: 'yesno',
  op: '>=',
  value: 10,
  unit: 'min',
  proof: 'none',
};

function formFrom(rule: Rule | null): Form {
  if (!rule) return BLANK;
  return {
    title: rule.title,
    question: rule.question,
    who: rule.who,
    schedule: rule.kind === 'weekly' ? 'weekly' : 'days',
    days: rule.kind === 'weekly' ? EVERY_DAY : rule.days,
    perWeek: rule.weeklyTarget ?? 3,
    answer: rule.kind === 'number' ? 'number' : 'yesno',
    op: rule.target?.op ?? '>=',
    value: rule.target?.value ?? 10,
    unit: rule.target?.unit ?? '',
    proof: rule.proof,
  };
}

/** The rule a form describes. `base` keeps what the builder does not edit (description, group, dates). */
function ruleFrom(form: Form, base: Rule | null, id: string): Rule {
  const common = {
    id,
    title: form.title.trim(),
    question: form.question.trim(),
    description: base?.description ?? '',
    group: base?.group ?? 'Mind',
    who: form.who,
    proof: form.proof,
    ...(base?.startsOn ? { startsOn: base.startsOn } : {}),
    ...(base?.endsOn ? { endsOn: base.endsOn } : {}),
  } satisfies Partial<Rule>;
  if (form.schedule === 'weekly')
    return {
      ...common,
      kind: 'weekly',
      days: base?.kind === 'weekly' ? base.days : EVERY_DAY,
      weeklyTarget: form.perWeek ?? 1,
    };
  if (form.answer === 'number')
    return {
      ...common,
      kind: 'number',
      days: form.days,
      target: { op: form.op, value: form.value ?? 0, unit: form.unit.trim() },
      ...(base?.personalTarget ? { personalTarget: true } : {}),
    };
  return { ...common, kind: 'yesno', days: form.days };
}

function check(form: Form): Errors {
  const e: Errors = {};
  if (!form.title.trim()) e.title = 'Name the habit.';
  if (!form.question.trim()) e.question = 'Write the question you both answer.';
  if (form.schedule === 'days' && form.days.length === 0)
    e.days = 'Pick at least one day.';
  if (form.schedule === 'weekly' && !form.perWeek)
    e.perWeek = 'Enter how many days a week.';
  if (
    form.schedule === 'days' &&
    form.answer === 'number' &&
    form.value === null
  )
    e.value = 'Enter the target.';
  return e;
}

/**
 * Build your own rule, or edit one: the habit, the question, who it is for, which days (or how
 * many days a week), Yes or No or a number with a target, and screenshots, with the check-in card
 * it makes shown live beside the fields (under them on phones).
 */
export function RuleBuilderSheet({
  open,
  onOpenChange,
  rule,
  rules,
  me,
  partner,
  day,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The rule to edit, or null to build a new one. */
  rule: Rule | null;
  /** Every rule in the draft, for a fresh id. */
  rules: Rule[];
  me: Person;
  partner: Person;
  /** The day the preview's sample screenshots are dated. */
  day: DateString;
  onSave: (rule: Rule, isNew: boolean) => void;
  onRemove?: (rule: Rule) => void;
}) {
  const [form, setForm] = useState<Form>(() => formFrom(rule));
  const [errors, setErrors] = useState<Errors>({});
  const [shown, setShown] = useState({ open, rule, times: 0 });
  // Start again from the rule (or a blank form) each time the sheet opens; the preview starts unanswered.
  if (open !== shown.open || (open && rule !== shown.rule)) {
    setShown({ open, rule, times: shown.times + (open ? 1 : 0) });
    if (open) {
      setForm(formFrom(rule));
      setErrors({});
    }
  }

  const set = (next: Partial<Form>) => {
    setForm({ ...form, ...next });
    const cleared = { ...errors };
    for (const key of Object.keys(next)) delete cleared[key as keyof Errors];
    if (next.schedule || next.answer) {
      delete cleared.days;
      delete cleared.perWeek;
      delete cleared.value;
    }
    setErrors(cleared);
  };

  const save = () => {
    const found = check(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSave(ruleFrom(form, rule, rule?.id ?? newRuleId(rules)), !rule);
  };

  const preview = ruleFrom(form, rule, rule?.id ?? 'preview');

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={rule ? 'Edit rule' : 'Build your own rule'}
      className="lg:w-[min(960px,calc(100vw_-_64px))]"
      footer={
        <>
          {rule && onRemove ? (
            <Button
              variant="quiet"
              icon={Trash2}
              className="sm:mr-auto"
              onClick={() => onRemove(rule)}
            >
              Remove rule
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          <Button variant="primary" onClick={save}>
            {rule ? 'Save rule' : 'Add rule'}
          </Button>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <TextField
            label="Habit"
            value={form.title}
            onChange={(title) => set({ title })}
            placeholder="Stretch 10 minutes"
            maxLength={60}
            error={errors.title}
          />
          <TextField
            label="The question"
            value={form.question}
            onChange={(question) => set({ question })}
            placeholder="Did you stretch for 10 minutes?"
            maxLength={100}
            hint="Asked at every check-in."
            error={errors.question}
          />
          <Labeled label="Who it’s for">
            <SegmentedControl
              label="Who it’s for"
              value={form.who}
              onChange={(who) => set({ who })}
              options={[
                { value: 'both', label: 'Both of you' },
                { value: me.id, label: me.name },
                { value: partner.id, label: partner.name },
              ]}
            />
          </Labeled>
          <Labeled label="How often">
            <SegmentedControl
              label="How often"
              value={form.schedule}
              onChange={(schedule) => set({ schedule })}
              options={[
                { value: 'days', label: 'Certain days' },
                { value: 'weekly', label: 'Days a week' },
              ]}
            />
          </Labeled>
          {form.schedule === 'days' ? (
            <WeekdayPicker
              label="Days"
              value={form.days}
              onChange={(days) => set({ days })}
              hint={formatWeekdays(form.days)}
              error={errors.days}
            />
          ) : (
            <NumberField
              label="Days each week"
              value={form.perWeek}
              onChange={(perWeek) => set({ perWeek })}
              unit="days"
              step={1}
              min={1}
              max={7}
              hint="Asked every day as Yes or No; only the week’s total counts."
              error={errors.perWeek}
            />
          )}
          {form.schedule === 'days' && (
            <Labeled label="Answer">
              <SegmentedControl
                label="Answer"
                value={form.answer}
                onChange={(answer) => set({ answer })}
                options={[
                  { value: 'yesno', label: 'Yes or no' },
                  { value: 'number', label: 'A number' },
                ]}
              />
            </Labeled>
          )}
          {form.schedule === 'days' && form.answer === 'number' && (
            <div className="flex flex-col gap-4">
              <Labeled label="Target">
                <SegmentedControl
                  label="Target"
                  value={form.op}
                  onChange={(op) => set({ op })}
                  options={[
                    { value: '>=', label: 'At least' },
                    { value: '<=', label: 'At most' },
                  ]}
                />
              </Labeled>
              <div className="grid grid-cols-[minmax(0,1fr)_128px] items-start gap-3">
                <NumberField
                  label="Amount"
                  value={form.value}
                  onChange={(value) => set({ value })}
                  unit={form.unit.trim() || undefined}
                  decimals
                  max={1000000}
                  error={errors.value}
                />
                <TextField
                  label="Unit"
                  value={form.unit}
                  onChange={(unit) => set({ unit })}
                  placeholder="min"
                  maxLength={12}
                />
              </div>
            </div>
          )}
          <Labeled label="Screenshot">
            <SegmentedControl
              label="Screenshot"
              value={form.proof}
              onChange={(proof) => set({ proof })}
              options={[
                { value: 'none', label: 'Not needed' },
                { value: 'optional', label: 'Optional' },
                { value: 'required', label: 'Required' },
              ]}
            />
          </Labeled>
        </div>
        <div className="min-w-0 lg:sticky lg:top-0">
          <CheckinPreview
            key={shown.times}
            rule={preview}
            who={whoName(form.who, me, partner)}
            day={day}
          />
        </div>
      </div>
    </Sheet>
  );
}
