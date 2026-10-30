import { parse as parseExif } from 'exifr';
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
 * Everything the signed-in person can read, after running the deadlines for their running
 * challenges. Null when the account has no profile yet (it needs a first name).
 */
export async function loadRows(): Promise<Rows | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const challenges = await select<ChallengeRow>('challenges');
  await Promise.all(
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
  ]);
  const me = profiles.find((p) => p.id === user.id);
  if (!me) return null;
  // The couple this person joined most recently: their current partner (as the database chooses).
  const couple = members
    .filter((m) => m.person_id === user.id)
    .sort((a, b) => b.joined_at.localeCompare(a.joined_at))[0]?.couple_id;
  const inCouple = new Set(
    members.filter((m) => m.couple_id === couple).map((m) => m.person_id),
  );
  return {
    me: { ...me, email: user.email ?? '' },
    members: profiles.filter((p) => inCouple.has(p.id) || p.id === me.id),
    challenges: fresh.filter((c) => !couple || c.couple_id === couple),
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
  };
}

/** Signed URLs for every screenshot in `rows`, good for an hour. */
export async function proofUrls(rows: Rows): Promise<ProofUrls> {
  const paths = new Set<string>();
  for (const e of rows.entries)
    for (const p of [...(e.proofs ?? []), ...(e.correction_proofs ?? [])])
      paths.add(p.path);
  if (!paths.size) return {};
  const { data } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrls([...paths], 3600);
  const out: ProofUrls = {};
  for (const d of data ?? [])
    if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

/* ── Accounts ──────────────────────────────────────────────────────────── */

export const setName = (name: string) => rpc('nx_set_name', { p_name: name });

/** Makes the profile from the name given at sign-up, the first time someone signs in. */
export async function ensureProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
export function ruleInput(rule: Rule, meId: string, partnerId: string) {
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
    who:
      rule.who === 'both'
        ? 'both'
        : rule.who === meId
          ? 'me'
          : rule.who === partnerId
            ? 'partner'
            : rule.who,
    proof: rule.proof,
    ...(rule.startsOn ? { startsOn: rule.startsOn } : {}),
    ...(rule.endsOn ? { endsOn: rule.endsOn } : {}),
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
  partnerId: string,
  draftId: string | null,
) {
  const f = templateFields(template);
  const rules = f.rules.map((r) => ruleInput(r, meId, partnerId));
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
  partnerId: string,
  was: Challenge | null,
) {
  const rules = d.rules.map((r) => ruleInput(r, meId, partnerId));
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
      was?.rules.map((r) => ruleInput(r, meId, partnerId)),
    ),
  });
}

/** Saves Set up and ends it: the viewer signs, and the partner is invited or asked to sign. */
export async function finishSetup(
  challengeId: string,
  d: SetupDraft,
  meId: string,
  partnerId: string,
  was: Challenge | null,
) {
  await saveSetup(challengeId, d, meId, partnerId, was);
  await rpc('nx_finish_setup', { p_challenge: challengeId });
}

/**
 * Cancels a challenge (supabase/next/cancel-challenge.sql): deleted before Day 1, ended now while it
 * runs. Says which.
 */
export const cancelChallenge = (challengeId: string) =>
  rpc<'deleted' | 'ended'>('nx_cancel_challenge', { p_challenge: challengeId });

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

/** Compresses and uploads one screenshot into the challenge's folder. Returns its path and when it was taken. */
export async function uploadProof(
  challengeId: string,
  userId: string,
  file: File,
) {
  const exif = await parseExif(file, ['DateTimeOriginal']).catch(() => null);
  const takenAt =
    exif?.DateTimeOriginal instanceof Date
      ? exif.DateTimeOriginal.toISOString()
      : undefined;
  const blob = await compress(file);
  const path = `${challengeId}/${userId}/${crypto.randomUUID()}.jpg`;
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
      return rpc('nx_sign_pact', { p_challenge: challengeId });
    case 'askToEnd':
    case 'withdrawEnd':
    case 'declineEnd':
      return rpc('nx_end_request', {
        p_challenge: challengeId,
        p_action: {
          askToEnd: 'ask',
          withdrawEnd: 'withdraw',
          declineEnd: 'decline',
        }[c.type],
      });
    case 'rename':
      return setName(c.name);
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
