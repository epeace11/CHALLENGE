'use client';
import { ArrowRight } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { api } from '@/lib/api';
import { END, closed } from '@/lib/dates';
import { locked } from '@/lib/progress';
import { titleFor } from '@/lib/rules';
import {
  ledgerPoints,
  nameOf,
  pointDollars,
  requestFor,
} from '@/lib/selectors';
import type { Point } from '@/lib/types';

/** What a ledger row offers: ask forgiveness for your own point, or forgive/undo the partner's. */
function PointAction({ p }: { p: Point }) {
  const { data, me, now, busy, finalized, run, dialogs } = useChallenge();
  const req = requestFor(data, p.id);
  if (finalized) return null;
  if (p.user_id === me.id)
    return !p.forgiven &&
      !locked(
        data.entries.find((e) => e.id === p.entry_id),
        now,
      ) &&
      (!req || req.status === 'denied') ? (
      <button onClick={() => dialogs.setPointRequest(p)}>
        {req ? 'Ask again' : 'Request forgiveness'}
      </button>
    ) : req && req.status === 'pending' ? (
      <span className="muted small">Asked · waiting</span>
    ) : null;
  return (
    <button
      className={p.forgiven ? '' : 'primary'}
      disabled={busy}
      onClick={() => void run(() => api.partnerForgive(p.id, !p.forgiven))}
    >
      {p.forgiven ? 'Undo forgiveness' : 'Forgive'}
    </button>
  );
}

/** Penalty history (toggled) and the finalize card. */
export function MoneyBlock() {
  const { data, me, now, busy, finalized, run, ui } = useChallenge();
  const confirmed = data.finalizations.some((f) => f.user_id === me.id);
  return (
    <div className="money-block">
      <button
        className="text-link"
        onClick={() => ui.setLedgerOpen(!ui.ledgerOpen)}
      >
        {ui.ledgerOpen ? 'Hide' : 'View'} penalty history
        <ArrowRight size={16} />
      </button>
      {ui.ledgerOpen && (
        <section className="glass ledger">
          {ledgerPoints(data).map((p) => (
            <div className="ledger-row" key={p.id}>
              <div>
                <b>{nameOf(data, p.user_id)}</b> · {titleFor(p.rule_id)}
                <p className="muted">
                  {p.day} ·{' '}
                  {p.forgiven ? 'Forgiven' : p.reason.replaceAll('_', ' ')}
                </p>
              </div>
              <span>{p.forgiven ? '$0' : `$${pointDollars(data, p)}`}</span>
              <PointAction p={p} />
            </div>
          ))}
          {!data.points.some((p) => !p.voided) && (
            <p className="muted">No penalties so far.</p>
          )}
        </section>
      )}
      <section className="finalize">
        <div>
          <h3>{finalized ? 'Challenge finalized.' : 'Finalize together'}</h3>
          <p className="muted">
            {finalized
              ? 'The gift totals are final.'
              : confirmed
                ? 'You’ve confirmed. Waiting for your partner.'
                : 'Both people confirm once all reviews are resolved.'}
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || finalized || !closed(END, now) || confirmed}
          onClick={() => void run(() => api.finalize())}
        >
          {finalized ? 'Finalized' : 'Finalize challenge'}
        </button>
      </section>
    </div>
  );
}
