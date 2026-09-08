import "server-only";
import { DateTime } from "luxon";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  challengeWeeks,
  dateRange,
  lockAt,
  ruleAppliesTo,
  todayIn,
  weeklyShortfall,
} from "@/lib/scoring";
import type { Challenge, Entry, Point, Profile, Rule, WeeklyAssessment } from "@/lib/types";

/**
 * All scheduled work, written to be idempotent and "catch-up" safe:
 * every step asks "has this already been applied?" rather than "is it
 * exactly noon right now?". So it can run hourly from the Cloudflare cron
 * trigger and opportunistically on dashboard loads — the result is the same.
 *
 *  1. Noon lock: for every day whose deadline has passed and isn't locked
 *     yet, apply the unlogged policy and record the lock.
 *  2. Auto-confirm: pending entries older than the dispute window.
 *  3. Weekly assessment: once the last day of a week has locked (so a
 *     Saturday workout can still be logged on Sunday morning), score every
 *     weekly rule for that week. The final partial week is scored the same
 *     way after the challenge's last day locks.
 */
export interface JobReport {
  lockedDays: string[];
  unloggedEntries: number;
  autoConfirmed: number;
  weeksAssessed: string[];
  shortfallPoints: number;
}

export async function runScheduledJobs(now: DateTime = DateTime.now()): Promise<JobReport> {
  const db = createAdminClient();
  const report: JobReport = { lockedDays: [], unloggedEntries: 0, autoConfirmed: 0, weeksAssessed: [], shortfallPoints: 0 };

  const [{ data: challenges }, { data: profiles }] = await Promise.all([
    db.from("challenges").select("*").order("start_date"),
    db.from("profiles").select("*"),
  ]);
  if (!challenges?.length || !profiles?.length) return report;

  for (const challenge of challenges as Challenge[]) {
    const today = todayIn(challenge.timezone, now);
    if (challenge.start_date > today) continue;

    const { data: rules } = await db.from("rules").select("*").eq("challenge_id", challenge.id).order("sort_order");
    if (!rules?.length) continue;
    const ruleIds = (rules as Rule[]).map((r) => r.id);

    await lockDays(db, challenge, rules as Rule[], profiles as Profile[], now, report);
    await autoConfirm(db, challenge, ruleIds, now, report);
    await assessWeeks(db, challenge, rules as Rule[], profiles as Profile[], now, report);
  }
  return report;
}

type Db = ReturnType<typeof createAdminClient>;

async function lockDays(db: Db, challenge: Challenge, rules: Rule[], profiles: Profile[], now: DateTime, report: JobReport) {
  const lastDay = challenge.end_date < todayIn(challenge.timezone, now) ? challenge.end_date : todayIn(challenge.timezone, now);
  const candidates = dateRange(challenge.start_date, lastDay).filter((d) => now >= lockAt(challenge, d));
  if (!candidates.length) return;

  const { data: locks } = await db.from("day_locks").select("date").eq("challenge_id", challenge.id);
  const locked = new Set((locks ?? []).map((l) => l.date as string));
  const toLock = candidates.filter((d) => !locked.has(d));
  if (!toLock.length) return;

  const ruleIds = rules.map((r) => r.id);
  const { data: entries } = await db
    .from("entries")
    .select("*")
    .in("rule_id", ruleIds)
    .gte("date", toLock[0])
    .lte("date", toLock[toLock.length - 1]);
  const entryKey = (userId: string, ruleId: string, date: string) => `${userId}|${ruleId}|${date}`;
  const entryMap = new Map<string, Entry>();
  for (const e of (entries ?? []) as Entry[]) entryMap.set(entryKey(e.user_id, e.rule_id, e.date), e);

  const entryIds = ((entries ?? []) as Entry[]).map((e) => e.id);
  const { data: existingPoints } = entryIds.length
    ? await db.from("points").select("entry_id").in("entry_id", entryIds).eq("forgiven", false)
    : { data: [] as { entry_id: string }[] };
  const pointedEntries = new Set((existingPoints ?? []).map((p) => p.entry_id as string));

  for (const date of toLock) {
    for (const profile of profiles) {
      let flatPointGiven = false;
      for (const rule of rules) {
        if (rule.cadence !== "daily" || !ruleAppliesTo(rule, profile.slug, date)) continue;
        const existing = entryMap.get(entryKey(profile.id, rule.id, date));

        let entryId: string;
        if (!existing) {
          const { data: created, error } = await db
            .from("entries")
            .insert({ user_id: profile.id, rule_id: rule.id, date, done: false, status: "confirmed", unlogged: true })
            .select("id")
            .single();
          if (error) throw error;
          entryId = created.id;
          report.unloggedEntries += 1;
        } else if (existing.done === null) {
          await db.from("entries").update({ done: false, status: "confirmed", unlogged: true }).eq("id", existing.id);
          entryId = existing.id;
          report.unloggedEntries += 1;
        } else if (existing.done === false && !pointedEntries.has(existing.id) && existing.status !== "excused") {
          // a miss saved without a point (shouldn't happen, but be safe)
          await db.from("points").insert({
            user_id: profile.id, challenge_id: challenge.id, rule_id: rule.id, date, reason: "missed", entry_id: existing.id,
          });
          continue;
        } else {
          continue;
        }

        const givePoint = challenge.unlogged_policy === "all_missed" || !flatPointGiven;
        if (givePoint) {
          const { error } = await db.from("points").insert({
            user_id: profile.id, challenge_id: challenge.id, rule_id: rule.id, date, reason: "unlogged", entry_id: entryId,
          });
          if (error) throw error;
          flatPointGiven = true;
        }
      }
    }
    const { error } = await db.from("day_locks").insert({ challenge_id: challenge.id, date });
    if (error) throw error;
    report.lockedDays.push(date);
  }
}

async function autoConfirm(db: Db, challenge: Challenge, ruleIds: string[], now: DateTime, report: JobReport) {
  const cutoff = now.minus({ hours: challenge.dispute_window_hours }).toISO()!;
  const { data, error } = await db
    .from("entries")
    .update({ status: "confirmed" })
    .in("rule_id", ruleIds)
    .eq("status", "pending")
    .eq("done", true)
    .lt("updated_at", cutoff)
    .select("id");
  if (error) throw error;
  report.autoConfirmed += data?.length ?? 0;
}

async function assessWeeks(db: Db, challenge: Challenge, rules: Rule[], profiles: Profile[], now: DateTime, report: JobReport) {
  const weeklyRules = rules.filter((r) => r.cadence === "weekly" && r.weekly_target != null);
  if (!weeklyRules.length) return;

  const closedWeeks = challengeWeeks(challenge).filter((w) => now >= lockAt(challenge, w.end));
  if (!closedWeeks.length) return;

  const { data: assessed } = await db
    .from("weekly_assessments")
    .select("user_id, rule_id, period_end")
    .in("rule_id", weeklyRules.map((r) => r.id));
  const done = new Set((assessed ?? []).map((a: Pick<WeeklyAssessment, "user_id" | "rule_id" | "period_end">) => `${a.user_id}|${a.rule_id}|${a.period_end}`));

  for (const week of closedWeeks) {
    for (const rule of weeklyRules) {
      for (const profile of profiles) {
        if (!ruleAppliesTo(rule, profile.slug, week.end)) continue;
        if (done.has(`${profile.id}|${rule.id}|${week.end}`)) continue;

        const { count } = await db
          .from("entries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("rule_id", rule.id)
          .eq("done", true)
          .neq("status", "conceded")
          .gte("date", week.start)
          .lte("date", week.end);
        const doneCount = count ?? 0;
        const shortfall = weeklyShortfall(rule.weekly_target!, doneCount);

        if (shortfall > 0) {
          const rows: Omit<Point, "id" | "created_at" | "forgiven" | "entry_id">[] = Array.from({ length: shortfall }, () => ({
            user_id: profile.id, challenge_id: challenge.id, rule_id: rule.id, date: week.end, reason: "weekly_shortfall",
          }));
          const { error } = await db.from("points").insert(rows);
          if (error) throw error;
          report.shortfallPoints += shortfall;
        }
        const { error } = await db.from("weekly_assessments").insert({
          user_id: profile.id, rule_id: rule.id, period_end: week.end, done_count: doneCount, shortfall,
        });
        if (error) throw error;
        report.weeksAssessed.push(`${profile.slug}:${week.end}`);
      }
    }
  }
}

// Opportunistic run from page loads, throttled per server instance.
let lastOpportunisticRun = 0;
const OPPORTUNISTIC_INTERVAL_MS = 5 * 60 * 1000;

export async function maybeRunScheduledJobs(): Promise<void> {
  const nowMs = Date.now();
  if (nowMs - lastOpportunisticRun < OPPORTUNISTIC_INTERVAL_MS) return;
  lastOpportunisticRun = nowMs;
  try {
    await runScheduledJobs();
  } catch (err) {
    console.error("scheduled jobs failed", err);
  }
}
