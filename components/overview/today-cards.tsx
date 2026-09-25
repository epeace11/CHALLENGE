'use client';
import { ArrowRight } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { formatDate, untilLock } from '@/lib/dates';
import { activeRules } from '@/lib/rules';
import { entriesOn, firstUnanswered, weekCount } from '@/lib/selectors';
import { targetFor, weekOf } from '@/lib/weeks';

/** The day being logged (with a shortcut into Log) and this week's weekly targets. */
export function TodayCards() {
  const { data, me, partner, now, go, log } = useChallenge();
  const { date, startEditing, setEditing } = log;
  const active = activeRules(me.name, date, data.weeks),
    recorded = entriesOn(data, me.id, date).length,
    remaining = untilLock(date, now),
    w = weekOf(data.weeks, date);
  return (
    <div className="overview-grid">
      <section className="glass compact">
        <div>
          <h3>Your daily log</h3>
          <p className="muted">
            {formatDate(date)} · you {recorded} / {active.length}
            {partner
              ? ` · ${partner.name} ${entriesOn(data, partner.id, date).length} / ${activeRules(partner.name, date, data.weeks).length}`
              : ''}
          </p>
          <p className="muted small">
            {remaining ? `Locks in ${remaining}` : 'Past the 11:59 pm deadline'}
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            if (recorded === 0) startEditing(0);
            else if (recorded < active.length)
              startEditing(firstUnanswered(data, me.id, active, date));
            else setEditing(false);
            go('Log');
          }}
        >
          {recorded === 0
            ? 'Start'
            : recorded < active.length
              ? 'Continue'
              : 'View log'}
          <ArrowRight size={16} />
        </button>
      </section>
      <section className="glass compact">
        <h3>This week</h3>
        {w ? (
          <>
            <p className="muted">
              {w.start.slice(5)} – {w.end.slice(5)} · gym {targetFor(w, 'gym')}{' '}
              visits each
            </p>
            <div className="gym-counts">
              {data.profiles.map((p) => (
                <span key={p.id}>
                  {p.name}{' '}
                  <b>
                    {weekCount(data, w, p.id)} / {targetFor(w, 'gym')}
                  </b>
                </span>
              ))}
            </div>
            {data.profiles
              .filter(
                (p) => p.name === 'Kazzy' && targetFor(w, 'steps_weekly') > 0,
              )
              .map((p) => (
                <p key={p.id} className="muted small">
                  {p.name}’s 10,000-step days{' '}
                  <b>
                    {weekCount(data, w, p.id, 'steps_weekly')} /{' '}
                    {targetFor(w, 'steps_weekly')}
                  </b>
                </p>
              ))}
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </section>
    </div>
  );
}
