import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/scoring";
import { ChallengeForm } from "@/components/admin/ChallengeForm";
import type { Challenge } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").order("start_date", { ascending: false });
  const challenges = (data ?? []) as Challenge[];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-muted">← Dashboard</Link>
        <h1 className="mt-1 text-xl font-extrabold">Challenges</h1>
        <p className="text-sm text-muted">A new month is just a new challenge and its rules. No code needed.</p>
      </div>
      <div className="card divide-y divide-line">
        {!challenges.length && <div className="p-4 text-sm text-muted">No challenges yet.</div>}
        {challenges.map((c) => (
          <Link key={c.id} href={`/admin/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-background">
            <div>
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-muted">{formatDate(c.start_date, "MMM d, yyyy")} – {formatDate(c.end_date, "MMM d, yyyy")} · {c.timezone}</div>
            </div>
            <span className="text-muted">›</span>
          </Link>
        ))}
      </div>
      <div>
        <h2 className="mb-2 text-base font-bold">New challenge</h2>
        <ChallengeForm />
      </div>
    </div>
  );
}
