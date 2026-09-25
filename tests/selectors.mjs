import assert from 'node:assert/strict';
import {
  nameOf,
  findEntry,
  entriesOn,
  firstUnanswered,
  historyOf,
  recentEntries,
  notesOf,
  activePointCount,
  missedTotal,
  forgivenCount,
  activePointOf,
  requestFor,
  forgivenessOf,
  ledgerPoints,
  pointDollars,
  standings,
  leaderOf,
  reviewQueue,
  dayTone,
  weekCount,
} from '../lib/selectors.ts';
import { dailyRules } from '../lib/rules.ts';

const erin = { id: 'e', name: 'Erin' },
  kazzy = { id: 'k', name: 'Kazzy' };
// Sunday Sep 20, noon Toronto: Sep 19 is the latest loggable day.
const maxDate = '2026-09-19';
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
  updated_at: `${day}T12:00:00Z`,
  ...o,
});
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
const weekday = [
    'bed',
    'screens',
    'weed',
    'prayer',
    'food',
    'time',
    'entertainment',
    'steps',
  ],
  weekend = ['prayer', 'food', 'time', 'entertainment', 'steps'],
  kazzyWeekday = [
    'bed',
    'screens',
    'weed_daily',
    'prayer',
    'food',
    'time',
    'entertainment',
    'calories',
  ];
assert.deepEqual(
  dailyRules('Erin', '2026-09-15').map((r) => r.id),
  weekday,
);
assert.deepEqual(
  dailyRules('Erin', '2026-09-18').map((r) => r.id),
  weekend,
);
assert.deepEqual(
  dailyRules('Kazzy', '2026-09-15').map((r) => r.id),
  kazzyWeekday,
);

const e15 = weekday.map((r) => entry('e', r, '2026-09-15')),
  e16 = weekday.map((r) =>
    entry(
      'e',
      r,
      '2026-09-16',
      r === 'prayer' ? { done: false, status: 'missed' } : {},
    ),
  ),
  e17 = weekday.map((r) =>
    entry(
      'e',
      r,
      '2026-09-17',
      r === 'prayer' ? { done: false, status: 'excused' } : {},
    ),
  ),
  e18 = ['prayer', 'food', 'time'].map((r) =>
    entry('e', r, '2026-09-18', { status: 'pending' }),
  ),
  e19 = weekend.map((r) =>
    entry('e', r, '2026-09-19', r === 'food' ? { status: 'disputed' } : {}),
  ),
  gym = [
    entry('e', 'gym', '2026-09-15'),
    entry('e', 'gym', '2026-09-16'),
    entry('e', 'gym', '2026-09-17', { status: 'conceded' }),
  ],
  // Kazzy's Sep 15: everything logged, one miss with a forgiveness request pending.
  k15 = kazzyWeekday.map((r) =>
    entry(
      'k',
      r,
      '2026-09-15',
      r === 'bed' ? { done: false, status: 'missed' } : { status: 'pending' },
    ),
  ),
  // Kazzy's Sep 16 prayer: an unlogged miss, corrected late, with a forgiveness ask sent alongside.
  k16 = entry('k', 'prayer', '2026-09-16', {
    done: false,
    status: 'unlogged',
    proposed_done: true,
    updated_at: '2026-09-19T20:00:00Z',
  });
const kBed = k15.find((e) => e.rule_id === 'bed'),
  eMissed = e16.find((e) => e.rule_id === 'prayer'),
  eExcused = e17.find((e) => e.rule_id === 'prayer'),
  eDisputed = e19.find((e) => e.rule_id === 'food');
const points = [
  point('p1', 'e', 'prayer', '2026-09-16', '2026-09-16T20:00:00Z', {
    entry_id: eMissed.id,
  }),
  point('p2', 'e', 'prayer', '2026-09-17', '2026-09-17T20:00:00Z', {
    entry_id: eExcused.id,
    forgiven: true,
  }),
  point('p3', 'k', 'bed', '2026-09-15', '2026-09-15T20:00:00Z', {
    entry_id: kBed.id,
  }),
  point('p4', 'k', 'prayer', '2026-09-16', '2026-09-17T23:59:00Z', {
    entry_id: k16.id,
    reason: 'unlogged',
  }),
  point('p5', 'k', 'food', '2026-09-15', '2026-09-15T21:00:00Z', {
    voided: true,
  }),
];
const requests = [
  {
    id: 'r1',
    point_id: 'p3',
    requester_id: 'k',
    reason: 'Sick',
    status: 'pending',
  },
  {
    id: 'r2',
    point_id: 'p4',
    requester_id: 'k',
    reason: 'Forgot to log',
    status: 'pending',
  },
  {
    id: 'r0',
    point_id: 'p2',
    requester_id: 'e',
    reason: 'Travel',
    status: 'approved',
  },
];
const disputes = [
  {
    id: 'd1',
    entry_id: eDisputed.id,
    raised_by: 'k',
    comment: 'Saw a receipt',
    status: 'open',
  },
];
const weeks = [{ start: '2026-09-15', end: '2026-09-20', targets: { gym: 3 } }];
const data = {
  profiles: [erin, kazzy],
  entries: [...e15, ...e16, ...e17, ...e18, ...e19, ...gym, ...k15, k16],
  points,
  requests,
  disputes,
  finalizations: [],
  journals: [
    {
      id: 'j1',
      user_id: 'e',
      day: '2026-09-15',
      text: 'Good start',
      created_at: '2026-09-15T22:00:00Z',
    },
  ],
  photos: [],
  weeks,
};

// Lookups
assert.equal(nameOf(data, 'k'), 'Kazzy');
assert.equal(findEntry(data, 'e', 'prayer', '2026-09-16'), eMissed);
assert.equal(entriesOn(data, 'e', '2026-09-18').length, 3);
assert.equal(
  firstUnanswered(data, 'e', dailyRules('Erin', '2026-09-18'), '2026-09-18'),
  3,
); // entertainment
assert.equal(
  firstUnanswered(data, 'e', dailyRules('Erin', '2026-09-15'), '2026-09-15'),
  -1,
);
const h = historyOf(data, 'e');
assert.deepEqual([h[0].day, h[0].rule_id], ['2026-09-19', 'prayer']); // newest day first, then rule order
assert.deepEqual([h.at(-1).day, h.at(-1).rule_id], ['2026-09-15', 'gym']);
assert.equal(recentEntries(data, 1)[0], k16); // latest change first
assert.equal(notesOf(data, 'e', '2026-09-15').length, 1);
assert.equal(notesOf(data, 'k', '2026-09-15').length, 0);

// Points, forgiveness and money
assert.deepEqual(
  [
    activePointCount(data, 'e'),
    missedTotal(data, 'e'),
    forgivenCount(data, 'e'),
  ],
  [1, 2, 1],
);
assert.deepEqual(
  [
    activePointCount(data, 'k'),
    missedTotal(data, 'k'),
    forgivenCount(data, 'k'),
  ],
  [2, 2, 0],
); // the voided point counts nowhere
assert.equal(activePointOf(data, eMissed.id).id, 'p1');
assert.equal(activePointOf(data, eExcused.id), undefined); // forgiven
assert.equal(requestFor(data, 'p3').id, 'r1');
assert.equal(forgivenessOf(data, kBed), 'pending');
assert.equal(forgivenessOf(data, eExcused), undefined);
assert.deepEqual(
  ledgerPoints(data).map((p) => p.id),
  ['p3', 'p1', 'p2', 'p4'],
); // oldest first; voided and unforgiven left out
// The n-th active point costs $n; forgiven and voided points cost nothing.
assert.deepEqual(
  points.map((p) => pointDollars(data, p)),
  [1, 0, 1, 2, 0],
);
assert.deepEqual(
  standings(data).map((p) => p.id),
  ['e', 'k'],
);
assert.equal(leaderOf(data), 'e');
assert.equal(leaderOf({ ...data, points: [] }), null); // a tie has no leader

// What Erin sees in Review: Kazzy's seven pending answers, both of his asks (the late correction that came with an ask is decided on the Forgiveness tab), and the dispute she is party to.
const q = reviewQueue(data, 'e');
assert.equal(q.pending.length, 8);
assert.equal(q.plain.length, 7);
assert.deepEqual(
  q.requests.map((r) => r.id),
  ['r1', 'r2'],
);
assert.equal(q.entryOfAsk(requests[1]), k16);
assert.equal(q.entryOfAsk(requests[0]), undefined);
assert.equal(q.disputes.length, 1);
assert.deepEqual([q.count, q.any], [10, true]);
// What Kazzy sees: Erin's three pending answers and the dispute; his own asks are not his to decide.
const qk = reviewQueue(data, 'k');
assert.deepEqual(
  [qk.plain.length, qk.requests.length, qk.disputes.length, qk.count],
  [3, 0, 1, 4],
);
assert.equal(
  reviewQueue({ ...data, entries: e15, requests: [], disputes: [] }, 'e').any,
  false,
);

// Calendar colours
const tone = (uid, name, d) => dayTone(data, uid, name, d, maxDate);
assert.equal(tone('e', 'Erin', '2026-09-15'), 'good');
assert.equal(tone('e', 'Erin', '2026-09-16'), 'bad'); // a miss
assert.equal(tone('e', 'Erin', '2026-09-17'), 'good'); // excused is not a miss
assert.equal(tone('e', 'Erin', '2026-09-18'), 'open'); // three of five answered
assert.equal(tone('e', 'Erin', '2026-09-19'), 'wait'); // a dispute is open
assert.equal(tone('e', 'Erin', '2026-09-20'), 'future');
assert.equal(tone('k', 'Kazzy', '2026-09-15'), 'wait'); // a miss under a pending forgiveness ask is not yet a miss
assert.equal(tone('k', 'Kazzy', '2026-09-16'), 'open'); // one late correction, the rest unanswered

// Weekly counts match the database: a conceded visit does not count.
assert.equal(weekCount(data, weeks[0], 'e'), 2);
assert.equal(weekCount(data, weeks[0], 'k'), 0);
assert.equal(weekCount(data, undefined, 'e'), 0);

console.log(
  'PASS: selectors — lookups, history order, points and forgiveness, position-based costs, standings, the review queue from both sides, calendar colours, weekly counts.',
);
