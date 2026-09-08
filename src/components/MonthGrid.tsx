import Link from "next/link";
import type { DateTime } from "luxon";
import type { ChallengeData, Session } from "@/lib/data";
import { cellGlyph, entryKey, indexEntries, slugColor } from "@/lib/derive";
import { dateRange, formatDate, isLocked, ruleAppliesTo } from "@/lib/scoring";
import { Section } from "./ui";

export function MonthGrid({ data, session, today, now }: { data: ChallengeData; session: Session; today: string; now: DateTime }) {
  const days = dateRange(data.challenge.start_date, data.challenge.end_date);
  const entries = indexEntries(data.entries);

  return (
    <Section title="Month grid" subtitle="✅ done · ❌ missed · 🛡️ excused · ⚠️ disputed · blank = not logged">
      <div className="flex flex-col gap-3">
        {session.profiles.map((p) => {
          const c = slugColor(p.slug);
          const rules = data.rules.filter((r) => r.applies_to === "both" || r.applies_to === p.slug);
          return (
            <div key={p.id} className="card overflow-hidden">
              <div className={`px-3 py-1.5 text-xs font-bold uppercase ${c.soft} ${c.text}`}>{p.display_name}</div>
              <div className="overflow-x-auto">
                <table className="grid-table w-max border-collapse text-center text-sm">
                  <thead>
                    <tr>
                      <th className="sticky-col px-2 py-1 text-left text-[11px] font-semibold text-muted">Rule</th>
                      {days.map((d) => (
                        <th key={d} className={`px-0.5 py-1 text-[10px] font-medium ${d === today ? "bg-accent-soft text-accent" : "text-muted"}`}>
                          <div>{formatDate(d, "ccccc")}</div>
                          <div>{formatDate(d, "d")}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="sticky-col max-w-36 truncate px-2 py-1 text-left text-xs font-medium">{rule.title}</td>
                        {days.map((d) => {
                          const applies = ruleAppliesTo(rule, p.slug, d);
                          const entry = entries.get(entryKey(p.id, rule.id, d));
                          const glyph = cellGlyph(entry, rule, applies, d > today);
                          const own = p.id === session.me.id;
                          const href = entry && entry.done !== null
                            ? `/entry/${entry.id}`
                            : own && applies && d <= today && !isLocked(data.challenge, d, now, entry?.reopen_until)
                              ? `/?date=${d}#log`
                              : null;
                          const cell = <span className="inline-block min-w-6 text-xs leading-6">{glyph}</span>;
                          return (
                            <td key={d} className={`px-0.5 py-0.5 ${d === today ? "bg-accent-soft/40" : ""}`}>
                              {href ? <Link href={href} className="block rounded hover:bg-line">{cell}</Link> : cell}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
