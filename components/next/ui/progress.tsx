'use client';
import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export type BarTone = 'accent' | 'done' | 'missed' | 'wait' | 'excused';

const COLOR: Record<BarTone, string> = {
  accent: 'var(--nx-accent)',
  done: 'var(--nx-done-bar)',
  missed: 'var(--nx-missed-bar)',
  wait: 'var(--nx-wait-bar)',
  excused: 'var(--nx-excused-bar)',
};

/**
 * A bar that fills smoothly when it appears and when `value` changes. With `segments`, it shows
 * `max` separate steps (gym: 2 of 4), filled one after another. `label` is what screen readers say
 * ("Gym this week: 2 of 4").
 */
export function ProgressBar({
  value,
  max = 1,
  tone = 'accent',
  size = 'md',
  segments,
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: BarTone;
  size?: 'sm' | 'md' | 'lg';
  segments?: boolean;
  label: string;
  className?: string;
}) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const style = {
    '--nx-bar-color': COLOR[tone],
    '--nx-bar-value': share,
  } as CSSProperties;
  const aria = {
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': max,
    'aria-valuenow': Math.min(value, max),
  } as const;
  if (segments)
    return (
      <div
        {...aria}
        className={cn('nx-bar-segments', className)}
        data-size={size}
        style={{
          ...style,
          ['--nx-bar-h' as string]:
            size === 'sm' ? '6px' : size === 'lg' ? '14px' : '10px',
        }}
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
      </div>
    );
  return (
    <div
      {...aria}
      className={cn('nx-bar', className)}
      data-size={size}
      style={style}
    >
      <span className="nx-bar-fill" />
    </div>
  );
}

/**
 * One bar split into coloured parts (done, forgiven, missed, waiting…), each part filling its share.
 * `label` says it all for screen readers ("Maya: 96 done, 6 missed, 2 waiting").
 */
export function StackedBar({
  parts,
  label,
  size = 'md',
  className,
}: {
  parts: { tone: BarTone | 'ahead'; value: number }[];
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className={cn('nx-bar flex', className)} data-size={size}>
      <span className="sr-only">{label}</span>
      {parts.map((p, i) =>
        p.value > 0 ? (
          <span
            key={i}
            className="nx-fade-in h-full"
            style={{
              width: `${(p.value / total) * 100}%`,
              background:
                p.tone === 'ahead' ? 'transparent' : COLOR[p.tone as BarTone],
              ['--nx-i' as string]: i,
            }}
          />
        ) : null,
      )}
    </div>
  );
}
