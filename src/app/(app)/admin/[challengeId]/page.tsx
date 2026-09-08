import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChallengeForm } from "@/components/admin/ChallengeForm";
import { RuleForm, DeleteRuleButton } from "@/components/admin/RuleForm";
import type { Challenge, Rule } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default async function AdminChallengePage({ params }: { params: Promise<{ challengeId: string }> }) {
  const { challengeId } = await params;
  const supabase = await createClient();
  const { data: challenge } = await supabase.from("challenges").select("*").eq("id", challengeId).maybeSingle();
  if (!challenge) notFound();
  const { data: rules } = await supabase.from("rules").select("*").eq("challenge_id", challengeId).order("sort_order");
  const c = challenge as Challenge;
  const list = (rules ?? []) as Rule[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-muted">← Challenges</Link>
        <h1 className="mt-1 text-xl font-extrabold">{c.name}</h1>
        <Link href={`/?challenge=${c.id}`} className="text-xs text-accent underline">View dashboard for this challenge</Link>
      </div>

      <ChallengeForm challenge={c} />

      <div>
        <h2 className="mb-2 text-base font-bold">Rules</h2>
        <div className="flex flex-col gap-2">
          {list.map((r) => (
            <details key={r.id} className="card">
              <summary className="cursor-pointer list-none px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{r.sort_order}. {r.title}</div>
                    <div className="text-xs text-muted">
                      {r.cadence === "weekly" ? `weekly ×${r.weekly_target}` : `daily · ${r.active_days.length === 7 ? "every day" : r.active_days.map((d) => DAY[d]).join(" ")}`}
                      {" · "}{r.applies_to}{r.proof_required ? " · 📷 proof" : ""}
                    </div>
                  </div>
                  <span className="text-muted">✎</span>
                </div>
              </summary>
              <div className="border-t border-line p-4">
                <RuleForm challengeId={c.id} rule={r} />
                <DeleteRuleButton ruleId={r.id} challengeId={c.id} />
              </div>
            </details>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-base font-bold">Add a rule</h2>
        <div className="card p-4">
          <RuleForm challengeId={c.id} nextSortOrder={(list.at(-1)?.sort_order ?? 0) + 1} />
        </div>
      </div>
    </div>
  );
}
