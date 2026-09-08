"use client";
import { useActionState, useState, useTransition } from "react";
import { deleteRule, saveRule } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/auth";
import type { Rule } from "@/lib/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RuleForm({ challengeId, rule, nextSortOrder }: { challengeId: string; rule?: Rule; nextSortOrder?: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRule, {});
  const [cadence, setCadence] = useState<"daily" | "weekly">(rule?.cadence ?? "daily");
  return (
    <form action={action} className="grid grid-cols-2 gap-3 text-sm">
      <input type="hidden" name="challenge_id" value={challengeId} />
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <label className="col-span-2 font-medium">
        Title
        <input name="title" required defaultValue={rule?.title ?? ""} className="input mt-1" />
      </label>
      <label className="col-span-2 font-medium">
        Description (shown in the log form)
        <textarea name="description" rows={2} defaultValue={rule?.description ?? ""} className="input mt-1" />
      </label>
      <label className="font-medium">
        Order
        <input name="sort_order" type="number" defaultValue={rule?.sort_order ?? nextSortOrder ?? 1} className="input mt-1" />
      </label>
      <label className="font-medium">
        Applies to
        <select name="applies_to" defaultValue={rule?.applies_to ?? "both"} className="input mt-1">
          <option value="both">Both</option>
          <option value="erin">Erin</option>
          <option value="kazzy">Kazzy</option>
        </select>
      </label>
      <label className="font-medium">
        Cadence
        <select name="cadence" value={cadence} onChange={(e) => setCadence(e.target.value as "daily" | "weekly")} className="input mt-1">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly target</option>
        </select>
      </label>
      {cadence === "weekly" ? (
        <label className="font-medium">
          Times per week
          <input name="weekly_target" type="number" min={1} max={7} defaultValue={rule?.weekly_target ?? 4} className="input mt-1" />
        </label>
      ) : (
        <fieldset className="col-span-2 font-medium">
          Active days
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs">
                <input type="checkbox" name="active_days" value={i} defaultChecked={(rule?.active_days ?? [0, 1, 2, 3, 4, 5, 6]).includes(i)} />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="col-span-2 flex items-center gap-2 font-medium">
        <input type="checkbox" name="proof_required" defaultChecked={rule?.proof_required ?? false} />
        Photo proof required to mark done
      </label>
      {state.error && <p className="col-span-2 text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary col-span-2">
        {pending ? "Saving…" : rule ? "Save rule" : "Add rule"}
      </button>
    </form>
  );
}

export function DeleteRuleButton({ ruleId, challengeId }: { ruleId: string; challengeId: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) {
    return (
      <button type="button" className="mt-3 text-xs text-bad underline" onClick={() => setConfirm(true)}>Delete this rule</button>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <span className="text-bad">Deletes all its entries and points too.</span>
      <button type="button" disabled={pending} className="btn btn-bad py-1 text-xs" onClick={() => start(() => deleteRule(ruleId, challengeId))}>Yes, delete</button>
      <button type="button" className="btn btn-ghost py-1 text-xs" onClick={() => setConfirm(false)}>Cancel</button>
    </div>
  );
}
