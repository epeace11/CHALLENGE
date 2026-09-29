'use client';
import type { CSSProperties, ReactNode } from 'react';
import type { Person } from '@/lib/next/model';
import { cn } from '@/lib/utils';

type Size = 'sm' | 'md' | 'lg';
type Who = Pick<Person, 'name' | 'initial' | 'hue'>;

/** A round avatar with the person's initial in their hue. Sizes 32 / 40 / 56px. */
export function Avatar({
  person,
  size = 'md',
  decorative,
  className,
}: {
  person: Who;
  size?: Size;
  /** Hide it from screen readers when the name is written next to it. */
  decorative?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn('nx-avatar', className)}
      data-size={size}
      style={{ ['--nx-hue' as string]: person.hue } as CSSProperties}
    >
      <span aria-hidden="true">{person.initial}</span>
      {!decorative && <span className="sr-only">{person.name}</span>}
    </span>
  );
}

/** The couple's two avatars, overlapping. */
export function PairAvatars({
  people,
  size = 'md',
  className,
}: {
  people: readonly [Who, Who] | Who[];
  size?: Size;
  className?: string;
}) {
  const [a, b] = people;
  return (
    <span className={cn('nx-pair', className)}>
      <Avatar person={a} size={size} decorative />
      <Avatar person={b} size={size} decorative />
      <span className="sr-only">
        {a.name} and {b.name}
      </span>
    </span>
  );
}

/**
 * An avatar and a name in a pill. With `onClick` it is a 44px button (switch whose calendar shows,
 * open someone's answers).
 */
export function PersonChip({
  person,
  children,
  onClick,
  pressed,
  className,
}: {
  person: Who;
  /** Replaces the name ("You", "Jordan · 9 points"). */
  children?: ReactNode;
  onClick?: () => void;
  /** For chips that toggle, whether this one is selected. */
  pressed?: boolean;
  className?: string;
}) {
  const inside = (
    <>
      <Avatar person={person} size="sm" decorative />
      <span>{children ?? person.name}</span>
    </>
  );
  if (!onClick)
    return <span className={cn('nx-chip', className)}>{inside}</span>;
  return (
    <button
      type="button"
      className={cn(
        'nx-chip nx-press',
        pressed && 'border-nx-accent bg-nx-accent-soft text-nx-accent',
        className,
      )}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {inside}
    </button>
  );
}
