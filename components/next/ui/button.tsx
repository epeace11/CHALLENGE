'use client';
import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export type ButtonProps = ComponentProps<'button'> & {
  /**
   * - `primary`: the one main action on a screen (filled accent). Use it once per screen.
   * - `secondary` (default): outlined, for other actions.
   * - `quiet`: accent text, for small or third-level actions.
   * - `danger`: filled red, for destructive confirmations.
   */
  variant?: ButtonVariant;
  /** `lg` is 56px tall with larger text, for the main action on a focused screen. */
  size?: 'md' | 'lg';
  /** Full width. */
  full?: boolean;
  /** Shows a spinner and ignores taps (the label stays, so the button keeps its size). */
  loading?: boolean;
  /** A lucide icon before the label. */
  icon?: LucideIcon;
  /** A lucide icon after the label (ArrowRight for moving on). */
  iconEnd?: LucideIcon;
};

/**
 * A button that says exactly what it does ("Save", "Approve", "Invite Jordan"). At least 48px
 * tall (44px for `quiet`), with press feedback. Defaults to type="button".
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  full,
  loading,
  icon: Icon,
  iconEnd: IconEnd,
  className,
  children,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('nx-btn', className)}
      data-variant={variant}
      data-size={size === 'lg' ? 'lg' : undefined}
      data-full={full || undefined}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading ? (
        <span className="nx-spinner" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      ) : null}
      <span className="nx-btn-label">{children}</span>
      {IconEnd && !loading ? (
        <IconEnd size={20} strokeWidth={2} aria-hidden="true" />
      ) : null}
    </button>
  );
}

/** A round 44px button with only an icon. `label` is required: it is what screen readers say. */
export function IconButton({
  icon: Icon,
  label,
  plain,
  iconSize = 20,
  className,
  type = 'button',
  ...rest
}: Omit<ComponentProps<'button'>, 'children'> & {
  icon: LucideIcon;
  label: string;
  /** No circle behind the icon (inside toolbars). */
  plain?: boolean;
  iconSize?: number;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn('nx-icon-btn', className)}
      data-plain={plain || undefined}
      {...rest}
    >
      <Icon size={iconSize} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
