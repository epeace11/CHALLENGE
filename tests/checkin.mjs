import assert from 'node:assert/strict';
import {
  askOption,
  draftChanged,
  draftProblem,
  joinProofs,
  proofPaths,
  savedDraft,
  submission,
} from '../lib/checkin.ts';
import { ruleById } from '../lib/rules.ts';

// Monday Sep 28, noon Toronto: Sep 27 is still open until 11:59 pm tonight, Sep 25 locked on Sep 26.
const now = Date.parse('2026-09-28T16:00:00Z');
const open = '2026-09-27',
  late = '2026-09-25';
const prayer = ruleById('prayer'),
  time = ruleById('time'),
  gym = ruleById('gym');
let n = 0;
const entry = (day, o = {}) => ({
  id: `x${++n}`,
  user_id: 'k',
  rule_id: 'prayer',
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
const point = (e, o = {}) => ({
  id: `p${e.id}`,
  user_id: 'k',
  rule_id: e.rule_id,
  day: e.day,
  reason: 'missed',
  forgiven: false,
  voided: false,
  entry_id: e.id,
  created_at: `${e.day}T20:00:00Z`,
  ...o,
});
const data = (points = [], requests = []) => ({
  profiles: [],
  entries: [],
  points,
  requests,
  disputes: [],
  finalizations: [],
  journals: [],
  photos: [],
  weeks: [],
});
const ask = (status, p) => ({
  id: `r${p.id}`,
  point_id: p.id,
  requester_id: 'k',
  reason: 'why',
  status,
});

// Screenshot paths round-trip through the newline-separated proof column.
assert.deepEqual(proofPaths('a.jpg\nb.jpg\n'), ['a.jpg', 'b.jpg']);
assert.deepEqual(proofPaths(null), []);
assert.equal(joinProofs([]), null);
assert.equal(joinProofs(['a.jpg', 'b.jpg']), 'a.jpg\nb.jpg');

// The draft starts from the saved answer, or from the late correction waiting on it; a miss that was never logged starts with nothing chosen.
assert.deepEqual(savedDraft(undefined), {
  done: null,
  note: '',
  proofs: [],
  forgive: false,
  reason: '',
});
assert.deepEqual(
  savedDraft(entry(open, { note: 'Morning', proof: 'a.jpg\nb.jpg' })),
  {
    done: true,
    note: 'Morning',
    proofs: ['a.jpg', 'b.jpg'],
    forgive: false,
    reason: '',
  },
);
assert.equal(
  savedDraft(entry(late, { done: false, status: 'unlogged' })).done,
  null,
);
assert.deepEqual(
  savedDraft(
    entry(late, {
      done: true,
      proof: 'old.jpg',
      proposed_done: false,
      proposed_note: 'Actually no',
    }),
  ),
  { done: false, note: 'Actually no', proofs: [], forgive: false, reason: '' },
); // the correction's own (empty) screenshots, not the original's

// What a No can carry.
const none = { kind: 'none' },
  fresh = { kind: 'ask', again: false };
assert.deepEqual(askOption(data(), undefined, gym, open, now), none); // weekly: the shortfall is counted per week
assert.deepEqual(askOption(data(), undefined, prayer, open, now), fresh); // on time, a No always makes a miss
const no = entry(open, { done: false, status: 'missed' }),
  noPoint = point(no);
assert.deepEqual(
  askOption(data([noPoint], [ask('pending', noPoint)]), no, prayer, open, now),
  { kind: 'sent', status: 'pending' },
);
assert.deepEqual(
  askOption(data([noPoint], [ask('denied', noPoint)]), no, prayer, open, now),
  { kind: 'ask', again: true },
);
assert.deepEqual(
  askOption(data([{ ...noPoint, forgiven: true }]), no, prayer, open, now),
  { kind: 'sent', status: 'forgiven' },
);
assert.deepEqual(askOption(data(), undefined, prayer, late, now), none); // late with no miss on record: nothing to forgive yet
const unlogged = entry(late, { done: false, status: 'unlogged' });
assert.deepEqual(
  askOption(
    data([point(unlogged, { reason: 'unlogged' })]),
    unlogged,
    prayer,
    late,
    now,
  ),
  fresh,
); // a miss that was never logged can still be forgiven
const pendingYes = entry(late, { status: 'pending' });
assert.deepEqual(
  askOption(
    data([point(pendingYes, { voided: true })]),
    pendingYes,
    prayer,
    late,
    now,
  ),
  none,
); // a late change of a Yes to No has no miss until it is approved

// Validation.
const d = (o = {}) => ({ ...savedDraft(undefined), ...o });
assert.equal(draftProblem(d(), prayer, fresh), 'Choose Yes or No first.');
assert.equal(draftProblem(d({ done: true }), prayer, fresh), null);
assert.equal(
  draftProblem(d({ done: true }), time, fresh),
  'Attach a screenshot to save a Yes.',
);
assert.equal(
  draftProblem(d({ done: true, proofs: ['a.jpg'] }), time, fresh),
  null,
);
assert.equal(draftProblem(d({ done: false }), time, fresh), null); // a No needs no screenshot
assert.equal(
  draftProblem(d({ done: false, forgive: true, reason: '  ' }), prayer, fresh),
  'Say why it should be forgiven, or untick the request.',
);
assert.equal(
  draftProblem(
    d({ done: false, forgive: true, reason: 'Sick' }),
    prayer,
    fresh,
  ),
  null,
);
assert.equal(
  draftProblem(d({ done: false, forgive: true }), prayer, none),
  null,
); // no request possible: the tick is ignored

// Changes and what Save sends: never a request with a Yes, never a request that cannot be made.
const saved = savedDraft(
  entry(open, { note: 'Morning ', proof: 'a.jpg\nb.jpg' }),
);
assert.equal(draftChanged({ ...saved, note: 'Morning' }, saved, fresh), false);
assert.equal(
  draftChanged({ ...saved, proofs: ['b.jpg', 'a.jpg'] }, saved, fresh),
  true,
);
assert.equal(draftChanged({ ...saved, done: false }, saved, fresh), true);
assert.equal(
  draftChanged({ ...saved, forgive: true, reason: 'x' }, saved, fresh),
  false,
); // a Yes carries no request
const savedNo = { ...saved, done: false };
assert.equal(draftChanged({ ...savedNo, forgive: true }, savedNo, fresh), true);
assert.equal(draftChanged({ ...savedNo, forgive: true }, savedNo, none), false);
assert.deepEqual(
  submission(
    { ...saved, note: ' Morning ', forgive: true, reason: 'x' },
    fresh,
  ),
  { done: true, note: 'Morning', proof: 'a.jpg\nb.jpg', forgive: null },
);
assert.deepEqual(
  submission(
    d({ done: false, forgive: true, reason: ' Sick all day ' }),
    fresh,
  ),
  { done: false, note: '', proof: null, forgive: 'Sick all day' },
);
assert.equal(
  submission(d({ done: false, forgive: true, reason: 'Sick' }), {
    kind: 'sent',
    status: 'pending',
  }).forgive,
  null,
);

console.log(
  'PASS: check-ins — drafts from saved answers and late corrections, what a No can carry, validation, changes, and what one Save sends.',
);
