'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { EntryPill } from '@/components/shared/status-pill';
import { formatShortDate } from '@/lib/dates';
import { titleFor } from '@/lib/rules';
import { nameOf, recentEntries } from '@/lib/selectors';

/** The latest answers from both people. */
export function RecentEntries() {
  const { data, go, ui, dialogs } = useChallenge();
  const recent = recentEntries(data);
  return (
    <section className="glass history-group">
      <div className="row">
        <h3>Recent entries</h3>
        <button
          className="text-link"
          onClick={() => {
            ui.setShowEntries(true);
            go('Progress');
          }}
        >
          View all
        </button>
      </div>
      {recent.map((e) => (
        <button
          className="history-row"
          key={e.id}
          onClick={() => dialogs.openEntry(e)}
        >
          <span>
            {titleFor(e.rule_id)}
            <small className="who">
              {nameOf(data, e.user_id)} · {formatShortDate(e.day)}
            </small>
          </span>
          <EntryPill entry={e} />
        </button>
      ))}
      {!recent.length && (
        <p className="muted">Your first answers will appear here.</p>
      )}
    </section>
  );
}
