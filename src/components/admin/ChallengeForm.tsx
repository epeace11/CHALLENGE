"use client";
import { useActionState } from "react";
import { createChallenge, updateChallenge } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/auth";
import type { Challenge } from "@/lib/types";

export function ChallengeForm({ challenge }: { challenge?: Challenge }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(challenge ? updateChallenge : createChallenge, {});
  return (
    <form action={action} className="card grid grid-cols-2 gap-3 p-4 text-sm">
      {challenge && <input type="hidden" name="id" value={challenge.id} />}
      <label className="col-span-2 font-medium">
        Name
        <input name="name" required defaultValue={challenge?.name ?? ""} placeholder="October Challenge" className="input mt-1" />
      </label>
      <label className="font-medium">
        Start
        <input name="start_date" type="date" required defaultValue={challenge?.start_date ?? ""} className="input mt-1" />
      </label>
      <label className="font-medium">
        End
        <input name="end_date" type="date" required defaultValue={challenge?.end_date ?? ""} className="input mt-1" />
      </label>
      <label className="font-medium">
        Log deadline (next day)
        <input name="log_deadline_time" type="time" defaultValue={(challenge?.log_deadline_time ?? "12:00").slice(0, 5)} className="input mt-1" />
      </label>
      <label className="font-medium">
        Dispute window (hours)
        <input name="dispute_window_hours" type="number" min={1} defaultValue={challenge?.dispute_window_hours ?? 48} className="input mt-1" />
      </label>
      <label className="font-medium">
        Timezone
        <input name="timezone" defaultValue={challenge?.timezone ?? "America/Toronto"} className="input mt-1" />
      </label>
      <label className="font-medium">
        Unlogged day policy
        <select name="unlogged_policy" defaultValue={challenge?.unlogged_policy ?? "all_missed"} className="input mt-1">
          <option value="all_missed">All rules count as missed</option>
          <option value="flat_one">One flat point</option>
        </select>
      </label>
      {state.error && <p className="col-span-2 text-bad">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary col-span-2">
        {pending ? "Saving…" : challenge ? "Save challenge" : "Create challenge"}
      </button>
    </form>
  );
}
