'use client';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';
import { Proofs } from '@/components/shared/proofs';
import { EntryPill } from '@/components/shared/status-pill';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { locked } from '@/lib/progress';
import { activeRules, titleFor } from '@/lib/rules';
import { activePointOf, nameOf, requestFor } from '@/lib/selectors';
import type { Entry } from '@/lib/types';

/** One answer: its status, note, screenshots, disputes and forgiveness history, and what you can do about it. */
export function EntryView({ entry }: { entry: Entry }) {
  const { data, me, now, busy, finalized, run, go, log, dialogs } =
    useChallenge();
  const who = nameOf(data, entry.user_id),
    mine = entry.user_id === me.id,
    isLocked = locked(entry, now),
    point = activePointOf(data, entry.id),
    req = point ? requestFor(data, point.id) : undefined,
    canAsk =
      mine &&
      !finalized &&
      !isLocked &&
      point &&
      (!req || req.status === 'denied'),
    forgivenPoint = data.points.find(
      (p) => p.entry_id === entry.id && p.forgiven,
    ),
    partnerPoint = !mine && !finalized ? (point ?? forgivenPoint) : undefined;
  return (
    <>
      <p className="eyebrow">
        {formatDate(entry.day)} · {who}
      </p>
      <DialogTitle>{titleFor(entry.rule_id)}</DialogTitle>
      <DialogDescription className="sr-only">
        {who}’s answer for {formatDate(entry.day)}
      </DialogDescription>
      <div className="detail-status">
        <EntryPill entry={entry} />
        {entry.note && <p className="detail-note">“{entry.note}”</p>}
      </div>
      <Proofs proof={entry.proof} />
      {data.disputes
        .filter((d) => d.entry_id === entry.id)
        .map((d) => (
          <p key={d.id} className="detail-meta">
            <b>Dispute · {d.status}</b>
            {d.comment}
          </p>
        ))}
      {data.requests
        .filter((r) =>
          data.points.some(
            (p) => p.id === r.point_id && p.entry_id === entry.id,
          ),
        )
        .map((r) => (
          <p key={r.id} className="detail-meta">
            <b>Forgiveness · {r.status}</b>
            {r.reason}
          </p>
        ))}
      {mine && isLocked && (
        <p className="muted locked-note">
          Locked in. The deadline has passed and this answer is settled.
        </p>
      )}
      {mine && !finalized && !isLocked && (
        <div className="dialog-actions">
          <button
            className="primary"
            onClick={() => {
              log.changeDate(entry.day);
              log.startEditing(
                activeRules(me.name, entry.day, data.weeks).findIndex(
                  (r) => r.id === entry.rule_id,
                ),
                'single',
              );
              go('Log');
              dialogs.closeEntry(false);
            }}
          >
            Edit this answer
          </button>
          {canAsk && (
            <button
              onClick={() => {
                dialogs.closeEntry();
                dialogs.setPointRequest(point!);
              }}
            >
              {req ? 'Ask again' : 'Request forgiveness'}
            </button>
          )}
        </div>
      )}
      {partnerPoint && (
        <div className="dialog-actions">
          <button
            className={partnerPoint.forgiven ? '' : 'primary'}
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.partnerForgive(
                  partnerPoint.id,
                  !partnerPoint.forgiven,
                );
                dialogs.closeEntry();
              })
            }
          >
            {partnerPoint.forgiven ? 'Undo forgiveness' : 'Forgive this miss'}
          </button>
        </div>
      )}
    </>
  );
}
