import { DateTime } from "luxon";
import type { ChallengeData, Session } from "@/lib/data";
import { entryKey, indexEntries, slugColor } from "@/lib/derive";
import { formatDate, ruleAppliesTo, weekBounds } from "@/lib/scoring";
import { Section } from "./ui";

export function WeeklyWorkouts({ data, session, today }: { data: ChallengeData; session: Session; today: string }) {
  const weeklyRules = data.rules.filter((r) => r.cadence === "weekly");
  if (!weeklyRules.length) return null;
  const week = weekBounds(today);
  const entries = indexEntries(data.entries);
  const days = Array.from({ length: 7 }, (_, i) => DateTime.fromISO(week.start).plus({ days: i }).toISODate()!);

  return (
    <Section title="This week's workouts" subtitle={`${formatDate(week.start, "MMM d")} – ${formatDate(week.end, "MMM d")}`}>
      <div className="flex flex-col gap-2">
        {weeklyRules.map((rule) => (
          <div key={rule.id} className="card divide-y divide-line">
            {session.profiles.filter((p) => ruleAppliesTo(rule, p.slug, today)).map((p) => {
              const c = slugColor(p.slug);
              const doneDays = days.filter((d) => {
                const e = entries.get(entryKey(p.id, rule.id, d));
                return e?.done === true && e.status !== "conceded";
              });
              const target = rule.weekly_target ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div>
                    <div className={`text-xs font-bold uppercase ${c.text}`}>{p.display_name}</div>
                    <div className="text-xl font-extrabold tabular-nums">
                      {doneDays.length}<span className="text-sm font-semibold text-muted">/{target}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {days.map((d) => {
                      const inChallenge = d >= data.challenge.start_date && d <= data.challenge.end_date;
                      const isDone = doneDays.includes(d);
                      return (
                        <div
                          key={d}
                          className={`flex h-8 w-8 flex-col items-center justify-center rounded-lg text-[10px] font-semibold ${
                            isDone ? `${c.bg} text-white` : inChallenge ? "bg-line text-muted" : "text-line"
                          } ${d === today ? "ring-2 ring-accent" : ""}`}
                          title={formatDate(d)}
                        >
                          {formatDate(d, "ccccc")}
                          <span className="text-[9px]">{isDone ? "✓" : formatDate(d, "d")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Section>
  );
}
