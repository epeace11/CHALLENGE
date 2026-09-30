import { supabase, action } from '@/lib/supabase';
import { toWeeks } from '@/lib/weeks';
import {
  JOURNAL_PAGE,
  startOf,
  type JournalCursor,
  type JournalWindow,
} from '@/lib/journal';
import type { Data, Journal } from '@/lib/types';

/**
 * Every read and write the app makes. Writes go through security-definer database
 * functions (supabase/setup.sql), which check membership, ownership and deadlines.
 */

const TABLES = [
  'challenge_profiles',
  'challenge_entries',
  'challenge_points',
  'challenge_requests',
  'challenge_disputes',
  'challenge_finalizations',
  'challenge_config',
  'challenge_weeks',
  'challenge_weekly_targets',
  'challenge_photos',
] as const;

const NOTES = 'challenge_journal_notes';
/** PostgREST filters for the notes at or after a window's start, and before it. */
const from = (w: JournalCursor) =>
  w.at === null
    ? `day.gte.${w.day}`
    : `day.gt.${w.day},and(day.eq.${w.day},created_at.gte."${w.at}")`;
const before = (w: JournalCursor) =>
  w.at === null
    ? `day.lt.${w.day}`
    : `day.lt.${w.day},and(day.eq.${w.day},created_at.lt."${w.at}")`;
/** Newest first, so a limit keeps the most recent notes. */
const newestFirst = () =>
  supabase
    .from(NOTES)
    .select('*')
    .order('day', { ascending: false })
    .order('created_at', { ascending: false });

/** The journal notes in window `w` (lib/journal.ts): the newest page before the first load, otherwise everything from the window's start. */
function loadNotes(w: JournalWindow) {
  if (w === null) return newestFirst().limit(JOURNAL_PAGE);
  if (w === 'all') return supabase.from(NOTES).select('*');
  return supabase.from(NOTES).select('*').or(from(w));
}

/**
 * Loads every challenge table, first running the scheduled deadline checks unless `sync` is false (a reload right after a write, which already ran them).
 * Journal notes load only inside `journal`, the window the app has scrolled back to; `window` is where it starts once this load lands.
 */
export async function loadChallenge(
  sync = true,
  journal: JournalWindow = 'all',
): Promise<{
  data: Data;
  finalized: boolean;
  window: JournalWindow;
}> {
  if (sync) await action('challenge_sync');
  const [results, journals] = await Promise.all([
    Promise.all(TABLES.map((t) => supabase.from(t).select('*'))),
    loadNotes(journal),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [
    profiles,
    entries,
    points,
    requests,
    disputes,
    finalizations,
    config,
    weeks,
    targets,
    photos,
  ] = results.map((r) => r.data ?? []);
  return {
    // Journals arrived after launch; until supabase/add-journal-notes.sql has run, the table is missing and the rest of the app still works.
    data: {
      profiles,
      entries,
      points,
      requests,
      disputes,
      finalizations,
      journals: journals.error ? [] : (journals.data ?? []),
      photos,
      weeks: toWeeks(weeks, targets),
    } as Data,
    finalized: config[0]?.finalized ?? false,
    window:
      journal === null
        ? journals.error
          ? 'all'
          : startOf(journals.data ?? [])
        : journal,
  };
}

/** The page of notes just before the window's start, newest first. */
export async function olderNotes(w: JournalCursor): Promise<Journal[]> {
  const { data, error } = await newestFirst().or(before(w)).limit(JOURNAL_PAGE);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Every note from `day` up to the window's start, so that whole day is loaded. */
export async function notesSince(
  day: string,
  w: JournalCursor,
): Promise<Journal[]> {
  const { data, error } = await supabase
    .from(NOTES)
    .select('*')
    .gte('day', day)
    .or(before(w));
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type ReviewAction =
  | 'approve'
  | 'reject_correction'
  | 'dispute'
  | 'withdraw'
  | 'concede';

export const api = {
  /** Saves (or late-corrects) one whole check-in: the answer, its note and screenshots, and with a No an optional forgiveness request, in one transaction. */
  checkin: (a: {
    rule: string;
    day: string;
    done: boolean;
    note: string;
    proof: string | null;
    forgive: string | null;
  }) =>
    action('challenge_checkin', {
      p_rule: a.rule,
      p_day: a.day,
      p_done: a.done,
      p_note: a.note,
      p_proof: a.proof,
      p_forgive: a.forgive,
    }),
  addPhoto: (path: string, takenAt: string | null) =>
    action('challenge_add_photo', { p_path: path, p_taken_at: takenAt }),
  /** Partner review of an entry. */
  review: (entry: string, act: ReviewAction, comment?: string) =>
    action('challenge_review', {
      p_entry: entry,
      p_action: act,
      ...(comment === undefined ? {} : { p_comment: comment }),
    }),
  /** Asks the partner to forgive one of your points. */
  requestForgiveness: (point: string, reason: string) =>
    action('challenge_forgive', { p_point: point, p_reason: reason }),
  /** Decides the partner's forgiveness request. */
  decide: (request: string, approve: boolean) =>
    action('challenge_decide', { p_request: request, p_approve: approve }),
  /** Forgives (or un-forgives) one of the partner's points directly. */
  partnerForgive: (point: string, forgive: boolean) =>
    action('challenge_partner_forgive', {
      p_point: point,
      p_forgive: forgive,
    }),
  finalize: () => action('challenge_finalize'),
  /** Adds one more note to `day`; returns its id. Earlier notes are never touched. */
  addNote: (day: string, text: string) =>
    action('challenge_journal_add', {
      p_day: day,
      p_text: text,
    }) as Promise<string>,
  editNote: (id: string, text: string) =>
    action('challenge_journal_edit', { p_id: id, p_text: text }),
  deleteNote: (id: string) => action('challenge_journal_delete', { p_id: id }),
  /** Registers this device for the evening push reminders (or refreshes its keys). */
  pushSubscribe: (endpoint: string, p256dh: string, auth: string) =>
    action('challenge_push_subscribe', {
      p_endpoint: endpoint,
      p_p256dh: p256dh,
      p_auth: auth,
    }),
  pushUnsubscribe: (endpoint: string) =>
    action('challenge_push_unsubscribe', { p_endpoint: endpoint }),
};
