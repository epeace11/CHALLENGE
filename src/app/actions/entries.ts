"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "@/lib/data";
import type { Entry, Photo } from "@/lib/types";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): Result<never> {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
  return { ok: false, error: message };
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/entry/[id]", "page");
}

export async function saveEntry(input: { ruleId: string; date: string; done: boolean; note: string }): Promise<Result<Entry>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_entry", {
    p_rule_id: input.ruleId, p_date: input.date, p_done: input.done, p_note: input.note ?? "",
  });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: data as Entry };
}

export async function attachPhoto(input: { ruleId: string; date: string; storagePath: string; takenAt: string | null }): Promise<Result<Photo>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_photo", {
    p_rule_id: input.ruleId, p_date: input.date, p_storage_path: input.storagePath, p_taken_at: input.takenAt,
  });
  if (error) {
    // the DB rejected it: clean up the orphaned object
    await supabase.storage.from(PHOTO_BUCKET).remove([input.storagePath]);
    return fail(error);
  }
  refresh();
  return { ok: true, data: data as Photo };
}

export async function removePhoto(photoId: string): Promise<Result> {
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("remove_photo", { p_photo_id: photoId });
  if (error) return fail(error);
  if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path as string]);
  refresh();
  return { ok: true, data: undefined };
}

export async function approveEntry(entryId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_entry", { p_entry_id: entryId });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: undefined };
}

export async function disputeEntry(entryId: string, comment: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("dispute_entry", { p_entry_id: entryId, p_comment: comment });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: undefined };
}

export async function concedeDispute(disputeId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("concede_dispute", { p_dispute_id: disputeId });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: undefined };
}

export async function withdrawDispute(disputeId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_dispute", { p_dispute_id: disputeId });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: undefined };
}

export async function requestForgiveness(pointId: string, reason: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_forgiveness", { p_point_id: pointId, p_reason: reason });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: undefined };
}

export async function decideForgiveness(requestId: string, approve: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_forgiveness", { p_request_id: requestId, p_approve: approve });
  if (error) return fail(error);
  refresh();
  return { ok: true, data: undefined };
}
