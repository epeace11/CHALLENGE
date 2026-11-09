import type {
  Challenge,
  ChallengeStatus,
  Dispute,
  Entry,
  ForgivenessRequest,
  Instant,
  Invite,
  JournalNote,
  Look,
  PastChallenge,
  Person,
  Point,
  Proof,
  Rule,
  RuleGroup,
  SavedChallenge,
  TimerRun,
  TimerSession,
  Verdict,
  Weekday,
  World,
} from '../next/model.ts';
import { BLANK_NAME, LIBRARY, THEMES } from '../next/catalog.ts';
import { dateIn, lastDay, lockTime, shift } from '../next/calendar.ts';
import { world as sample } from '../next/demo.ts';
import { practiceFor } from '../next/practice.ts';
import {
  activePoints,
  badges,
  calendar,
  challengeSummary,
  forgivenPoints,
  initialOf,
  owes,
  streaks,
} from '../next/selectors.ts';

/**
 * Builds the World the new pages read from the rows the database returns (supabase/next/schema.sql).
 * Plain TypeScript with no network, so tests/live.mjs can check it. The live app (components/live/)
 * loads the rows and passes them here; pages never know the difference.
 */

/* ── Rows, as PostgREST returns them ───────────────────────────────────── */

export type ProfileRow = { id: string; name: string; hue: number };
export type ChallengeRow = {
  id: string;
  couple_id: string;
  name: string;
  look: Look;
  theme: string | null;
  start_date: string;
  days: number;
  time_zone: string;
  deadline_days: number;
  deadline_time: string;
  step: number | string;
  cap: number | string | null;
  week_start: number;
  status: ChallengeStatus | 'draft' | 'invited' | 'signing';
  /** Absent on a project that hasn't run end-requests.sql. */
  end_asked_by?: string | null;
  end_asked_at?: string | null;
  created_by: string;
  created_at: string;
};
export type RuleRow = {
  id: string;
  challenge_id: string;
  position: number;
  title: string;
  question: string;
  description: string;
  rule_group: string;
  kind: Rule['kind'];
  days: number[];
  weekly_target: number | null;
  target_op: '>=' | '<=' | null;
  target_value: number | string | null;
  target_unit: string | null;
  who: string | null;
  for_invitee: boolean;
  proof: Rule['proof'];
  starts_on: string | null;
  ends_on: string | null;
  /** Each person sets their own target, kept in `limits` by person id (pact-limits.sql). */
  personal?: boolean;
  limits?: Record<string, number | string> | null;
  /** The timer is on for this rule (timer.sql). */
  timed?: boolean;
};
export type ProofRow = { path: string; takenAt?: string | null };
export type EntryRow = {
  id: string;
  challenge_id: string;
  person_id: string;
  rule_id: string;
  day: string;
  done: boolean | null;
  value: number | string | null;
  status: Entry['status'];
  note: string;
  proofs: ProofRow[];
  logged_at: string | null;
  correction_done: boolean | null;
  correction_value: number | string | null;
  correction_note: string | null;
  correction_proofs: ProofRow[] | null;
  correction_at: string | null;
  /** Saved by itself from the day's timer sessions (timer.sql). */
  from_timer?: boolean;
};
export type PointRow = {
  id: string;
  challenge_id: string;
  person_id: string;
  rule_id: string;
  day: string;
  reason: Point['reason'];
  entry_id: string | null;
  slot: number;
  forgiven: boolean;
  voided: boolean;
  created_at: string;
};
export type RequestRow = {
  id: string;
  challenge_id: string;
  point_id: string;
  from_id: string;
  reason: string;
  status: ForgivenessRequest['status'];
  created_at: string;
  decided_at: string | null;
};
export type DisputeRow = {
  id: string;
  challenge_id: string;
  entry_id: string;
  raised_by: string;
  comment: string;
  reply: string | null;
  status: Dispute['status'];
  created_at: string;
  resolved_at: string | null;
};
export type NoteRow = {
  id: string;
  challenge_id: string;
  person_id: string;
  day: string;
  text: string;
  created_at: string;
};
export type SignatureRow = {
  challenge_id: string;
  person_id: string;
  signed_at: string;
};
export type InviteRow = {
  id: string;
  challenge_id: string;
  from_id: string;
  to_name: string;
  to_email: string;
  code: string;
  sent_at: string;
  opened_at: string | null;
  accepted_at: string | null;
  expires_at: string;
};
export type SavedRow = {
  /** The challenge it was saved from (saved-copies.sql). */
  challenge_id?: string | null;
  id: string;
  couple_id: string;
  name: string;
  look: Look;
  days: number;
  step: number | string;
  cap: number | string | null;
  rules: SavedRule[];
  link_token: string;
  link_on: boolean;
  created_at: string;
  /** Whose 'me' the rules mean; null for saves from before this was recorded. */
  saved_by?: string | null;
};
/** A rule as nx_save_challenge stores it: `who` is 'both', 'me' (whoever saved it) or 'partner'. */
export type SavedRule = Omit<Rule, 'id' | 'who'> & { who: string };

/** A shared challenge as nx_shared_preview returns it: never who saved it. */
export type SharedRow = Pick<
  SavedRow,
  'id' | 'name' | 'look' | 'days' | 'step' | 'cap' | 'rules' | 'created_at'
>;

/** Everything one couple's account can read. */
export type Rows = {
  /** The signed-in person. */
  me: ProfileRow & { email: string };
  /** Who is in which couple: a person can have several partners. */
  couples: { couple_id: string; person_id: string; joined_at: string }[];
  /** What the viewer has hidden or deleted, only ever their own. */
  hidden: { challenge_id: string; status: 'hidden' | 'deleted' }[];
  hiddenSaved: { saved_id: string; status: 'hidden' | 'deleted' }[];
  /** Everyone in the viewer's couples, the viewer included (one before the invite is accepted). */
  members: ProfileRow[];
  challenges: ChallengeRow[];
  rules: RuleRow[];
  entries: EntryRow[];
  points: PointRow[];
  requests: RequestRow[];
  disputes: DisputeRow[];
  notes: NoteRow[];
  signatures: SignatureRow[];
  invites: InviteRow[];
  saved: SavedRow[];
  /** Gifts marked given, by who receives them (supabase/next/gifts-given.sql). */
  gifts: GiftRow[];
  /** Timers going and finished timer sessions, both people's (supabase/next/timer.sql). */
  timers: TimerRunRow[];
  sessions: TimerSessionRow[];
  /** Both people's goals for each challenge (supabase/next/goals.sql). */
  goals: GoalRow[];
};

/** One of a person's goals for a challenge, in their order (goals.sql). */
export type GoalRow = {
  id: string;
  challenge_id: string;
  person_id: string;
  position: number;
  text: string;
};

export type GiftRow = {
  challenge_id: string;
  recipient_id: string;
  given_at: string;
};

/** A timer started and not stopped yet, one per person per challenge (timer.sql). */
export type TimerRunRow = {
  challenge_id: string;
  person_id: string;
  rule_id: string;
  day: string;
  started_at: string;
  running_since: string | null;
  banked: number;
};

/** One stretch of timing, Start to Stop, without the pauses (timer.sql). */
export type TimerSessionRow = {
  id: string;
  challenge_id: string;
  person_id: string;
  rule_id: string;
  day: string;
  started_at: string;
  ended_at: string;
  seconds: number;
};

/** Where the app lives, for invite and share links. */
export type Links = { origin: string };

/** A screenshot's URL from its storage path (a signed URL, made by the loader). */
export type ProofUrls = Record<string, string>;

const num = (x: number | string | null) => (x === null ? null : Number(x));

/** The partner before anyone has accepted the invite. Its id never matches a real account. */
export const PENDING_PARTNER = 'pending-partner';

/* ── Pieces ────────────────────────────────────────────────────────────── */

export const personOf = (p: ProfileRow, email = ''): Person => ({
  id: p.id,
  name: p.name,
  initial: initialOf(p.name),
  email,
  hue: p.hue,
});

export function ruleOf(r: RuleRow, partnerId: string): Rule {
  return {
    id: r.id,
    title: r.title,
    question: r.question,
    description: r.description,
    group: r.rule_group as RuleGroup,
    kind: r.kind,
    days: [...r.days].sort((a, b) => a - b) as Weekday[],
    ...(r.weekly_target !== null ? { weeklyTarget: r.weekly_target } : {}),
    ...(r.target_op !== null
      ? {
          target: {
            op: r.target_op,
            value: Number(r.target_value),
            unit: r.target_unit ?? '',
          },
        }
      : {}),
    who: r.for_invitee ? partnerId : (r.who ?? 'both'),
    proof: r.proof,
    ...(r.starts_on ? { startsOn: r.starts_on } : {}),
    ...(r.ends_on ? { endsOn: r.ends_on } : {}),
    ...(r.personal
      ? {
          personalTarget: true,
          limits: Object.fromEntries(
            Object.entries(r.limits ?? {}).map(([id, v]) => [id, Number(v)]),
          ),
        }
      : {}),
    ...(r.timed ? { timed: true } : {}),
  };
}

/** What the pages call a challenge's status: before Day 1 everything is setting up. */
const statusOf = (s: ChallengeRow['status']): ChallengeStatus => s;

export function challengeOf(
  c: ChallengeRow,
  rules: RuleRow[],
  partnerId: string,
): Challenge {
  return {
    id: c.id,
    coupleId: c.couple_id,
    name: c.name,
    look: c.look,
    createdBy: c.created_by,
    theme: c.theme,
    start: c.start_date,
    days: c.days,
    timeZone: c.time_zone,
    deadline: {
      daysAfter: c.deadline_days,
      time: c.deadline_time.slice(0, 5),
    },
    step: Number(c.step),
    cap: num(c.cap),
    status: statusOf(c.status),
    rules: rules
      .filter((r) => r.challenge_id === c.id)
      .sort((a, b) => a.position - b.position)
      .map((r) => ruleOf(r, partnerId)),
    weekStart: c.week_start as Weekday,
    ...(c.end_asked_by && c.end_asked_at
      ? { endAsk: { by: c.end_asked_by, at: c.end_asked_at } }
      : {}),
  };
}

const proofsOf = (rows: ProofRow[] | null, urls: ProofUrls): Proof[] =>
  (rows ?? []).map((p, i) => ({
    id: p.path,
    src: urls[p.path] ?? '',
    alt: `Screenshot ${i + 1}`,
    ...(p.takenAt ? { takenAt: p.takenAt } : {}),
  }));

export function entryOf(e: EntryRow, urls: ProofUrls): Entry {
  return {
    id: e.id,
    personId: e.person_id,
    ruleId: e.rule_id,
    day: e.day,
    done: e.done,
    ...(e.value !== null ? { value: Number(e.value) } : {}),
    status: e.status,
    note: e.note,
    proofs: proofsOf(e.proofs, urls),
    ...(e.logged_at ? { loggedAt: e.logged_at } : {}),
    ...(e.correction_at
      ? {
          correction: {
            done: !!e.correction_done,
            ...(e.correction_value !== null
              ? { value: Number(e.correction_value) }
              : {}),
            note: e.correction_note ?? '',
            proofs: proofsOf(e.correction_proofs, urls),
            proposedAt: e.correction_at,
          },
        }
      : {}),
    ...(e.from_timer ? { fromTimer: true } : {}),
  };
}

export const pointOf = (p: PointRow): Point => ({
  id: p.id,
  personId: p.person_id,
  ruleId: p.rule_id,
  day: p.day,
  reason: p.reason,
  ...(p.entry_id ? { entryId: p.entry_id } : {}),
  forgiven: p.forgiven,
  voided: p.voided,
  createdAt: p.created_at,
});

export const requestOf = (r: RequestRow): ForgivenessRequest => ({
  id: r.id,
  pointId: r.point_id,
  from: r.from_id,
  reason: r.reason,
  status: r.status,
  createdAt: r.created_at,
  ...(r.decided_at ? { decidedAt: r.decided_at } : {}),
});

export const disputeOf = (d: DisputeRow): Dispute => ({
  id: d.id,
  entryId: d.entry_id,
  raisedBy: d.raised_by,
  comment: d.comment,
  ...(d.reply ? { reply: d.reply } : {}),
  status: d.status,
  createdAt: d.created_at,
  ...(d.resolved_at ? { resolvedAt: d.resolved_at } : {}),
});

export const noteOf = (n: NoteRow): JournalNote => ({
  id: n.id,
  personId: n.person_id,
  day: n.day,
  text: n.text,
  createdAt: n.created_at,
});

export const timerRunOf = (t: TimerRunRow): TimerRun => ({
  personId: t.person_id,
  ruleId: t.rule_id,
  day: t.day,
  startedAt: t.started_at,
  runningSince: t.running_since,
  banked: Number(t.banked),
});

export const sessionOf = (s: TimerSessionRow): TimerSession => ({
  id: s.id,
  personId: s.person_id,
  ruleId: s.rule_id,
  day: s.day,
  startedAt: s.started_at,
  endedAt: s.ended_at,
  seconds: Number(s.seconds),
});

/** A saved challenge's rules, with 'me' and 'partner' turned into the viewer's and partner's ids. */
export function savedOf(
  s: SavedRow,
  me: string,
  partner: string,
  links: Links,
): SavedChallenge {
  return {
    id: s.id,
    name: s.name,
    look: s.look,
    days: s.days,
    step: Number(s.step),
    cap: num(s.cap),
    rules: s.rules.map((r, i) => {
      // 'me' is whoever saved it: the partner's own rules stay theirs when the viewer starts it.
      const savedByPartner = !!s.saved_by && s.saved_by === partner;
      const mine = savedByPartner ? partner : me,
        theirs = savedByPartner ? me : partner;
      return {
        ...r,
        id: `${s.id}-${i}`,
        who: r.who === 'me' ? mine : r.who === 'partner' ? theirs : 'both',
      };
    }),
    source: 'mine',
    sharedBy: null,
    link: `${links.origin}/app?shared=${s.link_token}`,
    linkOn: s.link_on,
    savedOn: s.created_at.slice(0, 10),
  };
}

/* ── The world ─────────────────────────────────────────────────────────── */

/**
 * The challenge to show: `wanted`, else the newest running one, then one being set up, then the newest
 * finished one. Null when there are none. One this person has hidden or deleted is never on screen;
 * `all` is only for working out a past challenge's own numbers.
 */
export function currentChallenge(
  rows: Rows,
  wanted?: string | null,
  all = false,
) {
  const put = new Set(rows.hidden.map((h) => h.challenge_id));
  const list = rows.challenges
    .filter((c) => all || !put.has(c.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    list.find((c) => c.id === wanted) ??
    list.find((c) => c.status === 'running') ??
    // A draft the partner has only just started isn't where this person should land.
    list.find(
      (c) =>
        c.status !== 'finished' &&
        (c.status !== 'draft' || c.created_by === rows.me.id),
    ) ??
    list.find((c) => c.status === 'finished') ??
    list[0] ??
    null
  );
}

/** A blank challenge for an account that has none yet: today, 30 days, the viewer's time zone. */
export function blankChallenge(today: string, timeZone: string): Challenge {
  return {
    id: '',
    coupleId: '',
    name: BLANK_NAME,
    look: 'classic',
    theme: null,
    start: shift(today, 1),
    days: 30,
    timeZone,
    deadline: { daysAfter: 1, time: '23:59' },
    step: 1,
    cap: null,
    status: 'draft',
    rules: [],
    weekStart: 1,
  };
}

/** The final result of a finished challenge, worked out from its world. */
export function verdictFor(w: World): Verdict {
  const c = w.challenge,
    end = lastDay(c);
  const people = [w.me, w.partner].map((p) => {
    const best = streaks(w, p.id, end).sort((a, b) => b.best - a.best)[0];
    return {
      personId: p.id,
      points: activePoints(w, p.id).length,
      forgiven: forgivenPoints(w, p.id).length,
      owes: owes(w, p.id),
      gets: owes(w, w.me.id === p.id ? w.partner.id : w.me.id),
      bestStreak: { ruleId: best?.rule.id ?? '', days: best?.best ?? 0 },
      cleanDays: calendar(w, p.id).filter((d) => d.color === 'done').length,
      badges: badges(w, p.id)
        .filter((b) => b.earned)
        .map((b) => b.id),
    };
  });
  const [a, b] = people;
  return {
    challengeId: c.id,
    finishedOn: end,
    people,
    winner:
      a.points === b.points
        ? null
        : a.points < b.points
          ? a.personId
          : b.personId,
    openDisputes: w.disputes.filter((d) => d.status === 'open').length,
  };
}

/** Each load's finished challenges, worked out once (see buildWorld). */
const pastCache = new WeakMap<Rows, Map<string, PastChallenge>>();

export type Built = {
  world: World;
  /** The challenge row on screen, if any. */
  current: ChallengeRow | null;
  /** True once the partner has an account in the couple. */
  hasPartner: boolean;
  /** True once the viewer has signed the pact of the challenge on screen. */
  iSigned: boolean;
};

/**
 * The World for `rows`, showing `wanted` (or the current challenge). `now` is the clock, `timeZone`
 * the device's, for an account with no challenge yet.
 */
export function buildWorld(
  rows: Rows,
  now: Instant,
  timeZone: string,
  links: Links,
  urls: ProofUrls = {},
  wanted?: string | null,
  withPast = true,
): Built {
  const me = personOf(rows.me, rows.me.email);
  const current = currentChallenge(rows, wanted, !withPast);
  const hiddenStatus = (id: string) =>
    rows.hidden.find((h) => h.challenge_id === id)?.status;
  const statusOfSaved = (id: string) =>
    rows.hiddenSaved.find((h) => h.saved_id === id)?.status;
  // The partner is whoever shares this challenge's couple; with no challenge, the latest couple's.
  const couples = rows.couples
    .filter((m) => m.person_id === rows.me.id)
    .sort((a, b) => b.joined_at.localeCompare(a.joined_at));
  const coupleId = current?.couple_id ?? couples[0]?.couple_id;
  const partnerOfCouple = (id: string | undefined) =>
    rows.members.find(
      (p) =>
        p.id !== rows.me.id &&
        rows.couples.some((m) => m.couple_id === id && m.person_id === p.id),
    );
  const partnerRow = partnerOfCouple(coupleId);
  const savedPartner = (id: string) => {
    const row = partnerOfCouple(id);
    return row ? personOf(row) : undefined;
  };
  const invite = current
    ? rows.invites
        .filter((i) => i.challenge_id === current.id)
        .sort((a, b) => b.sent_at.localeCompare(a.sent_at))[0]
    : undefined;
  const partner: Person = partnerRow
    ? personOf(partnerRow)
    : {
        id: PENDING_PARTNER,
        name: invite?.to_name || 'your partner',
        initial: initialOf(invite?.to_name ?? ''),
        email: invite?.to_email ?? '',
        hue: (rows.me.hue + 180) % 360,
      };
  const challengeTz = current?.time_zone ?? timeZone;
  const today = dateIn(challengeTz, now);
  const challenge = current
    ? challengeOf(current, rows.rules, partner.id)
    : blankChallenge(today, timeZone);
  const mine = <T extends { challenge_id: string }>(list: T[]) =>
    list.filter((x) => x.challenge_id === challenge.id);
  const signatures = mine(rows.signatures);
  const iSigned = signatures.some((s) => s.person_id === me.id);
  const signedAt = (id: string) =>
    signatures.find((s) => s.person_id === id)?.signed_at ?? null;

  // Whoever set the challenge up invites the other.
  const inviterId = current?.created_by === partner.id ? partner.id : me.id;
  const liveInvite: Invite = {
    id: invite?.id ?? '',
    challengeId: challenge.id,
    from: inviterId,
    to: { name: partner.name, email: invite?.to_email ?? partner.email },
    link: '',
    code: invite?.code ?? '',
    sentAt: invite?.sent_at ?? current?.created_at ?? now,
    status: invite?.accepted_at
      ? 'accepted'
      : invite?.opened_at
        ? 'opened'
        : invite
          ? 'sent'
          : 'draft',
  };

  const base: World = {
    now,
    today,
    me,
    partner,
    couple: {
      id: coupleId ?? rows.saved[0]?.couple_id ?? '',
      people: [me, partner],
      since: today,
    },
    challenge,
    entries: mine(rows.entries).map((e) => entryOf(e, urls)),
    points: mine(rows.points).map(pointOf),
    requests: mine(rows.requests).map(requestOf),
    disputes: mine(rows.disputes).map(disputeOf),
    journal: mine(rows.notes).map(noteOf),
    saved: rows.saved
      .filter((s) => statusOfSaved(s.id) !== 'deleted')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((s) => ({
        // Its rules were saved with that couple's partner, who may not be the one on screen.
        ...savedOf(
          s,
          me.id,
          partnerOfCouple(s.couple_id)?.id ?? partner.id,
          links,
        ),
        coupleId: s.couple_id,
        ...(s.challenge_id ? { challengeId: s.challenge_id } : {}),
        ...(savedPartner(s.couple_id)
          ? { partner: savedPartner(s.couple_id) }
          : {}),
        hidden: statusOfSaved(s.id) === 'hidden',
      })),
    past: [],
    themes: THEMES,
    library: LIBRARY,
    invite: liveInvite,
    pact: {
      challengeId: challenge.id,
      terms: pactTerms(challenge),
      signatures: [
        { personId: me.id, signedAt: signedAt(me.id) },
        { personId: partner.id, signedAt: signedAt(partner.id) },
      ],
    },
    // From the couple's own rules; a part they can't play takes the sample's.
    practice: practiceFor(challenge, me.id, partner.id, sample.practice),
    sayRules: { sentence: '', rules: [], questions: [] },
    others: [],
    partners: couples.flatMap(({ couple_id }) => {
      const row = partnerOfCouple(couple_id);
      return row ? [{ coupleId: couple_id, person: personOf(row) }] : [];
    }),
    partnerPending: !partnerRow,
    // Empty on a project that hasn't run timer.sql (the loader reads none).
    timers: mine(rows.timers ?? []).map(timerRunOf),
    sessions: mine(rows.sessions ?? []).map(sessionOf),
    // Empty on a project that hasn't run goals.sql.
    goals: mine(rows.goals ?? [])
      .sort((a, b) => a.position - b.position)
      .map((g) => ({ id: g.id, personId: g.person_id, text: g.text })),
  };

  // Finished challenges, newest first, each with its verdict worked out from its own rows.
  const past: PastChallenge[] = withPast
    ? rows.challenges
        .filter(
          (c) => c.status === 'finished' && hiddenStatus(c.id) !== 'deleted',
        )
        .sort((a, b) => b.start_date.localeCompare(a.start_date))
        .map((row) => {
          // A finished challenge doesn't change with the clock: once per load is enough.
          const known = pastCache.get(rows) ?? new Map<string, PastChallenge>();
          pastCache.set(rows, known);
          const seen = known.get(row.id);
          if (seen) return seen;
          const w = buildWorld(
            rows,
            now,
            timeZone,
            links,
            urls,
            row.id,
            false,
          ).world;
          const verdict = verdictFor(w);
          const past: PastChallenge = {
            challenge: w.challenge,
            partner: w.partner,
            hidden: hiddenStatus(row.id) === 'hidden',
            verdict: {
              ...verdict,
              people: verdict.people.map((p) => {
                const given = (rows.gifts ?? []).find(
                  (g) =>
                    g.challenge_id === row.id && g.recipient_id === p.personId,
                );
                return given ? { ...p, giftGivenAt: given.given_at } : p;
              }),
            },
          };
          known.set(row.id, past);
          return past;
        })
    : [];
  // The viewer's other unfinished challenges, each seen from its own rows.
  const others = withPast
    ? rows.challenges
        .filter((c) => c.status !== 'finished' && c.id !== current?.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) =>
          challengeSummary(
            buildWorld(rows, now, timeZone, links, urls, row.id, false).world,
          ),
        )
    : [];
  return {
    world: { ...base, past, others },
    current,
    hasPartner: !!partnerRow,
    iSigned,
  };
}

/** What signing means, in plain sentences, for this challenge's deadline and step. */
export function pactTerms(c: Challenge) {
  const by =
    c.deadline.daysAfter === 0
      ? 'by the end of the day'
      : c.deadline.daysAfter === 1
        ? 'by 11:59 pm the next day'
        : `within ${c.deadline.daysAfter} days`;
  const money = (n: number) =>
    `$${(c.step * n).toFixed(c.step * n < 1 || c.step % 1 ? 2 : 0)}`;
  return [
    `We answer every check-in honestly, ${by}.`,
    'We review each other’s answers fairly, and say why when we dispute one.',
    `Each miss is a point. The first point costs ${money(1)}, the second ${money(2)}, and so on.`,
    'When it ends, each of us gives the other a gift set by our own points.',
  ];
}

/**
 * When the next day that can still be logged locks, after `after` (epoch ms): the moment a tab left
 * open reloads, so the day shows as closed and the database has marked what wasn't logged. Before
 * Day 1 that is Day 1's lock; null once the last day has locked.
 */
export function nextLock(
  c: Pick<Challenge, 'start' | 'days' | 'deadline' | 'timeZone'>,
  after: number,
): number | null {
  // A day still open ended at most `daysAfter + 1` days ago, and the oldest open day locks first.
  let day = shift(dateIn(c.timeZone, after), -(c.deadline.daysAfter + 1));
  if (day < c.start) day = c.start;
  for (const last = lastDay(c); day <= last; day = shift(day, 1)) {
    const at = lockTime(c, day);
    if (at > after) return at;
  }
  return null;
}

/** An invite link as nx_invite_preview returns it. */
export type InvitePreviewRow = {
  from: ProfileRow;
  toName: string;
  challenge: ChallengeRow;
  rules: RuleRow[];
};

/**
 * The World behind the invite page, for the partner who opened the link: they are `me` (signed in,
 * or a stand-in named from the invite before they have an account), and the inviter is the partner.
 */
export function inviteWorld(
  preview: InvitePreviewRow,
  viewer: (ProfileRow & { email: string }) | null,
  now: Instant,
): World {
  const name = viewer?.name ?? (preview.toName || 'You');
  const me: Person = viewer
    ? personOf(viewer, viewer.email)
    : {
        id: 'invitee',
        name,
        initial: initialOf(name),
        email: '',
        hue: (preview.from.hue + 180) % 360,
      };
  const inviter = personOf(preview.from);
  const challenge = challengeOf(
    preview.challenge,
    preview.rules.map((r) => ({ ...r, challenge_id: preview.challenge.id })),
    me.id,
  );
  const today = dateIn(challenge.timeZone, now);
  return {
    now,
    today,
    me,
    partner: inviter,
    couple: { id: '', people: [inviter, me], since: today },
    challenge,
    entries: [],
    points: [],
    requests: [],
    disputes: [],
    journal: [],
    saved: [],
    past: [],
    themes: THEMES,
    library: LIBRARY,
    invite: {
      id: '',
      challengeId: challenge.id,
      from: inviter.id,
      to: { name: me.name, email: me.email },
      link: '',
      code: '',
      sentAt: preview.challenge.created_at,
      status: 'opened',
    },
    pact: {
      challengeId: challenge.id,
      terms: pactTerms(challenge),
      signatures: [
        { personId: inviter.id, signedAt: now },
        { personId: me.id, signedAt: null },
      ],
    },
    practice: practiceFor(challenge, me.id, inviter.id, sample.practice),
    sayRules: { sentence: '', rules: [], questions: [] },
    others: [],
    partners: [],
    partnerPending: false,
    timers: [],
    sessions: [],
    goals: [],
  };
}

/**
 * A world showing a shared challenge first among the saved ones (the Shared page shows the first one
 * opened from a link). 'me' and 'partner' in its rules become the viewer and their partner.
 */
export function withShared(w: World, shared: SharedRow, links: Links): World {
  const asSaved = savedOf(
    { ...shared, couple_id: '', link_token: '', link_on: false },
    w.me.id,
    w.partner.id,
    links,
  );
  return {
    ...w,
    saved: [{ ...asSaved, source: 'link', link: '' }, ...w.saved],
  };
}
