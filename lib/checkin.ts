import { closed } from './dates.ts';
import type { Rule } from './rules.ts';
import type { Data, Entry } from './types.ts';

/**
 * One check-in on the Log page: a Yes or No for one habit on one day, with an optional note, its
 * screenshots and, with a No, an optional forgiveness request. Edits stay in a draft until Save
 * sends the whole check-in at once (api.checkin → challenge_checkin).
 */

/** Storage paths of every screenshot on an answer: the proof column holds them newline-separated. */
export const proofPaths = (proof: string | null | undefined) =>
  proof ? proof.split('\n').filter(Boolean) : [];
export const joinProofs = (paths: string[]) =>
  paths.length ? paths.join('\n') : null;

export type Draft = {
  /** Yes (true), No (false), or nothing chosen yet (null). */
  done: boolean | null;
  note: string;
  /** Screenshot storage paths, in order. */
  proofs: string[];
  /** Send a forgiveness request with this No. */
  forgive: boolean;
  reason: string;
};

const blank: Draft = {
  done: null,
  note: '',
  proofs: [],
  forgive: false,
  reason: '',
};

/** What a check-in starts from: the saved answer, or the late correction waiting on it. A miss that was never logged starts with nothing chosen. */
export function savedDraft(e: Entry | undefined): Draft {
  if (!e) return blank;
  if (e.proposed_done !== null)
    return {
      ...blank,
      done: e.proposed_done,
      note: e.proposed_note ?? '',
      proofs: proofPaths(e.proposed_proof),
    };
  if (e.status === 'unlogged') return blank;
  return { ...blank, done: e.done, note: e.note, proofs: proofPaths(e.proof) };
}

/** Whether a No on this check-in can carry a new forgiveness request, or the one already sent. */
export type AskOption =
  | { kind: 'none' }
  | { kind: 'sent'; status: 'pending' | 'forgiven' }
  | { kind: 'ask'; again: boolean };

export function askOption(
  data: Data,
  e: Entry | undefined,
  rule: Rule,
  day: string,
  now: number,
): AskOption {
  // Weekly habits have no miss per day; their shortfall is counted when the week closes.
  if (rule.weekly) return { kind: 'none' };
  const point = e && data.points.find((p) => p.entry_id === e.id);
  if (point?.forgiven) return { kind: 'sent', status: 'forgiven' };
  const request =
    point && data.requests.find((r) => r.point_id === point.id)?.status;
  const live = !!point && !point.voided;
  if (live && request === 'pending') return { kind: 'sent', status: 'pending' };
  // Before the deadline a No always makes a miss. After it, only a miss that already counts (never logged, or an open No) can be forgiven; a late change to a Yes has none until it is approved.
  if (!closed(day, now) || live)
    return { kind: 'ask', again: live && request === 'denied' };
  return { kind: 'none' };
}

/** Why the draft cannot be saved yet, or null when it can. */
export function draftProblem(d: Draft, rule: Rule, ask: AskOption) {
  if (d.done === null) return 'Choose Yes or No first.';
  if (d.done && rule.proof && !d.proofs.length)
    return 'Attach a screenshot to save a Yes.';
  if (!d.done && d.forgive && ask.kind === 'ask' && !d.reason.trim())
    return 'Say why it should be forgiven, or untick the request.';
  return null;
}

/** Whether saving would send anything: the answer, note or screenshots differ, or a request is added. */
export const draftChanged = (d: Draft, saved: Draft, ask: AskOption) =>
  d.done !== saved.done ||
  d.note.trim() !== saved.note.trim() ||
  d.proofs.join('\n') !== saved.proofs.join('\n') ||
  (d.done === false && d.forgive && ask.kind === 'ask');

/** What Save sends. A request only goes with a No that can carry one; anything else in the draft is left behind. */
export function submission(d: Draft, ask: AskOption) {
  return {
    done: d.done === true,
    note: d.note.trim(),
    proof: joinProofs(d.proofs),
    forgive:
      d.done === false && d.forgive && ask.kind === 'ask'
        ? d.reason.trim()
        : null,
  };
}
