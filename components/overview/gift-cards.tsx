'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { money, nextMissCost } from '@/lib/progress';
import {
  activePointCount,
  forgivenCount,
  leaderOf,
  missedTotal,
  standings,
} from '@/lib/selectors';

/** Each person's gift so far: the partner's points decide its value. */
export function GiftCards() {
  const { data, finalized } = useChallenge();
  const leader = leaderOf(data);
  return (
    <div className="gift-grid">
      {standings(data).map((p) => {
        const other = data.profiles.find((o) => o.id !== p.id);
        const n = activePointCount(data, p.id),
          misses = missedTotal(data, p.id),
          forgiven = forgivenCount(data, p.id);
        return (
          <section
            key={p.id}
            className={`glass gift ${leader === p.id ? 'winner' : ''}`}
          >
            <p className="gift-name">
              {p.name} · {n} {n === 1 ? 'point' : 'points'}
            </p>
            <div className="gift-sentence">
              <span>gets a</span>
              <strong>
                $
                {money(
                  other ? activePointCount(data, other.id) : 0,
                ).toLocaleString()}
              </strong>
              <span>gift</span>
            </div>
            <p className="missed-total">
              {misses} {misses === 1 ? 'miss' : 'misses'} in total
              {forgiven > 0 ? ` · ${forgiven} forgiven` : ''}
            </p>
            {other && !finalized && (
              <p className="next-miss">
                {other.name}’s next miss adds{' '}
                <b>${nextMissCost(data, other.id)}</b>
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
