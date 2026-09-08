import "server-only";
import { DateTime } from "luxon";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/scoring";
import type {
  Challenge, Dispute, Entry, EntryWithPhotos, ForgivenessRequest, Photo, PhotoWithUrl, Point, Profile, Rule, WeeklyAssessment,
} from "@/lib/types";

import { PHOTO_BUCKET_NAME } from "@/lib/constants";
export const PHOTO_BUCKET = PHOTO_BUCKET_NAME;
const SIGNED_URL_TTL = 60 * 60;

export interface Session {
  me: Profile;
  partner: Profile;
  profiles: Profile[];
}

export async function requireSession(): Promise<Session> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profiles } = await supabase.from("profiles").select("*").order("slug");
  const me = (profiles as Profile[] | null)?.find((p) => p.id === user.id);
  if (!me) {
    throw new Error("Your account is not linked to a profile yet. Run supabase/seed.sql with your email.");
  }
  const partner = (profiles as Profile[]).find((p) => p.id !== user.id) ?? me;
  return { me, partner, profiles: profiles as Profile[] };
}

/** The challenge to show: the latest one that has started, else the next upcoming. */
export async function currentChallenge(preferredId?: string): Promise<Challenge | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").order("start_date", { ascending: false });
  const all = (data ?? []) as Challenge[];
  if (!all.length) return null;
  if (preferredId) {
    const hit = all.find((c) => c.id === preferredId);
    if (hit) return hit;
  }
  const started = all.find((c) => c.start_date <= todayIn(c.timezone));
  return started ?? all[all.length - 1];
}

export interface ChallengeData {
  challenge: Challenge;
  rules: Rule[];
  entries: EntryWithPhotos[];
  points: Point[];
  forgiveness: ForgivenessRequest[];
  disputes: Dispute[];
  assessments: WeeklyAssessment[];
}

export async function loadChallengeData(challenge: Challenge): Promise<ChallengeData> {
  const supabase = await createClient();
  const { data: rules } = await supabase.from("rules").select("*").eq("challenge_id", challenge.id).order("sort_order");
  const ruleIds = ((rules ?? []) as Rule[]).map((r) => r.id);
  if (!ruleIds.length) {
    return { challenge, rules: [], entries: [], points: [], forgiveness: [], disputes: [], assessments: [] };
  }

  const [entriesRes, pointsRes, assessRes] = await Promise.all([
    supabase.from("entries").select("*").in("rule_id", ruleIds).order("date"),
    supabase.from("points").select("*").eq("challenge_id", challenge.id).order("created_at"),
    supabase.from("weekly_assessments").select("*").in("rule_id", ruleIds),
  ]);
  const entries = (entriesRes.data ?? []) as Entry[];
  const points = (pointsRes.data ?? []) as Point[];
  const entryIds = entries.map((e) => e.id);
  const pointIds = points.map((p) => p.id);

  const [photosRes, disputesRes, forgivenessRes] = await Promise.all([
    entryIds.length ? supabase.from("photos").select("*").in("entry_id", entryIds).order("uploaded_at") : Promise.resolve({ data: [] }),
    entryIds.length ? supabase.from("disputes").select("*").in("entry_id", entryIds).order("created_at") : Promise.resolve({ data: [] }),
    pointIds.length ? supabase.from("forgiveness_requests").select("*").in("point_id", pointIds).order("created_at") : Promise.resolve({ data: [] }),
  ]);
  const photos = (photosRes.data ?? []) as Photo[];
  const photosWithUrls = await signPhotos(photos);
  const byEntry = new Map<string, PhotoWithUrl[]>();
  for (const p of photosWithUrls) {
    const list = byEntry.get(p.entry_id) ?? [];
    list.push(p);
    byEntry.set(p.entry_id, list);
  }

  return {
    challenge,
    rules: (rules ?? []) as Rule[],
    entries: entries.map((e) => ({ ...e, photos: byEntry.get(e.id) ?? [] })),
    points,
    forgiveness: (forgivenessRes.data ?? []) as ForgivenessRequest[],
    disputes: (disputesRes.data ?? []) as Dispute[],
    assessments: (assessRes.data ?? []) as WeeklyAssessment[],
  };
}

export async function signPhotos(photos: Photo[]): Promise<PhotoWithUrl[]> {
  if (!photos.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(photos.map((p) => p.storage_path), SIGNED_URL_TTL);
  const urlByPath = new Map<string, string>();
  for (const s of data ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  return photos.map((p) => ({ ...p, url: urlByPath.get(p.storage_path) ?? null }));
}

export function nowIn(tz: string): DateTime {
  return DateTime.now().setZone(tz);
}
