import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { compress } from '@/lib/proof';
import type { Command, SetupDraft, Template } from '@/components/next/backend';
import type { Challenge, Rule } from '@/lib/next/model';
import { BLANK_NAME } from '@/lib/next/catalog';
import type {
  ChallengeRow,
  ProofUrls,
  Rows,
  SavedRow,
  SharedRow,
} from './world';

/**
 * Every database call the live app makes (supabase/next/schema.sql). Browser only. Each function
 * throws the database's own message on failure; components/live/ shows it.
 */

export const PROOF_BUCKET = 'proofs';

async function rpc<T = unknown>(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Rows per request: Supabase returns at most 1,000 by default. */
const PAGE = 1000;

/** Every row of `table` the account can read, a page at a time in `order`, so none is cut off. */
async function select<T>(table: string, columns = '*', order = 'id') {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

/* ── Loading ───────────────────────────────────────────────────────────── */

/**
 * The signed-in account, or null when signed out. When the auth server can't be reached (no
 * signal), supabase-js answers "no user" with a retryable error: that throws, so losing signal is a
 * failed load (what's on screen stays and it tries again), never signing out.
 */
async function currentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (isAuthRetryableFetchError(error)) throw new Error(error.message);
  return user;
}

/**
 * Everything the signed-in person can read, after running the deadlines for their running
 * challenges. Null when signed out, or when the account has no profile yet (it needs a first name).
 */
export async function loadRows(): Promise<Rows | null> {
  const user = await currentUser();
  if (!user) return null;
  const challenges = await select<ChallengeRow>('challenges');
  // One that can't run its deadlines now shouldn't stop the others loading.
  await Promise.allSettled(
    challenges
      .filter((c) => c.status === 'running')
      .map((c) => rpc('nx_sync', { p_challenge: c.id })),
  );
  const [
    profiles,
    members,
    fresh,
    rules,
    entries,
    points,
    requests,
    disputes,
    notes,
    signatures,
    invites,
    saved,
    gifts,
    hidden,
    hiddenSaved,
    timers,
    sessions,
    goals,
  ] = await Promise.all([
    select<Rows['members'][number]>('profiles', 'id,name,hue'),
    select<{ couple_id: string; person_id: string; joined_at: string }>(
      'couple_members',
      '*',
      'person_id',
    ),
    select<ChallengeRow>('challenges'),
    select<Rows['rules'][number]>('rules'),
    select<Rows['entries'][number]>('entries'),
    select<Rows['points'][number]>('points'),
    select<Rows['requests'][number]>('forgiveness_requests'),
    select<Rows['disputes'][number]>('disputes'),
    select<Rows['notes'][number]>('journal_notes'),
    select<Rows['signatures'][number]>('signatures', '*', 'challenge_id'),
    select<Rows['invites'][number]>(
      'invites',
      'id,challenge_id,from_id,to_name,to_email,code,sent_at,opened_at,accepted_at,expires_at',
    ),
    select<SavedRow>('saved_challenges'),
    // Added by supabase/next/gifts-given.sql: until that has run, no gift is marked.
    select<Rows['gifts'][number]>('gifts_given', '*', 'challenge_id').catch(
      () => [],
    ),
    // Only the viewer's own.
    select<Rows['hidden'][number]>(
      'hidden_challenges',
      'challenge_id,status',
      'challenge_id',
    ),
    select<Rows['hiddenSaved'][number]>(
      'hidden_saved',
      'saved_id,status',
      'saved_id',
    ),
    // Added by supabase/next/timer.sql: until that has run, nobody has timed anything.
    select<Rows['timers'][number]>('timer_runs', '*', 'person_id').catch(
      () => [],
    ),
    select<Rows['sessions'][number]>('timer_sessions').catch(() => []),
    // Added by supabase/next/goals.sql: until that has run, nobody has goals.
    select<Rows['goals'][number]>('goals').catch(() => []),
  ]);
  const me = profiles.find((p) => p.id === user.id);
  if (!me) return null;
  // Everyone in this person's couples: they can have several partners.
  const mine = new Set(
    members.filter((m) => m.person_id === user.id).map((m) => m.couple_id),
  );
  const inCouple = new Set(
    members.filter((m) => mine.has(m.couple_id)).map((m) => m.person_id),
  );
  return {
    me: { ...me, email: user.email ?? '' },
    couples: members.filter((m) => mine.has(m.couple_id)),
    hidden,
    hiddenSaved,
    members: profiles.filter((p) => inCouple.has(p.id) || p.id === me.id),
    challenges: fresh.filter((c) => mine.has(c.couple_id)),
    rules,
    entries,
    points,
    requests,
    disputes,
    notes,
    signatures,
    invites,
    saved,
    gifts,
    timers,
    sessions,
    goals,
  };
}

/** How long a signed screenshot URL works, in seconds. */
const SIGNED_FOR = 3600;
/** A URL this close to expiring is signed again on the next load. */
const RENEW_WITHIN = 10 * 60e3;
/**
 * Signed URLs by storage path, kept across loads: a screenshot keeps the same URL, so its thumbnail
 * isn't downloaded again (and doesn't flash) every time the rows reload.
 */
const signed = new Map<string, { url: string; until: number }>();

/**
 * Signed URLs for every screenshot in `rows`. Only paths that are new, or whose URL expires within
 * 10 minutes, are signed; the rest come from `signed`. Never throws: a path it couldn't sign shows
 * no image until a later load signs it.
 */
export async function proofUrls(rows: Rows): Promise<ProofUrls> {
  const paths = new Set<string>();
  for (const e of rows.entries)
    for (const p of [...(e.proofs ?? []), ...(e.correction_proofs ?? [])])
      paths.add(p.path);
  const now = Date.now();
  const stale = [...paths].filter(
    (p) => (signed.get(p)?.until ?? 0) - now < RENEW_WITHIN,
  );
  if (stale.length) {
    const { data } = await supabase.storage
      .from(PROOF_BUCKET)
      .createSignedUrls(stale, SIGNED_FOR)
      .catch(() => ({ data: null }));
    for (const d of data ?? [])
      if (d.path && d.signedUrl)
        signed.set(d.path, { url: d.signedUrl, until: now + SIGNED_FOR * 1e3 });
  }
  const out: ProofUrls = {};
  for (const p of paths) {
    const s = signed.get(p);
    if (s && s.until > now) out[p] = s.url;
  }
  return out;
}

/* ── Accounts ──────────────────────────────────────────────────────────── */

export const setName = (name: string) => rpc('nx_set_name', { p_name: name });

/** Makes the profile from the name given at sign-up, the first time someone signs in. */
export async function ensureProfile() {
  const user = await currentUser();
  if (!user) return;
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (data) return;
  const name =
    (user.user_metadata?.name as string | undefined)?.trim() ||
    (user.email ?? 'You').split('@')[0];
  await setName(name.slice(0, 40));
}

/**
 * Where links in sign-up and sign-in emails lead: the app, carrying the invite or shared link the
 * person opened, so it survives opening the email in another tab or browser.
 */
type Opened = { invite: string | null; shared: string | null };
const redirect = ({ invite, shared }: Opened) => {
  const params = new URLSearchParams();
  if (invite) params.set('invite', invite);
  if (shared) params.set('shared', shared);
  const query = params.toString();
  return `${location.origin}/app${query ? `?${query}` : ''}`;
};

export async function signUp(
  a: { name: string; email: string; password: string },
  opened: Opened,
) {
  const { data, error } = await supabase.auth.signUp({
    email: a.email,
    password: a.password,
    options: { data: { name: a.name }, emailRedirectTo: redirect(opened) },
  });
  if (error) throw new Error(error.message);
  return data.session ? ('in' as const) : ('confirm' as const);
}

export async function signIn(a: { email: string; password: string }) {
  const { error } = await supabase.auth.signInWithPassword(a);
  if (error) throw new Error(error.message);
}

export async function sendLink(
  a: { email: string; name?: string },
  opened: Opened,
) {
  const { error } = await supabase.auth.signInWithOtp({
    email: a.email,
    options: {
      emailRedirectTo: redirect(opened),
      ...(a.name ? { data: { name: a.name } } : {}),
    },
  });
  if (error) throw new Error(error.message);
}

/** Signs in with the code from a sign-in email, or from the email that confirms a new account. */
export async function verifyCode(a: { email: string; code: string }) {
  const signIn = await supabase.auth.verifyOtp({
    email: a.email,
    token: a.code,
    type: 'email',
  });
  if (!signIn.error) return;
  const confirm = await supabase.auth.verifyOtp({
    email: a.email,
    token: a.code,
    type: 'signup',
  });
  if (confirm.error) throw new Error(signIn.error.message);
}

/**
 * Emails a password reset: a six-digit code (the Reset password template needs {{ .Token }}) and a
 * link back to /app?reset=1, which signs in and asks for the new password.
 */
export async function sendReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/app?reset=1`,
  });
  if (error) throw new Error(error.message);
}

/** Signs in with the code from the reset email and sets the new password. */
export async function resetPassword(a: {
  email: string;
  code: string;
  password: string;
}) {
  const { error } = await supabase.auth.verifyOtp({
    email: a.email,
    token: a.code,
    type: 'recovery',
  });
  if (error) throw new Error(error.message);
  await setPassword(a.password);
}

/** A new password for the signed-in account. */
export async function setPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export const signOut = () => supabase.auth.signOut();

/* ── Setting up ────────────────────────────────────────────────────────── */

/** A rule as the database takes it: `who` is 'both', 'me', 'partner', or a member's id. */
export function ruleInput(rule: Rule, meId: string) {
  return {
    title: rule.title,
    question: rule.question,
    description: rule.description,
    group: rule.group,
    kind: rule.kind,
    days: rule.days,
    ...(rule.weeklyTarget !== undefined
      ? { weeklyTarget: rule.weeklyTarget }
      : {}),
    ...(rule.target ? { target: rule.target } : {}),
    // Two people: a rule that isn't both's or the viewer's is the partner's, whoever that is now.
    who: rule.who === 'both' ? 'both' : rule.who === meId ? 'me' : 'partner',
    proof: rule.proof,
    ...(rule.startsOn ? { startsOn: rule.startsOn } : {}),
    ...(rule.endsOn ? { endsOn: rule.endsOn } : {}),
    ...(rule.personalTarget
      ? {
          personalTarget: true,
          ...(rule.limits ? { limits: rule.limits } : {}),
        }
      : {}),
    // The database keeps it only on a rule counted in minutes.
    ...(rule.timed ? { timed: true } : {}),
  };
}

/** What a template fills a new challenge with. */
export function templateFields(template: Template) {
  if (template.kind === 'theme') {
    const t = template.theme;
    return {
      name: t.name,
      look: t.look,
      theme: t.id,
      days: t.days,
      step: t.step,
      cap: null,
      rules: t.rules.filter((r) => !t.optionalRuleIds.includes(r.id)),
    };
  }
  if (template.kind === 'again') {
    const c = template.challenge;
    return {
      name: c.name,
      look: c.look,
      theme: c.theme,
      days: c.days,
      step: c.step,
      cap: c.cap,
      rules: c.rules.map((r) => {
        const { startsOn: _s, endsOn: _e, ...rest } = r;
        return rest;
      }),
    };
  }
  if (template.kind === 'saved') {
    const s = template.saved;
    return {
      name: s.name,
      look: s.look,
      theme: null,
      days: s.days,
      step: s.step,
      cap: s.cap,
      rules: s.rules,
    };
  }
  return {
    name: BLANK_NAME,
    look: 'classic' as const,
    theme: null,
    days: 30,
    step: 1,
    cap: null,
    rules: [] as Rule[],
  };
}

/**
 * A challenge in setup from `template`, starting `start`. Reuses `draftId` (a challenge still in
 * setup) instead of making another. Returns its id.
 */
export async function startChallenge(
  template: Template,
  start: string,
  timeZone: string,
  meId: string,
  draftId: string | null,
  /** The couple it's with, or 'new' for someone who isn't in the app with you yet. */
  couple?: string,
) {
  const f = templateFields(template);
  const rules = f.rules.map((r) => ruleInput(r, meId));
  if (draftId) {
    await rpc('nx_update_challenge', {
      p_challenge: draftId,
      p_name: f.name,
      p_look: f.look,
      p_days: f.days,
      p_step: f.step,
      p_cap: f.cap,
      p_clear_cap: f.cap === null,
      p_rules: rules,
    });
    return draftId;
  }
  return rpc<string>('nx_create_challenge', {
    p_name: f.name,
    p_look: f.look,
    p_theme: f.theme,
    p_start: start,
    p_days: f.days,
    p_time_zone: timeZone,
    p_step: f.step,
    p_cap: f.cap,
    p_rules: rules,
    ...(couple === 'new'
      ? { p_new_partner: true }
      : couple
        ? { p_couple: couple }
        : {}),
  });
}

/**
 * Saves Set up as it stands. Only what changed from `was` (the challenge as saved) is sent, because
 * any change to the terms clears both signatures: saving Set up again without changing anything keeps
 * them.
 */
export async function saveSetup(
  challengeId: string,
  d: SetupDraft,
  meId: string,
  was: Challenge | null,
) {
  const rules = d.rules.map((r) => ruleInput(r, meId));
  const same = <T>(a: T, b: T) =>
    !!was && JSON.stringify(a) === JSON.stringify(b);
  const changed = <T>(value: T, before: T | undefined) =>
    same(value, before) ? null : value;
  const capSame = !!was && was.cap === d.cap;
  await rpc('nx_update_challenge', {
    p_challenge: challengeId,
    p_name: d.name,
    p_start: changed(d.start, was?.start),
    p_days: changed(d.days, was?.days),
    p_time_zone: changed(d.timeZone, was?.timeZone),
    p_step: changed(d.step, was?.step),
    p_cap: capSame ? null : d.cap,
    p_clear_cap: !capSame && d.cap === null,
    p_deadline_days: changed(d.deadline.daysAfter, was?.deadline.daysAfter),
    p_deadline_time: changed(
      d.deadline.time.slice(0, 5),
      was?.deadline.time.slice(0, 5),
    ),
    p_rules: changed(
      rules,
      was?.rules.map((r) => ruleInput(r, meId)),
    ),
  });
}

/** Saves Set up and ends it: the viewer signs, and the partner is invited or asked to sign. */
export async function finishSetup(
  challengeId: string,
  d: SetupDraft,
  meId: string,
  was: Challenge | null,
) {
  await saveSetup(challengeId, d, meId, was);
  await rpc('nx_finish_setup', { p_challenge: challengeId });
}

/**
 * Cancels a challenge (supabase/next/cancel-challenge.sql): deleted before Day 1, ended now while it
 * runs. Says which.
 */
export async function cancelChallenge(challengeId: string) {
  const done = await rpc<'deleted' | 'erase' | 'ended'>('nx_cancel_challenge', {
    p_challenge: challengeId,
  });
  if (done !== 'erase') return done;
  await eraseChallenge(challengeId);
  return 'deleted' as const;
}

/** Asks to end a challenge, or answers the ask. Agreeing can leave screenshots to erase. */
async function endRequest(challengeId: string, action: string) {
  const done = await rpc<string>('nx_end_request', {
    p_challenge: challengeId,
    p_action: action,
  });
  if (done === 'erase') await eraseChallenge(challengeId);
}

/* ── Invites ───────────────────────────────────────────────────────────── */

export async function createInvite(challengeId: string, toName: string) {
  const rows = await rpc<{ token: string; code: string }[]>(
    'nx_create_invite',
    { p_challenge: challengeId, p_to_name: toName, p_to_email: '' },
  );
  return rows[0];
}

export type InvitePreview = {
  from: { id: string; name: string; hue: number };
  toName: string;
  challenge: ChallengeRow;
  rules: Rows['rules'];
};

/** What an invite link shows before its partner has an account. Null when it expired. */
export const invitePreview = (token: string) =>
  rpc<InvitePreview | null>('nx_invite_preview', { p_token: token });

export const acceptInvite = (token: string) =>
  rpc<string>('nx_accept_invite', { p_token: token });

/* ── Share links ───────────────────────────────────────────────────────── */

/** A saved challenge another couple shared, while its link is on; null once it is off. */
export const sharedPreview = (token: string) =>
  rpc<SharedRow | null>('nx_shared_preview', { p_token: token });

/** Saves a copy of a shared challenge to this account's saved challenges. */
export const saveShared = (token: string) =>
  rpc<string>('nx_save_shared', { p_token: token });

/* ── Screenshots ───────────────────────────────────────────────────────── */

/**
 * Deletes a challenge from this person's account. Once neither person has it, it's erased.
 */
async function deleteChallenge(challengeId: string) {
  const gone = await rpc<boolean>('nx_delete_challenge', {
    p_challenge: challengeId,
  });
  if (gone) await eraseChallenge(challengeId);
}

/** The names in a screenshot folder, a page at a time. */
async function filesIn(folder: string) {
  const names: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(PROOF_BUCKET)
      .list(folder, { limit: PAGE, offset });
    if (error) throw new Error(error.message);
    names.push(...(data ?? []).map((f) => f.name));
    if (!data || data.length < PAGE) return names;
  }
}

/**
 * Erases a challenge both people have deleted. Its screenshots go first, while they can still be
 * found: everything in <challenge>/<person>/, so one that was replaced or never saved goes too.
 */
async function eraseChallenge(challengeId: string) {
  const people = await filesIn(challengeId);
  const files = await Promise.all(
    people.map(async (person) => {
      const folder = `${challengeId}/${person}`;
      return (await filesIn(folder)).map((name) => `${folder}/${name}`);
    }),
  );
  const paths = files.flat();
  for (let from = 0; from < paths.length; from += PAGE) {
    const { error } = await supabase.storage
      .from(PROOF_BUCKET)
      .remove(paths.slice(from, from + PAGE));
    if (error) throw new Error(error.message);
  }
  await rpc('nx_erase_challenge', { p_challenge: challengeId });
}

/**
 * A random UUID for a file name. Not crypto.randomUUID(): older iPhones and pages that aren't https
 * don't have it, and a screenshot failed to upload there. getRandomValues works everywhere.
 */
function randomId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Compresses and uploads one screenshot into the challenge's folder. Returns its path and when it was taken. */
export async function uploadProof(
  challengeId: string,
  userId: string,
  file: File,
) {
  // The EXIF reader loads only when a screenshot is added, not with the app.
  const exif = await import('exifr')
    .then(({ parse }) => parse(file, ['DateTimeOriginal']))
    .catch(() => null);
  const takenAt =
    exif?.DateTimeOriginal instanceof Date
      ? exif.DateTimeOriginal.toISOString()
      : undefined;
  const blob = await compress(file);
  const path = `${challengeId}/${userId}/${randomId()}.jpg`;
  const { error } = await supabase.storage
    .from(PROOF_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return { path, takenAt, blob };
}

/* ── Playing ───────────────────────────────────────────────────────────── */

/** Sends one command from a page to the database. */
export function send(challengeId: string, c: Command) {
  switch (c.type) {
    case 'saveCheckin':
      return rpc('nx_save_checkin', {
        p_challenge: challengeId,
        p_rule: c.input.ruleId,
        p_day: c.input.day,
        p_done: c.input.done ?? null,
        p_value: c.input.value ?? null,
        p_note: c.input.note ?? '',
        p_proofs: (c.input.proofs ?? []).map((p) => ({
          path: p.id,
          takenAt: p.takenAt ?? null,
        })),
        p_forgiveness: c.input.forgiveness ?? null,
      });
    case 'approve':
      return rpc('nx_review', { p_entry: c.entryId, p_action: 'approve' });
    case 'rejectCorrection':
      return rpc('nx_review', { p_entry: c.entryId, p_action: 'reject' });
    case 'dispute':
      return rpc('nx_review', {
        p_entry: c.entryId,
        p_action: 'dispute',
        p_comment: c.comment,
      });
    case 'concede':
      return rpc('nx_resolve_dispute', {
        p_dispute: c.disputeId,
        p_action: 'concede',
      });
    case 'withdrawDispute':
      return rpc('nx_resolve_dispute', {
        p_dispute: c.disputeId,
        p_action: 'withdraw',
      });
    case 'replyToDispute':
      return rpc('nx_resolve_dispute', {
        p_dispute: c.disputeId,
        p_action: 'reply',
        p_text: c.reply,
      });
    case 'askForgiveness':
      return rpc('nx_ask_forgiveness', {
        p_point: c.pointId,
        p_reason: c.reason,
      });
    case 'decideForgiveness':
      return rpc('nx_decide_forgiveness', {
        p_request: c.requestId,
        p_approve: c.decision === 'approved',
      });
    case 'forgivePoint':
      return rpc('nx_forgive_point', { p_point: c.pointId });
    case 'addNote':
      return rpc('nx_add_note', {
        p_challenge: challengeId,
        p_day: c.day,
        p_text: c.text,
      });
    case 'editNote':
      return rpc('nx_edit_note', { p_note: c.noteId, p_text: c.text });
    case 'removeNote':
      return rpc('nx_remove_note', { p_note: c.noteId });
    case 'signPact':
      return rpc('nx_sign_pact', {
        p_challenge: challengeId,
        ...(c.limits ? { p_limits: c.limits } : {}),
      });
    case 'askToEnd':
    case 'withdrawEnd':
    case 'declineEnd':
      return endRequest(
        challengeId,
        { askToEnd: 'ask', withdrawEnd: 'withdraw', declineEnd: 'decline' }[
          c.type
        ],
      );
    case 'rename':
      return setName(c.name);
    case 'renameChallenge':
      return rpc('nx_update_challenge', {
        p_challenge: challengeId,
        p_name: c.name,
      });
    case 'hideChallenge':
      return rpc('nx_hide_challenge', {
        p_challenge: c.challengeId,
        p_hidden: c.hidden,
      });
    case 'deleteChallenge':
      return deleteChallenge(c.challengeId);
    case 'hideSaved':
      return rpc('nx_hide_saved', { p_saved: c.savedId, p_hidden: c.hidden });
    case 'deleteSaved':
      return rpc('nx_delete_saved', { p_saved: c.savedId });
    case 'setShareLink':
      return rpc('nx_set_share_link', { p_saved: c.savedId, p_on: c.on });
    case 'markGift':
      return rpc('nx_mark_gift', {
        p_challenge: c.challengeId,
        p_recipient: c.recipientId,
        p_given: c.given,
      });
    case 'saveAs':
      return rpc('nx_save_challenge', {
        p_challenge: c.challengeId,
        p_name: c.name,
      });
    // The database stamps the timer's times itself (supabase/next/timer.sql).
    case 'startTimer':
      return rpc('nx_timer', {
        p_challenge: challengeId,
        p_action: 'start',
        p_rule: c.ruleId,
      });
    case 'pauseTimer':
    case 'resumeTimer':
    case 'stopTimer':
      return rpc('nx_timer', {
        p_challenge: challengeId,
        p_action: {
          pauseTimer: 'pause',
          resumeTimer: 'resume',
          stopTimer: 'stop',
        }[c.type],
      });
    case 'removeSession':
      return rpc('nx_remove_session', { p_session: c.sessionId });
    case 'setTimed':
      return rpc('nx_set_timed', {
        p_challenge: challengeId,
        p_rule: c.ruleId,
        p_on: c.timed,
      });
    case 'setGoals':
      return rpc('nx_set_goals', {
        p_challenge: challengeId,
        p_goals: c.goals,
      });
  }
}

/** Calls `onChange` whenever a row this account can read changes (row-level security applies). */
export function subscribe(onChange: () => void) {
  const channel = supabase.channel('nx-live');
  for (const table of [
    'challenges',
    'rules',
    'signatures',
    'couple_members',
    'entries',
    'points',
    'forgiveness_requests',
    'disputes',
    'journal_notes',
    // timer.sql: the partner's timer starting and stopping, and sessions saved.
    'timer_runs',
    'timer_sessions',
    // goals.sql: the partner's goals as they change.
    'goals',
    // Not gifts_given: a project that hasn't run gifts-given.sql would fail the whole channel.
    // Gift marks are rare and show on the next reload.
  ])
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      onChange,
    );
  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/**
 * Calls `f` after sign-in, sign-out and token changes. Deferred: supabase-js holds its auth lock
 * while it runs the callback, so calling it from inside would wait forever.
 */
export const onAuthChange = (f: () => void) =>
  supabase.auth.onAuthStateChange(() => {
    setTimeout(f, 0);
  }).data.subscription;
