'use client';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

const COLOR = {
  accent: 'var(--nx-accent)',
  done: 'var(--nx-done-bar)',
  missed: 'var(--nx-missed-bar)',
  wait: 'var(--nx-wait-bar)',
} as const;

/**
 * The kit's progress bar (same look, same fill animation) drawn with spans, for inside a button.
 * It is hidden from screen readers: the button's own words say the numbers.
 */
export function Bar({
  value,
  max,
  tone = 'accent',
  segments,
  size = 'md',
  className,
}: {
  value: number;
  max: number;
  tone?: keyof typeof COLOR;
  segments?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const style = {
    '--nx-bar-color': COLOR[tone],
    '--nx-bar-value': share,
    '--nx-bar-h': size === 'sm' ? '6px' : size === 'lg' ? '14px' : '10px',
  } as CSSProperties;
  if (segments)
    return (
      <span
        aria-hidden="true"
        className={cn('nx-bar-segments', className)}
        style={style}
      >
        {Array.from({ length: Math.max(0, Math.round(max)) }, (_, i) => (
          <span
            key={i}
            className="nx-bar-segment"
            data-on={i < value || undefined}
            style={{ ['--nx-i' as string]: i }}
          >
            <i />
          </span>
        ))}
      </span>
    );
  return (
    <span
      aria-hidden="true"
      className={cn('nx-bar block', className)}
      data-size={size}
      style={style}
    >
      <span className="nx-bar-fill block" />
    </span>
  );
}
