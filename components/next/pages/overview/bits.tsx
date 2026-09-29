'use client';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'accent' | 'wait' | 'done' | 'missed';

const TONE: Record<Tone, string> = {
  accent: 'bg-nx-accent-soft text-nx-accent',
  wait: 'bg-nx-wait-soft text-nx-wait',
  done: 'bg-nx-done-soft text-nx-done',
  missed: 'bg-nx-missed-soft text-nx-missed',
};

/** A round tinted icon at the start of a row. */
export function IconBubble({
  icon: Icon,
  tone = 'accent',
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full',
        TONE[tone],
        className,
      )}
    >
      <Icon size={22} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
