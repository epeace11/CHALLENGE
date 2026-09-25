'use client';
import { ArrowRight } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { ToneBar } from '@/components/shared/tone-bar';
import { total } from '@/lib/progress';

/** Both people's whole-challenge bars; opens Progress. */
export function ProgressStrip() {
  const { data, stats, go } = useChallenge();
  return (
    <button
      type="button"
      className="glass progress-strip"
      onClick={() => go('Progress')}
    >
      <span className="row">
        <span className="strip-title">Progress</span>
        <span className="strip-link">
          See it all
          <ArrowRight size={15} />
        </span>
      </span>
      {data.profiles.map((p) => {
        const c = stats.bars[p.id];
        return (
          <span key={p.id} className="bar-row">
            <span className="row">
              <span className="bar-name">{p.name}</span>
              <span className="muted">
                {c.done} / {total(c)} done · {c.missed} missed
              </span>
            </span>
            <ToneBar counts={c} />
          </span>
        );
      })}
    </button>
  );
}
