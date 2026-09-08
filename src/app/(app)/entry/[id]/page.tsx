import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { requireSession, signPhotos } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { REASON_LABEL, STATUS_LABEL, slugColor, statusTone } from "@/lib/derive";
import { formatDate, formatInstant, isLocked } from "@/lib/scoring";
import { ReviewActions } from "@/components/ReviewActions";
import { ForgivenessButton } from "@/components/ForgivenessButton";
import { PhotoStrip } from "@/components/PhotoStrip";
import { Badge } from "@/components/ui";
import type { Challenge, Dispute, Entry, ForgivenessRequest, Photo, Point, Rule } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await createClient();

  const { data: entry } = await supabase.from("entries").select("*").eq("id", id).maybeSingle();
  if (!entry) notFound();
  const e = entry as Entry;
  const [{ data: rule }, { data: photos }, { data: disputes }, { data: points }] = await Promise.all([
    supabase.from("rules").select("*").eq("id", e.rule_id).single(),
    supabase.from("photos").select("*").eq("entry_id", e.id).order("uploaded_at"),
    supabase.from("disputes").select("*").eq("entry_id", e.id).order("created_at"),
    supabase.from("points").select("*").eq("entry_id", e.id).order("created_at"),
  ]);
  const r = rule as Rule;
  const { data: challenge } = await supabase.from("challenges").select("*").eq("id", r.challenge_id).single();
  const c = challenge as Challenge;
  const pointIds = ((points ?? []) as Point[]).map((p) => p.id);
  const { data: forgiveness } = pointIds.length
    ? await supabase.from("forgiveness_requests").select("*").in("point_id", pointIds)
    : { data: [] as ForgivenessRequest[] };
  const signed = await signPhotos((photos ?? []) as Photo[]);

  const owner = session.profiles.find((p) => p.id === e.user_id)!;
  const color = slugColor(owner.slug);
  const mine = e.user_id === session.me.id;
  const now = DateTime.now();
  const editable = mine && !isLocked(c, e.date, now, e.reopen_until);
  const openDispute = ((disputes ?? []) as Dispute[]).find((d) => d.status === "open");
  const profileById = new Map(session.profiles.map((p) => [p.id, p]));
  const requestByPoint = new Map(((forgiveness ?? []) as ForgivenessRequest[]).map((f) => [f.point_id, f]));

  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="text-sm text-muted">← Dashboard</Link>
      <div className="card p-4">
        <div className="text-xs text-muted">
          <span className={`font-bold ${color.text}`}>{owner.display_name}</span> · {formatDate(e.date, "EEEE, MMMM d")}
        </div>
        <h1 className="mt-1 text-xl font-extrabold">{r.title}</h1>
        {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-2xl">{e.done === null ? "…" : e.status === "excused" ? "🛡️" : e.status === "disputed" ? "⚠️" : e.done && e.status !== "conceded" ? "✅" : "❌"}</span>
          {e.done !== null && <Badge tone={statusTone(e.status, e.done)}>{STATUS_LABEL[e.status]}</Badge>}
          {e.unlogged && <Badge tone="bg-line text-muted">auto-marked (not logged)</Badge>}
          {e.done !== null && <span className="text-xs text-muted">logged {formatInstant(e.logged_at, c.timezone)}</span>}
        </div>
        {e.note && <p className="mt-3 rounded-xl bg-background px-3 py-2 text-sm">“{e.note}”</p>}
        <PhotoStrip photos={signed} tz={c.timezone} size="h-32 w-32" />
        {editable && (
          <Link href={`/?date=${e.date}#log`} className="btn btn-ghost mt-3 w-full">✏️ Edit in the log form</Link>
        )}
        {!mine && e.status === "pending" && e.done === true && <ReviewActions kind="entry" entryId={e.id} />}
        {openDispute && (
          <ReviewActions kind="dispute" disputeId={openDispute.id} role={mine ? "logger" : "disputer"} />
        )}
      </div>

      {((disputes ?? []) as Dispute[]).length > 0 && (
        <div className="card divide-y divide-line">
          <div className="px-4 py-2 text-xs font-bold uppercase text-muted">Dispute history</div>
          {((disputes ?? []) as Dispute[]).map((d) => (
            <div key={d.id} className="px-4 py-2 text-sm">
              <div className="text-xs text-muted">
                {profileById.get(d.raised_by)?.display_name} · {formatInstant(d.created_at, c.timezone)} ·{" "}
                <span className="font-semibold">{d.status}</span>
                {d.resolved_at && ` ${formatInstant(d.resolved_at, c.timezone)}`}
              </div>
              <p>“{d.comment}”</p>
            </div>
          ))}
        </div>
      )}

      {((points ?? []) as Point[]).length > 0 && (
        <div className="card divide-y divide-line">
          <div className="px-4 py-2 text-xs font-bold uppercase text-muted">Points from this entry</div>
          {((points ?? []) as Point[]).map((p) => {
            const req = requestByPoint.get(p.id);
            return (
              <div key={p.id} className={`px-4 py-2 text-sm ${p.forgiven ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className={p.forgiven ? "line-through" : ""}>{REASON_LABEL[p.reason]}</span>
                  <span className="text-xs text-muted">{formatInstant(p.created_at, c.timezone)}</span>
                </div>
                {p.forgiven && <div className="text-xs text-accent">🛡 forgiven</div>}
                {req && (
                  <div className="text-xs text-muted">
                    Forgiveness {req.status}: “{req.reason}”
                    {req.decided_by && ` · decided by ${profileById.get(req.decided_by)?.display_name}`}
                  </div>
                )}
                {!p.forgiven && !req && mine && <ForgivenessButton pointId={p.id} />}
                {!p.forgiven && req?.status === "pending" && !mine && <ReviewActions kind="forgiveness" requestId={req.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
