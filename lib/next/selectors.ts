import type {
  Badge,
  Challenge,
  DateString,
  DayColor,
  Dispute,
  Entry,
  ForgivenessRequest,
  Goal,
  Instant,
  Look,
  Person,
  Point,
  Recap,
  Rule,
  RuleGroup,
  Target,
  Weekday,
  OtherChallenge,
  RunningSummary,
  TimerRun,
  TimerSession,
  World,
} from './model.ts';
import {
  appliesOn,
  challengeDays,
  dateIn,
  dateRange,
  daysBetween,
  isClosed,
  lastDay,
  lockTime,
  ms,
  ruleIsFor,
  ruleSpan,
  shift,
  weekOf,
  weekTarget,
  weeksOf,
  type Week,
} from './calendar.ts';
import {
  formatDate,
  formatDuration,
  formatRange,
  formatTime,
  formatValue,
  formatWeekday,
  plural,
} from './format.ts';

/**
 * Everything a page asks of the world: what is left to log, what waits for review, points and
 * gifts, weeks, streaks, calendar colours, stakes, badges and the Monday recap. Pure functions of a
 * World, covered by tests/next.mjs. The date helpers and formatters are re-exported, so pages
 * import from this one module.
 */

export * from './calendar.ts';
export * from './format.ts';

/* ── Constants ─────────────────────────────────────────────────────────── */

/** The looks in menu order, with their names. */
export const LOOKS: { id: Look; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'seventy-five', label: '75-Day' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'dry', label: 'Dry' },
  { id: 'fitness', label: 'Fitness' },
];

/** Rule library groups, in order. */
export const RULE_GROUPS: RuleGroup[] = [
  'Sleep',
  'Screens',
  'Food',
  'Drinks',
  'Movement',
  'Mind',
  'Money',
  'Home',
];

/* ── People and rules ──────────────────────────────────────────────────── */

export const personById = (w: World, id: string): Person | undefined =>
  w.couple.people.find((p) => p.id === id);

export const nameOf = (w: World, id: string) => personById(w, id)?.name ?? '';

/** The same world seen by `personId`: `me` and `partner` swap; everything else is shared. */
export const asViewer = (w: World, personId: string): World =>
  personId === w.me.id ? w : { ...w, me: w.partner, partner: w.me };

/** The other person of the couple. */
export const partnerOf = (w: World, id: string): Person =>
  w.couple.people[0].id === id ? w.couple.people[1] : w.couple.people[0];

export const ruleById = (c: Pick<Challenge, 'rules'>, id: string) =>
  c.rules.find((r) => r.id === id);

/** Every rule `personId` has. */
export const rulesFor = (c: Pick<Challenge, 'rules'>, personId: string) =>
  c.rules.filter((r) => ruleIsFor(r, personId));

/** Rules that ask `personId` something on `day`. Weekly rules count only in weeks where they have a target. */
export function rulesOn(c: Challenge, personId: string, day: DateString) {
  const week = weekOf(c, day);
  return rulesFor(c, personId).filter(
    (r) =>
      appliesOn(r, day, c) &&
      (r.kind !== 'weekly' || (!!week && weekTarget(r, week, c) > 0)),
  );
}

/** Rules on `day` that are scored that day (weekly rules left out). */
export const dailyRulesOn = (c: Challenge, personId: string, day: DateString) =>
  rulesOn(c, personId, day).filter((r) => r.kind !== 'weekly');

/** Rules grouped for the library picker, in RULE_GROUPS order; empty groups are left out. */
export const libraryByGroup = (rules: Rule[]) =>
  RULE_GROUPS.map((group) => ({
    group,
    rules: rules.filter((r) => r.group === group),
  })).filter((g) => g.rules.length > 0);

/** True when a number meets the target. */
export const meetsTarget = (t: Target, value: number) =>
  t.op === '>=' ? value >= t.value : value <= t.value;

/** The target `personId` answers against: their own limit on a rule where each sets their own. */
export function targetFor(rule: Rule, personId: string): Target | undefined {
  const own = rule.personalTarget ? rule.limits?.[personId] : undefined;
  return rule.target && own !== undefined
    ? { ...rule.target, value: own }
    : rule.target;
}

/**
 * Before both have signed: the challenge with the first day it gets if they both sign today. Day 1 is
 * never before the day after both signed (nx_sign_pact), so a planned first day already here moves.
 */
export function asIfSignedToday(c: Challenge, today: DateString): Challenge {
  if (c.status === 'running' || c.status === 'finished') return c;
  const earliest = shift(today, 1);
  return c.start >= earliest ? c : { ...c, start: earliest };
}

/* ── Days and deadlines ────────────────────────────────────────────────── */

/** "Day 19": today's place in the challenge (0 before it starts, `days` after it ends). */
export const dayNumber = (
  c: Pick<Challenge, 'start' | 'days'>,
  day: DateString,
) => Math.min(c.days, Math.max(0, daysBetween(c.start, day) + 1));

/** Days from `today` through the last day, today included (0 once it is over). */
export const daysLeft = (
  c: Pick<Challenge, 'start' | 'days'>,
  today: DateString,
) => Math.min(c.days, Math.max(0, daysBetween(today, lastDay(c)) + 1));

/**
 * Days that can still be logged: inside the challenge, deadline not yet passed, and over (or today,
 * when the deadline is the same night). Oldest first.
 */
export function openDays(w: World): DateString[] {
  const c = w.challenge,
    out: DateString[] = [];
  for (
    let n = c.deadline.daysAfter === 0 ? 0 : 1;
    n <= c.deadline.daysAfter + 1;
    n++
  ) {
    const d = shift(w.today, -n);
    if (d >= c.start && d <= lastDay(c) && !isClosed(c, d, w.now))
      out.unshift(d);
  }
  return out;
}

/**
 * When `day` is first answered: "Tomorrow, answer for today by 11:59 pm." (Day 1 on Overview) or
 * "On Wednesday, answer for Tuesday by 11:59 pm." (before Day 1). A same-day deadline answers it
 * that evening.
 */
export function answerLine(w: World, day: DateString) {
  const c = w.challenge,
    lock = lockTime(c, day),
    on = dateIn(c.timeZone, lock),
    time = formatTime(lock, c.timeZone);
  const name = day === w.today ? 'today' : formatWeekday(day);
  if (c.deadline.daysAfter === 0)
    return `Answer for ${name} by ${time} that day.`;
  const opens = shift(day, 1);
  const by = on === opens ? time : `${time} ${formatWeekday(on)}`;
  return opens === shift(w.today, 1)
    ? `Tomorrow, answer for ${name} by ${by}.`
    : `On ${formatWeekday(opens)}, answer for ${name} by ${by}.`;
}

/** The day being logged: the oldest open day (yesterday in the sample world), or null when nothing can be logged. */
export const openDay = (w: World): DateString | null => openDays(w)[0] ?? null;

/** Milliseconds until `day` locks (0 once it has). */
export const timeLeft = (w: World, day: DateString | null = openDay(w)) =>
  day ? Math.max(0, lockTime(w.challenge, day) - ms(w.now)) : 0;

/* ── Entries and check-ins ─────────────────────────────────────────────── */

const entryIndexes = new WeakMap<Entry[], Map<string, Entry>>();

/** One person's answer to one rule on one day, from an index of `w.entries` built once per list. */
export const entryFor = (
  w: World,
  personId: string,
  ruleId: string,
  day: DateString,
) => {
  let index = entryIndexes.get(w.entries);
  if (!index) {
    index = new Map();
    for (const e of w.entries) {
      const key = `${e.personId}|${e.ruleId}|${e.day}`;
      if (!index.has(key)) index.set(key, e);
    }
    entryIndexes.set(w.entries, index);
  }
  return index.get(`${personId}|${ruleId}|${day}`);
};

export const entriesOn = (w: World, personId: string, day: DateString) =>
  w.entries.filter((e) => e.personId === personId && e.day === day);

/** True once someone has answered: anything but an unlogged entry, or an unlogged one with a late answer proposed. */
export const isAnswered = (e: Entry | undefined) =>
  !!e && (e.status !== 'unlogged' || !!e.correction);

/** Check-ins `personId` still has to answer on `day` (the open day by default), in rule order. */
export function openCheckins(
  w: World,
  personId: string,
  day: DateString | null = openDay(w),
): Rule[] {
  if (!day) return [];
  return rulesOn(w.challenge, personId, day).filter(
    (r) => !isAnswered(entryFor(w, personId, r.id, day)),
  );
}

/** Check-ins due on `day`, how many are answered and how many are left. */
export function checkinProgress(
  w: World,
  personId: string,
  day: DateString | null = openDay(w),
) {
  if (!day) return { day, due: 0, answered: 0, left: 0 };
  const due = rulesOn(w.challenge, personId, day).length,
    left = openCheckins(w, personId, day).length;
  return { day, due, answered: due - left, left };
}

/** A weekly visit counts once it is a Yes that is not conceded or waiting on a late approval. */
export const countsForWeek = (e: Entry) =>
  e.done === true &&
  (e.status === 'confirmed' ||
    e.status === 'pending' ||
    e.status === 'disputed');

/** How an answer reads: "Yes", "No", "11,240 steps", or "Not logged". */
export function formatAnswer(rule: Rule, e: Pick<Entry, 'done' | 'value'>) {
  if (e.done === null) return 'Not logged';
  if (rule.kind === 'number' && e.value !== undefined)
    return formatValue(rule, e.value);
  return e.done ? 'Yes' : 'No';
}

/* ── Points and gifts ──────────────────────────────────────────────────── */

const byCreated = (a: Point, b: Point) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Points that cost money: not forgiven, not voided. Oldest first, which sets their price. */
export const activePoints = (w: World, personId: string) =>
  w.points
    .filter((p) => p.personId === personId && !p.forgiven && !p.voided)
    .sort(byCreated);

export const forgivenPoints = (w: World, personId: string) =>
  w.points
    .filter((p) => p.personId === personId && p.forgiven && !p.voided)
    .sort(byCreated);

/** Every point a person has had, forgiven ones included (voided ones left out), oldest first. */
export const pointHistory = (w: World, personId: string) =>
  w.points.filter((p) => p.personId === personId && !p.voided).sort(byCreated);

/** A gift's total for `points` active points: the nth costs n × `step`, up to the cap. */
export function giftTotal(
  points: number,
  step: number,
  cap: number | null = null,
) {
  const total = (step * points * (points + 1)) / 2;
  return cap === null || cap === undefined ? total : Math.min(cap, total);
}

/** Dollars one point adds: its place among the owner's active points times the step, cut off at the cap. Forgiven and voided points cost nothing. */
export function pointCost(w: World, point: Point) {
  if (point.forgiven || point.voided) return 0;
  const n =
    activePoints(w, point.personId).findIndex((p) => p.id === point.id) + 1;
  if (n === 0) return 0;
  const { step, cap } = w.challenge;
  return giftTotal(n, step, cap) - giftTotal(n - 1, step, cap);
}

/** What `personId` spends on the gift for their partner, set by their own points. */
export const owes = (w: World, personId: string) =>
  giftTotal(
    activePoints(w, personId).length,
    w.challenge.step,
    w.challenge.cap,
  );

/** The gift `personId` receives, set by their partner's points. */
export const gets = (w: World, personId: string) =>
  owes(w, partnerOf(w, personId).id);

/** What `personId`'s next miss would add to what they owe (0 once the cap is reached). */
export function nextMissCost(w: World, personId: string) {
  const n = activePoints(w, personId).length,
    { step, cap } = w.challenge;
  return giftTotal(n + 1, step, cap) - giftTotal(n, step, cap);
}

export type Standing = {
  person: Person;
  points: number;
  forgiven: number;
  owes: number;
  gets: number;
  nextMiss: number;
};

/** Both people's points and gifts, the viewer first. */
export function standings(w: World): [Standing, Standing] {
  const row = (person: Person): Standing => ({
    person,
    points: activePoints(w, person.id).length,
    forgiven: forgivenPoints(w, person.id).length,
    owes: owes(w, person.id),
    gets: gets(w, person.id),
    nextMiss: nextMissCost(w, person.id),
  });
  return [row(w.me), row(w.partner)];
}

/** Who is ahead (fewer active points) and by how many points; `personId` is null on a tie. */
export function leader(w: World) {
  const [a, b] = standings(w);
  const margin = Math.abs(a.points - b.points);
  return {
    personId:
      a.points === b.points
        ? null
        : a.points < b.points
          ? a.person.id
          : b.person.id,
    margin,
  };
}

/* ── Review ────────────────────────────────────────────────────────────── */

export type ReviewItem =
  | { kind: 'answer'; id: string; at: Instant; entry: Entry; rule: Rule }
  | { kind: 'correction'; id: string; at: Instant; entry: Entry; rule: Rule }
  | {
      kind: 'forgiveness';
      id: string;
      at: Instant;
      request: ForgivenessRequest;
      point: Point;
      rule: Rule;
      entry?: Entry;
    }
  | {
      kind: 'dispute';
      id: string;
      at: Instant;
      dispute: Dispute;
      entry: Entry;
      rule: Rule;
    };

/** The pending forgiveness request on a point, if any. */
export const pendingRequestFor = (w: World, pointId: string) =>
  w.requests.find((r) => r.pointId === pointId && r.status === 'pending');

/** The active (unforgiven, unvoided) point an entry produced, if any. */
export const pointOfEntry = (w: World, entryId: string) =>
  w.points.find((p) => p.entryId === entryId && !p.voided && !p.forgiven);

/**
 * Open disputes the partner raised on `personId`'s answers. `replied` picks the ones this person
 * has already answered with "Keep it open" (they wait on the partner) or the ones still unanswered.
 */
function openDisputesOn(w: World, personId: string, replied: boolean) {
  const other = partnerOf(w, personId).id;
  const out: Extract<ReviewItem, { kind: 'dispute' }>[] = [];
  for (const dispute of w.disputes) {
    const entry = w.entries.find((e) => e.id === dispute.entryId),
      r = entry && ruleById(w.challenge, entry.ruleId);
    if (
      dispute.status !== 'open' ||
      dispute.raisedBy !== other ||
      !entry ||
      entry.personId !== personId ||
      !r ||
      !!dispute.reply !== replied
    )
      continue;
    out.push({
      kind: 'dispute',
      id: `dispute:${dispute.id}`,
      at: dispute.createdAt,
      dispute,
      entry,
      rule: r,
    });
  }
  return out;
}

/**
 * Disputes on `personId`'s answers that they replied to and kept open: they now wait on the partner
 * who raised them (and the answer's owner can still concede).
 */
export const repliedDisputes = (w: World, personId: string) =>
  openDisputesOn(w, personId, true);

/** Every open dispute `personId` raised, replied to or not: they can always withdraw it. */
export const disputesRaisedBy = (w: World, personId: string) => {
  const other = partnerOf(w, personId).id;
  return [
    ...openDisputesOn(w, other, false),
    ...openDisputesOn(w, other, true),
  ];
};

/**
 * What waits on `personId`: the partner's answers to approve, their late corrections, their
 * forgiveness requests, and disputes the partner raised on this person's answers that this person
 * has not replied to yet. `items` holds all of them, oldest first.
 */
export function reviewQueue(w: World, personId: string) {
  const other = partnerOf(w, personId).id,
    c = w.challenge;
  const rule = (id: string) => ruleById(c, id);
  const answers: Extract<ReviewItem, { kind: 'answer' }>[] = [],
    corrections: Extract<ReviewItem, { kind: 'correction' }>[] = [],
    forgiveness: Extract<ReviewItem, { kind: 'forgiveness' }>[] = [],
    disputes: Extract<ReviewItem, { kind: 'dispute' }>[] = [];
  for (const e of w.entries) {
    const r = rule(e.ruleId);
    if (e.personId !== other || !r) continue;
    if (e.correction)
      corrections.push({
        kind: 'correction',
        id: `correction:${e.id}`,
        at: e.correction.proposedAt,
        entry: e,
        rule: r,
      });
    else if (e.status === 'pending')
      answers.push({
        kind: 'answer',
        id: `answer:${e.id}`,
        at: e.loggedAt ?? e.day,
        entry: e,
        rule: r,
      });
  }
  for (const request of w.requests) {
    const point = w.points.find((p) => p.id === request.pointId),
      r = point && rule(point.ruleId);
    if (request.status !== 'pending' || request.from !== other || !point || !r)
      continue;
    forgiveness.push({
      kind: 'forgiveness',
      id: `forgiveness:${request.id}`,
      at: request.createdAt,
      request,
      point,
      rule: r,
      entry: w.entries.find((e) => e.id === point.entryId),
    });
  }
  disputes.push(...openDisputesOn(w, personId, false));
  const items: ReviewItem[] = [
    ...answers,
    ...corrections,
    ...forgiveness,
    ...disputes,
  ].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return {
    items,
    answers,
    corrections,
    forgiveness,
    disputes,
    count: items.length,
  };
}

/** What `personId` is waiting on from their partner: the partner's review queue. */
export const waitingOnPartner = (w: World, personId: string) =>
  reviewQueue(w, partnerOf(w, personId).id);

/* ── Settling and the other challenges ─────────────────────────────────── */

/**
 * The last deadline has passed but it isn't over: there's no result until every dispute is settled
 * and every answer reviewed (48 hours at most). Null at any other time. `yours` is what only this
 * person can do.
 */
export function settling(w: World) {
  const c = w.challenge;
  if (c.status !== 'running' || ms(w.now) <= lockTime(c, lastDay(c)))
    return null;
  const disputes = w.disputes.filter((d) => d.status === 'open');
  const toReview = w.entries.filter(
    (e) => e.status === 'pending' && e.personId !== w.me.id,
  ).length;
  const raised = disputes.filter((d) => d.raisedBy === w.me.id).length;
  return {
    disputes: disputes.length,
    /** Open disputes this person raised (they can withdraw) and on their answers (they can concede). */
    raised,
    onYours: disputes.length - raised,
    toReview,
    /** Open disputes: either person can settle one, by conceding or withdrawing. Answers: only the reviewer. */
    yours: disputes.length + toReview,
    /** A timer still going holds the end too (nx_tick): this person's, which they can stop, or the partner's. */
    myTimer: timerOf(w, w.me.id),
    theirTimer: timerOf(w, w.partner.id),
  };
}

/**
 * What stands between the last day and who won, as one sentence without its full stop: disputes,
 * then answers to review, then a timer still going, then the partner's reviews.
 */
export function settlingStep(
  w: World,
  over: NonNullable<ReturnType<typeof settling>>,
) {
  const partner = w.partner.name;
  const timer = (run: TimerRun) =>
    (ruleById(w.challenge, run.ruleId)?.title ?? 'timed').split(', ')[0];
  if (over.disputes)
    return `Settle ${plural(over.disputes, 'dispute')} to see who won`;
  if (over.toReview)
    return `Review ${plural(over.toReview, 'answer')} to see who won`;
  if (over.myTimer)
    return `Your ${timer(over.myTimer)} timer is still running. Stop it to see who won`;
  if (over.theirTimer)
    return `Waiting for ${partner} to stop their ${timer(over.theirTimer)} timer`;
  return `Waiting for ${partner} to review your answers`;
}

/** What settling asks of this person, said to them: "You can concede it, or Jordan can withdraw it." */
export function settlingLine(w: World) {
  const over = settling(w);
  if (!over) return '';
  const partner = w.partner.name,
    it = over.disputes === 1 ? 'it' : 'them';
  if (over.raised && over.onYours)
    return `You can concede the ones on your answers, and withdraw the ones you raised.`;
  if (over.onYours)
    return `You can concede ${it}, or ${partner} can withdraw ${it}.`;
  if (over.raised)
    return `You can withdraw ${it}, or ${partner} can concede ${it}.`;
  // A timer is all that's left: the sentence above says so.
  if (!over.toReview && (over.myTimer || over.theirTimer)) return '';
  return 'Answers nobody reviews count as approved after 48 hours.';
}

/** A running challenge as Your challenges shows it. */
export function runningSummary(w: World): RunningSummary {
  const c = w.challenge;
  const progress = checkinProgress(w, w.me.id);
  const waiting = reviewQueue(w, w.me.id).count;
  const day = progress.day;
  return {
    range: formatRange(c.start, lastDay(c)),
    day: dayNumber(c, w.today),
    days: c.days,
    left: progress.left,
    leftHint: !day
      ? 'Nothing to log'
      : progress.left
        ? `${formatWeekday(day)}, ${formatDuration(timeLeft(w, day))} left`
        : 'All logged',
    waiting,
  };
}

/** Where a challenge stands, from `w`'s side, as a line for Your challenges. */
export function challengeSummary(w: World): OtherChallenge {
  const c = w.challenge,
    partner = w.partner.name,
    me = w.me.id;
  const base = { id: c.id, name: c.name, status: c.status, partner };
  const signed = w.pact.signatures.some(
    (s) => s.personId === me && !!s.signedAt,
  );
  if (c.status === 'draft')
    return c.createdBy && c.createdBy !== me
      ? { ...base, line: `${partner} is setting this up`, needsYou: false }
      : { ...base, line: 'Keep setting up', needsYou: true };
  if (c.status === 'invited' || c.status === 'signing')
    return signed
      ? {
          ...base,
          line:
            c.status === 'invited'
              ? `Waiting for ${partner} to join`
              : `Waiting for ${partner} to sign`,
          needsYou: false,
        }
      : { ...base, line: 'Sign the pact', needsYou: true };
  const over = settling(w);
  if (over)
    return {
      ...base,
      line: settlingStep(w, over),
      needsYou: over.yours > 0 || !!over.myTimer,
    };
  if (w.today < c.start)
    return { ...base, line: `Starts ${formatDate(c.start)}`, needsYou: false };
  const running = runningSummary(w);
  const { left, waiting } = running;
  return {
    ...base,
    line: [
      `Day ${running.day} of ${c.days}`,
      left ? `${left} left to log` : null,
      waiting ? `${waiting} to review` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    needsYou: left + waiting > 0,
    running,
  };
}

/* ── Weeks ─────────────────────────────────────────────────────────────── */

/**
 * A weekly rule this week (the week of `day`, today by default): visits so far, the target, how
 * many are still needed, and on how many days a visit can still count (today onward, plus an open
 * day not yet answered for this rule). Null when the rule or week does not exist.
 */
export function weekProgress(
  w: World,
  personId: string,
  ruleId: string,
  day: DateString = w.today,
) {
  const c = w.challenge,
    rule = ruleById(c, ruleId),
    week = weekOf(c, day);
  if (!rule || !week) return null;
  const need = weekTarget(rule, week, c),
    open = openDays(w);
  const have = w.entries.filter(
    (e) =>
      e.personId === personId &&
      e.ruleId === ruleId &&
      e.day >= week.start &&
      e.day <= week.end &&
      countsForWeek(e),
  ).length;
  const daysLeftInWeek = dateRange(week.start, week.end).filter(
    (d) =>
      appliesOn(rule, d, c) &&
      (d >= w.today ||
        (open.includes(d) && !isAnswered(entryFor(w, personId, ruleId, d)))),
  ).length;
  return {
    rule,
    week,
    have,
    need,
    left: Math.max(0, need - have),
    daysLeft: daysLeftInWeek,
    met: have >= need,
  };
}

/* ── Streaks ───────────────────────────────────────────────────────────── */

export type Streak = {
  rule: Rule;
  /** The run still going. */
  current: number;
  best: number;
  unit: 'day' | 'week';
};

/** How one answer affects a streak: a Yes extends it, a miss breaks it, anything else leaves it. */
function streakStep(
  w: World,
  e: Entry | undefined,
  closed: boolean,
): 'extend' | 'break' | 'skip' {
  if (!e) return closed ? 'break' : 'skip';
  if (e.correction) return 'skip';
  if (e.status === 'excused') return 'skip';
  if (
    e.status === 'missed' ||
    e.status === 'conceded' ||
    e.status === 'unlogged'
  )
    return 'break';
  return e.done ? 'extend' : 'break';
}

/**
 * Current and best streak per rule, counted over answered days up to `upTo` (yesterday by
 * default). Daily rules count days; weekly rules count weeks that met their target (the week in
 * progress counts once it has). Forgiven days and days still open neither extend nor break a run.
 */
export function streaks(
  w: World,
  personId: string,
  upTo: DateString = shift(w.today, -1),
): Streak[] {
  const c = w.challenge;
  return rulesFor(c, personId).map((rule) => {
    let run = 0,
      best = 0;
    if (rule.kind === 'weekly') {
      for (const week of weeksOf(c)) {
        if (week.start > upTo) break;
        const need = weekTarget(rule, week, c);
        if (!need) continue;
        const have = w.entries.filter(
          (e) =>
            e.personId === personId &&
            e.ruleId === rule.id &&
            e.day >= week.start &&
            e.day <= week.end &&
            e.day <= upTo &&
            countsForWeek(e),
        ).length;
        const over = week.end <= upTo && isClosed(c, week.end, w.now);
        if (have >= need) {
          run++;
          best = Math.max(best, run);
        } else if (over) run = 0;
      }
      return { rule, current: run, best, unit: 'week' as const };
    }
    const { from, to } = ruleSpan(rule, c);
    for (const d of dateRange(from, to < upTo ? to : upTo)) {
      if (!appliesOn(rule, d, c)) continue;
      const step = streakStep(
        w,
        entryFor(w, personId, rule.id, d),
        isClosed(c, d, w.now),
      );
      if (step === 'extend') {
        run++;
        best = Math.max(best, run);
      } else if (step === 'break') run = 0;
    }
    return { rule, current: run, best, unit: 'day' as const };
  });
}

/** The longest daily streak still going, if it is worth protecting (3 days or more). */
export function streakToProtect(w: World, personId: string) {
  const top = streaks(w, personId)
    .filter((s) => s.unit === 'day')
    .sort((a, b) => b.current - a.current)[0];
  return top && top.current >= 3 ? top : null;
}

/* ── Calendar ──────────────────────────────────────────────────────────── */

const MISS = new Set(['missed', 'conceded', 'unlogged']);

/**
 * Where `day` stands for `personId` (daily rules only; weekly rules are judged by the week):
 * - `ahead`: today or later (today is open when the deadline is that night), or outside the challenge.
 * - `open`: still loggable and something is unanswered.
 * - `missed`: a miss with a point that is not forgiven and not waiting on a forgiveness request.
 * - `review`: something waiting (an answer, a correction, a dispute or a forgiveness request).
 * - `excused`: a miss that was forgiven, nothing else wrong.
 * - `done`: everything done.
 */
export function dayColor(
  w: World,
  personId: string,
  day: DateString,
): DayColor {
  const c = w.challenge;
  if (
    day < c.start ||
    day > lastDay(c) ||
    day > w.today ||
    (day === w.today && c.deadline.daysAfter > 0)
  )
    return 'ahead';
  const closed = isClosed(c, day, w.now);
  const entries = dailyRulesOn(c, personId, day).map((r) =>
    entryFor(w, personId, r.id, day),
  );
  if (!closed && entries.some((e) => !isAnswered(e))) return 'open';
  const t = tally(w, entries);
  return t.missed
    ? 'missed'
    : t.review
      ? 'review'
      : t.excused
        ? 'excused'
        : 'done';
}

/** How a day's daily check-ins stand: how many missed, and whether any wait or were forgiven. */
function tally(w: World, entries: (Entry | undefined)[]) {
  let missed = 0,
    review = false,
    excused = false;
  for (const e of entries) {
    if (!e) missed++;
    else if (e.correction || e.status === 'pending' || e.status === 'disputed')
      review = true;
    else if (e.status === 'excused') excused = true;
    else if (MISS.has(e.status) || !e.done) {
      const point = pointOfEntry(w, e.id);
      if (point && pendingRequestFor(w, point.id)) review = true;
      else missed++;
    }
  }
  return { missed, review, excused };
}

/**
 * How many of a day's daily check-ins `personId` missed, out of how many were asked: "1 of 8
 * missed". A missed day is a missed day however many it was, so the colour stays; this says how
 * close it came. Only meaningful when `dayColor` is 'missed'.
 */
export function dayMisses(w: World, personId: string, day: DateString) {
  const entries = dailyRulesOn(w.challenge, personId, day).map((r) =>
    entryFor(w, personId, r.id, day),
  );
  return { missed: tally(w, entries).missed, due: entries.length };
}

/** "1 of 8 missed". */
export const missesLine = (m: { missed: number; due: number }) =>
  `${m.missed} of ${m.due} missed`;

/** Every day of the challenge for `personId`, with its number, colour and how many it missed. */
export const calendar = (w: World, personId: string) =>
  challengeDays(w.challenge).map((day, i) => {
    const color = dayColor(w, personId, day);
    return {
      day,
      number: i + 1,
      color,
      misses: color === 'missed' ? dayMisses(w, personId, day) : null,
    };
  });

/* ── Status pills ──────────────────────────────────────────────────────── */

export type PillStatus =
  | 'done'
  | 'missed'
  | 'review'
  | 'forgiven'
  | 'disputed'
  | 'open'
  | 'none';

/** The pill for one check-in: its status and the words on it. */
export function entryPill(
  w: World,
  rule: Rule,
  e: Entry | undefined,
  day: DateString,
): { status: PillStatus; label: string } {
  const closed = isClosed(w.challenge, day, w.now);
  if (!e || (e.status === 'unlogged' && !e.correction)) {
    if (!closed) return { status: 'open', label: 'Open' };
    return rule.kind === 'weekly'
      ? { status: 'none', label: 'No answer' }
      : { status: 'missed', label: 'Not logged' };
  }
  if (e.correction) return { status: 'review', label: 'Late answer waiting' };
  if (e.status === 'pending')
    return { status: 'review', label: 'Waiting for review' };
  if (e.status === 'disputed') return { status: 'disputed', label: 'Disputed' };
  if (e.status === 'excused') return { status: 'forgiven', label: 'Forgiven' };
  if (MISS.has(e.status) || (!e.done && rule.kind !== 'weekly')) {
    const point = pointOfEntry(w, e.id);
    if (point && pendingRequestFor(w, point.id))
      return { status: 'review', label: 'Forgiveness asked' };
    return {
      status: 'missed',
      label: e.status === 'conceded' ? 'Conceded' : 'Missed',
    };
  }
  if (!e.done) return { status: 'none', label: 'No' };
  return { status: 'done', label: 'Done' };
}

/* ── Stakes ────────────────────────────────────────────────────────────── */

/** A challenge, saved challenge or theme: what the stakes depend on. A theme has no start yet, so pass one. */
type Plan = {
  rules: Rule[];
  start: DateString;
  days: number;
  step: number;
  cap?: number | null;
  weekStart?: Weekday;
};

/** Check-ins `personId` would face over the whole challenge: each daily question, plus each weekly visit needed. */
export function checkinCount(plan: Plan, personId: string) {
  const c = { ...plan, weekStart: plan.weekStart ?? 1 };
  let n = 0;
  for (const rule of plan.rules.filter((r) => ruleIsFor(r, personId))) {
    if (rule.kind === 'weekly')
      n += weeksOf(c).reduce((s, week) => s + weekTarget(rule, week, c), 0);
    else n += challengeDays(c).filter((d) => appliesOn(rule, d, c)).length;
  }
  return n;
}

/** Rounds a gift to what people say out loud: nearest $10 from $100, nearest $5 from $20. */
export const roundGift = (x: number) =>
  x >= 100
    ? Math.round(x / 10) * 10
    : x >= 20
      ? Math.round(x / 5) * 5
      : Math.round(x);

/**
 * "Miss 1 in 10 check-ins and each gift will be about $150": for each person, their check-ins,
 * the misses at `missRate`, and the gift those misses cost; `gift` is the rounded average.
 * Pass `people` for a couple's own rules; a theme's rules are all for both, so the default works.
 */
export function stakesPreview(
  plan: Plan,
  missRate = 0.1,
  people: string[] = ['both'],
) {
  const perPerson = people.map((personId) => {
    const checkins = checkinCount(plan, personId),
      misses = Math.round(checkins * missRate);
    return {
      personId,
      checkins,
      misses,
      gift: giftTotal(misses, plan.step, plan.cap ?? null),
    };
  });
  const average =
    perPerson.reduce((s, p) => s + p.gift, 0) / Math.max(1, perPerson.length);
  return { missRate, perPerson, gift: roundGift(average) };
}

/* ── Weeks told on Mondays ─────────────────────────────────────────────── */

/** The recap of one week: points, dollars, check-ins done, weekly targets and streaks per person, and who won. */
export function weekRecap(w: World, week: Week): Recap {
  const c = w.challenge;
  const people = w.couple.people.map((person) => {
    const pts = w.points.filter(
      (p) =>
        p.personId === person.id &&
        !p.voided &&
        !p.forgiven &&
        p.day >= week.start &&
        p.day <= week.end,
    );
    let due = 0,
      done = 0;
    for (const d of dateRange(week.start, week.end))
      for (const r of dailyRulesOn(c, person.id, d)) {
        due++;
        const e = entryFor(w, person.id, r.id, d);
        if (
          e &&
          (e.status === 'excused' ||
            (e.done === true && !MISS.has(e.status) && !e.correction))
        )
          done++;
      }
    const weekly = rulesFor(c, person.id)
      .filter((r) => r.kind === 'weekly' && weekTarget(r, week, c) > 0)
      .map((r) => ({
        ruleId: r.id,
        have: w.entries.filter(
          (e) =>
            e.personId === person.id &&
            e.ruleId === r.id &&
            e.day >= week.start &&
            e.day <= week.end &&
            countsForWeek(e),
        ).length,
        need: weekTarget(r, week, c),
      }));
    const top = streaks(w, person.id, week.end)
      .filter((s) => s.unit === 'day')
      .sort((a, b) => b.current - a.current)[0];
    return {
      personId: person.id,
      points: pts.length,
      dollars: pts.reduce((s, p) => s + pointCost(w, p), 0),
      done,
      due,
      weekly,
      bestStreak:
        top && top.current > 0
          ? { ruleId: top.rule.id, days: top.current }
          : null,
    };
  });
  const [a, b] = people;
  return {
    weekStart: week.start,
    weekEnd: week.end,
    people,
    winner:
      a.points === b.points
        ? null
        : a.points < b.points
          ? a.personId
          : b.personId,
  };
}

/** The latest week that is over and fully closed: the one the Monday recap tells. Null before the first one. */
export function lastRecap(w: World): Recap | null {
  const c = w.challenge;
  const done = weeksOf(c).filter(
    (week) => week.end < w.today && isClosed(c, week.end, w.now),
  );
  const week = done[done.length - 1];
  return week ? weekRecap(w, week) : null;
}

/* ── Badges ────────────────────────────────────────────────────────────── */

/** Days before today with every daily rule done or forgiven (nothing missed, nothing waiting). */
function cleanDays(w: World, personId: string) {
  const c = w.challenge;
  return dateRange(c.start, shift(w.today, -1)).filter((d) => {
    if (d > lastDay(c)) return false;
    const color = dayColor(w, personId, d);
    return color === 'done' || color === 'excused';
  });
}

/**
 * Badges for `personId` as of now: earned ones with the day they were earned, the rest with how
 * close they are when they build up.
 */
export function badges(w: World, personId: string): Badge[] {
  const c = w.challenge,
    yesterday = shift(w.today, -1),
    clean = cleanDays(w, personId);
  // Clean days in a row: the first run of 7, and the run still going.
  let run = 0,
    prev = '',
    cleanWeekOn: string | undefined;
  for (const d of clean) {
    run = prev && shift(prev, 1) === d ? run + 1 : 1;
    prev = d;
    if (run === 7) cleanWeekOn ??= d;
  }
  // The run is still going if it reaches yesterday, or the day before while yesterday is still open.
  const cleanNow =
    prev === yesterday ||
    (prev === shift(yesterday, -1) &&
      dayColor(w, personId, yesterday) === 'open')
      ? run
      : 0;
  // Streak milestones: the first day any daily rule reached n in a row.
  const reached = (n: number) => {
    let first: string | undefined;
    for (const rule of rulesFor(c, personId).filter(
      (r) => r.kind !== 'weekly',
    )) {
      let r = 0;
      for (const d of dateRange(
        c.start,
        yesterday < lastDay(c) ? yesterday : lastDay(c),
      )) {
        if (!appliesOn(rule, d, c)) continue;
        const step = streakStep(
          w,
          entryFor(w, personId, rule.id, d),
          isClosed(c, d, w.now),
        );
        if (step === 'extend') r++;
        else if (step === 'break') r = 0;
        if (r === n && (!first || d < first)) first = d;
      }
    }
    return first;
  };
  const daily = streaks(w, personId).filter((s) => s.unit === 'day');
  const bestNow = Math.max(0, ...daily.map((s) => s.current));
  const longest = daily.sort((a, b) => b.current - a.current)[0];
  const longestNeed = longest
    ? challengeDays(c).filter((d) => appliesOn(longest.rule, d, c)).length
    : c.days;
  // Weeks: the first closed week with every weekly target met, and the first week won.
  const partner = partnerOf(w, personId).id;
  const closedWeeks = weeksOf(c).filter((week) => isClosed(c, week.end, w.now));
  const weeklyRules = rulesFor(c, personId).filter((r) => r.kind === 'weekly');
  const fullWeek = closedWeeks.find(
    (week) =>
      weeklyRules.some((r) => weekTarget(r, week, c) > 0) &&
      weeklyRules.every((r) => {
        const need = weekTarget(r, week, c);
        const have = w.entries.filter(
          (e) =>
            e.personId === personId &&
            e.ruleId === r.id &&
            e.day >= week.start &&
            e.day <= week.end &&
            countsForWeek(e),
        ).length;
        return have >= need;
      }),
  );
  const wonWeek = closedWeeks.find(
    (week) => weekRecap(w, week).winner === personId,
  );
  const forgave = w.requests
    .filter((r) => r.status === 'approved' && r.from === partner)
    .sort((a, b) => (a.decidedAt ?? '').localeCompare(b.decidedAt ?? ''))[0];
  const finish = dateRange(shift(lastDay(c), -6), lastDay(c));
  const finished = isClosed(c, lastDay(c), w.now);
  const badge = (
    id: string,
    title: string,
    how: string,
    earnedOn: string | undefined,
    progress?: Badge['progress'],
  ): Badge =>
    earnedOn
      ? { id, title, how, earned: true, earnedOn }
      : { id, title, how, earned: false, ...(progress ? { progress } : {}) };
  return [
    badge(
      'first-clean-day',
      'First clean day',
      'A day with nothing missed',
      clean[0],
    ),
    badge(
      'clean-week',
      'Clean week',
      'Seven clean days in a row',
      cleanWeekOn,
      {
        have: Math.min(cleanNow, 7),
        need: 7,
        unit: 'clean days in a row',
      },
    ),
    badge('streak-7', 'On a roll', 'Any rule, 7 days in a row', reached(7), {
      have: Math.min(bestNow, 7),
      need: 7,
      unit: 'days in a row',
    }),
    badge('streak-14', 'Locked in', 'Any rule, 14 days in a row', reached(14), {
      have: Math.min(bestNow, 14),
      need: 14,
      unit: 'days in a row',
    }),
    badge(
      'streak-all',
      'Unbroken',
      'Any rule, every day of the challenge',
      finished && longest && longest.current >= longestNeed
        ? lastDay(c)
        : undefined,
      {
        have: Math.min(longest?.current ?? 0, longestNeed),
        need: longestNeed,
        unit: 'days in a row',
      },
    ),
    badge(
      'full-week',
      'Full week',
      'Every weekly visit in a week',
      fullWeek?.end,
    ),
    badge(
      'week-won',
      'Week won',
      'Fewer points than your partner in a week',
      wonWeek?.end,
    ),
    badge(
      'gracious',
      'Gracious',
      'Forgave your partner once',
      forgave
        ? dateIn(c.timeZone, forgave.decidedAt ?? forgave.createdAt)
        : undefined,
    ),
    badge(
      'strong-finish',
      'Strong finish',
      'The last seven days all clean',
      finished && finish.every((d) => clean.includes(d))
        ? lastDay(c)
        : undefined,
    ),
  ];
}

/** The badge not yet earned that is closest, by share of progress; null when none builds up. */
export function nextBadge(w: World, personId: string) {
  return (
    badges(w, personId)
      .filter((b) => !b.earned && b.progress && b.progress.have > 0)
      .sort(
        (a, b) =>
          b.progress!.have / b.progress!.need -
          a.progress!.have / a.progress!.need,
      )[0] ?? null
  );
}

/**
 * A rule's question as a check-in asks it. A check-in often answers an earlier day, so a "today" at
 * the start or end of the question is left out: "Did you pray today?" asks "Did you pray?".
 */
export function askedQuestion(rule: Pick<Rule, 'question'>): string {
  const q = rule.question
    .trim()
    .replace(/^today,?\s+/i, '')
    .replace(/,?\s+today(?=[?.!]*$)/i, '');
  return q ? q.charAt(0).toUpperCase() + q.slice(1) : rule.question;
}

/* ── Timer ─────────────────────────────────────────────────────────────── */

/** Units a timer counts in: "min", "mins", "minute", "minutes". */
const MINUTES = /^min(ute)?s?$/i;

/** A rule the timer can be turned on for: a number rule counted in minutes. */
export const canTime = (rule: Rule) =>
  rule.kind === 'number' &&
  !!rule.target &&
  MINUTES.test(rule.target.unit.trim());

/** Rules with the timer on that `personId` has, in the challenge's order. */
export const timedRules = (w: World, personId: string) =>
  rulesFor(w.challenge, personId).filter((r) => r.timed && canTime(r));

/** Rules `personId` has that the timer could be turned on for, and isn't yet. */
export const timeableRules = (w: World, personId: string) =>
  rulesFor(w.challenge, personId).filter((r) => canTime(r) && !r.timed);

/** The timer `personId` has going (running or paused), if any. */
export const timerOf = (w: World, personId: string): TimerRun | null =>
  w.timers.find((t) => t.personId === personId) ?? null;

/** Seconds on a timer's clock at `now`: earlier stretches plus the one running, worked out from timestamps. */
export const timerSeconds = (run: TimerRun, now: Instant | number) =>
  run.banked +
  (run.runningSince
    ? Math.max(0, Math.floor((ms(now) - ms(run.runningSince)) / 1000))
    : 0);

/** The challenge day an instant falls on, in its time zone: the day a session started counts toward. */
export const timerDay = (w: World, at: Instant | number): DateString =>
  dateIn(w.challenge.timeZone, at);

/** One person's finished sessions on a rule, oldest first; only `day`'s when given. */
export const sessionsOf = (
  w: World,
  personId: string,
  ruleId: string,
  day?: DateString,
): TimerSession[] =>
  w.sessions
    .filter(
      (s) =>
        s.personId === personId &&
        s.ruleId === ruleId &&
        (day === undefined || s.day === day),
    )
    .sort((a, b) => ms(a.startedAt) - ms(b.startedAt));

/**
 * Seconds in `personId`'s stopped sessions on a timed rule for `day`: what is logged so far. A timer
 * still going isn't, until it stops.
 */
export const loggedSeconds = (
  w: World,
  personId: string,
  ruleId: string,
  day: DateString,
) =>
  sessionsOf(w, personId, ruleId, day).reduce((sum, s) => sum + s.seconds, 0);

/** Seconds timed on a rule on `day`: its finished sessions, plus a timer still going for that day. */
export function timedSeconds(
  w: World,
  personId: string,
  ruleId: string,
  day: DateString,
  now: Instant | number = w.now,
) {
  const done = loggedSeconds(w, personId, ruleId, day);
  const run = timerOf(w, personId);
  return run && run.ruleId === ruleId && run.day === day
    ? done + timerSeconds(run, now)
    : done;
}

/** Whole minutes, rounded down: what a timed day's answer is saved as (19:59 is 19 min). */
export const timedMinutes = (seconds: number) =>
  Math.floor(Math.max(0, seconds) / 60);

/**
 * Where a timed day stands against `personId`'s target: the seconds timed, the target, and `diff`,
 * the seconds past (positive) or short of (negative) the target's minutes. `met` uses the saved whole
 * minutes, so the moment the clock reaches the target is the moment the answer counts. For a limit
 * ("60 min or less"), a positive `diff` is time over the limit and `met` turns false.
 */
export function timedProgress(
  w: World,
  personId: string,
  rule: Rule,
  day: DateString,
  now: Instant | number = w.now,
) {
  return progressOf(
    rule,
    personId,
    timedSeconds(w, personId, rule.id, day, now),
  );
}

/** timedProgress for the stopped sessions only: what is logged so far, a timer still going left out. */
export const loggedProgress = (
  w: World,
  personId: string,
  rule: Rule,
  day: DateString,
) => progressOf(rule, personId, loggedSeconds(w, personId, rule.id, day));

function progressOf(rule: Rule, personId: string, seconds: number) {
  const target = targetFor(rule, personId);
  const targetSeconds = (target?.value ?? 0) * 60;
  const minutes = timedMinutes(seconds);
  return {
    seconds,
    minutes,
    target,
    targetSeconds,
    diff: seconds - targetSeconds,
    met: !!target && meetsTarget(target, minutes),
    /** True for an "at most" rule, where going past the target is a miss. */
    limit: target?.op === '<=',
  };
}

/**
 * A timed rule's days so far for `personId`, newest first, for the history: each day it asks
 * (from its first day to today), with the seconds timed, that day's sessions, and the answer saved
 * for it (by itself from the timer, or by hand), if any.
 */
export function timedDays(
  w: World,
  personId: string,
  rule: Rule,
  now: Instant | number = w.now,
) {
  const today = timerDay(w, now);
  return challengeDays(w.challenge)
    .filter((day) => day <= today && appliesOn(rule, day, w.challenge))
    .reverse()
    .map((day) => ({
      day,
      seconds: timedSeconds(w, personId, rule.id, day, now),
      sessions: sessionsOf(w, personId, rule.id, day),
      entry: entryFor(w, personId, rule.id, day) ?? null,
    }));
}

/* ── Goals ─────────────────────────────────────────────────────────────── */

/** How many goals a person can have on a challenge, and how long each can be. */
export const GOALS_MAX = 5;
export const GOAL_LENGTH = 100;

/** One person's goals for the challenge, in their order. */
export const goalsOf = (w: World, personId: string): Goal[] =>
  w.goals.filter((g) => g.personId === personId);
