'use client';
import { useId, type ReactNode } from 'react';
import type { Weekday } from '@/lib/next/model';
import { CalendarDays } from 'lucide-react';
import { formatDay, formatMoney } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';
import styles from './setup.module.css';

/**
 * Form pieces the kit does not have, for Set up and rules: a date field, a visible label for kit
 * controls whose own label is only for screen readers, the step keys, the weekday keys, radio rows
 * and filter chips. They reuse the kit's field classes, so they line up with TextField and NumberField.
 */

/**
 * A labelled date field that reads like the rest of the app ("Monday, Nov 2"), not the browser's
 * own format ("2026-11-02"). The phone's date picker sits invisibly on top, so a tap opens it; on
 * a laptop a click opens it too, and the box shows a focus ring for the keyboard.
 */
export function DateField({
  label,
  value,
  onChange,
  hint,
  className,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('nx-field', className)}>
      <label htmlFor={id} className="nx-field-label">
        {label}
      </label>
      <div className={styles.date}>
        <span className="nx-input flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{formatDay(value)}</span>
          <CalendarDays
            size={20}
            aria-hidden="true"
            className="shrink-0 text-nx-ink-2"
          />
        </span>
        <input
          id={id}
          type="date"
          value={value}
          aria-describedby={hint ? `${id}-note` : undefined}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker();
            } catch {
              // Older browsers open it on their own, or the keyboard edits it.
            }
          }}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        />
      </div>
      {hint && (
        <p id={`${id}-note`} className="nx-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A visible label and hint around a kit control that names itself for screen readers
 * (SegmentedControl, Toggle), so the label is not read twice.
 */
export function Labeled({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('nx-field', className)}>
      <p className="nx-field-label" aria-hidden="true">
        {label}
      </p>
      {children}
      {error ? (
        <p className="nx-field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="nx-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/** What the first point costs, as five keys: $0.25 · $0.50 · $1 · $2 · $5. */
export function StepPicker({
  steps,
  value,
  onChange,
  label,
  hint,
}: {
  steps: number[];
  value: number;
  onChange: (step: number) => void;
  label: string;
  hint?: ReactNode;
}) {
  const name = useId();
  return (
    <fieldset className="nx-field min-w-0">
      <legend className="nx-field-label mb-2">{label}</legend>
      <div className={styles.keys} data-count={steps.length}>
        {steps.map((step) => (
          <label key={step} className={styles.key}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === step}
              onChange={() => onChange(step)}
            />
            {formatMoney(step)}
          </label>
        ))}
      </div>
      {hint && <p className="nx-field-hint mt-2">{hint}</p>}
    </fieldset>
  );
}

const WEEK: { day: Weekday; short: string; long: string }[] = [
  { day: 1, short: 'Mon', long: 'Monday' },
  { day: 2, short: 'Tue', long: 'Tuesday' },
  { day: 3, short: 'Wed', long: 'Wednesday' },
  { day: 4, short: 'Thu', long: 'Thursday' },
  { day: 5, short: 'Fri', long: 'Friday' },
  { day: 6, short: 'Sat', long: 'Saturday' },
  { day: 0, short: 'Sun', long: 'Sunday' },
];

/** The days a rule is asked, Monday to Sunday, as seven keys that switch on and off. */
export function WeekdayPicker({
  value,
  onChange,
  label,
  hint,
  error,
}: {
  value: Weekday[];
  onChange: (days: Weekday[]) => void;
  label: string;
  hint?: ReactNode;
  error?: ReactNode;
}) {
  const toggle = (day: Weekday) =>
    onChange(
      value.includes(day)
        ? value.filter((d) => d !== day)
        : [...value, day].sort((a, b) => a - b),
    );
  return (
    <fieldset className="nx-field min-w-0">
      <legend className="nx-field-label mb-2">{label}</legend>
      <div className={styles.keys} data-count={7}>
        {WEEK.map(({ day, short, long }) => (
          <label key={day} className={styles.key}>
            <input
              type="checkbox"
              className="sr-only"
              checked={value.includes(day)}
              onChange={() => toggle(day)}
            />
            <span aria-hidden="true">{short}</span>
            <span className="sr-only">{long}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="nx-field-error mt-2" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="nx-field-hint mt-2">{hint}</p>
      ) : null}
    </fieldset>
  );
}

/** A short list of choices, one per row, with a radio dot. */
export function RadioRows<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** For screen readers; the sheet's title says it on screen. */
  label: string;
  options: {
    value: T;
    title: ReactNode;
    detail?: ReactNode;
    aside?: ReactNode;
  }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className={styles.radioRow}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={o.value === value}
            onChange={() => onChange(o.value)}
          />
          <span className={styles.radioDot} aria-hidden="true" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-nx-body font-semibold">{o.title}</span>
            {o.detail && (
              <span className="text-nx-2 text-nx-ink-2">{o.detail}</span>
            )}
          </span>
          {o.aside}
        </label>
      ))}
    </fieldset>
  );
}

/** One choice from a few, as chips that wrap (the library's groups). */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{label}</legend>
      <div className={styles.chips}>
        {options.map((o) => (
          <label key={o.value} className={styles.chip}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={o.value === value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
