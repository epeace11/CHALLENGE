'use client';
import { useState } from 'react';
import { Check, ChevronLeft, NotebookPen } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { DayJournal } from '@/components/shared/journal';
import { formatDate, formatShortDate, shift, untilLock } from '@/lib/dates';
import { locked } from '@/lib/progress';
import { activeRules, type Rule } from '@/lib/rules';
import { entriesOn, findEntry } from '@/lib/selectors';
import { DateControl } from './date-control';
import { DaySummary } from './day-summary';
import { QuestionCard } from './question-card';

/** Record one day: its summary once anything is answered, otherwise (or while editing) one check-in at a time. */
export function LogPage() {
  const { data, me, partner, now, log } = useChallenge();
  const { date, step, editing, setEditing } = log;
  const active = activeRules(me.name, date, data.weeks),
    recorded = entriesOn(data, me.id, date).length,
    settled = active.every((r) =>
      locked(findEntry(data, me.id, r.id, date), now),
    );
  // The last check-in saved, confirmed briefly above the next one; the count restarts the fade.
  const [saved, setSaved] = useState<{ rule: Rule; n: number } | null>(null);
  const onSaved = (rule: Rule) => {
    setSaved((s) => ({ rule, n: (s?.n ?? 0) + 1 }));
    // Bring the next check-in's top into view when Save was tapped far down a long one.
    requestAnimationFrame(() => {
      const top = document.querySelector('.log-wrap');
      if (top && top.getBoundingClientRect().top < 0)
        top.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };
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
        {saved && (
          <output className="saved-flash" key={saved.n}>
            <Check size={14} strokeWidth={2.6} /> Saved · {saved.rule.title}
          </output>
        )}
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
            <QuestionCard
              key={`${date}|${step}`}
              active={active}
              onSaved={onSaved}
            />
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
        <DeadlineNote
          date={date}
          now={now}
          settled={settled}
          partnerName={partner?.name}
        />
      </div>
    </>
  );
}

/** How long until the day locks; afterwards, whether it is settled or still open to late corrections. */
function DeadlineNote({
  date,
  now,
  settled,
  partnerName,
}: {
  date: string;
  now: number;
  settled: boolean;
  partnerName?: string;
}) {
  const remaining = untilLock(date, now);
  if (remaining)
    return (
      <p className="deadline">
        Locks in <b>{remaining}</b> · {formatDate(shift(date, 1))} at 11:59 pm,
        Toronto time
      </p>
    );
  return settled ? (
    <p className="deadline late">
      Past the 11:59 pm deadline · these answers are locked in
    </p>
  ) : (
    <p className="deadline late">
      Past the 11:59 pm deadline · changes are late corrections that need{' '}
      {partnerName ?? 'your partner'}’s approval
    </p>
  );
}
