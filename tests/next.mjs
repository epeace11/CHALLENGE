import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  activePoints,
  asViewer,
  badges,
  calendar,
  checkinCount,
  dayColor,
  dayNumber,
  daysLeft,
  entryFor,
  entryPill,
  formatAnswer,
  formatDate,
  formatDay,
  formatDayShort,
  formatDeadline,
  formatDuration,
  formatMoney,
  formatRange,
  formatTarget,
  formatTime,
  formatValue,
  formatWeekdays,
  formatWhen,
  gets,
  giftTotal,
  isClosed,
  lastDay,
  lastRecap,
  leader,
  libraryByGroup,
  lockTime,
  nextBadge,
  nextMissCost,
  openCheckins,
  openDay,
  owes,
  plural,
  pointCost,
  repliedDisputes,
  reviewQueue,
  roundGift,
  ruleById,
  rulesOn,
  stakesPreview,
  standings,
  streakToProtect,
  streaks,
  timeLeft,
  waitingOnPartner,
  weekOf,
  weekProgress,
  weekTarget,
  weekday,
  weeksOf,
} from '../lib/next/selectors.ts';
import {
  addNote,
  approve,
  concede,
  decideForgiveness,
  dispute,
  rejectCorrection,
  removeNote,
  replyToDispute,
  saveCheckin,
  setShareLink,
  signPact,
  updateChallenge,
  withdrawDispute,
} from '../lib/next/actions.ts';
import { world, FALL_RESET } from '../lib/next/demo.ts';
import { EVERY_DAY, SUN_THU, MON_FRI } from '../lib/next/catalog.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const w = world;
const MAYA = 'maya',
  JORDAN = 'jordan';

/* ── Formatters and dates ───────────────────────────────────────────────── */

assert.equal(formatDay('2026-11-19'), 'Thursday, Nov 19');
assert.equal(formatDayShort('2026-11-19'), 'Thu, Nov 19');
assert.equal(formatDate('2026-12-01'), 'Dec 1');
assert.equal(formatRange('2026-11-02', '2026-12-01'), 'Nov 2 – Dec 1');
assert.equal(formatRange('2026-11-09', '2026-11-15'), 'Nov 9 – 15');
assert.equal(formatMoney(45), '$45');
assert.equal(formatMoney(0.25), '$0.25');
assert.equal(formatMoney(1234.5), '$1,234.50');
assert.equal(formatWeekdays(EVERY_DAY), 'Every day');
assert.equal(formatWeekdays(SUN_THU), 'Sun–Thu');
assert.equal(formatWeekdays(MON_FRI), 'Mon–Fri');
assert.equal(formatWeekdays([5, 6]), 'Fri–Sat');
assert.equal(formatWeekdays([0, 6]), 'Weekends');
assert.equal(formatWeekdays([1, 3, 5]), 'Mon, Wed, Fri');
assert.equal(
  formatTarget({ op: '<=', value: 60, unit: 'min' }),
  '60 min or less',
);
assert.equal(
  formatTarget({ op: '>=', value: 10000, unit: 'steps' }),
  '10,000 steps or more',
);
assert.equal(formatDeadline(FALL_RESET.deadline), '11:59 pm the next day');
assert.equal(formatDuration(4 * 36e5 + 29 * 6e4 + 5e3), '4h 29m');
assert.equal(formatDuration(29 * 6e4), '29m');
assert.equal(formatDuration(-1), '0m');
assert.equal(formatDuration(51 * 36e5), '2d 3h');
assert.equal(plural(1, 'point'), '1 point');
assert.equal(plural(6, 'point'), '6 points');
assert.equal(formatTime(w.now, FALL_RESET.timeZone), '7:30 pm');
assert.equal(weekday('2026-11-02'), 1);
assert.equal(lastDay(FALL_RESET), '2026-12-01');
// 11:59 pm the next day, across the end of daylight saving (Nov 1, 2026).
const tz = { deadline: FALL_RESET.deadline, timeZone: 'America/Toronto' };
assert.equal(lockTime(tz, '2026-10-30'), Date.parse('2026-11-01T03:59:00Z'));
assert.equal(lockTime(tz, '2026-10-31'), Date.parse('2026-11-02T04:59:00Z'));
assert.equal(lockTime(tz, '2026-07-06'), Date.parse('2026-07-08T03:59:00Z'));
// Weeks run Monday to Sunday; the last one is two days and needs one gym visit.
const weeks = weeksOf(FALL_RESET);
assert.deepEqual(
  weeks.map((x) => [x.start, x.end, x.length]),
  [
    ['2026-11-02', '2026-11-08', 7],
    ['2026-11-09', '2026-11-15', 7],
    ['2026-11-16', '2026-11-22', 7],
    ['2026-11-23', '2026-11-29', 7],
    ['2026-11-30', '2026-12-01', 2],
  ],
);
const gym = ruleById(FALL_RESET, 'gym');
assert.deepEqual(
  weeks.map((x) => weekTarget(gym, x, FALL_RESET)),
  [4, 4, 4, 4, 1],
);
assert.equal(weekOf(FALL_RESET, '2026-11-20').start, '2026-11-16');

/* ── The sample world's key numbers ─────────────────────────────────────── */

assert.equal(w.me.id, MAYA);
assert.equal(w.partner.id, JORDAN);
assert.equal(dayNumber(FALL_RESET, w.today), 19);
assert.equal(daysLeft(FALL_RESET, w.today), 12);
assert.equal(openDay(w), '2026-11-19');
assert.equal(formatDuration(timeLeft(w)), '4h 29m');
assert.ok(isClosed(FALL_RESET, '2026-11-18', w.now));
assert.ok(!isClosed(FALL_RESET, '2026-11-19', w.now));
assert.deepEqual(
  rulesOn(FALL_RESET, MAYA, '2026-11-19').map((r) => r.id),
  ['bed', 'phones', 'social', 'gym', 'eating-out', 'read', 'alcohol'],
);
assert.deepEqual(
  rulesOn(FALL_RESET, JORDAN, '2026-11-21').map((r) => r.id),
  ['phones', 'social', 'steps', 'gym', 'eating-out'],
);

// What is left to log.
assert.deepEqual(
  openCheckins(w, MAYA).map((r) => r.id),
  ['social', 'gym', 'read'],
);
assert.deepEqual(openCheckins(w, JORDAN), []);

// What waits for review.
const queue = reviewQueue(w, MAYA);
assert.equal(queue.count, 4);
assert.deepEqual(
  queue.answers.map((i) => i.entry.ruleId),
  ['steps', 'social'],
);
const steps = queue.answers[0].entry;
assert.equal(steps.value, 11240);
assert.equal(steps.proofs.length, 1);
assert.match(steps.proofs[0].src, /^data:image\/svg\+xml/);
assert.equal(formatAnswer(queue.answers[0].rule, steps), '11,240 steps');
assert.equal(queue.forgiveness.length, 1);
assert.equal(queue.forgiveness[0].point.ruleId, 'eating-out');
assert.equal(queue.disputes.length, 1);
assert.equal(queue.disputes[0].entry.personId, MAYA);
assert.equal(queue.disputes[0].dispute.raisedBy, JORDAN);
assert.equal(queue.corrections.length, 0);
const waiting = waitingOnPartner(w, MAYA);
assert.equal(waiting.count, 1);
assert.equal(waiting.answers[0].entry.ruleId, 'alcohol');

// Points and gifts: the nth point costs n dollars.
assert.equal(activePoints(w, MAYA).length, 6);
assert.equal(activePoints(w, JORDAN).length, 9);
assert.equal(owes(w, MAYA), 21);
assert.equal(owes(w, JORDAN), 45);
assert.equal(gets(w, MAYA), 45);
assert.equal(gets(w, JORDAN), 21);
assert.equal(nextMissCost(w, MAYA), 7);
assert.equal(nextMissCost(w, JORDAN), 10);
assert.deepEqual(leader(w), { personId: MAYA, margin: 3 });
const [me, them] = standings(w);
assert.deepEqual(
  [me.person.id, me.points, me.forgiven, me.gets, them.points, them.forgiven],
  [MAYA, 6, 0, 45, 9, 1],
);
const forgiven = w.points.find((p) => p.forgiven);
assert.equal(pointCost(w, forgiven), 0);
assert.deepEqual(
  activePoints(w, JORDAN).map((p) => pointCost(w, p)),
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
);
assert.equal(giftTotal(6, 1, null), 21);
assert.equal(giftTotal(9, 1, 30), 30);
assert.equal(giftTotal(3, 0.25, null), 1.5);
const capped = updateChallenge(w, { cap: 30 });
assert.equal(owes(capped, JORDAN), 30);
assert.equal(nextMissCost(capped, JORDAN), 0);
assert.equal(owes(capped, MAYA), 21);
assert.equal(nextMissCost(capped, MAYA), 7);
assert.equal(
  activePoints(capped, JORDAN).reduce((s, p) => s + pointCost(capped, p), 0),
  30,
);
assert.equal(owes(updateChallenge(w, { step: 2 }), MAYA), 42);

// Gym this week.
assert.deepEqual(
  (({ have, need, left, daysLeft }) => ({ have, need, left, daysLeft }))(
    weekProgress(w, MAYA, 'gym'),
  ),
  { have: 2, need: 4, left: 2, daysLeft: 4 },
);
assert.deepEqual(
  (({ have, need, left, daysLeft }) => ({ have, need, left, daysLeft }))(
    weekProgress(w, JORDAN, 'gym'),
  ),
  { have: 3, need: 4, left: 1, daysLeft: 3 },
);

// Streaks: forgiven and open days neither extend nor break.
const mayaStreaks = Object.fromEntries(
  streaks(w, MAYA).map((s) => [s.rule.id, s.current]),
);
assert.equal(mayaStreaks.phones, 18);
assert.equal(mayaStreaks.alcohol, 1);
assert.equal(mayaStreaks.gym, 2);
assert.equal(streakToProtect(w, MAYA).rule.id, 'phones');
const jordanStreaks = Object.fromEntries(
  streaks(w, JORDAN).map((s) => [s.rule.id, s.current]),
);
assert.equal(jordanStreaks.bed, 10);
assert.equal(jordanStreaks.phones, 2);
assert.equal(streakToProtect(w, JORDAN).rule.id, 'bed');

// Calendar colours.
const color = (p, d) => dayColor(w, p, d);
assert.equal(color(MAYA, '2026-11-02'), 'done');
assert.equal(color(MAYA, '2026-11-03'), 'missed');
assert.equal(color(MAYA, '2026-11-17'), 'review');
assert.equal(color(MAYA, '2026-11-19'), 'open');
assert.equal(color(MAYA, '2026-11-20'), 'ahead');
assert.equal(color(JORDAN, '2026-11-07'), 'excused');
assert.equal(color(JORDAN, '2026-11-17'), 'missed');
assert.equal(color(JORDAN, '2026-11-18'), 'review');
assert.equal(color(JORDAN, '2026-11-19'), 'review');
const cal = calendar(w, MAYA);
assert.equal(cal.length, 30);
assert.deepEqual(cal[17], { day: '2026-11-19', number: 18, color: 'open' });
assert.deepEqual(cal[18], { day: '2026-11-20', number: 19, color: 'ahead' });

// Status pills.
const pill = (p, rule, d) =>
  entryPill(w, ruleById(FALL_RESET, rule), entryFor(w, p, rule, d), d);
assert.deepEqual(pill(MAYA, 'bed', '2026-11-17'), {
  status: 'disputed',
  label: 'Disputed',
});
assert.deepEqual(pill(JORDAN, 'steps', '2026-11-19'), {
  status: 'review',
  label: 'Waiting for review',
});
assert.deepEqual(pill(JORDAN, 'eating-out', '2026-11-18'), {
  status: 'review',
  label: 'Forgiveness asked',
});
assert.equal(pill(JORDAN, 'phones', '2026-11-07').status, 'forgiven');
assert.deepEqual(pill(JORDAN, 'phones', '2026-11-17'), {
  status: 'missed',
  label: 'Not logged',
});
assert.equal(pill(JORDAN, 'eating-out', '2026-11-12').label, 'Conceded');
assert.equal(pill(MAYA, 'social', '2026-11-19').status, 'open');
assert.equal(pill(MAYA, 'gym', '2026-11-03').status, 'none');
assert.equal(pill(MAYA, 'gym', '2026-11-02').status, 'done');

// Last week's recap, Nov 9–15.
const recap = lastRecap(w);
assert.equal(recap.weekStart, '2026-11-09');
assert.equal(recap.weekEnd, '2026-11-15');
assert.equal(recap.winner, MAYA);
const [mr, jr] = recap.people;
assert.deepEqual([mr.points, mr.dollars, jr.points, jr.dollars], [2, 7, 3, 15]);
assert.deepEqual(mr.weekly, [{ ruleId: 'gym', have: 4, need: 4 }]);
assert.deepEqual(jr.weekly, [{ ruleId: 'gym', have: 3, need: 4 }]);
assert.equal(mr.bestStreak.ruleId, 'phones');
assert.equal(mr.bestStreak.days, 14);
assert.equal(mr.due - mr.done, 2);

// Stakes: miss 1 in 10 check-ins.
const plan = { ...FALL_RESET };
assert.equal(checkinCount(plan, MAYA), 181);
assert.equal(checkinCount(plan, JORDAN), 159);
const stakes = stakesPreview(plan, 0.1, [MAYA, JORDAN]);
assert.deepEqual(
  stakes.perPerson.map((p) => [p.misses, p.gift]),
  [
    [18, 171],
    [16, 136],
  ],
);
assert.equal(stakes.gift, 150);
const seventyFive = w.themes.find((t) => t.id === 'seventy-five');
assert.equal(
  stakesPreview({ ...seventyFive, start: '2027-01-04' }).gift,
  roundGift(258.75),
);
assert.equal(roundGift(258.75), 260);
assert.equal(roundGift(21), 20);
assert.equal(roundGift(7.4), 7);

// Badges.
const mayaBadges = Object.fromEntries(badges(w, MAYA).map((b) => [b.id, b]));
assert.deepEqual(
  Object.values(mayaBadges)
    .filter((b) => b.earned)
    .map((b) => [b.id, b.earnedOn]),
  [
    ['first-clean-day', '2026-11-02'],
    ['streak-7', '2026-11-08'],
    ['streak-14', '2026-11-15'],
    ['full-week', '2026-11-08'],
    ['week-won', '2026-11-08'],
    ['gracious', '2026-11-08'],
  ],
);
assert.deepEqual(mayaBadges['streak-all'].progress, {
  have: 18,
  need: 30,
  unit: 'days in a row',
});
assert.equal(nextBadge(w, MAYA).id, 'streak-all');
assert.equal(badges(w, JORDAN).find((b) => b.id === 'week-won').earned, false);

// Other data the pages use.
assert.equal(w.saved.length, 2);
assert.deepEqual(
  w.saved.map((s) => [s.name, s.source, s.days, s.rules.length, s.step]),
  [
    ['Summer Sprint', 'mine', 21, 6, 1],
    ['Dry October', 'link', 31, 2, 2],
  ],
);
assert.equal(w.saved[1].sharedBy, 'Priya & Sam');
const verdict = w.past[0].verdict;
assert.equal(w.past[0].challenge.start, '2026-07-06');
assert.equal(lastDay(w.past[0].challenge), '2026-07-26');
for (const p of verdict.people) {
  const other = verdict.people.find((o) => o.personId !== p.personId);
  assert.equal(p.owes, giftTotal(p.points, 1, null));
  assert.equal(p.gets, other.owes);
}
assert.deepEqual(
  verdict.people.map((p) => [p.points, p.gets]),
  [
    [4, 28],
    [7, 10],
  ],
);
assert.equal(verdict.winner, MAYA);
assert.deepEqual(
  w.themes.map((t) => [t.name, t.days, t.rules.length, t.look]),
  [
    ['75-Day Challenge', 75, 6, 'seventy-five'],
    ['Sleep & Screens Reset', 30, 5, 'sleep'],
    ['Dry Month', 30, 2, 'dry'],
    ['Fitness & Food', 30, 4, 'fitness'],
  ],
);
assert.equal(w.themes[0].step, 0.25);
assert.ok(w.library.length >= 38 && w.library.length <= 45);
assert.deepEqual(
  libraryByGroup(w.library).map((g) => g.group),
  ['Sleep', 'Screens', 'Food', 'Drinks', 'Movement', 'Mind', 'Money', 'Home'],
);
assert.equal(
  new Set(w.library.map((r) => r.id)).size,
  w.library.length,
  'library ids are unique',
);
assert.equal(w.sayRules.rules.length, 3);
assert.equal(
  w.sayRules.questions[0].text,
  'Every night, or Sun–Thu like bedtime?',
);
assert.equal(w.practice.questions.length, 3);
assert.deepEqual(w.practice.partnerReview.map((r) => r.decision).sort(), [
  'approve',
  'dispute',
]);
assert.deepEqual(
  w.pact.signatures.map((s) => [s.personId, !!s.signedAt]),
  [
    [MAYA, true],
    [JORDAN, false],
  ],
);
assert.equal(w.invite.to.name, 'Jordan');
assert.equal(formatWhen(gym), '4 days a week');
assert.equal(formatValue(ruleById(FALL_RESET, 'social'), 48), '48 min');
assert.ok(Object.isFrozen(w) && Object.isFrozen(w.entries[0]));
const jordanView = asViewer(w, JORDAN);
assert.equal(jordanView.me.id, JORDAN);
assert.equal(reviewQueue(jordanView, JORDAN).count, 1);

/* ── Actions ────────────────────────────────────────────────────────────── */

const shot = { id: 'p1', src: 'data:image/svg+xml,x', alt: 'Screen Time' };
// A Yes waits for review and closes the check-in.
let x = saveCheckin(w, {
  personId: MAYA,
  ruleId: 'social',
  day: '2026-11-19',
  value: 45,
  proofs: [shot],
});
assert.deepEqual(
  openCheckins(x, MAYA).map((r) => r.id),
  ['gym', 'read'],
);
assert.equal(entryFor(x, MAYA, 'social', '2026-11-19').status, 'pending');
assert.equal(entryFor(x, MAYA, 'social', '2026-11-19').done, true);
assert.equal(waitingOnPartner(x, MAYA).count, 2);
// A number off target is a miss with the next point's price.
x = saveCheckin(x, {
  personId: MAYA,
  ruleId: 'read',
  day: '2026-11-19',
  value: 5,
});
assert.equal(entryFor(x, MAYA, 'read', '2026-11-19').status, 'missed');
assert.equal(owes(x, MAYA), 28);
assert.equal(nextMissCost(x, MAYA), 8);
// Changing it before the deadline voids that point.
x = saveCheckin(x, {
  personId: MAYA,
  ruleId: 'read',
  day: '2026-11-19',
  value: 12,
});
assert.equal(owes(x, MAYA), 21);
// A weekly No costs nothing and needs no review.
x = saveCheckin(x, {
  personId: MAYA,
  ruleId: 'gym',
  day: '2026-11-19',
  done: false,
});
assert.equal(entryFor(x, MAYA, 'gym', '2026-11-19').status, 'confirmed');
assert.equal(owes(x, MAYA), 21);
assert.deepEqual(openCheckins(x, MAYA), []);
assert.equal(dayColor(x, MAYA, '2026-11-19'), 'review');
// A No can carry a forgiveness request.
let y = saveCheckin(w, {
  personId: MAYA,
  ruleId: 'read',
  day: '2026-11-19',
  value: 3,
  forgiveness: 'Migraine.',
});
assert.equal(reviewQueue(y, JORDAN).forgiveness.length, 1);
assert.equal(dayColor(y, MAYA, '2026-11-19'), 'open');
// Reviewing.
y = approve(w, steps.id);
assert.equal(entryFor(y, JORDAN, 'steps', '2026-11-19').status, 'confirmed');
assert.equal(reviewQueue(y, MAYA).count, 3);
y = decideForgiveness(y, queue.forgiveness[0].request.id, 'approved');
assert.equal(activePoints(y, JORDAN).length, 8);
assert.equal(gets(y, MAYA), 36);
assert.equal(entryFor(y, JORDAN, 'eating-out', '2026-11-18').status, 'excused');
assert.equal(dayColor(y, JORDAN, '2026-11-18'), 'excused');
assert.equal(reviewQueue(y, MAYA).count, 2);
const denied = decideForgiveness(w, queue.forgiveness[0].request.id, 'denied');
assert.equal(dayColor(denied, JORDAN, '2026-11-18'), 'missed');
assert.equal(activePoints(denied, JORDAN).length, 9);
// Disputes: conceding makes a point; withdrawing restores the answer.
const d = queue.disputes[0].dispute;
const conceded = concede(w, d.id);
assert.equal(activePoints(conceded, MAYA).length, 7);
assert.equal(entryFor(conceded, MAYA, 'bed', '2026-11-17').status, 'conceded');
assert.equal(dayColor(conceded, MAYA, '2026-11-17'), 'missed');
assert.equal(reviewQueue(conceded, MAYA).disputes.length, 0);
// Keeping a dispute open with a reply moves it off Maya's queue (and the Review badge); it waits on Jordan.
const replied = replyToDispute(w, d.id, 'I was in bed by 10:55.');
assert.equal(reviewQueue(replied, MAYA).count, 3);
assert.equal(repliedDisputes(replied, MAYA).length, 1);
assert.equal(repliedDisputes(w, MAYA).length, 0);
const withdrawn = withdrawDispute(w, d.id);
assert.equal(
  entryFor(withdrawn, MAYA, 'bed', '2026-11-17').status,
  'confirmed',
);
assert.equal(activePoints(withdrawn, MAYA).length, 6);
const disputed = dispute(
  w,
  entryFor(w, JORDAN, 'social', '2026-11-19').id,
  MAYA,
  'Screenshot is from Wednesday.',
);
assert.equal(reviewQueue(disputed, JORDAN).disputes.length, 1);
assert.equal(reviewQueue(disputed, MAYA).answers.length, 1);
// A late answer after the deadline waits for the partner, then replaces the miss.
let late = saveCheckin(w, {
  personId: JORDAN,
  ruleId: 'phones',
  day: '2026-11-17',
  done: true,
  note: 'Forgot to log it.',
});
assert.equal(reviewQueue(late, MAYA).corrections.length, 1);
assert.equal(
  entryPill(
    late,
    ruleById(FALL_RESET, 'phones'),
    entryFor(late, JORDAN, 'phones', '2026-11-17'),
    '2026-11-17',
  ).status,
  'review',
);
assert.equal(
  rejectCorrection(
    late,
    entryFor(late, JORDAN, 'phones', '2026-11-17').id,
  ).entries.find(
    (e) => e.id === entryFor(late, JORDAN, 'phones', '2026-11-17').id,
  ).correction,
  undefined,
);
late = approve(late, entryFor(late, JORDAN, 'phones', '2026-11-17').id);
assert.equal(
  entryFor(late, JORDAN, 'phones', '2026-11-17').status,
  'confirmed',
);
assert.equal(activePoints(late, JORDAN).length, 8);
assert.equal(dayColor(late, JORDAN, '2026-11-17'), 'done');
// Notes, the pact, share links.
let n = addNote(w, MAYA, '2026-11-19', '  Early night.  ');
assert.equal(n.journal.at(-1).text, 'Early night.');
n = removeNote(n, n.journal.at(-1).id);
assert.equal(n.journal.length, w.journal.length);
assert.ok(signPact(w, JORDAN).pact.signatures.every((s) => s.signedAt));
assert.equal(
  setShareLink(w, 'saved-summer-sprint', true).saved[0].linkOn,
  true,
);
// The sample world itself never changes.
assert.equal(owes(w, MAYA), 21);
assert.deepEqual(openCheckins(w, MAYA).length, 3);

/* ── Pages: every planned version exists, and the rules for all new UI hold ─ */

const PLANNED = {
  landing: 2,
  signup: 2,
  shared: 2,
  start: 3,
  say: 2,
  setup: 2,
  home: 2,
  invite: 3,
  pact: 2,
  practice: 2,
  overview: 3,
  log: 3,
  rules: 2,
  review: 3,
  gifts: 2,
  progress: 2,
  recap: 2,
  verdict: 2,
  settings: 2,
};
assert.equal(Object.keys(PLANNED).length, 19);
assert.equal(
  Object.values(PLANNED).reduce((s, v) => s + v, 0),
  43,
);
const pagesDir = join(root, 'components/next/pages');
const registry = readFileSync(join(pagesDir, 'registry.ts'), 'utf8');
for (const [id, count] of Object.entries(PLANNED)) {
  const dir = join(pagesDir, id);
  const index = readFileSync(join(dir, 'index.ts'), 'utf8');
  assert.match(
    registry,
    new RegExp(`from '\\./${id}'`),
    `registry imports ${id}`,
  );
  for (let v = 1; v <= count; v++) {
    const file = join(dir, `v${v}.tsx`);
    assert.ok(existsSync(file), `${id}/v${v}.tsx exists`);
    assert.match(
      index,
      new RegExp(`from '\\./v${v}'`),
      `${id}/index.ts lists v${v}`,
    );
    assert.match(
      readFileSync(file, 'utf8'),
      /^\/\/ \S.*\n/,
      `${id}/v${v}.tsx starts with a one-line comment saying what is different about it`,
    );
  }
  assert.ok(
    !existsSync(join(dir, `v${count + 1}.tsx`)),
    `${id} has ${count} versions`,
  );
}

/** Every file under `dir` with one of `exts`. */
function files(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}
const sources = [
  ...files(join(root, 'components/next'), ['.ts', '.tsx', '.css']),
  ...files(join(root, 'lib/next'), ['.ts']),
];
const styles = [
  join(root, 'styles/next.css'),
  ...files(join(root, 'components/next'), ['.css']),
];
for (const file of sources) {
  const text = readFileSync(file, 'utf8'),
    name = relative(root, file);
  // Sample data and pages only show fictional people (Maya and Jordan); the kit may name Kazzy's rules.
  if (/^(lib\/next|components\/next\/pages)\//.test(name))
    assert.doesNotMatch(
      text,
      /\b(Erin|Kazzy)\b/,
      `${name}: sample data never uses Erin or Kazzy`,
    );
  // No network and no database: the preview runs on sample data only.
  assert.doesNotMatch(text, /75 Hard|Dry January/i, `${name}: theme names`);
  assert.doesNotMatch(
    text,
    /@\/lib\/(supabase|api|proof|push)\b|\bfetch\(|XMLHttpRequest|WebSocket\(/,
    `${name}: the preview makes no network or database calls`,
  );
  // Deterministic: pages and data read the time from world.now, never the clock.
  if (/^(lib\/next|components\/next\/pages)\//.test(name))
    assert.doesNotMatch(
      text,
      /Date\.now\(|new Date\(\)|Math\.random\(/,
      `${name}: use world.now and world.today, never the clock or randomness`,
    );
  // Kazzy's rule 7: nothing under 14px.
  assert.doesNotMatch(
    text,
    /\btext-(xs|2xs)\b/,
    `${name}: text-xs is under 14px`,
  );
  for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)(px|rem)\]/g)) {
    const px = m[2] === 'rem' ? +m[1] * 16 : +m[1];
    assert.ok(px >= 14, `${name}: ${m[0]} is under 14px`);
  }
  for (const m of text.matchAll(/fontSize:\s*['"]?(\d+(?:\.\d+)?)(px)?\b/g))
    assert.ok(+m[1] >= 14, `${name}: fontSize ${m[1]} is under 14px`);
}
// A CSS module can load before app/globals.css in dev; stating Tailwind's layer order first keeps the
// kit's components layer between Tailwind's reset and its utilities.
const LAYER_ORDER = '@layer properties, theme, base, components, utilities;';
for (const file of files(join(root, 'components/next'), ['.module.css'])) {
  const text = readFileSync(file, 'utf8'),
    first = text.search(/@layer\s+components\s*\{/);
  if (first >= 0)
    assert.ok(
      text.includes(LAYER_ORDER) && text.indexOf(LAYER_ORDER) < first,
      `${relative(root, file)}: starts with ${LAYER_ORDER}`,
    );
}
for (const file of styles) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/font-size:\s*(\d+(?:\.\d+)?)(px|rem)/g)) {
    const px = m[2] === 'rem' ? +m[1] * 16 : +m[1];
    assert.ok(
      px >= 14,
      `${relative(root, file)}: font-size ${m[0]} is under 14px`,
    );
  }
}

console.log(
  'PASS: next — formatters and dates, the sample world’s numbers (open check-ins, review queue, points and gifts, gym weeks, streaks, calendar colours, pills, recap, stakes, badges), actions, every planned page version, and the no-network and 14px rules.',
);
