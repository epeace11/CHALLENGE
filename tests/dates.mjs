import assert from 'node:assert/strict';
import {
  START,
  END,
  TOTAL_DAYS,
  toronto,
  shift,
  clampDate,
  defaultDate,
  dayOfWeek,
  days,
  daysLeft,
  formatDate,
  formatShortDate,
  formatTime,
  challengeRange,
  lockTime,
  untilLock,
  closed,
} from '../lib/dates.ts';

// The challenge's shape comes from START and END alone.
assert.equal(TOTAL_DAYS, 30);
assert.equal(days().length, TOTAL_DAYS);
assert.equal(days()[0], START);
assert.equal(days().at(-1), END);
assert.equal(challengeRange, 'SEP 15 – OCT 14');

assert.equal(shift('2026-09-30', 1), '2026-10-01');
assert.equal(shift('2026-10-01', -1), '2026-09-30');
assert.equal(dayOfWeek('2026-09-15'), 2); // Tuesday
assert.equal(dayOfWeek('2026-09-20'), 0); // Sunday
assert.equal(clampDate('2026-09-01'), START);
assert.equal(clampDate('2026-11-01'), END);
assert.equal(clampDate('2026-10-01'), '2026-10-01');

// Toronto dates: 3:30 UTC on Sep 21 is still 11:30 pm Sep 20 in Toronto (EDT, UTC-4).
assert.equal(toronto(new Date('2026-09-21T03:30:00Z')), '2026-09-20');
assert.equal(toronto(new Date('2026-09-21T04:30:00Z')), '2026-09-21');
// The Log page opens on yesterday, kept inside the challenge.
assert.equal(defaultDate(new Date('2026-09-21T04:30:00Z')), '2026-09-20');
assert.equal(defaultDate(new Date('2026-09-10T12:00:00Z')), START);
assert.equal(defaultDate(new Date('2026-10-20T12:00:00Z')), END);

assert.equal(daysLeft(START), 30);
assert.equal(daysLeft(END), 1);
assert.equal(daysLeft('2026-10-15'), 0);
assert.equal(daysLeft('2026-09-01'), 30);

assert.equal(formatDate('2026-09-23'), 'Wednesday, Sep 23');
assert.equal(formatShortDate('2026-09-23'), 'Sep 23');
assert.equal(formatTime('2026-09-23T19:05:00Z'), '3:05 PM');

// A day locks at 11:59 pm Toronto time the next day. During the challenge that is EDT, so Sep 24 locks at 03:59 UTC on Sep 26.
assert.equal(lockTime('2026-09-24'), Date.parse('2026-09-26T03:59:00Z'));
// Daylight saving: clocks go back on Nov 1, 2026 and forward on Mar 8, 2026. The lock instant follows the local clock either side of each change.
assert.equal(lockTime('2026-10-30'), Date.parse('2026-11-01T03:59:00Z')); // Oct 31, 11:59 pm EDT
assert.equal(lockTime('2026-10-31'), Date.parse('2026-11-02T04:59:00Z')); // Nov 1, 11:59 pm EST
assert.equal(lockTime('2026-11-05'), Date.parse('2026-11-07T04:59:00Z'));
assert.equal(lockTime('2026-03-07'), Date.parse('2026-03-09T03:59:00Z')); // Mar 8, 11:59 pm EDT

assert.equal(closed('2026-09-24', Date.parse('2026-09-26T03:58:59Z')), false);
assert.equal(closed('2026-09-24', Date.parse('2026-09-26T03:59:01Z')), true);
assert.equal(
  untilLock('2026-09-24', Date.parse('2026-09-26T00:47:00Z')),
  '3h 12m',
);
assert.equal(
  untilLock('2026-09-24', Date.parse('2026-09-26T03:47:30Z')),
  '11m',
);
assert.equal(untilLock('2026-09-24', Date.parse('2026-09-26T04:00:00Z')), null);

console.log(
  'PASS: dates — challenge length from START/END, Toronto days, 11:59 pm locks across daylight-saving changes, countdowns, formatting.',
);
