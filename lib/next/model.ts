/**
 * Types for The Challenge, the couples product on the prod-challenge branch.
 * Plain TypeScript with no React, so Node tests can import it. Every challenge has exactly two people.
 *
 * Dates are 'YYYY-MM-DD' strings in the challenge's time zone. Instants are ISO strings.
 * Money is in dollars (a $0.25 step is 0.25).
 */

/** A calendar date, 'YYYY-MM-DD', in the challenge's time zone. */
export type DateString = string;
/** A moment in time, as an ISO string ('2026-11-21T00:30:00.000Z'). */
export type Instant = string;
/** 0 = Sunday, 1 = Monday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Person = {
  id: string;
  name: string;
  /** One letter for avatars. */
  initial: string;
  email: string;
  /** Avatar hue, 0–360. */
  hue: number;
};

/** The two people. `people[0]` is whoever signed up first. */
export type Couple = {
  id: string;
  people: [Person, Person];
  /** Day they joined, for the account screens. */
  since: DateString;
};

/** A challenge's colour theme. `classic` is today's purple glass. */
export type Look = 'classic' | 'seventy-five' | 'sleep' | 'dry' | 'fitness';

export type RuleGroup =
  | 'Sleep'
  | 'Screens'
  | 'Food'
  | 'Drinks'
  | 'Movement'
  | 'Mind'
  | 'Money'
  | 'Home';

/**
 * - `yesno`: a Yes or No each day it applies.
 * - `number`: a number each day, checked against `target` (minutes, steps, pages…).
 * - `weekly`: asked each day as a Yes or No; only the week's total counts, against `weeklyTarget`.
 *   A day without a visit costs nothing; each visit short of the target when the week closes is a point.
 */
export type RuleKind = 'yesno' | 'number' | 'weekly';

/** A number rule's target: `>=` for at least (10,000 steps), `<=` for at most (60 min). */
export type Target = { op: '>=' | '<='; value: number; unit: string };

/** Whether a Yes needs screenshots. */
export type ProofNeed = 'none' | 'optional' | 'required';

export type Rule = {
  id: string;
  /** Short name for lists: "In bed by 11 pm, then read". */
  title: string;
  /** Asked at check-in: "Were you in bed by 11 pm, reading until you fell asleep?" */
  question: string;
  /** One or two plain sentences on what counts. */
  description: string;
  group: RuleGroup;
  kind: RuleKind;
  /** Weekdays it applies (0 = Sunday). A weekly rule lists the days a visit can count, usually all seven. */
  days: Weekday[];
  /** Weekly rules: days needed in each full week. Partial weeks need proportionally fewer (see weekTarget). */
  weeklyTarget?: number;
  /** Number rules only. */
  target?: Target;
  /** Each person sets their own target value at setup (a calorie limit). Themes only. */
  personalTarget?: boolean;
  /** 'both', or the id of the one person who has it. */
  who: 'both' | (string & {});
  proof: ProofNeed;
  /** First and last day it applies; the challenge's own dates when absent. */
  startsOn?: DateString;
  endsOn?: DateString;
};

/**
 * - `pending`: answered, waiting for the partner's review.
 * - `confirmed`: approved (a weekly rule's answers and a No need no review).
 * - `missed`: a No, or a number off target. It has a point.
 * - `disputed`: the partner disputed it; see the open Dispute. No point while it is open.
 * - `excused`: a miss the partner forgave. Its point costs nothing.
 * - `conceded`: the person accepted a dispute. It has a point.
 * - `unlogged`: nothing was logged by the deadline. It has a point.
 */
export type EntryStatus =
  | 'pending'
  | 'confirmed'
  | 'missed'
  | 'disputed'
  | 'excused'
  | 'conceded'
  | 'unlogged';

/** One screenshot. `src` is a URL (sample data uses inline SVG data URIs). */
export type Proof = {
  id: string;
  src: string;
  /** What it shows, for screen readers: "Step count screenshot, 11,240 steps". */
  alt: string;
  /** When the photo was taken, if the image says. */
  takenAt?: Instant;
};

/** A late answer proposed after the deadline; it counts only once the partner approves it. */
export type Correction = {
  done: boolean;
  value?: number;
  note: string;
  proofs: Proof[];
  proposedAt: Instant;
};

/** One person's answer to one rule on one day. */
export type Entry = {
  id: string;
  personId: string;
  ruleId: string;
  day: DateString;
  /** Yes or No; for number rules, whether `value` met the target. Null when nothing was logged. */
  done: boolean | null;
  /** Number rules: what was logged. */
  value?: number;
  status: EntryStatus;
  note: string;
  proofs: Proof[];
  /** When it was logged or last changed. */
  loggedAt?: Instant;
  correction?: Correction;
};

/**
 * A miss. The nth active point a person gets costs n times the step; forgiven and voided points
 * cost nothing and keep their place in the history. Order is by `createdAt`.
 */
export type Point = {
  id: string;
  personId: string;
  ruleId: string;
  /** The day missed; for a weekly shortfall, the week's last day. */
  day: DateString;
  reason: 'missed' | 'unlogged' | 'conceded' | 'weekly';
  entryId?: string;
  forgiven: boolean;
  voided: boolean;
  createdAt: Instant;
};

/** Someone asks their partner to forgive one of their points. */
export type ForgivenessRequest = {
  id: string;
  pointId: string;
  /** The person asking: the point's owner. */
  from: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: Instant;
  decidedAt?: Instant;
};

/** One person questions the other's answer. The answer's owner concedes (it becomes a point) or the raiser withdraws. */
export type Dispute = {
  id: string;
  entryId: string;
  raisedBy: string;
  comment: string;
  /** The answer owner's reply, if any. */
  reply?: string;
  status: 'open' | 'conceded' | 'withdrawn';
  createdAt: Instant;
  resolvedAt?: Instant;
};

/** A dated note. Both people read them; they never affect scoring. */
export type JournalNote = {
  id: string;
  personId: string;
  day: DateString;
  text: string;
  createdAt: Instant;
};

/** When a day's logging closes: `time` on the day `daysAfter` days later ("11:59 pm the next day"). */
export type Deadline = { daysAfter: number; time: string };

export type ChallengeStatus =
  | 'draft'
  | 'invited'
  | 'signing'
  | 'running'
  | 'finished';

export type Challenge = {
  id: string;
  coupleId: string;
  name: string;
  look: Look;
  /** The theme it started from, if any. */
  theme: string | null;
  /** First day. */
  start: DateString;
  /** How many days it runs, the start included. */
  days: number;
  /** IANA time zone the days and deadlines follow. */
  timeZone: string;
  deadline: Deadline;
  /** Dollars the first point costs; the nth point costs n times this. */
  step: number;
  /** Most a gift can reach, in dollars; null for no cap. */
  cap: number | null;
  status: ChallengeStatus;
  rules: Rule[];
  /** First day of each week, for weekly rules and the Monday recap. */
  weekStart: Weekday;
};

/** A challenge kept to run again, or opened from a link another couple shared. */
export type SavedChallenge = {
  id: string;
  name: string;
  look: Look;
  days: number;
  step: number;
  cap: number | null;
  rules: Rule[];
  /** 'mine': saved by this couple. 'link': opened from a link another couple shared. */
  source: 'mine' | 'link';
  /** Who shared it, for 'link' ("Priya & Sam"). */
  sharedBy: string | null;
  /** The share link. For 'mine' it works only while `linkOn`. */
  link: string;
  linkOn: boolean;
  savedOn: DateString;
};

/** A ready-made challenge to start from. */
export type Theme = {
  id: string;
  name: string;
  look: Look;
  days: number;
  step: number;
  /** One plain sentence on what it asks. */
  summary: string;
  rules: Rule[];
  /** Rules that start switched off and can be added at setup. */
  optionalRuleIds: string[];
};

export type Badge = {
  id: string;
  title: string;
  /** How to earn it, in a few words. */
  how: string;
  earned: boolean;
  earnedOn?: DateString;
  /** How close a badge not yet earned is. */
  progress?: { have: number; need: number; unit: string };
};

/** Where a day stands, for one person, in a calendar. */
export type DayColor =
  | 'done'
  | 'excused'
  | 'missed'
  | 'review'
  | 'open'
  | 'ahead';

/** The final result of a finished challenge. */
export type Verdict = {
  challengeId: string;
  finishedOn: DateString;
  people: {
    personId: string;
    /** Active points at the end. */
    points: number;
    forgiven: number;
    /** Dollars this person spends on the gift for their partner. */
    owes: number;
    /** Dollars of the gift this person receives. */
    gets: number;
    bestStreak: { ruleId: string; days: number };
    /** Days with nothing missed. */
    cleanDays: number;
    badges: string[];
  }[];
  /** Fewer points wins; null on a tie. */
  winner: string | null;
};

/** One Monday-to-Sunday week, told on the Monday after. */
export type Recap = {
  weekStart: DateString;
  weekEnd: DateString;
  people: {
    personId: string;
    /** Points dated in the week, forgiven ones excluded. */
    points: number;
    /** Dollars those points added to this person's gift. */
    dollars: number;
    /** Daily check-ins done out of those due. */
    done: number;
    due: number;
    /** Weekly rules this person has: visits made against the week's target. */
    weekly: { ruleId: string; have: number; need: number }[];
    /** Longest streak still going at the week's end. */
    bestStreak: { ruleId: string; days: number } | null;
  }[];
  /** Fewer points wins the week; null on a tie. */
  winner: string | null;
};

/** The invite a person sends their partner. */
export type Invite = {
  id: string;
  challengeId: string;
  from: string;
  to: { name: string; email: string };
  link: string;
  /** Short code to type instead of opening the link. */
  code: string;
  sentAt: Instant;
  status: 'draft' | 'sent' | 'opened' | 'accepted';
};

/** Both people sign before day one. */
export type Pact = {
  challengeId: string;
  /** What signing means, in plain sentences. */
  terms: string[];
  signatures: { personId: string; signedAt: Instant | null }[];
};

/** A pretend day that shows how check-ins, reviews and misses work, before the real start. */
export type PracticeScript = {
  /** Three sample questions with a suggested answer each. */
  questions: { rule: Rule; sample: { done?: boolean; value?: number } }[];
  /** What the pretend partner does with the answers. */
  partnerReview: {
    ruleId: string;
    decision: 'approve' | 'dispute';
    comment?: string;
  }[];
  /** The answer that turns into a pretend miss, and what it would cost. */
  miss: { ruleId: string; cost: number };
};

/** What "Say your rules" drafts from one spoken or typed sentence. */
export type SayRulesDraft = {
  sentence: string;
  rules: Rule[];
  /** Anything it could not tell, asked back as a choice. */
  questions: {
    ruleId: string;
    text: string;
    options: { label: string; days: Weekday[] }[];
  }[];
};

/** A finished challenge and how it ended. */
export type PastChallenge = { challenge: Challenge; verdict: Verdict };

/** Everything a page can show. The viewer is `me`; `partner` is the other person. */
export type World = {
  /** The current moment and today's date in the challenge's time zone. */
  now: Instant;
  today: DateString;
  me: Person;
  partner: Person;
  couple: Couple;
  /** The running challenge. */
  challenge: Challenge;
  entries: Entry[];
  points: Point[];
  requests: ForgivenessRequest[];
  disputes: Dispute[];
  journal: JournalNote[];
  saved: SavedChallenge[];
  past: PastChallenge[];
  themes: Theme[];
  /** Rules to pick from when building a challenge. */
  library: Rule[];
  invite: Invite;
  pact: Pact;
  practice: PracticeScript;
  sayRules: SayRulesDraft;
};
