'use client';
import { useChallenge } from '@/components/app/challenge-context';
import { costByHabit, money, perfectDays } from '@/lib/progress';
import { titleFor } from '@/lib/rules';
import { activePointCount, forgivenCount } from '@/lib/selectors';

/** Side-by-side totals for both people; the final word once the challenge is finalized. */
export function SummaryCard() {
  const { data, now, finalized, stats } = useChallenge();
  return (
    <section className="glass summary">
      <p className="eyebrow">
        {finalized ? 'Final summary' : 'Summary so far'}
      </p>
      <h2>{finalized ? 'That’s a wrap.' : 'Where things stand.'}</h2>
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
            forgiven = forgivenCount(data, p.id);
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
