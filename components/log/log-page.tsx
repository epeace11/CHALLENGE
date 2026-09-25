'use client';
import { ChevronLeft, NotebookPen } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { DayJournal } from '@/components/shared/journal';
import { formatDate, formatShortDate, shift, untilLock } from '@/lib/dates';
import { activeRules } from '@/lib/rules';
import { entriesOn } from '@/lib/selectors';
import { DateControl } from './date-control';
import { DaySummary } from './day-summary';
import { QuestionCard } from './question-card';

/** Record one day: its summary once anything is answered, otherwise (or while editing) one question at a time. */
export function LogPage() {
  const { data, me, partner, now, log } = useChallenge();
  const { date, step, editing, setEditing } = log;
  const active = activeRules(me.name, date, data.weeks),
    recorded = entriesOn(data, me.id, date).length;
  return (
    <>
      <div className="page-heading">
        <h1>
          Record your day.
          <br />
          <span>Be honest.</span>
        </h1>
        <DateControl />
      </div>
      <div className="log-wrap">
        {recorded > 0 && !editing ? (
          <DaySummary active={active} recorded={recorded} />
        ) : (
          <>
            {recorded > 0 && (
              <button className="text-link" onClick={() => setEditing(false)}>
                <ChevronLeft size={15} /> Day summary
              </button>
            )}
            {editing !== 'single' && (
              <div className="step">
                <span>
                  {String(step + 1).padStart(2, '0')} / {active.length}
                </span>
                <div className="track">
                  <i
                    style={{ width: `${((step + 1) / active.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <QuestionCard active={active} />
          </>
        )}
        <section className="glass journal">
          <div className="row">
            <h3>
              <NotebookPen size={18} />
              Journal
            </h3>
            <span className="muted small">{formatShortDate(date)}</span>
          </div>
          <DayJournal uid={me.id} day={date} />
        </section>
        <DeadlineNote date={date} now={now} partnerName={partner?.name} />
      </div>
    </>
  );
}

function DeadlineNote({
  date,
  now,
  partnerName,
}: {
  date: string;
  now: number;
  partnerName?: string;
}) {
  const remaining = untilLock(date, now);
  return remaining ? (
    <p className="deadline">
      Locks in <b>{remaining}</b> · {formatDate(shift(date, 1))} at 11:59 pm,
      Toronto time
    </p>
  ) : (
    <p className="deadline late">
      Past the 11:59 pm deadline · changes are late corrections that need{' '}
      {partnerName ?? 'your partner'}’s approval
    </p>
  );
}
