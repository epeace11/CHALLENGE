'use client';
import { Pencil, Trash2 } from 'lucide-react';
import type { Rule, SayRulesDraft, World } from '@/lib/next/model';
import { Button, GlassCard } from '@/components/next/ui';
import { cx } from './cx';
import {
  GROUP_ICON,
  factsOf,
  keepTogether,
  questionFor,
  type Answer,
} from './draft';
import { QuestionChoice } from './options';

/**
 * One drafted rule in full: its name and what counts, then who, days, how it is answered and the
 * screenshot, the question it asks back (answered right here), and Edit and Remove.
 */
export function RuleCard({
  world,
  draft,
  rule,
  answer,
  error,
  onAnswer,
  onEdit,
  onRemove,
}: {
  world: World;
  draft: SayRulesDraft;
  rule: Rule;
  answer: Answer | undefined;
  error: string | null;
  onAnswer: (option: number) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const Icon = GROUP_ICON[rule.group];
  const question = questionFor(draft, rule.id);
  const open = !!question && answer === undefined;
  return (
    <GlassCard as="article" className="flex flex-col gap-5">
      <div className="flex items-start gap-3.5">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent-strong"
          aria-hidden="true"
        >
          <Icon size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
          <h3 className="font-nx-serif text-nx-h3 text-nx-ink">
            {keepTogether(rule.title)}
          </h3>
          <p className="text-nx-2 text-nx-ink-2">{rule.description}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-4">
        {factsOf(world, rule, open).map((f) => (
          <div key={f.label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-nx-min text-nx-ink-2">{f.label}</dt>
            <dd
              key={f.value}
              className={cx(
                'nx-fade-in text-nx-2 font-semibold',
                f.pending ? 'text-nx-wait' : 'text-nx-ink',
              )}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {question && answer !== 'custom' && (
        <QuestionChoice
          id={`question-${rule.id}`}
          question={question}
          value={answer}
          onAnswer={onAnswer}
          error={error}
        />
      )}

      <div className="-my-2 -mr-3 flex flex-wrap justify-end gap-1 border-t border-nx-line pt-2">
        <Button
          variant="quiet"
          icon={Pencil}
          aria-label={`Edit ${rule.title}`}
          onClick={onEdit}
        >
          Edit
        </Button>
        <Button
          variant="quiet"
          icon={Trash2}
          aria-label={`Remove ${rule.title}`}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </GlassCard>
  );
}
