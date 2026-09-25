'use client';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { useChallenge } from '@/components/app/challenge-context';
import { api } from '@/lib/api';
import { activePointOf, requestFor } from '@/lib/selectors';
import type { Entry } from '@/lib/types';

/** Under a "No": the forgiveness request's status, or a way to ask (again, after a denial). Keyed by the answer, so a changed answer starts closed. */
export function ForgivenessAsk({ entry }: { entry: Entry | undefined }) {
  const { data, busy, run } = useChallenge();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState('');
  const point = activePointOf(data, entry?.id);
  const request = requestFor(data, point?.id);
  if (request && request.status !== 'denied')
    return (
      <p className="muted">
        Forgiveness{' '}
        {request.status === 'pending'
          ? 'awaiting partner approval'
          : request.status}
        .
      </p>
    );
  if (!point) return null;
  return (
    <div className="forgiveness">
      {request?.status === 'denied' && (
        <p className="muted">
          Forgiveness was denied. You can ask again with a new reason.
        </p>
      )}
      <label>
        <Checkbox checked={open} onCheckedChange={(v) => setOpen(Boolean(v))} />
        {request?.status === 'denied' ? 'Ask again' : 'Request forgiveness'}
      </label>
      {open && (
        <>
          <textarea
            placeholder="Why should this be forgiven?"
            aria-label="Forgiveness reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
          />
          <button
            disabled={!reason.trim() || busy}
            onClick={() =>
              void run(() => api.requestForgiveness(point.id, reason))
            }
          >
            Send request
          </button>
        </>
      )}
    </div>
  );
}
