import { END, closed, formatDate, formatShortDate, shift } from './dates.ts';
import {
  ruleIndex,
  titleFor,
  weeklyRuleIds,
  dailyRules,
  type Person,
  type Rule,
} from './rules.ts';
import type { Week } from './weeks.ts';
import type { Data, Entry, Point } from './types.ts';
import {
  askedPoints,
  costsMoney,
  pointCosts,
  weeklyCredit,
  weeklyForgiven,
} from './progress.ts';

/** Small read-only queries over the loaded data, shared by the pages and dialogs. */

export const nameOf = (data: Data, uid: string) =>
  data.profiles.find((p) => p.id === uid)?.name;

export const findEntry = (
  data: Data,
  uid: string | undefined,
  rule: string | undefined,
  day: string,
) =>
  data.entries.find(
    (e) => e.user_id === uid && e.rule_id === rule && e.day === day,
  );

export const entriesOn = (data: Data, uid: string | undefined, day: string) =>
  data.entries.filter((e) => e.user_id === uid && e.day === day);

/** Index of the first rule in `list` with no answer yet (-1 when all are answered). */
export const firstUnanswered = (
  data: Data,
  uid: string | undefined,
  list: Rule[],
  day: string,
) => list.findIndex((r) => !findEntry(data, uid, r.id, day));

/** Every entry by `uid`, newest day first, then in rule order. */
export const historyOf = (data: Data, uid: string) =>
  data.entries
    .filter((e) => e.user_id === uid)
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) ||
        ruleIndex(a.rule_id) - ruleIndex(b.rule_id),
    );

export const recentEntries = (data: Data, n = 6) =>
  [...data.entries]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, n);

/* ── Points and forgiveness ─────────────────────────── */

/** Points that still count: not forgiven, not voided, not waiting on a forgiveness request. */
export const activePointCount = (data: Data, uid: string) => {
  const asked = askedPoints(data);
  return data.points.filter((p) => p.user_id === uid && costsMoney(p, asked))
    .length;
};
/** A weekly day's forgiveness ask: it holds the request but is never a miss (lib/progress.ts weeklyForgiven). */
const isDayAsk = (p: Point) => p.reason === 'day_forgiveness';
/** Every miss that became a point, forgiven ones included. */
export const missedTotal = (data: Data, uid: string) =>
  data.points.filter((p) => p.user_id === uid && !p.voided && !isDayAsk(p))
    .length;
export const forgivenCount = (data: Data, uid: string) =>
  data.points.filter(
    (p) => p.user_id === uid && !p.voided && p.forgiven && !isDayAsk(p),
  ).length;

/** The entry's point that still counts, if any. */
export const activePointOf = (data: Data, entryId: string | undefined) =>
  data.points.find((p) => p.entry_id === entryId && !p.voided && !p.forgiven);

export const requestFor = (data: Data, pointId: string | undefined) =>
  data.requests.find((r) => r.point_id === pointId);

/** Status of the forgiveness request on an entry's active point, if any. */
export const forgivenessOf = (data: Data, e: Entry) => {
  const point = activePointOf(data, e.id);
  return point ? requestFor(data, point.id)?.status : undefined;
};

/** What denying the forgiveness request on `p` leads to, said plainly for the confirm dialog. `name` is the person who asked. */
export function denyOutcome(data: Data, p: Point, now: number, name: string) {
  const what = `${titleFor(p.rule_id)} for ${formatDate(p.day)}`,
    until = `They can ask again until ${formatShortDate(shift(p.day, 1))} at 11:59 pm.`,
    past = 'Its deadline has passed, so they can’t ask again.';
  if (isDayAsk(p))
    return `${name}’s No on ${what} won’t count toward the week. ${closed(p.day, now) ? past : until}`;
  const e = data.entries.find((x) => x.id === p.entry_id);
  // Unlogged misses and weekly shortfalls stay open to new requests; a logged No locks at its deadline.
  const again =
    !e || e.status === 'unlogged'
      ? 'They can ask again with a new reason.'
      : closed(p.day, now)
        ? past
        : until;
  return `${name}’s miss on ${what} stays a point. ${again} You can still forgive it later from the penalty history.`;
}

/** Points shown in the penalty history, oldest first. */
export const ledgerPoints = (data: Data) =>
  [...data.points]
    .filter((p) => !p.voided || p.forgiven)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

/** Dollars a point added to its owner's gift: the n-th active point costs $n; forgiven, voided and still-asked points cost nothing. */
export const pointDollars = (data: Data, p: Point) =>
  pointCosts(data, p.user_id).get(p.id) ?? 0;

/** Both people, fewest active points first. */
export const standings = (data: Data) =>
  [...data.profiles].sort(
    (a, b) =>
      activePointCount(data, a.id) - activePointCount(data, b.id) ||
      a.name.localeCompare(b.name),
  );

/** The person strictly ahead, or null on a tie. */
export const leaderOf = (data: Data) => {
  const s = standings(data);
  return s.length === 2 &&
    activePointCount(data, s[0].id) < activePointCount(data, s[1].id)
    ? s[0].id
    : null;
};

/* ── Review queue ───────────────────────────────────── */

/** What waits on `me` in Review. */
export function reviewQueue(data: Data, me: string | undefined) {
  const pending = data.entries.filter(
    (e) =>
      e.user_id !== me && (e.status === 'pending' || e.proposed_done !== null),
  );
  const requests = data.requests.filter(
    (r) => r.status === 'pending' && r.requester_id !== me,
  );
  const disputes = data.disputes.filter((d) => d.status === 'open');
  // A "No" sent with a forgiveness ask is decided only on the Forgiveness tab; deciding it also settles the answer, so it never needs a separate approval under Entries.
  const askOf = (e: Entry) => {
    const point = activePointOf(data, e.id);
    return point ? requests.find((r) => r.point_id === point.id) : undefined;
  };
  const plain = pending.filter((e) => !askOf(e));
  /** The pending answer a forgiveness request came with, if any. */
  const entryOfAsk = (r: { point_id: string }) => {
    const point = data.points.find((p) => p.id === r.point_id);
    return pending.find((e) => e.id === point?.entry_id);
  };
  return {
    pending,
    requests,
    disputes,
    plain,
    entryOfAsk,
    /** Items shown across the three Review tabs. */
    count: plain.length + requests.length + disputes.length,
    /** Anything at all waiting, including answers that came with an ask. */
    any: pending.length + requests.length + disputes.length > 0,
  };
}

/* ── Calendar and weeks ─────────────────────────────── */

export type DayTone = 'future' | 'bad' | 'open' | 'wait' | 'good';

/** Colour of one person's day in the month calendar (daily habits only). */
export function dayTone(
  data: Data,
  uid: string,
  name: Person,
  d: string,
  maxDate: string,
): DayTone {
  if (d > maxDate) return 'future';
  const es = data.entries.filter(
    (e) =>
      e.user_id === uid && e.day === d && !weeklyRuleIds.includes(e.rule_id),
  );
  const need = dailyRules(name, d).length,
    asking = (e: Entry) => forgivenessOf(data, e) === 'pending';
  if (
    es.some(
      (e) =>
        !asking(e) &&
        (e.status === 'unlogged' ||
          e.status === 'missed' ||
          e.status === 'conceded' ||
          (!e.done && e.status !== 'excused')),
    )
  )
    return 'bad';
  if (es.length < need) return 'open';
  if (
    es.some(
      (e) =>
        e.status === 'pending' ||
        e.status === 'disputed' ||
        e.proposed_done !== null ||
        asking(e),
    )
  )
    return 'wait';
  return 'good';
}

/** Days that count toward `uid`'s weekly rule in week `w`, as the database counts them: Yes answers (conceded ones excluded) plus forgiven days. */
export const weekCount = (
  data: Data,
  w: Week | undefined,
  uid: string,
  rule = 'gym',
) => (w ? weeklyCredit(data, uid, rule, w) : 0);
/** Of those, the days that were forgiven rather than done. */
export const weekForgiven = (
  data: Data,
  w: Week | undefined,
  uid: string,
  rule = 'gym',
) => (w ? weeklyForgiven(data, uid, rule, w).forgiven : 0);

/* ── Finalizing ─────────────────────────────────────── */

export type Blocker = {
  key: string;
  text: string;
  /** Who has to act: a member id, or null when either can (or nobody, for the clock). */
  waitingOn: string | null;
  /** The Review tab that settles it. */
  tab?: 'entries' | 'forgiveness' | 'disputes';
};

/** Everything that still stops the challenge being finalized, mirroring challenge_finalize: the last day's deadline, then every review, correction, forgiveness request and dispute, then each person's confirmation. */
export function finalizeBlockers(data: Data, now: number): Blocker[] {
  const out: Blocker[] = [],
    count = (n: number, one: string, many = `${one}s`) =>
      `${n} ${n === 1 ? one : many}`;
  if (!closed(END, now))
    out.push({
      key: 'clock',
      text: `The last day locks on ${formatShortDate(shift(END, 1))} at 11:59 pm.`,
      waitingOn: null,
    });
  for (const reviewer of data.profiles) {
    const owner =
        data.profiles.find((p) => p.id !== reviewer.id)?.name ?? 'your partner',
      q = reviewQueue(data, reviewer.id),
      answers = q.plain.filter((e) => e.proposed_done === null).length,
      fixes = q.plain.length - answers;
    if (answers)
      out.push({
        key: `answers-${reviewer.id}`,
        text: `${reviewer.name} to review ${answers} of ${owner}’s answers`,
        waitingOn: reviewer.id,
        tab: 'entries',
      });
    if (fixes)
      out.push({
        key: `fixes-${reviewer.id}`,
        text: `${reviewer.name} to review ${count(fixes, 'late correction')} from ${owner}`,
        waitingOn: reviewer.id,
        tab: 'entries',
      });
    if (q.requests.length)
      out.push({
        key: `asks-${reviewer.id}`,
        text: `${reviewer.name} to decide ${count(q.requests.length, 'forgiveness request')} from ${owner}`,
        waitingOn: reviewer.id,
        tab: 'forgiveness',
      });
  }
  const disputes = data.disputes.filter((d) => d.status === 'open').length;
  if (disputes)
    out.push({
      key: 'disputes',
      text: `${count(disputes, 'open dispute')} to settle`,
      waitingOn: null,
      tab: 'disputes',
    });
  for (const p of data.profiles)
    if (!data.finalizations.some((f) => f.user_id === p.id))
      out.push({
        key: `confirm-${p.id}`,
        text: `${p.name} to confirm`,
        waitingOn: p.id,
      });
  return out;
}
