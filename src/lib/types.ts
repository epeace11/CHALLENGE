export type UserSlug = "erin" | "kazzy";
export type RuleCadence = "daily" | "weekly";
export type RuleAppliesTo = "both" | UserSlug;
export type EntryStatus = "pending" | "confirmed" | "disputed" | "conceded" | "excused";
export type PointReason = "missed" | "unlogged" | "weekly_shortfall" | "dispute_conceded";
export type RequestStatus = "pending" | "approved" | "denied";
export type DisputeStatus = "open" | "conceded" | "withdrawn";
export type UnloggedPolicy = "all_missed" | "flat_one";

export interface Profile {
  id: string;
  slug: UserSlug;
  display_name: string;
}

export interface Challenge {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  timezone: string;
  log_deadline_time: string; // HH:MM[:SS]
  dispute_window_hours: number;
  unlogged_policy: UnloggedPolicy;
  created_at: string;
}

export interface Rule {
  id: string;
  challenge_id: string;
  sort_order: number;
  title: string;
  description: string;
  cadence: RuleCadence;
  applies_to: RuleAppliesTo;
  active_days: number[];
  weekly_target: number | null;
  proof_required: boolean;
}

export interface Entry {
  id: string;
  user_id: string;
  rule_id: string;
  date: string;
  done: boolean | null;
  note: string | null;
  status: EntryStatus;
  unlogged: boolean;
  reopen_until: string | null;
  logged_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  entry_id: string;
  storage_path: string;
  taken_at: string | null;
  uploaded_at: string;
}

export interface Point {
  id: string;
  user_id: string;
  challenge_id: string;
  rule_id: string;
  date: string;
  reason: PointReason;
  forgiven: boolean;
  entry_id: string | null;
  created_at: string;
}

export interface ForgivenessRequest {
  id: string;
  point_id: string;
  requester_id: string;
  reason: string;
  status: RequestStatus;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  entry_id: string;
  raised_by: string;
  comment: string;
  status: DisputeStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface WeeklyAssessment {
  id: string;
  user_id: string;
  rule_id: string;
  period_end: string;
  done_count: number;
  shortfall: number;
  assessed_at: string;
}

export interface PhotoWithUrl extends Photo {
  url: string | null;
}

export interface EntryWithPhotos extends Entry {
  photos: PhotoWithUrl[];
}
