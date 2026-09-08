import Link from "next/link";
import { DateTime } from "luxon";
import { currentChallenge, loadChallengeData, requireSession } from "@/lib/data";
import { maybeRunScheduledJobs } from "@/lib/jobs";
import { clampDate, dateRange, defaultLogDate, isLocked, lockAt, ruleAppliesTo, todayIn } from "@/lib/scoring";
import { indexEntries, entryKey } from "@/lib/derive";
import { MoneyHeader } from "@/components/MoneyHeader";
import { DailyLog } from "@/components/DailyLog";
import { ReviewQueue } from "@/components/ReviewQueue";
import { WeeklyWorkouts } from "@/components/WeeklyWorkouts";
import { MonthGrid } from "@/components/MonthGrid";
import { PointLedger } from "@/components/PointLedger";
import { Empty } from "@/components/ui";
import type { EntryWithPhotos } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const preferredChallenge = typeof sp.challenge === "string" ? sp.challenge : undefined;

  await maybeRunScheduledJobs();
  const session = await requireSession();
  const challenge = await currentChallenge(preferredChallenge);

  if (!challenge) {
    return (
      <Empty>
        No challenge yet. <Link href="/admin" className="font-semibold text-accent underline">Create one in Settings</Link>.
      </Empty>
    );
  }

  const data = await loadChallengeData(challenge);
  const now = DateTime.now();
  const today = todayIn(challenge.timezone, now);
  const requestedDate = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const logDate = requestedDate ? clampDate(requestedDate, challenge.start_date, challenge.end_date) : defaultLogDate(challenge, now);

  const entryIndex = indexEntries(data.entries);
  const myRulesForDate = data.rules.filter((r) => ruleAppliesTo(r, session.me.slug, logDate));
  const myEntriesForDate: Record<string, EntryWithPhotos> = {};
  for (const r of myRulesForDate) {
    const e = entryIndex.get(entryKey(session.me.id, r.id, logDate));
    if (e) myEntriesForDate[r.id] = e;
  }

  // Days the user can pick in the log form: everything up to today, marking
  // which are still open. Reopened (forgiven) days count as open.
  const lastSelectable = today < challenge.end_date ? today : challenge.end_date;
  const selectableDates = dateRange(challenge.start_date, lastSelectable).map((d) => {
    const reopened = data.entries.some((e) => e.user_id === session.me.id && e.date === d && e.reopen_until && now < DateTime.fromISO(e.reopen_until));
    return { date: d, locked: isLocked(challenge, d, now) && !reopened };
  });
  const reopenUntil = data.entries
    .filter((e) => e.user_id === session.me.id && e.date === logDate && e.reopen_until && now < DateTime.fromISO(e.reopen_until))
    .map((e) => e.reopen_until!)
    .sort()
    .at(-1) ?? null;
  const dateLocked = isLocked(challenge, logDate, now, reopenUntil);
  const lockInstant = reopenUntil && now < DateTime.fromISO(reopenUntil) && now >= lockAt(challenge, logDate)
    ? reopenUntil
    : lockAt(challenge, logDate).toISO()!;

  return (
    <div className="flex flex-col gap-6">
      <MoneyHeader data={data} session={session} now={now} />
      <DailyLog
        challenge={challenge}
        meId={session.me.id}
        date={logDate}
        today={today}
        dates={selectableDates}
        locked={dateLocked}
        lockAtIso={lockInstant}
        rules={myRulesForDate}
        entries={myEntriesForDate}
      />
      <ReviewQueue data={data} session={session} />
      <WeeklyWorkouts data={data} session={session} today={today} />
      <MonthGrid data={data} session={session} today={today} now={now} />
      <PointLedger data={data} session={session} />
    </div>
  );
}
