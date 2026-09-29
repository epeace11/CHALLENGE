'use client';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

/** An icon in a soft accent circle, for the start of a row or card. */
export function IconBubble({
  icon: Icon,
  size = 44,
}: {
  icon: LucideIcon;
  size?: 40 | 44;
}) {
  return (
    <span
      className={
        size === 44
          ? 'grid size-11 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent'
          : 'grid size-10 shrink-0 place-items-center rounded-full bg-nx-accent-soft text-nx-accent'
      }
    >
      <Icon size={size === 44 ? 22 : 20} aria-hidden="true" />
    </span>
  );
}

/**
 * One person's visits against a weekly target: name, the steps filling, "2 of 4". It sits inside
 * buttons, so the steps are spans with the kit's bar classes, and decorative: the text says the count.
 */
export function WeekBar({
  name,
  have,
  need,
}: {
  name: string;
  have: number;
  need: number;
}) {
  const color = have >= need ? 'var(--nx-done-bar)' : 'var(--nx-accent)';
  return (
    <span className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3">
      <span className="truncate text-nx-2 text-nx-ink-2">{name}</span>
      <span
        aria-hidden="true"
        className="nx-bar-segments"
        style={
          {
            '--nx-bar-color': color,
            '--nx-bar-h': '10px',
          } as CSSProperties
        }
      >
        {Array.from({ length: Math.max(0, need) }, (_, i) => (
          <span
            key={i}
            className="nx-bar-segment"
            data-on={i < have || undefined}
            style={{ ['--nx-i' as string]: i } as CSSProperties}
          >
            <i />
          </span>
        ))}
      </span>
      <span className="text-nx-2 font-semibold text-nx-ink">
        {have} of {need}
      </span>
    </span>
  );
}
