import type { DateTime } from "luxon";
import type { ChallengeData, Session } from "@/lib/data";
import { daysRemaining, formatDate, money } from "@/lib/scoring";
import { pendingReview, slugColor, totalsByUser } from "@/lib/derive";

export function MoneyHeader({ data, session, now }: { data: ChallengeData; session: Session; now: DateTime }) {
  const totals = totalsByUser(data.points, session.profiles);
  const remaining = daysRemaining(data.challenge, now);
  const openDisputes = data.disputes.filter((d) => d.status === "open").length;
  const awaitingMe = pendingReview(data.entries, session.partner.id).length
    + data.forgiveness.filter((f) => f.status === "pending" && f.requester_id !== session.me.id).length;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-muted">
        <span className="font-semibold text-foreground">{data.challenge.name}</span>
        <span>
          {formatDate(data.challenge.start_date, "MMM d")} – {formatDate(data.challenge.end_date, "MMM d")} ·{" "}
          {remaining > 0 ? `${remaining} day${remaining === 1 ? "" : "s"} left` : "finished"}
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-line">
        {session.profiles.map((p) => {
          const t = totals.get(p.id) ?? { count: 0, dollars: 0 };
          const c = slugColor(p.slug);
          return (
            <div key={p.id} className="px-4 py-4">
              <div className={`text-xs font-bold uppercase tracking-wide ${c.text}`}>{p.display_name} owes</div>
              <div className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">{money(t.dollars)}</div>
              <div className="text-xs text-muted">{t.count} point{t.count === 1 ? "" : "s"}</div>
            </div>
          );
        })}
      </div>
      {(openDisputes > 0 || awaitingMe > 0) && (
        <div className="flex flex-wrap gap-2 border-t border-line px-4 py-2 text-xs">
          {awaitingMe > 0 && (
            <a href="#review" className="rounded-full bg-warn-soft px-2.5 py-1 font-semibold text-warn">
              {awaitingMe} awaiting your review
            </a>
          )}
          {openDisputes > 0 && (
            <a href="#review" className="rounded-full bg-bad-soft px-2.5 py-1 font-semibold text-bad">
              {openDisputes} open dispute{openDisputes === 1 ? "" : "s"}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
