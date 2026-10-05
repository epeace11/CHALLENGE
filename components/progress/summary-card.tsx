'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { END, TOTAL_DAYS, closed } from '@/lib/dates';
import {
  costByHabit,
  money,
  perfectDays,
  weeklyDone,
  weeklyForgiven,
} from '@/lib/progress';
import { titleFor } from '@/lib/rules';
import { targetFor } from '@/lib/weeks';
import { activePointCount, forgivenCount } from '@/lib/selectors';
import type { Data } from '@/lib/types';

/** Gym visits over the whole challenge: done, forgiven, and the sum of the weekly targets. */
function gymTotals(data: Data, uid: string) {
  const t = { done: 0, forgiven: 0, target: 0 };
  for (const w of data.weeks) {
    if (!targetFor(w, 'gym')) continue;
    t.done += weeklyDone(data, uid, 'gym', w);
    t.forgiven += weeklyForgiven(data, uid, 'gym', w).forgiven;
    t.target += targetFor(w, 'gym');
  }
  return t;
}

/** Side-by-side totals for both people: a recap once the last day has locked, and the final word once the challenge is finalized. */
export function SummaryCard() {
  const { data, now, finalized, stats } = useChallenge();
  const over = closed(END, now);
  return (
    <section className="glass summary">
      <p className="eyebrow">
        {finalized ? 'Final summary' : over ? 'Recap' : 'Summary so far'}
      </p>
      <h2>
        {finalized
          ? 'That’s a wrap.'
          : over
            ? `${TOTAL_DAYS} days, done.`
            : 'Where things stand.'}
      </h2>
      <div className="summary-grid">
        {data.profiles.map((p) => {
          const other = data.profiles.find((o) => o.id !== p.id),
            best = [...(stats.habits[p.id] ?? [])].sort(
              (a, b) => b.best - a.best,
            )[0],
            perfect = perfectDays(data, p, now, stats.ix),
            cost = costByHabit(data, p.id)[0],
            all = stats.earned[p.id] ?? [],
            got = all.filter((b) => b.earned),
            forgiven = forgivenCount(data, p.id),
            gym = gymTotals(data, p.id),
            lastNote = data.journals
              .filter((j) => j.user_id === p.id)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          return (
            <div key={p.id} className="summary-col">
              <h3>{p.name}</h3>
              <Stat label="Gift value">
                $
                {money(
                  other ? activePointCount(data, other.id) : 0,
                ).toLocaleString()}
              </Stat>
              <Stat label="Misses">
                {forgiven > 0 && <small>+{forgiven} forgiven · </small>}
                {activePointCount(data, p.id)}
              </Stat>
              <Stat label="Perfect days">
                {perfect.longest > 1 && (
                  <small>best run {perfect.longest} · </small>
                )}
                {perfect.count}
              </Stat>
              <Stat label="Longest streak">
                {best && best.best > 0 ? (
                  <>
                    <small>{best.rule.title} · </small>
                    {best.best}
                  </>
                ) : (
                  '–'
                )}
              </Stat>
              <Stat label="Days won">{stats.won.wins[p.id] ?? 0}</Stat>
              <Stat label="Costliest habit">
                {cost ? (
                  <>
                    <small>{titleFor(cost.rule)} · </small>${cost.dollars}
                  </>
                ) : (
                  '–'
                )}
              </Stat>
              <Stat label="Badges">
                {got.length}
                <small> of {all.length}</small>
              </Stat>
              {gym.target > 0 && (
                <Stat label="Gym visits">
                  {gym.forgiven > 0 && (
                    <small>{gym.forgiven} forgiven · </small>
                  )}
                  {gym.done + gym.forgiven}
                  <small> of {gym.target}</small>
                </Stat>
              )}
              {over && lastNote && (
                <blockquote className="summary-note">
                  “
                  {lastNote.text.length > 160
                    ? `${lastNote.text.slice(0, 160).trimEnd()}…`
                    : lastNote.text}
                  ”<span className="muted">Latest journal note</span>
                </blockquote>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{children}</b>
    </div>
  );
}
