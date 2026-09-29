'use client';
import { useId, useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { IconButton } from '@/components/next/ui';
import { CODE_LENGTH } from './form';

/** The kit's field markup (label, control, one line under it), for the two fields the kit lacks. */
function FieldFrame({
  id,
  label,
  hint,
  error,
  onBlur,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  onBlur?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="nx-field" onBlur={onBlur}>
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

/** A password field with a Show / Hide button inside it (44px). */
export function PasswordField({
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: ReactNode;
  error?: ReactNode;
  autoComplete: 'new-password' | 'current-password';
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error} onBlur={onBlur}>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={shown ? 'text' : 'password'}
          className="nx-input pr-14"
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-note` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <IconButton
          icon={shown ? EyeOff : Eye}
          label={shown ? 'Hide password' : 'Show password'}
          plain
          className="absolute top-1 right-1"
          onClick={() => setShown((s) => !s)}
        />
      </div>
    </FieldFrame>
  );
}

/**
 * The code field's own look: the kit's input, with big spaced digits. The `!` sizes win over the
 * old app's `input { font: inherit; font-size: 16px !important }`; the dark fill is the sunken token.
 */
const CODE_INPUT = [
  'min-h-16 w-full rounded-[14px] border-[1.5px] border-nx-line-strong bg-nx-surface px-4',
  'text-center !text-[28px] !leading-[1.2] !font-semibold tracking-[0.35em] indent-[0.35em] text-nx-ink tabular-nums',
  'transition-[border-color,box-shadow] duration-200 ease-nx outline-none',
  'hover:border-nx-accent-line focus:border-nx-accent focus:shadow-[0_0_0_4px_var(--nx-accent-soft)]',
  'aria-[invalid=true]:border-nx-missed [[data-theme=dark]_&]:bg-nx-sunken',
].join(' ');

/** The six-digit code from the sign-in email, in big spaced digits. Keeps digits only. */
export function CodeField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: ReactNode;
}) {
  const id = useId();
  return (
    <FieldFrame id={id} label={`${CODE_LENGTH}-digit code`} error={error}>
      <input
        id={id}
        name="code"
        className={CODE_INPUT}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_LENGTH}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-note` : undefined}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
        }
      />
    </FieldFrame>
  );
}

/** A thin "or" between the main action and the other way in. */
export function OrDivider() {
  return (
    <div
      className="flex items-center gap-3 text-nx-2 text-nx-ink-2"
      aria-hidden="true"
    >
      <span className="h-px flex-1 bg-nx-line" />
      or
      <span className="h-px flex-1 bg-nx-line" />
    </div>
  );
}
