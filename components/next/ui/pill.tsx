'use client';
import {
  Check,
  CircleDashed,
  Clock3,
  HeartHandshake,
  Minus,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { PillStatus } from '@/lib/next/selectors';
import { cn } from '@/lib/utils';

const LABEL: Record<PillStatus, string> = {
  done: 'Done',
  missed: 'Missed',
  review: 'Waiting for review',
  forgiven: 'Forgiven',
  disputed: 'Disputed',
  open: 'Open',
  none: 'No answer',
};

const ICON: Record<PillStatus, LucideIcon> = {
  done: Check,
  missed: X,
  review: Clock3,
  forgiven: HeartHandshake,
  disputed: TriangleAlert,
  open: CircleDashed,
  none: Minus,
};

/**
 * Where an answer stands: done, missed, waiting for review, forgiven, disputed or open (plus
 * `none`, a neutral No for weekly rules). entryPill() in lib/next/selectors picks the status and
 * words for an entry; pass its `label` to override the default words.
 */
export function StatusPill({
  status,
  label,
  className,
}: {
  status: PillStatus;
  label?: string;
  className?: string;
}) {
  const Icon = ICON[status];
  return (
    <span className={cn('nx-pill', className)} data-status={status}>
      <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
      {label ?? LABEL[status]}
    </span>
  );
}
