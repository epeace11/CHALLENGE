'use client';
import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import {
  ConfirmDialog,
  type ConfirmRequest,
} from '@/components/dialogs/confirm-dialog';
import { Proofs } from '@/components/shared/proofs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { titleFor } from '@/lib/rules';
import { reviewQueue } from '@/lib/selectors';

const Empty = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="glass empty">
    <h2>{title}</h2>
    <p className="muted">{children}</p>
  </section>
);

/** The partner's answers to approve, forgiveness requests to decide, and open disputes. */
export function ReviewPage() {
  const { data, me, partner, busy, loading, refresh, run, ui, dialogs } =
    useChallenge();
  const { plain, requests, disputes, entryOfAsk } = reviewQueue(data, me.id);
  // Denying forgiveness and conceding a miss cannot be taken back, so each asks once.
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  return (
    <>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <div className="page-heading">
        <h1>Review together.</h1>
        <button
          title="Refresh reviews"
          aria-label="Refresh reviews"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <Tabs
        value={ui.reviewTab}
        onValueChange={(v) => ui.setReviewTab(String(v))}
      >
        <TabsList className="filters">
          <TabsTrigger value="entries">Entries ({plain.length})</TabsTrigger>
          <TabsTrigger value="forgiveness">
            Forgiveness ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="disputes">
            Disputes ({disputes.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entries">
          {plain.length > 1 && (
            <div className="review-toolbar">
              <span className="muted">{partner?.name}’s entries</span>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    for (const e of plain) await api.review(e.id, 'approve');
                  })
                }
              >
                Approve all ({plain.length})
              </button>
            </div>
          )}
          {plain.map((e) => (
            <section className="glass review-card" key={e.id}>
              <div>
                <p className="eyebrow">
                  {partner?.name} · {formatDate(e.day)}
                </p>
                <h3>{titleFor(e.rule_id)}</h3>
                {e.proposed_done !== null && (
                  <p className="muted">
                    Late correction: {e.proposed_done ? 'Yes' : 'No'} ·
                    Original: {e.done ? 'Yes' : 'No'}
                  </p>
                )}
                <p>{e.proposed_note ?? e.note}</p>
                <Proofs proof={e.proposed_proof ?? e.proof} />
              </div>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => void run(() => api.review(e.id, 'approve'))}
                >
                  Approve
                </button>
                {e.proposed_done !== null ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(() => api.review(e.id, 'reject_correction'))
                    }
                  >
                    Decline correction
                  </button>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => dialogs.setDisputing(e)}
                  >
                    Dispute
                  </button>
                )}
              </div>
            </section>
          ))}
          {!plain.length && (
            <Empty title="All caught up.">No entries need your approval.</Empty>
          )}
        </TabsContent>
        <TabsContent value="forgiveness">
          {requests.map((r) => {
            const p = data.points.find((p) => p.id === r.point_id),
              e = entryOfAsk(r);
            // Deciding also settles the answer the ask came with.
            const decide = (approve: boolean) =>
              run(async () => {
                if (e) await api.review(e.id, 'approve');
                await api.decide(r.id, approve);
              });
            return (
              <section className="glass review-card" key={r.id}>
                <div>
                  <p className="eyebrow">
                    {partner?.name} · {p?.day ? formatDate(p.day) : ''}
                  </p>
                  <h3>{titleFor(p?.rule_id ?? '')}</h3>
                  <p>“{r.reason}”</p>
                  {e && (
                    <>
                      {(e.proposed_note ?? e.note) && (
                        <p className="muted">{e.proposed_note ?? e.note}</p>
                      )}
                      <Proofs proof={e.proposed_proof ?? e.proof} />
                    </>
                  )}
                </div>
                <div className="actions">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void decide(true)}
                  >
                    Approve forgiveness
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      setConfirm({
                        title: 'Deny forgiveness?',
                        description: `${partner?.name}’s miss on ${titleFor(p?.rule_id ?? '')}${p?.day ? ` for ${formatDate(p.day)}` : ''} stays a point. Once its deadline has passed they can’t ask again, though you can still forgive it later from the penalty history.`,
                        label: 'Deny',
                        action: () => decide(false),
                      })
                    }
                  >
                    Deny
                  </button>
                </div>
              </section>
            );
          })}
          {!requests.length && (
            <Empty title="Nothing to decide.">
              Forgiveness requests will appear here.
            </Empty>
          )}
        </TabsContent>
        <TabsContent value="disputes">
          {disputes.map((d) => {
            const e = data.entries.find((e) => e.id === d.entry_id);
            const mine = d.raised_by === me.id;
            return (
              <section className="glass review-card" key={d.id}>
                <div>
                  <h3>{titleFor(e?.rule_id ?? '')}</h3>
                  <p className="muted">{e?.day}</p>
                  <p>“{d.comment}”</p>
                  <Proofs proof={e?.proof} />
                </div>
                <button
                  disabled={busy}
                  onClick={() =>
                    mine
                      ? void run(() => api.review(d.entry_id, 'withdraw'))
                      : setConfirm({
                          title: 'Concede this miss?',
                          description: `${titleFor(e?.rule_id ?? '')}${e?.day ? ` for ${formatDate(e.day)}` : ''} becomes a miss and adds a penalty point. This can’t be undone, though ${partner?.name ?? 'your partner'} can forgive the point.`,
                          label: 'Concede',
                          action: () =>
                            run(() => api.review(d.entry_id, 'concede')),
                        })
                  }
                >
                  {mine ? 'Withdraw dispute' : 'Concede miss'}
                </button>
              </section>
            );
          })}
          {!disputes.length && (
            <Empty title="No open disputes.">
              Settle any differences together.
            </Empty>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
