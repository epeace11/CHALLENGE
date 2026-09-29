import type {
  Challenge,
  Couple,
  DateString,
  Dispute,
  Entry,
  ForgivenessRequest,
  Instant,
  Invite,
  JournalNote,
  Pact,
  PastChallenge,
  Person,
  Point,
  PracticeScript,
  Proof,
  Rule,
  SavedChallenge,
  SayRulesDraft,
  World,
} from './model.ts';
import {
  EVERY_DAY,
  LIBRARY,
  SUN_THU,
  THEMES,
  numberRule,
  weeklyRule,
  yesNo,
} from './catalog.ts';
import { dateRange, shift, weekday, zonedTime } from './calendar.ts';
import { screenTimeShot, stepsShot } from './shots.ts';

/**
 * The sample world every preview page is built on. Deterministic: fixed dates and times, never
 * the clock, no network. Maya is the viewer; Jordan is her partner. Both are fictional.
 *
 * Today is Friday, Nov 20, 2026, 7:30 pm in Toronto: Day 19 of Fall Reset (Mon Nov 2 – Tue Dec 1).
 * Thursday Nov 19 is the open day, loggable until 11:59 pm tonight.
 *
 * Key numbers (tests/next.mjs checks them):
 * - Maya: 3 check-ins open for Nov 19 (social media, reading, gym); 1 answer waiting for Jordan.
 * - Waiting for Maya: 2 of Jordan's answers (10,000 steps: 11,240 with a screenshot; social media:
 *   48 min), 1 forgiveness request (Nov 18, eating out) and 1 dispute Jordan raised (Maya's Nov 17 bedtime).
 * - Points: Maya 6 active, Jordan 9 active (plus 1 forgiven). Maya gets a $45 gift, Jordan a $21
 *   gift; Maya is ahead by 3. Maya's next miss adds $7, Jordan's $10.
 * - Gym this week (Nov 16–22): Maya 2 of 4, Jordan 3 of 4.
 * - Last week's recap (Nov 9–15): Maya 2 points, Jordan 3; Maya won; gym Maya 4 of 4, Jordan 3 of 4.
 */

export const TIME_ZONE = 'America/Toronto';

/** An instant for a Toronto wall-clock time. */
const at = (day: DateString, time: string): Instant =>
  new Date(zonedTime(day, time, TIME_ZONE)).toISOString();

/* ── The couple ────────────────────────────────────────────────────────── */

export const MAYA: Person = {
  id: 'maya',
  name: 'Maya',
  initial: 'M',
  email: 'maya@example.com',
  hue: 280,
};
export const JORDAN: Person = {
  id: 'jordan',
  name: 'Jordan',
  initial: 'J',
  email: 'jordan@example.com',
  hue: 195,
};
export const COUPLE: Couple = {
  id: 'maya-jordan',
  people: [MAYA, JORDAN],
  since: '2026-10-28',
};

/* ── Fall Reset ────────────────────────────────────────────────────────── */

export const FALL_RULES: Rule[] = [
  yesNo(
    'bed',
    'Sleep',
    'In bed by 11 pm, then read',
    'Were you in bed by 11 pm, reading until you fell asleep?',
    'In bed with the lights low by 11 pm, reading until you fall asleep.',
    { days: SUN_THU },
  ),
  yesNo(
    'phones',
    'Sleep',
    'No phones in the bedroom',
    'Did your phone stay out of the bedroom all night?',
    'Phones charge outside the bedroom. An alarm clock is fine.',
  ),
  numberRule(
    'social',
    'Screens',
    'Social media and games, 60 min or less',
    'How many minutes of social media and games?',
    'Add up social apps and games in Screen Time and attach the screenshot.',
    { op: '<=', value: 60, unit: 'min' },
    { proof: 'required' },
  ),
  numberRule(
    'steps',
    'Movement',
    '10,000 steps',
    'How many steps did you walk?',
    'Your phone’s step count for the day. Attach the screenshot.',
    { op: '>=', value: 10000, unit: 'steps' },
    { who: JORDAN.id, proof: 'required' },
  ),
  weeklyRule(
    'gym',
    'Movement',
    'Gym, 4 days a week',
    'Did you go to the gym?',
    'Any workout at a gym. Four days in each Monday-to-Sunday week.',
    4,
  ),
  yesNo(
    'eating-out',
    'Food',
    'No eating out',
    'Did you skip eating out?',
    'No restaurants, takeout or delivery. Coffee is fine.',
  ),
  numberRule(
    'read',
    'Mind',
    'Read 10 pages',
    'How many pages did you read?',
    'Any book, paper or e-reader.',
    { op: '>=', value: 10, unit: 'pages' },
    { who: MAYA.id },
  ),
  yesNo(
    'alcohol',
    'Drinks',
    'No alcohol',
    'Did you skip alcohol?',
    'No beer, wine or spirits.',
    { days: SUN_THU, who: MAYA.id },
  ),
];

export const FALL_RESET: Challenge = {
  id: 'fall-reset',
  coupleId: COUPLE.id,
  name: 'Fall Reset',
  look: 'classic',
  theme: null,
  start: '2026-11-02',
  days: 30,
  timeZone: TIME_ZONE,
  deadline: { daysAfter: 1, time: '23:59' },
  step: 1,
  cap: null,
  status: 'running',
  rules: FALL_RULES,
  weekStart: 1,
};

/* ── Answers, Nov 2 – 19 ───────────────────────────────────────────────── */

const CLOSED = dateRange('2026-11-02', '2026-11-18');
const OPEN_DAY = '2026-11-19';

/** Logged values for the number rules, Nov 2 – 18, in day order. */
const VALUES: Record<string, Record<string, number[]>> = {
  maya: {
    social: [
      42, 85, 38, 51, 29, 47, 55, 33, 40, 58, 36, 44, 31, 49, 72, 39, 45,
    ],
    read: [12, 15, 10, 22, 11, 18, 25, 14, 10, 16, 12, 4, 20, 30, 13, 11, 17],
  },
  jordan: {
    social: [
      95, 52, 44, 57, 38, 49, 41, 35, 53, 46, 39, 58, 110, 43, 50, 37, 55,
    ],
    steps: [
      10420, 12085, 7850, 11230, 10960, 13410, 10215, 11870, 10540, 12330,
      10105, 11460, 14020, 10780, 6420, 10890, 11615,
    ],
  },
};

/** Gym visits (every other closed day is a No). */
const GYM: Record<string, string[]> = {
  maya: [
    '2026-11-02',
    '2026-11-04',
    '2026-11-05',
    '2026-11-07',
    '2026-11-09',
    '2026-11-10',
    '2026-11-12',
    '2026-11-14',
    '2026-11-16',
    '2026-11-18',
  ],
  jordan: [
    '2026-11-03',
    '2026-11-04',
    '2026-11-06',
    '2026-11-08',
    '2026-11-09',
    '2026-11-11',
    '2026-11-13',
    '2026-11-16',
    '2026-11-17',
  ],
};

/** When each person usually logs the day before. */
const USUAL_TIME: Record<string, string> = { maya: '08:05', jordan: '07:45' };

function proofsFor(
  rule: Rule,
  personId: string,
  day: DateString,
  value: number | undefined,
): Proof[] {
  if (rule.proof === 'none' || value === undefined) return [];
  const takenAt = at(shift(day, 1), '07:30');
  if (rule.id === 'steps')
    return [
      {
        id: `proof-${personId}-${rule.id}-${day}`,
        src: stepsShot(value, day),
        alt: `Step count screenshot, ${value.toLocaleString('en-US')} steps`,
        takenAt,
      },
    ];
  if (rule.id === 'social')
    return [
      {
        id: `proof-${personId}-${rule.id}-${day}`,
        src: screenTimeShot(value, day),
        alt: `Screen Time screenshot, ${value} minutes of social media and games`,
        takenAt,
      },
    ];
  return [];
}

type Answer = Partial<
  Pick<Entry, 'done' | 'value' | 'status' | 'note' | 'loggedAt'>
>;

/** One answer, confirmed and done unless `o` says otherwise; number rules take their day's value. */
function answer(
  personId: string,
  rule: Rule,
  day: DateString,
  o: Answer = {},
): Entry {
  const i = CLOSED.indexOf(day);
  const value =
    o.value ??
    (rule.kind === 'number' ? VALUES[personId]?.[rule.id]?.[i] : undefined);
  const done =
    o.done !== undefined
      ? o.done
      : rule.kind === 'number' && rule.target && value !== undefined
        ? rule.target.op === '>='
          ? value >= rule.target.value
          : value <= rule.target.value
        : true;
  return {
    id: `entry-${personId}-${rule.id}-${day}`,
    personId,
    ruleId: rule.id,
    day,
    done,
    ...(value !== undefined ? { value } : {}),
    status: o.status ?? (done ? 'confirmed' : 'missed'),
    note: o.note ?? '',
    proofs: done === null ? [] : proofsFor(rule, personId, day, value),
    loggedAt: o.loggedAt ?? at(shift(day, 1), USUAL_TIME[personId]),
  };
}

/** Answers that differ from a plain confirmed Yes: misses, disputes, the open day. Keyed person|rule|day. */
const SPECIAL: Record<string, Answer> = {
  // Maya's six points.
  'maya|social|2026-11-03': { loggedAt: at('2026-11-04', '08:40') },
  'maya|eating-out|2026-11-06': {
    done: false,
    note: 'Dinner with my sister for her birthday.',
    loggedAt: at('2026-11-07', '10:05'),
  },
  'maya|bed|2026-11-11': {
    done: false,
    note: 'Up late finishing a work deck.',
    loggedAt: at('2026-11-12', '07:55'),
  },
  'maya|read|2026-11-13': { loggedAt: at('2026-11-14', '09:30') },
  'maya|social|2026-11-16': { loggedAt: at('2026-11-17', '08:15') },
  'maya|alcohol|2026-11-18': {
    done: false,
    note: 'One glass of wine at the office party.',
    loggedAt: at('2026-11-19', '08:20'),
  },
  // Jordan disputes Maya's Nov 17 bedtime.
  'maya|bed|2026-11-17': {
    status: 'disputed',
    loggedAt: at('2026-11-18', '07:50'),
  },
  // Jordan's misses.
  'jordan|social|2026-11-02': { loggedAt: at('2026-11-03', '21:10') },
  'jordan|steps|2026-11-04': { loggedAt: at('2026-11-05', '20:30') },
  'jordan|bed|2026-11-05': {
    done: false,
    note: 'Watched the late game.',
    loggedAt: at('2026-11-06', '08:10'),
  },
  'jordan|phones|2026-11-07': {
    done: false,
    status: 'excused',
    note: 'Used my phone as the alarm.',
    loggedAt: at('2026-11-08', '09:00'),
  },
  'jordan|eating-out|2026-11-12': {
    status: 'conceded',
    loggedAt: at('2026-11-13', '08:00'),
  },
  'jordan|social|2026-11-14': { loggedAt: at('2026-11-15', '10:20') },
  'jordan|steps|2026-11-16': { loggedAt: at('2026-11-17', '20:05') },
  'jordan|phones|2026-11-17': {
    done: null,
    status: 'unlogged',
    loggedAt: at('2026-11-18', '23:59'),
  },
  'jordan|eating-out|2026-11-18': {
    done: false,
    note: 'Team dinner for a coworker’s last day.',
    loggedAt: at('2026-11-19', '07:30'),
  },
};

function buildEntries(): Entry[] {
  const out: Entry[] = [];
  for (const person of [MAYA, JORDAN])
    for (const day of CLOSED)
      for (const rule of FALL_RULES) {
        if (rule.who !== 'both' && rule.who !== person.id) continue;
        if (!rule.days.includes(weekday(day))) continue;
        if (rule.kind === 'weekly') {
          out.push(
            answer(person.id, rule, day, {
              done: GYM[person.id].includes(day),
              status: 'confirmed',
            }),
          );
          continue;
        }
        out.push(
          answer(
            person.id,
            rule,
            day,
            SPECIAL[`${person.id}|${rule.id}|${day}`],
          ),
        );
      }
  const rule = (id: string) => FALL_RULES.find((r) => r.id === id)!;
  // The open day, Thursday Nov 19. Maya answered four; social media, reading and the gym are still open.
  out.push(
    answer(MAYA.id, rule('bed'), OPEN_DAY, {
      loggedAt: at('2026-11-20', '08:05'),
    }),
    answer(MAYA.id, rule('phones'), OPEN_DAY, {
      loggedAt: at('2026-11-20', '08:05'),
    }),
    answer(MAYA.id, rule('eating-out'), OPEN_DAY, {
      loggedAt: at('2026-11-20', '08:06'),
    }),
    answer(MAYA.id, rule('alcohol'), OPEN_DAY, {
      status: 'pending',
      loggedAt: at('2026-11-20', '17:10'),
    }),
    // Jordan answered everything; Maya approved four this morning and two wait for her.
    answer(JORDAN.id, rule('bed'), OPEN_DAY, {
      loggedAt: at('2026-11-20', '07:44'),
    }),
    answer(JORDAN.id, rule('phones'), OPEN_DAY, {
      loggedAt: at('2026-11-20', '07:44'),
    }),
    answer(JORDAN.id, rule('eating-out'), OPEN_DAY, {
      loggedAt: at('2026-11-20', '07:45'),
    }),
    answer(JORDAN.id, rule('gym'), OPEN_DAY, {
      loggedAt: at('2026-11-20', '07:45'),
    }),
    answer(JORDAN.id, rule('steps'), OPEN_DAY, {
      value: 11240,
      status: 'pending',
      note: 'Walked to work both ways.',
      loggedAt: at('2026-11-20', '18:40'),
    }),
    answer(JORDAN.id, rule('social'), OPEN_DAY, {
      value: 48,
      status: 'pending',
      loggedAt: at('2026-11-20', '18:41'),
    }),
  );
  return out;
}

const ENTRIES = buildEntries();
const entryId = (personId: string, ruleId: string, day: DateString) =>
  `entry-${personId}-${ruleId}-${day}`;

/** A point for a miss, created when the miss was logged. */
const missPoint = (
  id: string,
  personId: string,
  ruleId: string,
  day: DateString,
  o: Partial<Point> = {},
): Point => ({
  id,
  personId,
  ruleId,
  day,
  reason: 'missed',
  entryId: entryId(personId, ruleId, day),
  forgiven: false,
  voided: false,
  createdAt:
    ENTRIES.find((e) => e.id === entryId(personId, ruleId, day))?.loggedAt ??
    at(shift(day, 1), '08:00'),
  ...o,
});

const POINTS: Point[] = [
  missPoint('point-m1', MAYA.id, 'social', '2026-11-03'),
  missPoint('point-m2', MAYA.id, 'eating-out', '2026-11-06'),
  missPoint('point-m3', MAYA.id, 'bed', '2026-11-11'),
  missPoint('point-m4', MAYA.id, 'read', '2026-11-13'),
  missPoint('point-m5', MAYA.id, 'social', '2026-11-16'),
  missPoint('point-m6', MAYA.id, 'alcohol', '2026-11-18'),
  missPoint('point-j1', JORDAN.id, 'social', '2026-11-02'),
  missPoint('point-j2', JORDAN.id, 'steps', '2026-11-04'),
  missPoint('point-j3', JORDAN.id, 'bed', '2026-11-05'),
  missPoint('point-j-forgiven', JORDAN.id, 'phones', '2026-11-07', {
    forgiven: true,
  }),
  missPoint('point-j4', JORDAN.id, 'eating-out', '2026-11-12', {
    reason: 'conceded',
    createdAt: at('2026-11-13', '19:40'),
  }),
  missPoint('point-j5', JORDAN.id, 'social', '2026-11-14'),
  // Jordan went to the gym 3 times in the Nov 9–15 week; the week closed Monday at 11:59 pm.
  {
    id: 'point-j6',
    personId: JORDAN.id,
    ruleId: 'gym',
    day: '2026-11-15',
    reason: 'weekly',
    forgiven: false,
    voided: false,
    createdAt: at('2026-11-17', '00:00'),
  },
  missPoint('point-j7', JORDAN.id, 'steps', '2026-11-16'),
  missPoint('point-j8', JORDAN.id, 'phones', '2026-11-17', {
    reason: 'unlogged',
    createdAt: at('2026-11-19', '00:00'),
  }),
  missPoint('point-j9', JORDAN.id, 'eating-out', '2026-11-18'),
];

const REQUESTS: ForgivenessRequest[] = [
  {
    id: 'request-phones-nov-7',
    pointId: 'point-j-forgiven',
    from: JORDAN.id,
    reason: 'Needed my phone as the alarm. I bought a clock the next day.',
    status: 'approved',
    createdAt: at('2026-11-08', '09:01'),
    decidedAt: at('2026-11-08', '12:30'),
  },
  {
    id: 'request-eating-out-nov-18',
    pointId: 'point-j9',
    from: JORDAN.id,
    reason:
      'Team dinner for a coworker’s last day. I ordered a salad and water.',
    status: 'pending',
    createdAt: at('2026-11-19', '07:31'),
  },
];

const DISPUTES: Dispute[] = [
  {
    id: 'dispute-eating-out-nov-12',
    entryId: entryId(JORDAN.id, 'eating-out', '2026-11-12'),
    raisedBy: MAYA.id,
    comment: 'You had a burrito at lunch. I saw the receipt.',
    reply: 'Forgot about that. Fair.',
    status: 'conceded',
    createdAt: at('2026-11-13', '12:15'),
    resolvedAt: at('2026-11-13', '19:40'),
  },
  {
    id: 'dispute-bed-nov-17',
    entryId: entryId(MAYA.id, 'bed', '2026-11-17'),
    raisedBy: JORDAN.id,
    comment: 'You were on the couch with your phone until 11:40.',
    status: 'open',
    createdAt: at('2026-11-18', '08:30'),
  },
];

const JOURNAL: JournalNote[] = [
  {
    id: 'note-1',
    personId: MAYA.id,
    day: '2026-11-09',
    text: 'Both phones charge in the kitchen now. Easier than I expected.',
    createdAt: at('2026-11-09', '22:40'),
  },
  {
    id: 'note-2',
    personId: MAYA.id,
    day: '2026-11-16',
    text: 'Screen time was high because the flight was delayed three hours.',
    createdAt: at('2026-11-16', '23:05'),
  },
  {
    id: 'note-3',
    personId: JORDAN.id,
    day: '2026-11-18',
    text: 'Team dinner. Ordered a salad and water.',
    createdAt: at('2026-11-18', '21:30'),
  },
  {
    id: 'note-4',
    personId: MAYA.id,
    day: '2026-11-19',
    text: 'Finished the book I started on day 1.',
    createdAt: at('2026-11-19', '22:15'),
  },
];

/* ── Saved and past challenges ─────────────────────────────────────────── */

const SUMMER_RULES: Rule[] = [
  yesNo(
    'ss-bed',
    'Sleep',
    'In bed by 11 pm',
    'Were you in bed by 11 pm?',
    'In bed with the lights low by 11 pm.',
    { days: SUN_THU },
  ),
  yesNo(
    'ss-phones',
    'Sleep',
    'No phones in the bedroom',
    'Did your phone stay out of the bedroom all night?',
    'Phones charge outside the bedroom. An alarm clock is fine.',
  ),
  numberRule(
    'ss-steps',
    'Movement',
    '10,000 steps',
    'How many steps did you walk?',
    'Your phone’s step count for the day. Attach the screenshot.',
    { op: '>=', value: 10000, unit: 'steps' },
    { who: JORDAN.id, proof: 'required' },
  ),
  weeklyRule(
    'ss-gym',
    'Movement',
    'Gym, 3 days a week',
    'Did you go to the gym?',
    'Any workout at a gym. Three days in each Monday-to-Sunday week.',
    3,
  ),
  yesNo(
    'ss-eating-out',
    'Food',
    'No eating out',
    'Did you skip eating out?',
    'No restaurants, takeout or delivery. Coffee is fine.',
  ),
  numberRule(
    'ss-read',
    'Mind',
    'Read 10 pages',
    'How many pages did you read?',
    'Any book, paper or e-reader.',
    { op: '>=', value: 10, unit: 'pages' },
    { who: MAYA.id },
  ),
];

const SAVED: SavedChallenge[] = [
  {
    id: 'saved-summer-sprint',
    name: 'Summer Sprint',
    look: 'classic',
    days: 21,
    step: 1,
    cap: null,
    rules: SUMMER_RULES,
    source: 'mine',
    sharedBy: null,
    link: 'https://thechallenge.win/c/summer-sprint-k4t9',
    linkOn: false,
    savedOn: '2026-07-27',
  },
  {
    id: 'saved-dry-october',
    name: 'Dry October',
    look: 'dry',
    days: 31,
    step: 2,
    cap: null,
    rules: [
      yesNo(
        'do-no-alcohol',
        'Drinks',
        'No alcohol',
        'Did you skip alcohol?',
        'No beer, wine or spirits.',
      ),
      yesNo(
        'do-no-weed',
        'Drinks',
        'No weed',
        'Did you skip weed?',
        'Smoking, vaping and edibles.',
      ),
    ],
    source: 'link',
    sharedBy: 'Priya & Sam',
    link: 'https://thechallenge.win/c/dry-october-p8m2',
    linkOn: true,
    savedOn: '2026-10-02',
  },
];

const PAST: PastChallenge[] = [
  {
    challenge: {
      id: 'summer-sprint',
      coupleId: COUPLE.id,
      name: 'Summer Sprint',
      look: 'classic',
      theme: null,
      start: '2026-07-06',
      days: 21,
      timeZone: TIME_ZONE,
      deadline: { daysAfter: 1, time: '23:59' },
      step: 1,
      cap: null,
      status: 'finished',
      rules: SUMMER_RULES,
      weekStart: 1,
    },
    verdict: {
      challengeId: 'summer-sprint',
      finishedOn: '2026-07-26',
      people: [
        {
          personId: MAYA.id,
          points: 4,
          forgiven: 1,
          owes: 10,
          gets: 28,
          bestStreak: { ruleId: 'ss-phones', days: 21 },
          cleanDays: 14,
          badges: [
            'first-clean-day',
            'clean-week',
            'streak-7',
            'streak-14',
            'streak-all',
            'week-won',
            'gracious',
          ],
        },
        {
          personId: JORDAN.id,
          points: 7,
          forgiven: 0,
          owes: 28,
          gets: 10,
          bestStreak: { ruleId: 'ss-steps', days: 12 },
          cleanDays: 9,
          badges: ['first-clean-day', 'streak-7', 'full-week'],
        },
      ],
      winner: MAYA.id,
    },
  },
];

/* ── Before day one ────────────────────────────────────────────────────── */

const INVITE: Invite = {
  id: 'invite-fall-reset',
  challengeId: FALL_RESET.id,
  from: MAYA.id,
  to: { name: JORDAN.name, email: JORDAN.email },
  link: 'https://thechallenge.win/i/fall-reset-7kq2',
  code: 'FALL-7KQ2',
  sentAt: at('2026-10-30', '20:12'),
  status: 'sent',
};

const PACT: Pact = {
  challengeId: FALL_RESET.id,
  terms: [
    'We answer every check-in honestly, by 11:59 pm the next day.',
    'We review each other’s answers fairly, and say why when we dispute one.',
    'Each miss is a point. The first point costs $1, the second $2, and so on.',
    'When it ends, each of us buys the other a gift worth our own points.',
  ],
  signatures: [
    { personId: MAYA.id, signedAt: at('2026-10-31', '21:14') },
    { personId: JORDAN.id, signedAt: null },
  ],
};

const fallRule = (id: string) => FALL_RULES.find((r) => r.id === id)!;

const PRACTICE: PracticeScript = {
  questions: [
    { rule: fallRule('bed'), sample: { done: true } },
    { rule: fallRule('social'), sample: { value: 45 } },
    { rule: fallRule('eating-out'), sample: { done: false } },
  ],
  partnerReview: [
    { ruleId: 'bed', decision: 'approve' },
    {
      ruleId: 'social',
      decision: 'dispute',
      comment: 'The screenshot says 1h 12m.',
    },
  ],
  miss: { ruleId: 'eating-out', cost: FALL_RESET.step },
};

const SAY_RULES: SayRulesDraft = {
  sentence:
    'We both want to be in bed by 11 on weeknights and read till we fall asleep, no phones in the bedroom, and I’ll do 10k steps every day with a screenshot',
  rules: [
    yesNo(
      'say-bed',
      'Sleep',
      'In bed by 11 pm, then read',
      'Were you in bed by 11 pm, reading until you fell asleep?',
      'In bed by 11 pm on weeknights, reading until you fall asleep.',
      { days: SUN_THU },
    ),
    yesNo(
      'say-phones',
      'Sleep',
      'No phones in the bedroom',
      'Did your phone stay out of the bedroom all night?',
      'Phones charge outside the bedroom.',
    ),
    numberRule(
      'say-steps',
      'Movement',
      '10,000 steps',
      'How many steps did you walk?',
      'Your phone’s step count for the day. Attach the screenshot.',
      { op: '>=', value: 10000, unit: 'steps' },
      { who: MAYA.id, proof: 'required' },
    ),
  ],
  questions: [
    {
      ruleId: 'say-phones',
      text: 'Every night, or Sun–Thu like bedtime?',
      options: [
        { label: 'Every night', days: EVERY_DAY },
        { label: 'Sun–Thu', days: SUN_THU },
      ],
    },
  ],
};

/* ── The world ─────────────────────────────────────────────────────────── */

/** Freezes the sample world so a page that mutates it fails loudly; use the actions in lib/next/actions.ts instead. */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

export const world: World = deepFreeze({
  now: at('2026-11-20', '19:30'),
  today: '2026-11-20',
  me: MAYA,
  partner: JORDAN,
  couple: COUPLE,
  challenge: FALL_RESET,
  entries: ENTRIES,
  points: POINTS,
  requests: REQUESTS,
  disputes: DISPUTES,
  journal: JOURNAL,
  saved: SAVED,
  past: PAST,
  themes: THEMES,
  library: LIBRARY,
  invite: INVITE,
  pact: PACT,
  practice: PRACTICE,
  sayRules: SAY_RULES,
});
