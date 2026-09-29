'use client';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * Two big answer buttons, Yes and No, 64px tall. The chosen one fills with the accent. They are
 * native radio buttons, so arrow keys work, and `label` names the question for screen readers.
 */
export function YesNo({
  value,
  onChange,
  label,
  yes = 'Yes',
  no = 'No',
  disabled,
  className,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  /** The question, for screen readers. */
  label: string;
  yes?: string;
  no?: string;
  disabled?: boolean;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn('nx-yesno min-w-0', className)} disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      {[true, false].map((option) => {
        const Icon = option ? Check : X;
        return (
          <label key={String(option)} className="nx-choice">
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {value === option && (
              <Icon size={22} strokeWidth={2.4} aria-hidden="true" />
            )}
            {option ? yes : no}
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * A row of 2–4 choices where one is always selected (Week / Month, Maya / Jordan). The selection
 * slides between options. Native radio buttons, so arrow keys work.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const name = useId();
  const still = useReducedMotion();
  // The thumb slides only once the control has settled on screen: a value set while the page opens
  // (a setting read from this phone) jumps, and under reduced motion it always jumps. A layout
  // animation started in the first frames can otherwise stick halfway, on the wrong option.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const slide = settled && !still;
  return (
    <fieldset className={cn('nx-seg min-w-0', className)}>
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="nx-seg-option">
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={o.value === value}
            onChange={() => onChange(o.value)}
          />
          {o.value === value &&
            (slide ? (
              <motion.span
                layoutId={`seg-${name}`}
                className="nx-seg-thumb"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : (
              <span className="nx-seg-thumb" />
            ))}
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * An on/off setting as a full-width row: the label and an optional one-line description on the
 * left, the switch on the right. The whole row is the switch (56px tall).
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      disabled={disabled}
      className={cn('nx-toggle-row nx-press', className)}
      onClick={() => onChange(!checked)}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={`${id}-label`} className="text-nx-body text-nx-ink">
          {label}
        </span>
        {description && (
          <span id={`${id}-description`} className="text-nx-2 text-nx-ink-2">
            {description}
          </span>
        )}
      </span>
      <span className="nx-switch" aria-hidden="true" />
    </button>
  );
}
