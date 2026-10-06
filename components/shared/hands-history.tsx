'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { formatShortDate } from '@/lib/dates';
import { ruleById } from '@/lib/rules';
import { Proofs } from './proofs';

/** Every Sunday hands photo, oldest first, so the weeks can be compared side by side. `current` marks the answer being viewed. */
export function HandsHistory({
  uid,
  current,
}: {
  uid: string;
  current?: string;
}) {
  const { data, today } = useChallenge();
  // A late correction's photo is the one waiting to count, so show it.
  const photoOf = (e: (typeof data.entries)[number]) =>
    e.proposed_done !== null ? e.proposed_proof : e.proof;
  const weeks = data.entries
    .filter((e) => e.user_id === uid && e.rule_id === 'hands' && photoOf(e))
    .sort((a, b) => a.day.localeCompare(b.day));
  const from = ruleById('hands')?.from;
  return (
    <section className="hands-history">
      <h3>Every week</h3>
      {weeks.length === 0 ? (
        <p className="muted">
          No hands photos yet.
          {from && today <= from
            ? ` The first one is due Sunday, ${formatShortDate(from)}.`
            : ''}
        </p>
      ) : (
        <>
          <div className="hands-weeks">
            {weeks.map((e) => (
              <div
                key={e.id}
                className={`hands-week${e.id === current ? ' current' : ''}`}
              >
                <span>
                  {formatShortDate(e.day)}
                  {e.id === current ? ' · this one' : ''}
                </span>
                <Proofs proof={photoOf(e)} />
              </div>
            ))}
          </div>
          {weeks.length === 1 && (
            <p className="muted">
              Each Sunday’s photo will sit next to this one.
            </p>
          )}
        </>
      )}
    </section>
  );
}
