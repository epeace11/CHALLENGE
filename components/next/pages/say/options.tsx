'use client';
import { useId } from 'react';
import { Check, Circle, CircleCheck, CircleHelp } from 'lucide-react';
import type { SayRulesDraft } from '@/lib/next/model';
import { cx } from './cx';
import type { Answer } from './draft';
import styles from './say.module.css';

type Question = SayRulesDraft['questions'][number];

/**
 * The question the draft asks back ("Every night, or Sun–Thu like bedtime?") as two big answer
 * buttons. Native radios in a radio group named by the question, so arrow keys work; `id` lets the
 * page move focus here when Use these rules is tapped before it is answered.
 */
export function QuestionChoice({
  id,
  question,
  value,
  onAnswer,
  error,
  kicker,
  size = 'md',
  className,
}: {
  id: string;
  question: Question;
  value: Answer | undefined;
  onAnswer: (option: number) => void;
  error?: string | null;
  /** A short line above the question, naming the rule it is about. */
  kicker?: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const name = useId();
  const open = value === undefined;
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={`${id}-text`}
      aria-describedby={error ? `${id}-error` : undefined}
      className={cx(styles.question, 'min-w-0', className)}
      data-open={open || undefined}
    >
      {kicker && (
        <p className="text-nx-2 font-semibold text-nx-ink-2">{kicker}</p>
      )}
      <p
        id={`${id}-text`}
        className={cx(
          'flex items-start gap-2.5 font-semibold text-nx-ink',
          size === 'lg' ? 'text-nx-lead' : 'text-nx-body',
        )}
      >
        <CircleHelp
          size={22}
          className={cx(
            'mt-0.5 shrink-0',
            open ? 'text-nx-wait' : 'text-nx-accent',
          )}
          aria-hidden="true"
        />
        {question.text}
      </p>
      {/* Side by side when both fit, one above the other when they do not. */}
      <div className="flex flex-wrap gap-2.5">
        {question.options.map((o, i) => (
          <label
            key={o.label}
            className={cx(
              'nx-choice flex-1 whitespace-nowrap',
              size === 'md' && 'min-h-13 text-nx-body',
            )}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === i}
              onChange={() => onAnswer(i)}
            />
            {value === i ? (
              <CircleCheck size={22} strokeWidth={2.2} aria-hidden="true" />
            ) : (
              <Circle
                size={22}
                strokeWidth={1.8}
                className="text-nx-ink-2"
                aria-hidden="true"
              />
            )}
            {o.label}
          </label>
        ))}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-nx-2 font-semibold text-nx-missed"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** A labelled row of radio chips that wrap, for picking one of a few presets (days). */
export function ChipGroup({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  hint?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-labelledby={`${name}-label`}
      className="flex min-w-0 flex-col gap-2"
    >
      <p id={`${name}-label`} className="nx-field-label">
        {label}
      </p>
      <div className={styles.chips}>
        {options.map((o) => (
          <label key={o.id} className={styles.chip}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === o.id}
              onChange={() => onChange(o.id)}
            />
            {value === o.id && (
              <Check size={18} strokeWidth={2.4} aria-hidden="true" />
            )}
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="nx-field-hint">{hint}</p>}
    </div>
  );
}
