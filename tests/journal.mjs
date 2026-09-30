import assert from 'node:assert/strict';
import {
  JOURNAL_PAGE,
  addOlder,
  byDay,
  continues,
  covers,
  inWindow,
  landNotes,
  notesOn,
  startOf,
} from '../lib/journal.ts';

const note = (id, user_id, day, time, text = id) => ({
  id,
  user_id,
  day,
  text,
  created_at: `${day}T${time}:00.000000+00:00`,
});
// Several notes per person per day, and one written for the 27th the next morning.
const a = note('a', 'e', '2026-09-27', '14:00'),
  b = note('b', 'k', '2026-09-27', '15:00'),
  late = {
    ...note('late', 'e', '2026-09-27', '00:00'),
    created_at: '2026-09-28T13:00:00+00:00',
  },
  c = note('c', 'e', '2026-09-28', '14:00'),
  d = note('d', 'e', '2026-09-28', '14:05'),
  e = note('e', 'k', '2026-09-28', '16:00'),
  f = note('f', 'e', '2026-09-28', '16:30');

// Grouped by day, oldest first; within a day in the order written, both people interleaved.
const groups = byDay([f, c, e, a, late, d, b]);
assert.deepEqual(
  groups.map((g) => [g.day, g.notes.map((n) => n.id)]),
  [
    ['2026-09-27', ['a', 'b', 'late']],
    ['2026-09-28', ['c', 'd', 'e', 'f']],
  ],
);
// A day being written to gets an empty group in its place.
assert.deepEqual(
  byDay([c], '2026-09-26').map((g) => [g.day, g.notes.length]),
  [
    ['2026-09-26', 0],
    ['2026-09-28', 1],
  ],
);
assert.deepEqual(
  notesOn([f, a, c, b, d], '2026-09-28').map((n) => n.id),
  ['c', 'd', 'f'],
);

// Consecutive notes by the same person within 15 minutes drop the repeated name.
assert.equal(continues(c, d), true);
assert.equal(continues(d, e), false); // other author
assert.equal(continues(e, f), false); // back to the other person
assert.equal(continues(undefined, c), false);
assert.equal(continues(note('x', 'e', '2026-09-28', '15:00'), f), false); // 90 minutes apart

// The window: a full first page starts it at its oldest note; a short page means the whole journal.
const page = Array.from({ length: JOURNAL_PAGE }, (_, i) =>
  note(
    `p${i}`,
    'e',
    '2026-09-28',
    `1${Math.floor(i / 10)}:${String(i % 10).padStart(2, '0')}`,
  ),
).reverse();
assert.deepEqual(startOf(page), {
  day: '2026-09-28',
  at: page.at(-1).created_at,
});
assert.equal(startOf(page.slice(1)), 'all');
assert.equal(startOf([]), 'all');

const w = { day: '2026-09-28', at: d.created_at };
assert.deepEqual(
  [a, c, d, e].map((n) => inWindow(n, w)),
  [false, false, true, true],
);
assert.equal(inWindow(a, { day: '2026-09-27', at: null }), true);
assert.equal(covers(w, '2026-09-28'), false); // part of the 28th is still unloaded
assert.equal(covers(w, '2026-09-29'), true);
assert.equal(covers({ day: '2026-09-28', at: null }, '2026-09-28'), true);
assert.equal(covers('all', '2026-09-15'), true);
assert.equal(covers(null, '2026-09-30'), false);

// A reload replaces the notes inside the window it asked for: edits and removals land, new notes
// appear, and older notes loaded meanwhile (scrolling up) stay put.
const edited = { ...e, text: 'edited' };
assert.deepEqual(
  landNotes([a, c, d, e, f], [d, edited], w).map((n) => [n.id, n.text]),
  [
    ['a', 'a'],
    ['c', 'c'],
    ['d', 'd'],
    ['e', 'edited'],
  ],
);
// The first load, and a whole-journal load, replace everything.
assert.deepEqual(
  landNotes([a], [c], null).map((n) => n.id),
  ['c'],
);
assert.deepEqual(
  landNotes([a], [c], 'all').map((n) => n.id),
  ['c'],
);
// Older notes slot in above without duplicates.
assert.deepEqual(
  addOlder([c, d, e], [d, b, a]).map((n) => n.id),
  ['a', 'b', 'c', 'd', 'e'],
);

console.log(
  'PASS: journal feed grouping, several notes per person per day, windowed loading and merging.',
);
