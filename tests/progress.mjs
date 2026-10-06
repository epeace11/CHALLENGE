import assert from 'node:assert/strict';
import {
  tone,
  personBar,
  habitStats,
  habitOrder,
  daysWon,
  perfectDays,
  costByHabit,
  nextMissCost,
  badges,
  dayNumber,
  total,
  maxLoggable,
  locked,
} from '../lib/progress.ts';
import { days, START, END } from '../lib/dates.ts';
import { activeRules } from '../lib/rules.ts';
import { toWeeks } from '../lib/weeks.ts';
import { readFileSync } from 'node:fs';
// Weeks and targets exactly as the database defines them, so the app and supabase/setup.sql cannot drift apart.
const setup = readFileSync(
  new URL('../supabase/setup.sql', import.meta.url),
  'utf8',
);
const weekRows = [
  ...setup
    .match(/insert into public\.challenge_weeks values(.*);/)[1]
    .matchAll(/\('([\d-]+)','([\d-]+)'\)/g),
].map((m) => ({ start_date: m[1], end_date: m[2] }));
const targetRows = [
  ...setup
    .match(/insert into public\.challenge_weekly_targets values(.*);/)[1]
    .matchAll(/\('(\w+)','([\d-]+)',(\d+)\)/g),
].map((m) => ({ rule_id: m[1], start_date: m[2], target: +m[3] }));
const weeks = toWeeks(weekRows, targetRows);
assert.match(
  setup,
  new RegExp(
    `start_date date not null default '${START}',end_date date not null default '${END}'`,
  ),
);
const erin = { id: 'e', name: 'Erin' },
  kazzy = { id: 'k', name: 'Kazzy' };
const now = Date.parse('2026-09-20T16:00:00Z'); // Sunday Sep 20, noon Toronto: Sep 15–18 closed, Sep 19 still open
let n = 0;
const entry = (uid, rule, day, o = {}) => ({
  id: `x${++n}`,
  user_id: uid,
  rule_id: rule,
  day,
  done: true,
  status: 'confirmed',
  note: '',
  proof: null,
  proposed_done: null,
  proposed_note: null,
  proposed_proof: null,
  updated_at: day,
  ...o,
});
const erinDaily = [
  'bed',
  'screens',
  'weed',
  'prayer',
  'food',
  'time',
  'entertainment',
  'steps',
];
const entries = [
  ...erinDaily.map((r) => entry('e', r, '2026-09-15')),
  ...erinDaily.map((r) =>
    entry(
      'e',
      r,
      '2026-09-16',
      r === 'prayer' ? { done: false, status: 'missed' } : {},
    ),
  ),
  ...erinDaily.map((r) =>
    entry(
      'e',
      r,
      '2026-09-17',
      r === 'prayer' ? { done: false, status: 'excused' } : {},
    ),
  ),
  ...erinDaily
    .filter((r) => !['bed', 'screens', 'weed'].includes(r))
    .map((r) => entry('e', r, '2026-09-18')),
  ...['prayer', 'food', 'time'].map((r) =>
    entry('e', r, '2026-09-19', { status: 'pending' }),
  ),
];
const point = (id, uid, rule, day, created, o = {}) => ({
  id,
  user_id: uid,
  rule_id: rule,
  day,
  reason: 'missed',
  forgiven: false,
  voided: false,
  entry_id: null,
  created_at: created,
  ...o,
});
const points = [
  point('p1', 'e', 'prayer', '2026-09-16', '2026-09-16T20:00:00Z'),
  point('p2', 'e', 'prayer', '2026-09-17', '2026-09-17T20:00:00Z', {
    forgiven: true,
  }),
  point('p3', 'k', 'bed', '2026-09-15', '2026-09-16T22:00:00Z', {
    reason: 'unlogged',
  }),
  point('p5', 'k', 'screens', '2026-09-15', '2026-09-16T22:00:00Z', {
    reason: 'unlogged',
  }),
];
const data = {
  profiles: [erin, kazzy],
  entries,
  points,
  requests: [],
  disputes: [],
  finalizations: [],
  journals: [],
  photos: [],
  weeks,
};

assert.equal(maxLoggable(now), '2026-09-19');
// locked mirrors challenge_locked in supabase/setup.sql: settled once its deadline has passed. Sep 16 locked at Sep 17, 11:59 pm; Sep 19 locks tonight.
for (const status of ['confirmed', 'missed', 'excused', 'conceded'])
  assert.equal(
    locked(entry('e', 'bed', '2026-09-16', { status }), now),
    true,
    status,
  );
for (const status of ['pending', 'disputed', 'unlogged'])
  assert.equal(
    locked(entry('e', 'bed', '2026-09-16', { status }), now),
    false,
    status,
  );
assert.equal(
  locked(
    entry('e', 'bed', '2026-09-16', { status: 'missed', proposed_done: true }),
    now,
  ),
  false,
); // a correction is waiting
assert.equal(
  locked(entry('e', 'bed', '2026-09-19', { status: 'confirmed' }), now),
  false,
); // deadline not passed
assert.equal(locked(undefined, now), false); // nothing logged is a late correction, not a lock
assert.equal(maxLoggable(Date.parse('2026-09-13T16:00:00Z')), '2026-09-14'); // before the start nothing is loggable
assert.equal(
  tone(undefined, '2026-09-15', Date.parse('2026-09-13T16:00:00Z')),
  'future',
);
assert.equal(personBar(data, erin, Date.parse('2026-09-13T16:00:00Z')).open, 0);
assert.equal(dayNumber(now), 6);
assert.equal(weeks.length, 5);
assert.deepEqual(
  weeks.map((w) => w.targets.gym),
  [3, 4, 4, 4, 1],
);
// Kazzy's steps start with the Sep 28 week (supabase/steps-from-sep-28.sql): Sep 21–27 has no steps target, so it is never assessed or counted.
assert.deepEqual(
  weeks.map((w) => w.targets.steps_weekly ?? 0),
  [0, 0, 3, 3, 1],
);
assert.equal(weeks[0].start, START);
assert.equal(weeks.at(-1).end, END);
assert.equal(tone(undefined, '2026-09-18', now), 'missed');
assert.equal(tone(undefined, '2026-09-19', now), 'open');
assert.equal(tone(undefined, '2026-09-20', now), 'future');
assert.equal(
  tone(
    entry('e', 'bed', '2026-09-16', { status: 'pending' }),
    '2026-09-16',
    now,
  ),
  'review',
);
assert.equal(
  tone(
    entry('e', 'bed', '2026-09-16', {
      proposed_done: true,
      done: false,
      status: 'unlogged',
    }),
    '2026-09-16',
    now,
  ),
  'review',
);

// Erin's bar: Sep 18 is a Friday so weeknight rules are off; 8+7+7+5 done, 1 excused, 1 missed, 3 reviewing, 2 open daily. The 3 unmet gym visits stay ahead until the week is assessed.
const bar = personBar(data, erin, now);
assert.deepEqual(
  {
    done: bar.done,
    excused: bar.excused,
    missed: bar.missed,
    review: bar.review,
    open: bar.open,
  },
  { done: 27, excused: 1, missed: 1, review: 3, open: 2 },
);
// Kazzy's weed rule runs every day and his 1 am bed rule runs Fri/Sat, so his bar has two more habit-days per weekend day than Erin's, plus his weekly step days.
const weekendDays = days().filter(
  (d) => new Date(d + 'T12:00Z').getUTCDay() > 4,
).length;
assert.equal(
  total(bar) - 1 + 2 * weekendDays + 7,
  total(personBar(data, kazzy, now)),
); // plus his weekly steps targets, 3+3+1 (none before Sep 28); Erin's one is her Sunday hands photo, asked from Oct 11 only
// Gym days asked or forgiven count toward the open week: one forgiven visit is excused, one still asked is under review, the rest stay ahead.
const gymAsk = (id, day, forgiven) => ({
  id,
  user_id: 'e',
  rule_id: 'gym',
  day,
  reason: 'day_forgiveness',
  forgiven,
  voided: false,
  entry_id: null,
  created_at: day,
});
const gbar = personBar(
  {
    ...data,
    points: [
      ...data.points,
      gymAsk('ga', '2026-09-16', true),
      gymAsk('gb', '2026-09-17', false),
    ],
    requests: [
      ...data.requests,
      {
        id: 'rgb',
        point_id: 'gb',
        requester_id: 'e',
        reason: 'x',
        status: 'pending',
      },
    ],
  },
  erin,
  now,
);
assert.deepEqual(
  [gbar.excused - bar.excused, gbar.review - bar.review, total(gbar)],
  [1, 1, total(bar)],
);
const kbar = personBar(data, kazzy, now);
assert.equal(kbar.done, 0);
assert.equal(kbar.review, 0);
// Kazzy's 4 closed days all missed: Tue/Wed/Thu 8 rules, Fri 7 (weed still counts, plus the weekend bed rule).
assert.equal(kbar.missed, 8 + 8 + 8 + 7);
const ks = habitStats(data, kazzy, now);
assert.ok(
  ks.some((s) => s.rule.id === 'bed') &&
    ks.some((s) => s.rule.id === 'bed_1am') &&
    !ks.some((s) => s.rule.id === 'weed'),
);
assert.equal(ks.find((s) => s.rule.id === 'bed_1am').missed, 1); // only Fri Sep 18 has closed

// Streaks: excused neither breaks nor extends; pending counts as done.
const es = habitStats(data, erin, now);
const bed = es.find((s) => s.rule.id === 'bed'),
  prayer = es.find((s) => s.rule.id === 'prayer');
assert.deepEqual(
  { streak: bed.streak, best: bed.best, missed: bed.missed },
  { streak: 3, best: 3, missed: 0 },
); // 15,16 done, 17 excused; 18 Fri off, 19 Sat off
assert.deepEqual(
  {
    streak: prayer.streak,
    best: prayer.best,
    missed: prayer.missed,
    done: prayer.done,
  },
  { streak: 2, best: 2, missed: 1, done: 2 },
);
assert.equal(prayer.rate, 2 / 3);
assert.equal(prayer.dollars, 1);
assert.ok(!es.some((s) => s.rule.id === 'gym' || s.rule.id === 'calories'));
const order = habitOrder({ e: es, k: habitStats(data, kazzy, now) });
assert.equal(order[0].id, 'prayer'); // Kazzy missed everything equally; Erin's prayer miss tips it

// Days won and perfect days
const won = daysWon(data, now);
assert.deepEqual(
  { e: won.wins.e, k: won.wins.k, ties: won.ties, n: won.recent.length },
  { e: 4, k: 0, ties: 0, n: 4 },
);
const perfect = perfectDays(data, erin, now);
assert.deepEqual(
  {
    count: perfect.count,
    longest: perfect.longest,
    current: perfect.current,
    first: perfect.first,
  },
  { count: 3, longest: 2, current: 2, first: '2026-09-15' },
); // Sep 17 (excused) and 18 are clean and 18 is the latest closed day, so the run is still going

// Money: position-based, forgiven excluded
assert.equal(nextMissCost(data, erin.id), 2);
assert.equal(nextMissCost(data, kazzy.id), 3);
assert.deepEqual(costByHabit(data, kazzy.id)[0], {
  rule: 'screens',
  dollars: 2,
  count: 1,
});

// Badges
const eb = badges(data, erin, now),
  kb = badges(data, kazzy, now);
const get = (list, id) => list.find((b) => b.id === id);
assert.deepEqual(
  { earned: get(eb, 'first_clean').earned, date: get(eb, 'first_clean').date },
  { earned: true, date: '2026-09-15' },
);
assert.equal(get(eb, 'clean_week').earned, false);
assert.equal(get(eb, 'gracious').earned, false);
assert.equal(get(kb, 'gracious').earned, true); // Erin's point was forgiven, so Kazzy forgave
assert.equal(get(kb, 'first_clean').earned, false);
assert.equal(get(eb, 'halfway').earned, false);
// New badges: Erin won Sep 15–17 in a row; nobody has a closed gym week yet; the finish is far off.
assert.deepEqual(
  { earned: get(eb, 'hat_trick').earned, date: get(eb, 'hat_trick').date },
  { earned: true, date: '2026-09-17' },
);
assert.equal(get(kb, 'hat_trick').earned, false);
assert.equal(get(eb, 'iron_week').earned, false);
assert.equal(get(eb, 'strong_finish').earned, false);
assert.equal(eb.length, 12);
// Progress toward the badges that build up, shown only while they are not yet earned.
assert.equal(get(eb, 'first_clean').progress, undefined);
assert.equal(get(eb, 'hat_trick').progress, undefined);
assert.deepEqual(get(eb, 'clean_week').progress, {
  have: 2,
  need: 7,
  unit: 'clean days in a row',
});
// Erin's longest streak still going is five (food and screen time: Sep 15–18 done, Sep 19 under review).
assert.deepEqual(get(eb, 'streak7').progress, {
  have: 5,
  need: 7,
  unit: 'days in a row',
});
assert.equal(get(eb, 'streak30').progress.have, 5);
assert.deepEqual(get(kb, 'hat_trick').progress, {
  have: 0,
  need: 3,
  unit: 'days won in a row',
});
assert.deepEqual(get(eb, 'iron_week').progress, {
  have: 0,
  need: 3,
  unit: 'visits this week',
});
assert.equal(get(eb, 'gracious').progress, undefined); // not a count
// Iron week: three visits in the first partial week, checked after that week closes.
const gymData = {
  ...data,
  entries: [
    ...entries,
    ...['2026-09-15', '2026-09-16', '2026-09-17'].map((d) =>
      entry('e', 'gym', d),
    ),
  ],
};
assert.equal(
  badges(gymData, erin, Date.parse('2026-09-22T16:00:00Z')).find(
    (b) => b.id === 'iron_week',
  ).date,
  '2026-09-20',
);
// Before that week closes the visits are all there, but the badge waits for the week to end.
assert.deepEqual(get(badges(gymData, erin, now), 'iron_week'), {
  id: 'iron_week',
  title: 'Iron week',
  how: 'Every gym visit in a week',
  earned: false,
  date: undefined,
  progress: {
    have: 3,
    need: 3,
    unit: 'visits this week',
    note: 'Counts once the week is over',
  },
});
// The bar's denominator is every habit-day of the challenge, so Erin's 8 daily rules over 30 days plus 16 gym visits, plus her one Sunday hands photo (Oct 11).
assert.equal(
  total(bar),
  5 * 30 +
    3 * days().filter((d) => new Date(d + 'T12:00Z').getUTCDay() <= 4).length +
    16 +
    1,
);

// A miss waiting on a forgiveness request is under review: no point, no dollars, and its day is neither won, lost nor tied until the partner decides.
{
  const miss = entries.find(
      (e) =>
        e.user_id === 'e' && e.rule_id === 'prayer' && e.day === '2026-09-16',
    ),
    asking = {
      ...data,
      points: points.map((q) =>
        q.id === 'p1' ? { ...q, entry_id: miss.id } : q,
      ),
      requests: [
        {
          id: 'r1',
          point_id: 'p1',
          requester_id: 'e',
          reason: 'sick',
          status: 'pending',
        },
      ],
    };
  assert.equal(
    tone(miss, miss.day, now, undefined, new Set([miss.id])),
    'review',
  );
  const b = personBar(asking, erin, now);
  assert.deepEqual(
    { missed: b.missed, review: b.review },
    { missed: 0, review: 4 },
  );
  const w = daysWon(asking, now);
  assert.deepEqual(
    { e: w.wins.e, k: w.wins.k, ties: w.ties, review: w.review },
    { e: 3, k: 0, ties: 0, review: 1 },
  );
  assert.equal(nextMissCost(asking, erin.id), 1);
  assert.equal(
    habitStats(asking, erin, now).find((s) => s.rule.id === 'prayer').missed,
    0,
  );
  // Sep 15 done, 16 asked (neither extends nor breaks), 17 excused, 18 done, 19 pending: a run of 3, not 4.
  const prayer = habitStats(asking, erin, now).find(
    (s) => s.rule.id === 'prayer',
  );
  assert.deepEqual(
    { streak: prayer.streak, best: prayer.best },
    { streak: 3, best: 3 },
  );
  // Denied: it counts again.
  const denied = {
    ...asking,
    requests: [{ ...asking.requests[0], status: 'denied' }],
  };
  assert.equal(personBar(denied, erin, now).missed, 1);
  assert.deepEqual(daysWon(denied, now).wins.e, 4);
  assert.equal(nextMissCost(denied, erin.id), 2);
}

// Erin's hands photo is asked on Sundays only, from Oct 11.
const asksHands = (who, d) =>
  activeRules(who, d, weeks).some((r) => r.id === 'hands');
assert.deepEqual(
  [
    asksHands('Erin', '2026-10-11'),
    asksHands('Erin', '2026-10-04'),
    asksHands('Erin', '2026-10-12'),
    asksHands('Kazzy', '2026-10-11'),
  ],
  [true, false, false, false],
);
console.log(
  'PASS: progress stats — tones, bars, streaks (excused keeps them), worst-first order, days won (pending forgiveness undecided), perfect days, costs, badges.',
);
