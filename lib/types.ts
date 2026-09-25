import type { Person } from './rules.ts';
import type { Week } from './weeks.ts';

/** Rows as the challenge tables return them. */
export type Profile = { id: string; name: Person };

export type Entry = {
  id: string;
  user_id: string;
  rule_id: string;
  day: string;
  done: boolean;
  /** 'pending' | 'confirmed' | 'disputed' | 'missed' | 'excused' | 'conceded' | 'unlogged' */
  status: string;
  note: string;
  /** Newline-separated storage paths; see proofPaths. */
  proof: string | null;
  /** A late correction waiting for the partner; null when there is none. */
  proposed_done: boolean | null;
  proposed_note: string | null;
  proposed_proof: string | null;
  updated_at: string;
};

/** A penalty point. Forgiven and voided points stay for history but cost nothing. */
export type Point = {
  id: string;
  user_id: string;
  rule_id: string;
  day: string;
  reason: string;
  forgiven: boolean;
  voided: boolean;
  entry_id: string | null;
  created_at: string;
};

/** A forgiveness request. */
export type Request = {
  id: string;
  point_id: string;
  requester_id: string;
  reason: string;
  /** 'pending' | 'approved' | 'denied' */
  status: string;
};

export type Dispute = {
  id: string;
  entry_id: string;
  raised_by: string;
  comment: string;
  status: string;
};

export type Journal = {
  id: string;
  user_id: string;
  day: string;
  text: string;
  created_at: string;
};

/** Everything the app loads, refreshed as a whole. */
export type Data = {
  profiles: Profile[];
  entries: Entry[];
  points: Point[];
  requests: Request[];
  disputes: Dispute[];
  finalizations: { user_id: string }[];
  journals: Journal[];
  weeks: Week[];
};

export const emptyData: Data = {
  profiles: [],
  entries: [],
  points: [],
  requests: [],
  disputes: [],
  finalizations: [],
  journals: [],
  weeks: [],
};
