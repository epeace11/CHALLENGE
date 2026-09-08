import Link from "next/link";
import type { ChallengeData, Session } from "@/lib/data";
import { REASON_LABEL, slugColor } from "@/lib/derive";
import { formatDate, formatInstant, money } from "@/lib/scoring";
import { ForgivenessButton } from "./ForgivenessButton";
import { Empty, Section } from "./ui";

export function PointLedger({ data, session }: { data: ChallengeData; session: Session }) {
  const tz = data.challenge.timezone;
  const ruleById = new Map(data.rules.map((r) => [r.id, r]));
  const profileById = new Map(session.profiles.map((p) => [p.id, p]));
  const requestByPoint = new Map(data.forgiveness.map((f) => [f.point_id, f]));

  // Chronological, with a per-person running count so the n-th point costs $n.
  const running = new Map<string, { count: number; total: number }>();
  const rows = data.points.map((pt) => {
    const r = running.get(pt.user_id) ?? { count: 0, total: 0 };
    let cost = 0;
    if (!pt.forgiven) {
      r.count += 1;
      cost = r.count;
      r.total += cost;
    }
    running.set(pt.user_id, { ...r });
    return { pt, cost, total: r.total };
  });

  return (
    <Section title="Point ledger" subtitle="Every point in order. The n-th point costs $n.">
      {!rows.length && <Empty>No points yet. Keep it up! 💪</Empty>}
      {rows.length > 0 && (
        <div className="card divide-y divide-line">
          {rows.slice().reverse().map(({ pt, cost, total }) => {
            const person = profileById.get(pt.user_id);
            const rule = ruleById.get(pt.rule_id);
            const req = requestByPoint.get(pt.id);
            const c = person ? slugColor(person.slug) : slugColor("erin");
            const mine = pt.user_id === session.me.id;
            return (
              <div key={pt.id} className={`flex items-start justify-between gap-3 px-3 py-2 ${pt.forgiven ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <div className="text-xs text-muted">
                    <span className={`font-bold ${c.text}`}>{person?.display_name}</span> · {formatDate(pt.date)} · {REASON_LABEL[pt.reason]}
                    <span className="hidden sm:inline"> · added {formatInstant(pt.created_at, tz)}</span>
                  </div>
                  <div className={`text-sm font-medium ${pt.forgiven ? "line-through" : ""}`}>
                    {pt.entry_id ? <Link href={`/entry/${pt.entry_id}`}>{rule?.title}</Link> : rule?.title}
                  </div>
                  {pt.forgiven && <div className="text-xs text-accent">🛡️ forgiven</div>}
                  {!pt.forgiven && req && (
                    <div className="text-xs text-muted">
                      Forgiveness {req.status === "pending" ? "requested" : req.status}: “{req.reason}”
                    </div>
                  )}
                  {!pt.forgiven && !req && mine && <ForgivenessButton pointId={pt.id} />}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-bold tabular-nums">{pt.forgiven ? "—" : money(cost)}</div>
                  {!pt.forgiven && <div className="text-[10px] text-muted">total {money(total)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}
