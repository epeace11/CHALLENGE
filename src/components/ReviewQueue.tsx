import Link from "next/link";
import type { ChallengeData, Session } from "@/lib/data";
import { REASON_LABEL, pendingReview, slugColor } from "@/lib/derive";
import { formatDate, formatInstant } from "@/lib/scoring";
import { ReviewActions } from "./ReviewActions";
import { PhotoStrip } from "./PhotoStrip";
import { Empty, Section } from "./ui";

export function ReviewQueue({ data, session }: { data: ChallengeData; session: Session }) {
  const tz = data.challenge.timezone;
  const ruleById = new Map(data.rules.map((r) => [r.id, r]));
  const entryById = new Map(data.entries.map((e) => [e.id, e]));
  const pointById = new Map(data.points.map((p) => [p.id, p]));
  const profileById = new Map(session.profiles.map((p) => [p.id, p]));

  const toReview = pendingReview(data.entries, session.partner.id);
  const forgivenessForMe = data.forgiveness.filter((f) => f.status === "pending" && f.requester_id !== session.me.id);
  const myForgiveness = data.forgiveness.filter((f) => f.status === "pending" && f.requester_id === session.me.id);
  const openDisputes = data.disputes.filter((d) => d.status === "open");
  const partnerColor = slugColor(session.partner.slug);

  const empty = !toReview.length && !forgivenessForMe.length && !openDisputes.length && !myForgiveness.length;

  return (
    <Section id="review" title="Review" subtitle={`${session.partner.display_name}'s entries and requests waiting on you`}>
      {empty && <Empty>Nothing to review. 🎉</Empty>}
      <div className="flex flex-col gap-2">
        {toReview.map((e) => {
          const rule = ruleById.get(e.rule_id);
          return (
            <div key={e.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted">
                    <span className={`font-bold ${partnerColor.text}`}>{session.partner.display_name}</span> · {formatDate(e.date)} · logged {formatInstant(e.logged_at, tz)}
                  </div>
                  <Link href={`/entry/${e.id}`} className="font-semibold">{rule?.title ?? "Rule"}</Link>
                  {e.note && <p className="mt-0.5 text-sm">“{e.note}”</p>}
                </div>
                <span className="text-xl">✅</span>
              </div>
              <PhotoStrip photos={e.photos} tz={tz} />
              <ReviewActions kind="entry" entryId={e.id} />
            </div>
          );
        })}

        {forgivenessForMe.map((f) => {
          const point = pointById.get(f.point_id);
          const rule = point ? ruleById.get(point.rule_id) : undefined;
          const entry = point?.entry_id ? entryById.get(point.entry_id) : undefined;
          return (
            <div key={f.id} className="card p-3">
              <div className="text-xs text-muted">
                <span className={`font-bold ${partnerColor.text}`}>{session.partner.display_name}</span> asks forgiveness · {point ? formatDate(point.date) : ""}
              </div>
              <div className="font-semibold">
                {rule?.title ?? "Point"} <span className="text-xs font-normal text-muted">({point ? REASON_LABEL[point.reason] : ""})</span>
              </div>
              <p className="mt-0.5 text-sm">“{f.reason}”</p>
              {entry && <Link href={`/entry/${entry.id}`} className="text-xs text-accent underline">View entry</Link>}
              <ReviewActions kind="forgiveness" requestId={f.id} />
            </div>
          );
        })}

        {openDisputes.map((d) => {
          const entry = entryById.get(d.entry_id);
          const rule = entry ? ruleById.get(entry.rule_id) : undefined;
          const iAmLogger = entry?.user_id === session.me.id;
          const raisedBy = profileById.get(d.raised_by);
          return (
            <div key={d.id} className="card border-warn/40 p-3">
              <div className="text-xs text-muted">
                ⚠️ Open dispute · {entry ? formatDate(entry.date) : ""} · raised by {raisedBy?.display_name}
              </div>
              <Link href={entry ? `/entry/${entry.id}` : "#"} className="font-semibold">{rule?.title ?? "Entry"}</Link>
              <p className="mt-0.5 text-sm">“{d.comment}”</p>
              {entry?.note && <p className="text-xs text-muted">Logger&apos;s note: “{entry.note}”</p>}
              {entry && <PhotoStrip photos={entry.photos} tz={tz} size="h-16 w-16" />}
              <ReviewActions kind="dispute" disputeId={d.id} role={iAmLogger ? "logger" : "disputer"} />
            </div>
          );
        })}

        {myForgiveness.map((f) => {
          const point = pointById.get(f.point_id);
          const rule = point ? ruleById.get(point.rule_id) : undefined;
          return (
            <div key={f.id} className="card p-3 text-sm">
              <div className="text-xs text-muted">Your forgiveness request · waiting on {session.partner.display_name}</div>
              <div className="font-semibold">{rule?.title} · {point ? formatDate(point.date) : ""}</div>
              <p className="text-muted">“{f.reason}”</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
