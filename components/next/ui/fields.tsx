'use client';
import { useId, useState, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Target } from '@/lib/next/model';
import { formatNumber, formatTarget } from '@/lib/next/format';
import { meetsTarget } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import { IconButton } from './button';

type FieldBits = {
  /** Always shown above the field; it is the field's name for screen readers too. */
  label: ReactNode;
  /** One line under the field. */
  hint?: ReactNode;
  /** Replaces the hint and marks the field invalid. */
  error?: ReactNode;
  className?: string;
};

function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FieldBits & { id: string; children: ReactNode }) {
  return (
    <div className={cn('nx-field', className)}>
      <label htmlFor={id} className="nx-field-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-note`} className="nx-field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="nx-field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled text field (17px). `multiline` makes it a textarea for notes and reasons. */
export function TextField({
  label,
  hint,
  error,
  className,
  value,
  onChange,
  multiline,
  rows = 3,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  name,
  required,
  disabled,
}: FieldBits & {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  type?: 'text' | 'email' | 'password' | 'url' | 'search' | 'tel';
  placeholder?: string;
  autoComplete?: string;
  inputMode?:
    | 'text'
    | 'email'
    | 'url'
    | 'search'
    | 'tel'
    | 'numeric'
    | 'decimal';
  maxLength?: number;
  name?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const shared = {
    id,
    name,
    value,
    placeholder,
    maxLength,
    required,
    disabled,
    className: 'nx-input',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error || hint ? `${id}-note` : undefined,
  };
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      {multiline ? (
        <textarea
          {...shared}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...shared}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

const parse = (text: string) => {
  const n = Number(text.replace(/,/g, '').trim());
  return text.trim() === '' || Number.isNaN(n) ? null : n;
};

/**
 * A number with its unit and target: big 30px digits, − and + buttons when `step` is set, and a
 * line that says the target and whether the value meets it ("60 min or less · Meets the target").
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  target,
  step,
  min = 0,
  max,
  decimals = false,
  hint,
  error,
  className,
  disabled,
}: FieldBits & {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Shown inside the field after the number ("steps", "min"). Defaults to the target's unit. */
  unit?: string;
  target?: Target;
  /** Adds − and + buttons that move by this much. */
  step?: number;
  min?: number;
  max?: number;
  /** Allow a decimal point (litres). */
  decimals?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  // The text as typed, so "10," or "3." survive while typing; resynced when the value changes elsewhere.
  const [text, setText] = useState(value === null ? '' : formatNumber(value));
  const [shownFor, setShownFor] = useState(value);
  if (value !== shownFor) {
    setShownFor(value);
    if (parse(text) !== value)
      setText(value === null ? '' : formatNumber(value));
  }
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min, n));
  const set = (n: number | null) => {
    const next = n === null ? null : clamp(n);
    setText(next === null ? '' : formatNumber(next));
    setShownFor(next);
    onChange(next);
  };
  const met = target && value !== null ? meetsTarget(target, value) : null;
  const targetLine = target ? (
    <span className="nx-target" data-met={met === null ? undefined : met}>
      Target: {formatTarget(target)}
      {met === null ? '' : met ? ' · Meets the target' : ' · Misses the target'}
    </span>
  ) : null;
  return (
    <Field
      id={id}
      label={label}
      hint={hint ?? targetLine}
      error={error}
      className={className}
    >
      <div className="nx-number">
        {step !== undefined && (
          <IconButton
            icon={Minus}
            label={`${step} less`}
            disabled={disabled || (value ?? 0) <= min}
            onClick={() => set((value ?? 0) - step)}
          />
        )}
        <div className="nx-number-box">
          <input
            id={id}
            className="nx-number-input"
            type="text"
            inputMode={decimals ? 'decimal' : 'numeric'}
            autoComplete="off"
            value={text}
            disabled={disabled}
            placeholder="0"
            aria-invalid={error ? true : undefined}
            aria-describedby={
              error || hint || target ? `${id}-note` : undefined
            }
            onChange={(e) => {
              const raw = e.target.value.replace(
                decimals ? /[^\d.,]/g : /[^\d,]/g,
                '',
              );
              setText(raw);
              const n = parse(raw);
              setShownFor(n);
              onChange(n === null ? null : clamp(n));
            }}
            onBlur={() => set(parse(text))}
          />
          {(unit ?? target?.unit) && (
            <span className="nx-number-unit">{unit ?? target?.unit}</span>
          )}
        </div>
        {step !== undefined && (
          <IconButton
            icon={Plus}
            label={`${step} more`}
            disabled={disabled || (max !== undefined && (value ?? 0) >= max)}
            onClick={() => set((value ?? 0) + step)}
          />
        )}
      </div>
    </Field>
  );
}
