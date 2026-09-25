'use client';
import { Check, X } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { forgivenessOf } from '@/lib/selectors';
import type { Entry } from '@/lib/types';

type PillTone = 'pending' | 'excused' | 'disputed' | 'done' | 'missed';

/** How an answer reads in lists. `forgiveness` is the status of the request on the entry's active point, if any: a pending ask shows as under review, not as a plain miss. */
export function entryStatus(
  entry: Entry,
  forgiveness?: string,
): { label: string; tone: PillTone } {
  if (entry.proposed_done !== null)
    return { label: 'Correction pending', tone: 'pending' };
  if (entry.status === 'excused') return { label: 'Excused', tone: 'excused' };
  if (entry.status === 'disputed')
    return { label: 'Disputed', tone: 'disputed' };
  if (entry.status === 'pending')
    return { label: 'Awaiting review', tone: 'pending' };
  if (forgiveness === 'pending')
    return { label: 'Forgiveness requested', tone: 'pending' };
  if (entry.status === 'unlogged')
    return { label: 'Not logged', tone: entry.done ? 'done' : 'missed' };
  return entry.done
    ? { label: 'Done', tone: 'done' }
    : { label: 'Missed', tone: 'missed' };
}

/** Status pill for one answer. */
export function EntryPill({ entry }: { entry: Entry }) {
  const { data } = useChallenge();
  const { label, tone } = entryStatus(entry, forgivenessOf(data, entry));
  return (
    <span className={`pill pill-${tone}`} title={label}>
      {tone === 'done' ? (
        <Check size={13} strokeWidth={2.4} />
      ) : tone === 'missed' ? (
        <X size={13} strokeWidth={2.4} />
      ) : null}
      {label}
    </span>
  );
}

/** Pill for a habit with no answer yet. */
export const NotAnswered = () => (
  <span className="pill pill-none">Not answered</span>
);
