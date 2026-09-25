'use client';
import { Flame } from 'lucide-react';
import { useChallenge } from '@/components/app/challenge-context';
import { ToneBar } from '@/components/shared/tone-bar';

export const percent = (rate: number) => `${Math.round(rate * 100)}%`;

/** Every daily habit, worst first, with each person's bar, hit rate and streak. Tapping one opens its story. */
export function HabitList() {
  const { data, stats, dialogs } = useChallenge();
  return (
    <section className="glass progress-block">
      <div className="row">
        <h3>By habit, worst first</h3>
        <span className="muted small">Tap one for the story</span>
      </div>
      {stats.order.map((r) => (
        <button
          key={r.id}
          type="button"
          className="habit-row"
          onClick={() => dialogs.openHabit(r.id)}
        >
          <span className="habit-title">
            {r.title}
            {r.person && <small className="who">{r.person} only</small>}
          </span>
          {data.profiles.map((p) => {
            const s = stats.habits[p.id]?.find((x) => x.rule.id === r.id);
            if (!s) return null;
            return (
              <span key={p.id} className="mini">
                <span className="mini-name">{p.name[0]}</span>
                <ToneBar counts={s.counts} compact />
                <span className="mini-rate">
                  {s.rate === null ? '–' : percent(s.rate)}
                </span>
                <span
                  className="mini-streak"
                  title={`Current streak: ${s.streak} day${s.streak === 1 ? '' : 's'}`}
                >
                  <Flame size={13} />
                  {s.streak}
                </span>
              </span>
            );
          })}
        </button>
      ))}
    </section>
  );
}
