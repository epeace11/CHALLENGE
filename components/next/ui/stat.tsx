'use client';
import type { ComponentProps, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CountUp } from './motion';

export type StatTone = 'default' | 'accent' | 'done' | 'missed' | 'wait';

/**
 * A number people act on, and the button that takes them there: "3 left to log" opens Check in,
 * "$45 gift" opens Gifts. There is deliberately no non-interactive stat: a number that leads
 * nowhere does not belong on the screen (Kazzy's rules 8 and 9).
 *
 * `value` as a number counts up; pass `format` (formatMoney…) to word it. A string shows as is.
 */
export function StatButton({
  label,
  value,
  format,
  hint,
  tone = 'default',
  size = 'md',
  glass = true,
  className,
  type = 'button',
  onClick,
  ...rest
}: Omit<ComponentProps<'button'>, 'value' | 'onClick'> & {
  /** What the number is: "Left to log". */
  label: ReactNode;
  value: number | string;
  format?: (n: number) => string;
  /** One short line under the number: "Thursday, until 11:59 pm". */
  hint?: ReactNode;
  tone?: StatTone;
  /** `lg` for the one number that matters most on a screen. */
  size?: 'md' | 'lg';
  /** Glass card (default) or a plain card. */
  glass?: boolean;
  /** Required: where the number leads. */
  onClick: () => void;
}) {
  return (
    <button
      type={type}
      className={cn(
        glass ? 'nx-glass' : 'nx-card',
        'nx-tappable nx-stat relative',
        className,
      )}
      data-tone={tone === 'default' ? undefined : tone}
      data-size={size === 'lg' ? 'lg' : undefined}
      onClick={onClick}
      {...rest}
    >
      <span className="nx-stat-label">{label}</span>
      <span className="nx-stat-value">
        {typeof value === 'number' ? (
          <CountUp value={value} format={format} />
        ) : (
          value
        )}
      </span>
      {hint && <span className="nx-stat-hint">{hint}</span>}
      <ChevronRight className="nx-row-chevron" size={20} aria-hidden="true" />
    </button>
  );
}
