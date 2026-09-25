import { supabase, action } from '@/lib/supabase';
import { toWeeks } from '@/lib/weeks';
import type { Data } from '@/lib/types';

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

/** Loads every challenge table, first running the scheduled deadline checks unless `sync` is false (a reload right after a write, which already ran them). */
export async function loadChallenge(sync = true): Promise<{
  data: Data;
  finalized: boolean;
}> {
  if (sync) await action('challenge_sync');
  const [results, journals] = await Promise.all([
    Promise.all(TABLES.map((t) => supabase.from(t).select('*'))),
    supabase.from('challenge_journal_notes').select('*').order('created_at'),
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
  };
}

export type ReviewAction =
  | 'approve'
  | 'reject_correction'
  | 'dispute'
  | 'withdraw'
  | 'concede';

export const api = {
  /** Saves (or late-corrects) one answer. */
  log: (a: {
    rule: string;
    day: string;
    done: boolean;
    note: string;
    proof: string | null;
  }) =>
    action('challenge_log', {
      p_rule: a.rule,
      p_day: a.day,
      p_done: a.done,
      p_note: a.note,
      p_proof: a.proof,
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
  addNote: (day: string, text: string) =>
    action('challenge_journal_add', { p_day: day, p_text: text }),
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
