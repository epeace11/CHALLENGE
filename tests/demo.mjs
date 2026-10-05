import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_IDS, DEMO_WEEKS, demoData } from '../lib/demo.ts';
import { personBar, total } from '../lib/progress.ts';
import { finalizeBlockers, reviewQueue } from '../lib/selectors.ts';

const byKey = (a, b) => a.join('|').localeCompare(b.join('|'));
// Demo weeks and targets match the database's, so demo mode shows the real schedule.
const setup = readFileSync(
  new URL('../supabase/setup.sql', import.meta.url),
  'utf8',
);
const weeks = [
  ...setup
    .match(/insert into public\.challenge_weeks values(.*);/)[1]
    .matchAll(/\('([\d-]+)','([\d-]+)'\)/g),
].map((m) => [m[1], m[2]]);
assert.deepEqual(
  DEMO_WEEKS.map((w) => [w.start, w.end]),
  weeks,
);
const targets = [
  ...setup
    .match(/insert into public\.challenge_weekly_targets values(.*);/)[1]
    .matchAll(/\('(\w+)','([\d-]+)',(\d+)\)/g),
].map((m) => [m[1], m[2], +m[3]]);
assert.deepEqual(
  DEMO_WEEKS.flatMap((w) =>
    Object.entries(w.targets).map(([r, t]) => [r, w.start, t]),
  ).sort(byKey),
  targets.sort(byKey),
);

// Monday Oct 5, noon Toronto: a few weeks in, with a bit of everything to look at.
const now = Date.parse('2026-10-05T16:00:00Z'),
  data = demoData(now);
assert.deepEqual(demoData(now), data); // the same every load
const erin = data.profiles.find((p) => p.id === DEMO_IDS.Erin);
assert.ok(total(personBar(data, erin, now)) > 0);
assert.ok(data.points.some((p) => p.reason === 'missed'));
assert.ok(data.points.some((p) => p.reason === 'weekly_shortfall'));
assert.ok(
  data.points.some((p) => p.reason === 'day_forgiveness' && p.forgiven),
);
assert.ok(data.requests.some((r) => r.status === 'pending'));
assert.ok(data.disputes.length === 1);
assert.ok(reviewQueue(data, DEMO_IDS.Erin).count > 0);
assert.ok(data.journals.length > 0);
assert.ok(finalizeBlockers(data, now).length > 0);
// Before the start there is nothing yet, and after the end every day has an answer.
assert.equal(demoData(Date.parse('2026-09-10T16:00:00Z')).entries.length, 0);
const after = demoData(Date.parse('2026-10-17T16:00:00Z'));
assert.ok(after.entries.some((e) => e.day === '2026-10-14'));
console.log(
  'PASS: demo data — the database’s weeks and targets, the same every load, misses, reviews, forgiveness, a dispute, assessed weeks and journal notes.',
);
