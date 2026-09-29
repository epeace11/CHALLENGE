'use client';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

const COLOR = {
  accent: 'var(--nx-accent)',
  done: 'var(--nx-done-bar)',
} as const;

/**
 * The kit's progress bar drawn with spans, for use inside a button (a div is not allowed there). It
 * is decorative: the button's own text says the numbers. Same look and the same fill motion.
 */
export function InlineBar({
  value,
  max,
  tone = 'accent',
  segments,
  className,
}: {
  value: number;
  max: number;
  tone?: keyof typeof COLOR;
  segments?: boolean;
  className?: string;
}) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  if (segments)
    return (
      <span
        aria-hidden="true"
        className={cn('nx-bar-segments', className)}
        style={
          {
            '--nx-bar-color': COLOR[tone],
            '--nx-bar-h': '10px',
          } as CSSProperties
        }
      >
        {Array.from({ length: Math.max(0, Math.round(max)) }, (_, i) => (
          <span
            key={i}
            className="nx-bar-segment"
            data-on={i < value || undefined}
            style={{ ['--nx-i' as string]: i } as CSSProperties}
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
      style={
        {
          '--nx-bar-color': COLOR[tone],
          '--nx-bar-value': share,
        } as CSSProperties
      }
    >
      <span className="nx-bar-fill" />
    </span>
  );
}
