'use client';
import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BADGE_ICON } from './data';
import styles from './progress.module.css';

/** A badge as a medal: the accent once earned, a dashed ring until then. Decorative. */
export function Medal({
  id,
  earned,
  size = 48,
  className,
}: {
  id: string;
  earned: boolean;
  size?: number;
  className?: string;
}) {
  const Icon = BADGE_ICON[id] ?? Sparkles;
  return (
    <span
      className={cn(styles.medal, className)}
      data-earned={earned}
      style={{ ['--medal' as string]: `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.9} />
    </span>
  );
}
