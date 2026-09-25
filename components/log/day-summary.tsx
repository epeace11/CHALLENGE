'use client';
import { ArrowRight } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { EntryPill, NotAnswered } from '@/components/shared/status-pill';
import { formatDate } from '@/lib/dates';
import type { Rule } from '@/lib/rules';
import { findEntry, firstUnanswered } from '@/lib/selectors';

/** Every answer for the day being logged; tap one to change just that answer. */
export function DaySummary({
  active,
  recorded,
}: {
  active: Rule[];
  recorded: number;
}) {
  const { data, me, finalized, log } = useChallenge();
  const { date, startEditing } = log;
  const complete = recorded >= active.length;
  return (
    <section className="glass history-group day-summary">
      <p className="eyebrow">
        {complete
          ? 'ALREADY LOGGED'
          : `${recorded} / ${active.length} RECORDED`}
      </p>
      <h2>
        {complete
          ? `${formatDate(date)} is logged.`
          : `${formatDate(date)} is partly logged.`}
      </h2>
      {active.map((r, i) => {
        const e = findEntry(data, me.id, r.id, date);
        return (
          <button
            key={r.id}
            className="history-row"
            disabled={finalized}
            onClick={() => startEditing(i, 'single')}
          >
            <span>{r.title}</span>
            {e ? <EntryPill entry={e} /> : <NotAnswered />}
          </button>
        );
      })}
      <div className="question-footer">
        {!complete && (
          <button
            className="primary"
            disabled={finalized}
            onClick={() =>
              startEditing(firstUnanswered(data, me.id, active, date))
            }
          >
            Continue logging
            <ArrowRight size={16} />
          </button>
        )}
        <button disabled={finalized} onClick={() => startEditing(0)}>
          Edit answers
        </button>
      </div>
    </section>
  );
}
