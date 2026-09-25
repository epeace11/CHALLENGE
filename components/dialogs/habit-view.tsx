'use client';
import { Flame } from 'lucide-react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useChallenge } from '@/components/app/challenge-context';
import { percent } from '@/components/progress/habit-list';
import { EntryPill } from '@/components/shared/status-pill';
import { days, formatDate, formatShortDate } from '@/lib/dates';
import { entryKey, tone } from '@/lib/progress';
import { dailyRules, ruleById } from '@/lib/rules';

/** One habit's story for both people: a dot per day, streaks, cost, and every miss. Days with a note open their answer. */
export function HabitView({ ruleId }: { ruleId: string }) {
  const { data, now, stats, dialogs } = useChallenge();
  const r = ruleById(ruleId)!;
  return (
    <>
      <p className="eyebrow">
        {r.group} · {r.days}
      </p>
      <DialogTitle>{r.fullTitle ?? r.title}</DialogTitle>
      <DialogDescription className="sr-only">{r.description}</DialogDescription>
      {data.profiles.map((p) => {
        const s = stats.habits[p.id]?.find((x) => x.rule.id === r.id);
        if (!s) return null;
        const misses = data.entries
          .filter(
            (e) =>
              e.user_id === p.id &&
              e.rule_id === r.id &&
              tone(e, e.day, now) === 'missed',
          )
          .sort((a, b) => b.day.localeCompare(a.day));
        return (
          <section key={p.id} className="habit-person">
            <div className="row">
              <h3>{p.name}</h3>
              <span className="muted">
                {s.rate === null
                  ? 'Nothing closed yet'
                  : `${percent(s.rate)} · ${s.done} of ${s.done + s.missed}`}
              </span>
            </div>
            <div className="dots">
              {days()
                .filter((d) => dailyRules(p.name, d).some((x) => x.id === r.id))
                .map((d) => {
                  const e = stats.ix.get(entryKey(p.id, r.id, d)),
                    cls = `dot ${tone(e, d, now)}`;
                  return e && (e.proposed_note ?? e.note) ? (
                    <button
                      key={d}
                      type="button"
                      className={cls}
                      title={`${formatDate(d)} · has a note`}
                      aria-label={`${formatDate(d)}, open note`}
                      onClick={() => dialogs.openEntry(e)}
                    />
                  ) : (
                    <i key={d} className={cls} title={formatDate(d)} />
                  );
                })}
            </div>
            <div className="habit-facts">
              <span>
                <Flame size={13} />
                {s.streak} now · best {s.best}
              </span>
              <span>${s.dollars} so far</span>
            </div>
            {misses.map((e) => (
              <button
                key={e.id}
                type="button"
                className="history-row"
                onClick={() => dialogs.openEntry(e)}
              >
                <span>
                  {formatShortDate(e.day)}
                  {e.note && <small className="who">“{e.note}”</small>}
                </span>
                <EntryPill entry={e} />
              </button>
            ))}
          </section>
        );
      })}
    </>
  );
}
