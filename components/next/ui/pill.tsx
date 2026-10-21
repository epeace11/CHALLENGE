'use client';
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
  // Words and colour only: no check marks or other icons inside the pill.
  return (
    <span className={cn('nx-pill', className)} data-status={status}>
      {label ?? LABEL[status]}
    </span>
  );
}
