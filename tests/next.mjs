import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  answerLine,
  activePoints,
  asIfSignedToday,
  challengeSummary,
  disputesRaisedBy,
  settling,
  targetFor,
  asViewer,
  badges,
  calendar,
  checkinCount,
  dayColor,
  dayMisses,
  missesLine,
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
  shift,
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
  deleteChallenge,
  deleteSaved,
  hideChallenge,
  hideSaved,
  renameChallenge,
  updateChallenge,
  withdrawDispute,
} from '../lib/next/actions.ts';
import { world, FALL_RESET } from '../lib/next/demo.ts';
import { practiceFor } from '../lib/next/practice.ts';
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
// With a same-night deadline, today is the day being logged and yesterday is closed.
{
  const sameDay = updateChallenge(w, {
    deadline: { daysAfter: 0, time: '23:59' },
  });
  assert.equal(openDay(sameDay), '2026-11-20');
  assert.equal(dayColor(sameDay, w.me.id, '2026-11-20'), 'open');
  assert.equal(dayColor(w, w.me.id, '2026-11-20'), 'ahead');
}
assert.equal(formatDuration(timeLeft(w)), '4h 29m');
assert.ok(isClosed(FALL_RESET, '2026-11-18', w.now));
assert.ok(!isClosed(FALL_RESET, '2026-11-19', w.now));
assert.deepEqual(
  rulesOn(FALL_RESET, MAYA, '2026-11-19').map((r) => r.id),
  ['bed', 'phones', 'social', 'gym', 'eating-out', 'read', 'alcohol', 'arabic'],
);
assert.deepEqual(
  rulesOn(FALL_RESET, JORDAN, '2026-11-21').map((r) => r.id),
  ['phones', 'social', 'steps', 'gym', 'eating-out', 'arabic'],
);

// What is left to log.
assert.deepEqual(
  openCheckins(w, MAYA).map((r) => r.id),
  ['social', 'gym', 'read'],
);
assert.deepEqual(openCheckins(w, JORDAN), []);

// What waits for review.
const queue = reviewQueue(w, MAYA);
assert.equal(queue.count, 5);
assert.deepEqual(
  queue.answers.map((i) => i.entry.ruleId),
  ['steps', 'social', 'arabic'],
);
const steps = queue.answers[0].entry;
assert.equal(steps.value, 11240);
assert.equal(steps.proofs.length, 1);
assert.match(steps.proofs[0].src, /^data:image\/svg\+xml/);
assert.equal(formatAnswer(queue.answers[0].rule, steps), '11,240 steps');
assert.equal(queue.forgiveness.length, 1);
assert.equal(queue.forgiveness[0].point?.ruleId, 'eating-out');
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
assert.deepEqual(cal[17], {
  day: '2026-11-19',
  number: 18,
  color: 'open',
  misses: null,
});
assert.deepEqual(cal[18], {
  day: '2026-11-20',
  number: 19,
  color: 'ahead',
  misses: null,
});
// A missed day says how many of its check-ins were missed, out of how many it asked.
const missedDay = cal.find((d) => d.color === 'missed');
assert.ok(missedDay.misses.missed >= 1);
assert.ok(missedDay.misses.missed <= missedDay.misses.due);
assert.deepEqual(missedDay.misses, dayMisses(w, MAYA, missedDay.day));
assert.equal(missesLine({ missed: 1, due: 8 }), '1 of 8 missed');

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
assert.equal(checkinCount(plan, MAYA), 197);
assert.equal(checkinCount(plan, JORDAN), 175);
const stakes = stakesPreview(plan, 0.1, [MAYA, JORDAN]);
assert.deepEqual(
  stakes.perPerson.map((p) => [p.misses, p.gift]),
  [
    [20, 210],
    [18, 171],
  ],
);
assert.equal(stakes.gift, 190);
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
// When a day is first answered, said on Day 1 and before it (the sample's deadline: 11:59 pm the next day).
assert.equal(answerLine(w, w.today), 'Tomorrow, answer for today by 11:59 pm.');
assert.equal(
  answerLine(w, '2026-11-24'),
  'On Wednesday, answer for Tuesday by 11:59 pm.',
);
assert.equal(w.practice.questions.length, 3);
assert.deepEqual(w.practice.partnerReview.map((r) => r.decision).sort(), [
  'approve',
  'dispute',
]);
// One of the partner's answers to review doesn't match its screenshot.
assert.ok(
  w.practice.partnerAnswers.some(
    (a) => a.shot !== undefined && a.shot !== a.answer.value,
  ),
);
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
// A weekly No can ask to be forgiven: one request on the answer, reworded by saving again; forgiven,
// the day counts toward the week like a Yes. A Yes drops a request still waiting.
const gymNo = (world, forgiveness) =>
  saveCheckin(world, {
    personId: MAYA,
    ruleId: 'gym',
    day: '2026-11-19',
    done: false,
    ...(forgiveness ? { forgiveness } : {}),
  });
let g = gymNo(gymNo(w, 'Sprained ankle'), 'Sprained my ankle');
const gymEntry = entryFor(g, MAYA, 'gym', '2026-11-19');
const gymAsks = reviewQueue(g, JORDAN).forgiveness;
assert.equal(gymAsks.length, 1);
assert.equal(gymAsks[0].request.reason, 'Sprained my ankle');
assert.equal(gymAsks[0].point, undefined);
assert.equal(gymAsks[0].day, '2026-11-19');
assert.equal(gymAsks[0].personId, MAYA);
assert.equal(
  entryPill(g, ruleById(w.challenge, 'gym'), gymEntry, '2026-11-19').label,
  'Forgiveness asked',
);
const gymBefore = weekProgress(g, MAYA, 'gym', '2026-11-19').have;
g = decideForgiveness(g, gymAsks[0].request.id, 'approved');
assert.equal(entryFor(g, MAYA, 'gym', '2026-11-19').status, 'excused');
assert.equal(weekProgress(g, MAYA, 'gym', '2026-11-19').have, gymBefore + 1);
assert.equal(
  gymNo(g).entries.find((e) => e.id === gymEntry.id).status,
  'excused',
  'a note keeps it forgiven',
);
assert.equal(
  reviewQueue(
    saveCheckin(gymNo(w, 'Sick'), {
      personId: MAYA,
      ruleId: 'gym',
      day: '2026-11-19',
      done: true,
      proofs: [shot],
    }),
    JORDAN,
  ).forgiveness.length,
  0,
);
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
assert.equal(reviewQueue(y, MAYA).count, 4);
y = decideForgiveness(y, queue.forgiveness[0].request.id, 'approved');
assert.equal(activePoints(y, JORDAN).length, 8);
assert.equal(gets(y, MAYA), 36);
assert.equal(entryFor(y, JORDAN, 'eating-out', '2026-11-18').status, 'excused');
assert.equal(dayColor(y, JORDAN, '2026-11-18'), 'excused');
assert.equal(reviewQueue(y, MAYA).count, 3);
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
assert.equal(reviewQueue(replied, MAYA).count, 4);
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
assert.equal(reviewQueue(disputed, MAYA).answers.length, 2);
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
// Signing before Day 1: a limit of your own on a rule where each sets theirs, and once both have
// signed, Day 1 is never before the next day.
{
  const calories = {
    ...ruleById(FALL_RESET, 'read'),
    id: 'calories',
    kind: 'number',
    who: 'both',
    target: { op: '<=', value: 2000, unit: 'kcal' },
    personalTarget: true,
  };
  const before = {
    ...w,
    challenge: {
      ...w.challenge,
      status: 'signing',
      start: '2026-11-20',
      rules: [...w.challenge.rules, calories],
    },
  };
  assert.equal(asIfSignedToday(before.challenge, w.today).start, '2026-11-21');
  assert.equal(asIfSignedToday(w.challenge, w.today).start, w.challenge.start);
  const signed = signPact(before, JORDAN, { calories: 1800, read: 5 });
  const rule = ruleById(signed.challenge, 'calories');
  assert.deepEqual(rule.limits, { [JORDAN]: 1800 }, 'only a personal rule');
  assert.equal(targetFor(rule, JORDAN).value, 1800);
  assert.equal(targetFor(rule, MAYA).value, 2000, 'the suggestion until set');
  assert.deepEqual(
    [signed.challenge.status, signed.challenge.start],
    ['running', '2026-11-21'],
  );
  assert.equal(signPact(signed, JORDAN, { calories: 3000 }), signed);
}
// After the last deadline it isn't over until it's settled, and each challenge says where it stands.
{
  assert.equal(settling(w), null, 'mid-challenge');
  const last = lastDay(w.challenge);
  const after = shift(last, 3);
  const ended = { ...w, today: after, now: `${after}T12:00:00.000Z` };
  const open = {
    id: 'd-1',
    entryId: 'x',
    raisedBy: JORDAN,
    comment: 'No',
    status: 'open',
    createdAt: ended.now,
  };
  const idle = { ...ended, entries: [], disputes: [] };
  assert.deepEqual(settling(idle), {
    disputes: 0,
    raised: 0,
    onYours: 0,
    toReview: 0,
    yours: 0,
    myTimer: null,
    theirTimer: null,
  });
  // A timer still going holds the end: this person's, which they stop, or the partner's.
  {
    const S = await import('../lib/next/selectors.ts');
    const run = (personId) => ({
      personId,
      ruleId: 'arabic',
      day: last,
      startedAt: ended.now,
      runningSince: ended.now,
      banked: 0,
    });
    const mine = { ...idle, timers: [run(MAYA)] };
    assert.equal(
      S.settlingStep(mine, settling(mine)),
      'Your Arabic timer is still running. Stop it to see who won',
    );
    assert.equal(challengeSummary(mine).needsYou, true);
    assert.equal(S.settlingLine(mine), '');
    const theirs = { ...idle, timers: [run(JORDAN)] };
    assert.equal(
      challengeSummary(theirs).line,
      'Waiting for Jordan to stop their Arabic timer',
    );
    assert.equal(challengeSummary(theirs).needsYou, false);
  }
  const disputed = { ...idle, disputes: [open] };
  assert.equal(settling(disputed).disputes, 1);
  assert.equal(
    challengeSummary(disputed).line,
    'Settle 1 dispute to see who won',
  );
  assert.equal(challengeSummary(disputed).needsYou, true);
  assert.equal(
    challengeSummary(idle).line,
    'Waiting for Jordan to review your answers',
  );
  const here = challengeSummary(w);
  assert.equal(here.partner, 'Jordan');
  assert.ok(here.line.startsWith('Day 19 of 30'));
  const signing = {
    ...w,
    challenge: { ...w.challenge, status: 'signing' },
    pact: {
      ...w.pact,
      signatures: w.pact.signatures.map((s) => ({ ...s, signedAt: null })),
    },
  };
  // A draft the partner is setting up waits on them.
  const theirDraft = {
    ...w,
    challenge: { ...w.challenge, status: 'draft', createdBy: w.partner.id },
  };
  assert.equal(
    challengeSummary(theirDraft).line,
    `${w.partner.name} is setting this up`,
  );
  assert.equal(challengeSummary(theirDraft).needsYou, false);
  assert.equal(
    challengeSummary({
      ...w,
      challenge: { ...w.challenge, status: 'draft', createdBy: w.me.id },
    }).line,
    'Keep setting up',
  );
  assert.equal(challengeSummary(signing).line, 'Sign the pact');
  assert.equal(
    challengeSummary(signPact(signing, MAYA)).line,
    'Waiting for Jordan to sign',
  );
}
// The person who raised a dispute can always see and withdraw it, replied to or not: from both sides.
{
  const open = w.disputes.find((d) => d.status === 'open');
  const owner = w.entries.find((e) => e.id === open.entryId).personId;
  const raiser = open.raisedBy;
  assert.ok(disputesRaisedBy(w, raiser).some((i) => i.dispute.id === open.id));
  const replied = replyToDispute(w, open.id, 'I did');
  assert.ok(
    disputesRaisedBy(replied, raiser).some((i) => i.dispute.id === open.id),
    'still theirs to withdraw after the reply',
  );
  assert.equal(
    disputesRaisedBy(replied, owner).some((i) => i.dispute.id === open.id),
    false,
  );
}
// Hiding and deleting a finished challenge or a saved one are this person's own.
{
  const id = w.past[0].challenge.id;
  assert.equal(hideChallenge(w, id, true).past[0].hidden, true);
  assert.equal(hideSaved(w, w.saved[0].id, true).saved[0].hidden, true);
  assert.equal(deleteChallenge(w, id).past.length, w.past.length - 1);
  assert.equal(deleteSaved(w, w.saved[0].id).saved.length, w.saved.length - 1);
  assert.equal(renameChallenge(w, ' New ').challenge.name, 'New');
}
// Practice from a couple's own rules: the sample couple's (as hand-made), and a couple with only
// Yes-or-No rules, whose number parts fall back to the sample's.
{
  const built = practiceFor(FALL_RESET, MAYA, JORDAN, w.practice);
  assert.deepEqual(
    built.questions.map((q) => [q.rule.id, q.sample, q.shot]),
    [
      ['bed', {}, undefined],
      ['social', { value: 45 }, 72],
      ['phones', { done: false }, undefined],
    ],
  );
  assert.equal(
    built.partnerReview.find((r) => r.decision === 'dispute').comment,
    w.practice.partnerReview.find((r) => r.decision === 'dispute').comment,
    'the dispute quotes the screenshot',
  );
  assert.deepEqual(
    built.partnerAnswers.map((a) => [a.rule.id, a.answer, a.shot]),
    [
      ['eating-out', { done: true }, undefined],
      ['steps', { value: 10200 }, 8412],
    ],
    "the partner's answers aren't the ones you just gave",
  );
  const dry = {
    ...FALL_RESET,
    step: 2,
    rules: FALL_RESET.rules.filter((r) => r.kind === 'yesno'),
  };
  const yesOnly = practiceFor(dry, MAYA, JORDAN, w.practice);
  assert.ok(yesOnly.questions.every((q) => q.rule.kind === 'yesno'));
  assert.deepEqual(yesOnly.questions[1].sample, { done: true });
  assert.equal(yesOnly.miss.cost, 2);
  assert.equal(yesOnly.partnerAnswers[1], w.practice.partnerAnswers[1]);
}
assert.equal(
  setShareLink(w, 'saved-summer-sprint', true).saved[0].linkOn,
  true,
);
// The sample world itself never changes.
assert.equal(owes(w, MAYA), 21);
assert.deepEqual(openCheckins(w, MAYA).length, 3);

/* ── Pages: every planned version exists, and the rules for all new UI hold ─ */

// Kazzy picked one version of every page (components/next/DESIGN-LOG.md); a new design round raises a count.
const PLANNED = {
  landing: 1,
  signup: 1,
  shared: 1,
  start: 1,
  say: 1,
  setup: 1,
  home: 1,
  invite: 1,
  pact: 1,
  practice: 1,
  overview: 1,
  log: 1,
  timer: 1,
  rules: 1,
  review: 1,
  progress: 1,
  recap: 1,
  verdict: 1,
  settings: 1,
};
assert.equal(Object.keys(PLANNED).length, 19);
const pagesDir = join(root, 'components/next/pages');
const registry = readFileSync(join(pagesDir, 'registry.ts'), 'utf8');
for (const [id, count] of Object.entries(PLANNED)) {
  const dir = join(pagesDir, id);
  const index = readFileSync(join(dir, 'index.ts'), 'utf8');
  assert.match(
    registry,
    new RegExp(`import\\('\\./${id}'\\)`),
    `registry loads ${id}`,
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
  // The live app's host and database calls stay out of the kit and pages: they reach it through useBackend().
  assert.doesNotMatch(
    text,
    /@\/(components|lib)\/live\b|\.\.\/live\//,
    `${name}: pages and the kit never import components/live or lib/live`,
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

// The timer: a timed rule's sessions add up toward the day's target and past it.
{
  const T = await import('../lib/next/actions.ts');
  const S = await import('../lib/next/selectors.ts');
  const F = await import('../lib/next/format.ts');
  const arabic = w.challenge.rules.find((r) => r.id === 'arabic');
  const social = w.challenge.rules.find((r) => r.id === 'social');
  assert.ok(S.canTime(arabic) && S.canTime(social));
  assert.ok(!S.canTime(w.challenge.rules.find((r) => r.id === 'read')));
  assert.deepEqual(
    S.timedRules(w, MAYA).map((r) => r.id),
    ['arabic'],
  );
  assert.deepEqual(
    S.timeableRules(w, MAYA).map((r) => r.id),
    ['social'],
  );
  // Today Maya has 12 of 20 minutes from this morning's session.
  assert.equal(S.timedProgress(w, MAYA, arabic, '2026-11-20').minutes, 12);
  const at = (hm) => `2026-11-21T${hm}:00.000Z`; // Nov 20, evening in Toronto (UTC-5)
  let x = T.startTimer(w, MAYA, 'arabic', at('00:30'));
  assert.equal(S.timerOf(x, MAYA).day, '2026-11-20');
  assert.equal(S.timerSeconds(S.timerOf(x, MAYA), at('00:35')), 300);
  x = T.pauseTimer(x, MAYA, at('00:35'));
  assert.equal(
    S.timerSeconds(S.timerOf(x, MAYA), at('01:00')),
    300,
    'a paused clock stands still',
  );
  x = T.resumeTimer(x, MAYA, at('01:00'));
  // 5 + 13 minutes on the clock: with this morning's 12, today is 30 minutes, 10 past the target.
  const live = S.timedProgress(x, MAYA, arabic, '2026-11-20', at('01:13'));
  assert.deepEqual([live.minutes, live.diff, live.met], [30, 600, true]);
  // What's logged leaves the session going out until it stops: still this morning's 12.
  assert.equal(S.loggedSeconds(x, MAYA, 'arabic', '2026-11-20'), 720);
  assert.deepEqual(
    [
      S.loggedProgress(x, MAYA, arabic, '2026-11-20').minutes,
      S.loggedProgress(x, MAYA, arabic, '2026-11-20').met,
    ],
    [12, false],
  );
  // A check-in can answer yesterday, so it never asks "today".
  const asked = (question) => S.askedQuestion({ question });
  assert.equal(asked('Did you pray today?'), 'Did you pray?');
  assert.equal(
    asked('Did you walk at least 10,000 steps today?'),
    'Did you walk at least 10,000 steps?',
  );
  assert.equal(asked('Today, did you stretch?'), 'Did you stretch?');
  assert.equal(
    asked('Did you hit today’s target?'),
    'Did you hit today’s target?',
  );
  assert.equal(asked('Today?'), 'Today?');
  x = T.stopTimer(x, MAYA, at('01:13'));
  assert.equal(S.loggedProgress(x, MAYA, arabic, '2026-11-20').minutes, 30);
  assert.equal(S.timerOf(x, MAYA), null);
  const last = x.sessions[x.sessions.length - 1];
  assert.deepEqual(
    [last.day, last.seconds, last.startedAt],
    ['2026-11-20', 1080, at('00:30')],
  );
  assert.deepEqual(
    S.sessionsOf(x, MAYA, 'arabic', '2026-11-20').map((s) => s.seconds),
    [720, 1080],
  );
  assert.equal(
    F.formatMinutes(S.timedSeconds(x, MAYA, 'arabic', '2026-11-20')),
    '30 min',
  );
  assert.equal(F.formatClock(1080), '18:00');
  assert.equal(F.formatClock(3725), '1:02:05');
  // 19:59 is saved as 19 minutes, so the target counts only once the clock reaches 20:00.
  assert.equal(S.timedMinutes(1199), 19);
  // A session that runs past midnight counts toward the day it started.
  let y = T.startTimer(w, MAYA, 'arabic', at('04:50'));
  y = T.stopTimer(y, MAYA, at('05:20'));
  assert.equal(y.sessions[y.sessions.length - 1].day, '2026-11-20');
  // One timer at a time: starting another saves the first.
  let z = T.setTimed(w, 'social', true);
  assert.ok(z.challenge.rules.find((r) => r.id === 'social').timed);
  z = T.startTimer(z, MAYA, 'arabic', at('00:00'));
  z = T.startTimer(z, MAYA, 'social', at('00:10'));
  assert.equal(S.timerOf(z, MAYA).ruleId, 'social');
  assert.equal(S.sessionsOf(z, MAYA, 'arabic', '2026-11-20').length, 2);
  // Turning the timer off saves a timer going on that rule; a rule not in minutes can't be timed.
  z = T.setTimed(z, 'social', false, at('00:20'));
  assert.equal(S.timerOf(z, MAYA), null);
  assert.equal(S.sessionsOf(z, MAYA, 'social', '2026-11-20')[0].seconds, 600);
  assert.equal(T.setTimed(w, 'read', true), w);
  assert.equal(
    T.startTimer(w, MAYA, 'social', at('00:00')),
    w,
    'only a timed rule starts',
  );
  assert.equal(
    T.startTimer(w, MAYA, 'steps', at('00:00')),
    w,
    "only one's own rule",
  );
  assert.equal(
    T.startTimer(
      { ...w, challenge: { ...w.challenge, status: 'finished' } },
      MAYA,
      'arabic',
      at('00:00'),
    ).timers.length,
    0,
    'only while it runs',
  );
  // A stop with nothing on the clock saves nothing; removing a session takes it off.
  assert.equal(
    T.stopTimer(T.startTimer(w, MAYA, 'arabic', at('00:00')), MAYA, at('00:00'))
      .sessions.length,
    w.sessions.length,
  );
  assert.equal(T.removeSession(x, last.id).sessions.length, w.sessions.length);
  // History: each day it asks, newest first, with the answer saved from the timer.
  const days = S.timedDays(w, JORDAN, arabic);
  assert.deepEqual(
    days.map((d) => [d.day, d.seconds / 60, d.entry?.status ?? null]),
    [
      ['2026-11-20', 20, null],
      ['2026-11-19', 35, 'pending'],
      ['2026-11-18', 26, 'confirmed'],
      ['2026-11-17', 22, 'confirmed'],
      ['2026-11-16', 20, 'confirmed'],
    ],
  );
  assert.ok(days[1].entry.fromTimer);
  // A change by hand on Check in is no longer from the timer.
  const byHand = saveCheckin(w, {
    personId: MAYA,
    ruleId: 'arabic',
    day: '2026-11-19',
    value: 40,
  });
  assert.equal(
    entryFor(byHand, MAYA, 'arabic', '2026-11-19').fromTimer,
    undefined,
  );
}

// Goals: each person's own, in order, words only.
{
  const G = await import('../lib/next/actions.ts');
  const S = await import('../lib/next/selectors.ts');
  assert.deepEqual(
    S.goalsOf(w, MAYA).map((g) => g.text),
    ['Run a 10K before New Year', 'Read two books a month'],
  );
  assert.deepEqual(
    S.goalsOf(w, JORDAN).map((g) => g.text),
    ['Sleep 7 hours most nights'],
  );
  const x = G.setGoals(w, MAYA, [
    '  Learn to swim ',
    '',
    'x'.repeat(150),
    'a',
    'b',
    'c',
    'd',
    'e',
  ]);
  assert.deepEqual(
    S.goalsOf(x, MAYA).map((g) => g.text.length),
    [13, 100, 1, 1, 1],
    'trimmed, empty dropped, 100 characters, 5 at most',
  );
  assert.equal(S.goalsOf(x, JORDAN).length, 1, "the partner's stay");
  assert.equal(S.goalsOf(G.setGoals(w, MAYA, []), MAYA).length, 0);
}

// The live app can open every page inside a running challenge (it once couldn't open Timer).
{
  const { PAGE_META } = await import('../components/next/pages/meta.ts');
  const live = readFileSync(join(root, 'components/live/live-app.tsx'), 'utf8');
  const running = [
    ...live
      .match(/const RUNNING: PageId\[\] = \[([\s\S]*?)\];/)[1]
      .matchAll(/'(\w+)'/g),
  ].map((m) => m[1]);
  for (const meta of Object.values(PAGE_META))
    if (meta.frame === 'app')
      assert.ok(
        running.includes(meta.id),
        `the live app opens ${meta.id} while a challenge runs`,
      );
}

console.log(
  'PASS: next — formatters and dates, the sample world’s numbers (open check-ins, review queue, points and gifts, gym weeks, streaks, calendar colours, pills, recap, stakes, badges), actions, the timer, goals, every planned page version, and the no-network and 14px rules.',
);
