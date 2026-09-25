'use client';
import { ArrowRight, NotebookPen } from 'lucide-react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';
import { DayJournal } from '@/components/shared/journal';
import { EntryPill, NotAnswered } from '@/components/shared/status-pill';
import { formatDate } from '@/lib/dates';
import { activeRules } from '@/lib/rules';
import { entriesOn, nameOf } from '@/lib/selectors';

/** One person's day: each habit's answer and their journal. On your own day, a shortcut to log or edit it. */
export function DayView({ d, uid }: { d: string; uid: string }) {
  const { data, me, finalized, go, log, dialogs } = useChallenge();
  const name = nameOf(data, uid),
    myRules = activeRules(me.name, d, data.weeks),
    myRecorded = entriesOn(data, me.id, d).length;
  return (
    <>
      <p className="eyebrow">{name}</p>
      <DialogTitle>{formatDate(d)}</DialogTitle>
      <DialogDescription className="sr-only">
        What {name} logged for {formatDate(d)}
      </DialogDescription>
      {data.profiles
        .filter((p) => p.id === uid)
        .map((p) => {
          const rs = activeRules(p.name, d, data.weeks),
            es = entriesOn(data, p.id, d),
            done = es.filter((e) => e.done && e.status !== 'conceded').length;
          return (
            <section key={p.id} className="day-person">
              <div className="row">
                <h3>{p.name}</h3>
                <span className="muted">
                  {es.length
                    ? `${done} of ${rs.length} done`
                    : 'Nothing logged'}
                </span>
              </div>
              {rs.map((r) => {
                const e = es.find((e) => e.rule_id === r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="history-row"
                    disabled={!e}
                    onClick={() => {
                      if (e) dialogs.openEntry(e);
                    }}
                  >
                    <span>{r.title}</span>
                    {e ? <EntryPill entry={e} /> : <NotAnswered />}
                  </button>
                );
              })}
              <p className="eyebrow journal-label">
                <NotebookPen size={13} />
                Journal
              </p>
              <DayJournal uid={p.id} day={d} />
            </section>
          );
        })}
      {!finalized && uid === me.id && (
        <div className="dialog-actions">
          <button
            className="primary"
            onClick={() => {
              dialogs.closeTopView();
              log.changeDate(d);
              go('Log');
            }}
          >
            {myRecorded < myRules.length ? 'Log this day' : 'Edit my answers'}
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
