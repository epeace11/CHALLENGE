import { dollarsFor } from "./scoring";
import type { Entry, EntryWithPhotos, EntryStatus, Point, PointReason, Profile, Rule, UserSlug } from "./types";

export const entryKey = (userId: string, ruleId: string, date: string) => `${userId}|${ruleId}|${date}`;

export function indexEntries<T extends Entry>(entries: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const e of entries) m.set(entryKey(e.user_id, e.rule_id, e.date), e);
  return m;
}

export interface Totals {
  count: number;
  dollars: number;
}

export function totalsByUser(points: Point[], profiles: Profile[]): Map<string, Totals> {
  const m = new Map<string, Totals>();
  for (const p of profiles) m.set(p.id, { count: 0, dollars: 0 });
  for (const pt of points) {
    if (pt.forgiven) continue;
    const t = m.get(pt.user_id) ?? { count: 0, dollars: 0 };
    t.count += 1;
    m.set(pt.user_id, t);
  }
  for (const t of m.values()) t.dollars = dollarsFor(t.count);
  return m;
}

export const REASON_LABEL: Record<PointReason, string> = {
  missed: "Missed",
  unlogged: "Not logged",
  weekly_shortfall: "Weekly shortfall",
  dispute_conceded: "Dispute conceded",
};

export const STATUS_LABEL: Record<EntryStatus, string> = {
  pending: "Awaiting review",
  confirmed: "Confirmed",
  disputed: "Disputed",
  conceded: "Conceded",
  excused: "Excused",
};

export function statusTone(status: EntryStatus, done: boolean | null): string {
  if (done === false && status !== "excused") return "bg-bad-soft text-bad";
  switch (status) {
    case "pending": return "bg-warn-soft text-warn";
    case "confirmed": return "bg-good-soft text-good";
    case "disputed": return "bg-warn-soft text-warn";
    case "conceded": return "bg-bad-soft text-bad";
    case "excused": return "bg-accent-soft text-accent";
  }
}

/** Grid glyph for a cell. */
export function cellGlyph(entry: Entry | undefined, rule: Rule, applies: boolean, isFuture: boolean): string {
  if (!applies) return "·";
  if (!entry || entry.done === null) return isFuture ? "" : "";
  if (entry.status === "excused") return "🛡️";
  if (entry.status === "disputed") return "⚠️";
  if (entry.done) return entry.status === "conceded" ? "❌" : "✅";
  return rule.cadence === "weekly" ? "–" : "❌";
}

export function slugColor(slug: UserSlug): { text: string; soft: string; bg: string } {
  return slug === "erin"
    ? { text: "text-erin", soft: "bg-erin-soft", bg: "bg-erin" }
    : { text: "text-kazzy", soft: "bg-kazzy-soft", bg: "bg-kazzy" };
}

export function pendingReview(entries: EntryWithPhotos[], partnerId: string): EntryWithPhotos[] {
  return entries.filter((e) => e.user_id === partnerId && e.status === "pending" && e.done === true);
}
