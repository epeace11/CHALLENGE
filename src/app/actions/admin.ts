"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./auth";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createChallenge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const payload = {
    name: str(formData, "name"),
    start_date: str(formData, "start_date"),
    end_date: str(formData, "end_date"),
    timezone: str(formData, "timezone") || "America/Toronto",
    log_deadline_time: str(formData, "log_deadline_time") || "12:00",
    dispute_window_hours: Number(str(formData, "dispute_window_hours") || 48),
    unlogged_policy: str(formData, "unlogged_policy") || "all_missed",
  };
  if (!payload.name || !payload.start_date || !payload.end_date) return { error: "Name, start and end dates are required." };
  const { data, error } = await supabase.from("challenges").insert(payload).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin");
  redirect(`/admin/${data.id}`);
}

export async function updateChallenge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(formData, "id");
  const payload = {
    name: str(formData, "name"),
    start_date: str(formData, "start_date"),
    end_date: str(formData, "end_date"),
    timezone: str(formData, "timezone") || "America/Toronto",
    log_deadline_time: str(formData, "log_deadline_time") || "12:00",
    dispute_window_hours: Number(str(formData, "dispute_window_hours") || 48),
    unlogged_policy: str(formData, "unlogged_policy") || "all_missed",
  };
  const { error } = await supabase.from("challenges").update(payload).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
  revalidatePath("/");
  return {};
}

export async function saveRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const id = str(formData, "id");
  const challengeId = str(formData, "challenge_id");
  const cadence = str(formData, "cadence") === "weekly" ? "weekly" : "daily";
  const activeDays = formData.getAll("active_days").map(Number).filter((n) => n >= 0 && n <= 6);
  const payload = {
    challenge_id: challengeId,
    sort_order: Number(str(formData, "sort_order") || 0),
    title: str(formData, "title"),
    description: str(formData, "description"),
    cadence,
    applies_to: str(formData, "applies_to") || "both",
    active_days: cadence === "daily" ? (activeDays.length ? activeDays : [0, 1, 2, 3, 4, 5, 6]) : [0, 1, 2, 3, 4, 5, 6],
    weekly_target: cadence === "weekly" ? Number(str(formData, "weekly_target") || 1) : null,
    proof_required: formData.get("proof_required") === "on",
  };
  if (!payload.title) return { error: "A title is required." };
  const query = id
    ? supabase.from("rules").update(payload).eq("id", id)
    : supabase.from("rules").insert(payload);
  const { error } = await query;
  if (error) return { error: error.message };
  revalidatePath(`/admin/${challengeId}`);
  revalidatePath("/");
  return {};
}

export async function deleteRule(ruleId: string, challengeId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("rules").delete().eq("id", ruleId);
  revalidatePath(`/admin/${challengeId}`);
  revalidatePath("/");
}
