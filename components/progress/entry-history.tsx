'use client';
import { ArrowRight, History } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { EntryPill } from '@/components/shared/status-pill';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/lib/dates';
import { titleFor } from '@/lib/rules';
import { historyOf } from '@/lib/selectors';

/** Every answer, grouped by day. Side by side on wide screens; one person at a time (tabs) on phones. */
export function EntryHistory() {
  const { data, ui, dialogs } = useChallenge();
  return (
    <section className="glass progress-block entries">
      <div className="row">
        <h3>
          <History size={18} />
          Every entry
        </h3>
        <button
          type="button"
          className="text-link"
          onClick={() => ui.setShowEntries(!ui.showEntries)}
        >
          {ui.showEntries ? 'Hide' : 'Show'}
          <ArrowRight size={15} />
        </button>
      </div>
      {ui.showEntries && (
        <>
          <Tabs
            value={ui.historyPerson}
            onValueChange={(v) => ui.setHistoryPerson(String(v))}
          >
            <TabsList className="filters history-tabs">
              {data.profiles.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="history-cols">
            {data.profiles.map((p) => {
              const h = historyOf(data, p.id);
              return (
                <div
                  key={p.id}
                  className={`col${ui.historyPerson === p.id ? ' active' : ''}`}
                >
                  <h2 className="col-name">{p.name}</h2>
                  {Object.entries(Object.groupBy(h, (e) => e.day)).map(
                    ([d, entries]) => (
                      <section className="history-group" key={d}>
                        <p className="eyebrow">{formatDate(d)}</p>
                        {entries?.map((e) => (
                          <button
                            key={e.id}
                            className="history-row"
                            onClick={() => dialogs.openEntry(e)}
                          >
                            <span>{titleFor(e.rule_id)}</span>
                            <EntryPill entry={e} />
                          </button>
                        ))}
                      </section>
                    ),
                  )}
                  {!h.length && (
                    <p className="muted">
                      {p.name}’s logged habits will appear here.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
