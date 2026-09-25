'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { ToneBar, ToneLegend } from '@/components/shared/tone-bar';
import { costByHabit, dayNumber, total } from '@/lib/progress';
import { titleFor } from '@/lib/rules';
import { BadgeGrid } from './badge-grid';
import { EntryHistory } from './entry-history';
import { HabitList } from './habit-list';
import { SummaryCard } from './summary-card';

export function ProgressPage() {
  const { data, now, stats } = useChallenge();
  const { won } = stats;
  return (
    <>
      <div className="page-heading">
        <h1>Progress.</h1>
        <span className="eyebrow">Day {dayNumber(now)} of 30</span>
      </div>
      <section className="glass progress-block">
        <div className="row">
          <h3>The whole challenge</h3>
          <span className="muted small">Every habit, all 30 days</span>
        </div>
        <ToneLegend />
        {data.profiles.map((p) => {
          const c = stats.bars[p.id];
          return (
            <div key={p.id} className="bar-row">
              <div className="row">
                <span className="bar-name">{p.name}</span>
                <span className="muted">
                  {c.done} / {total(c)} done · {c.missed} missed
                  {c.excused > 0 ? ` · ${c.excused} excused` : ''}
                  {c.review > 0 ? ` · ${c.review} reviewing` : ''}
                </span>
              </div>
              <ToneBar counts={c} />
            </div>
          );
        })}
      </section>
      <HabitList />
      <section className="glass progress-block">
        <div className="row">
          <h3>Days won</h3>
          <span className="muted small">Fewer misses takes the day</span>
        </div>
        <div className="score">
          {data.profiles.map((p) => (
            <div key={p.id}>
              <b>{won.wins[p.id] ?? 0}</b>
              <span>{p.name}</span>
            </div>
          ))}
          <div>
            <b>{won.ties}</b>
            <span>{won.ties === 1 ? 'tie' : 'ties'}</span>
          </div>
        </div>
        {won.recent.length === 0 && (
          <p className="muted">No day has closed yet.</p>
        )}
      </section>
      <section className="glass progress-block">
        <div className="row">
          <h3>Most expensive habits</h3>
        </div>
        <div className="two-col">
          {data.profiles.map((p) => {
            const list = costByHabit(data, p.id).slice(0, 3);
            return (
              <div key={p.id}>
                <p className="eyebrow">{p.name}</p>
                {list.map((c) => (
                  <div key={c.rule} className="cost-row">
                    <span>
                      {titleFor(c.rule)}
                      <small className="who">
                        {c.count} {c.count === 1 ? 'miss' : 'misses'}
                      </small>
                    </span>
                    <b>${c.dollars}</b>
                  </div>
                ))}
                {!list.length && <p className="muted">No penalties yet.</p>}
              </div>
            );
          })}
        </div>
      </section>
      <BadgeGrid />
      <SummaryCard />
      <EntryHistory />
    </>
  );
}
