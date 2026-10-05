import { END, START, closed, days, shift, toronto } from './dates.ts';
import { askedPoints, weeklyCredit, weeklyForgiven } from './progress.ts';
import { dailyRules, weeklyRules, type Person } from './rules.ts';
import { targetFor, toWeeks } from './weeks.ts';
import type { Data, Entry, Point, Request } from './types.ts';

/**
 * Made-up challenge data for demo mode (localhost with ?demo; hooks/use-demo.ts), so every page can be
 * looked at without signing in to the live database. Deterministic for a given moment: the same day
 * always gives the same answers, with a few of everything (misses, reviews, forgiveness, a dispute,
 * gym days forgiven and asked, closed weeks assessed).
 */

/** Weeks and targets as supabase/setup.sql defines them; tests/demo.mjs checks they agree. */
export const DEMO_WEEKS = toWeeks(
  [
    { start_date: '2026-09-15', end_date: '2026-09-20' },
    { start_date: '2026-09-21', end_date: '2026-09-27' },
    { start_date: '2026-09-28', end_date: '2026-10-04' },
    { start_date: '2026-10-05', end_date: '2026-10-11' },
    { start_date: '2026-10-12', end_date: '2026-10-14' },
  ],
  [
    ['gym', '2026-09-15', 3],
    ['gym', '2026-09-21', 4],
    ['gym', '2026-09-28', 4],
    ['gym', '2026-10-05', 4],
    ['gym', '2026-10-12', 1],
    ['steps_weekly', '2026-09-28', 3],
    ['steps_weekly', '2026-10-05', 3],
    ['steps_weekly', '2026-10-12', 1],
  ].map(([rule_id, start_date, target]) => ({
    rule_id: rule_id as string,
    start_date: start_date as string,
    target: target as number,
  })),
);

export const DEMO_IDS: Record<Person, string> = {
  Erin: 'demo-erin',
  Kazzy: 'demo-kazzy',
};

/** A steady number in [0, 1) for a key, so the demo looks the same on every load. */
function roll(key: string) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const NOTES = [
  'Long day, but I still made it to bed on time.',
  'Meal prepped for the week. Feeling good about food.',
  'Skipped dessert tonight and did not even miss it.',
  'Walked to the store instead of driving.',
  'Hard one today. Tomorrow is a fresh start.',
  'Read two chapters before falling asleep.',
];

export function demoData(now: number): Data {
  const today = toronto(new Date(now)),
    last = shift(today, -1) < END ? shift(today, -1) : END,
    entries: Entry[] = [],
    points: Point[] = [],
    requests: Request[] = [],
    profiles = (['Erin', 'Kazzy'] as const).map((name) => ({
      id: DEMO_IDS[name],
      name,
    }));
  if (last < START)
    return {
      profiles,
      entries,
      points,
      requests,
      disputes: [],
      finalizations: [],
      journals: [],
      photos: [],
      weeks: DEMO_WEEKS,
    };
  const add = (
    uid: string,
    rule: string,
    day: string,
    done: boolean,
    status: string,
  ) => {
    const e: Entry = {
      id: `e:${uid}:${rule}:${day}`,
      user_id: uid,
      rule_id: rule,
      day,
      done,
      status,
      note: '',
      proof: null,
      proposed_done: null,
      proposed_note: null,
      proposed_proof: null,
      updated_at: `${day}T23:00:00Z`,
    };
    entries.push(e);
    return e;
  };
  const point = (e: Entry, reason: string, o: Partial<Point> = {}) => {
    const q: Point = {
      id: `p:${e.id}`,
      user_id: e.user_id,
      rule_id: e.rule_id,
      day: e.day,
      reason,
      forgiven: false,
      voided: false,
      entry_id: e.id,
      created_at: `${shift(e.day, 1)}T04:00:00Z`,
      ...o,
    };
    points.push(q);
    return q;
  };
  const ask = (q: Point, status: string, reason: string) =>
    requests.push({
      id: `r:${q.id}`,
      point_id: q.id,
      requester_id: q.user_id,
      reason,
      status,
    });

  for (const p of profiles)
    for (const d of days(START, last)) {
      const open = !closed(d, now);
      for (const r of dailyRules(p.name, d)) {
        const x = roll(`${p.id}|${r.id}|${d}`);
        if (open) {
          if (x < 0.5) add(p.id, r.id, d, true, 'pending');
          continue;
        }
        if (x < 0.03) point(add(p.id, r.id, d, false, 'unlogged'), 'unlogged');
        else if (x < 0.1) point(add(p.id, r.id, d, false, 'missed'), 'missed');
        else
          add(
            p.id,
            r.id,
            d,
            true,
            d >= shift(today, -3) && x > 0.85 ? 'pending' : 'confirmed',
          );
      }
      for (const r of weeklyRules(p.name)) {
        if (
          !targetFor(
            DEMO_WEEKS.find((w) => d >= w.start && d <= w.end),
            r.id,
          )
        )
          continue;
        const x = roll(`${p.id}|${r.id}|${d}`);
        if (x < 0.55)
          add(p.id, r.id, d, true, open || x > 0.5 ? 'pending' : 'confirmed');
        else if (x < 0.75) add(p.id, r.id, d, false, 'missed');
      }
    }

  // A few forgiveness stories: Erin's first miss forgiven, Kazzy's latest one still asked.
  const misses = (uid: string) =>
    points.filter((q) => q.user_id === uid && q.reason === 'missed');
  const forgiven = misses(DEMO_IDS.Erin)[0];
  if (forgiven) {
    forgiven.forgiven = true;
    entries.find((e) => e.id === forgiven.entry_id)!.status = 'excused';
    ask(forgiven, 'approved', 'Stuck at the airport all night.');
  }
  const asking = misses(DEMO_IDS.Kazzy).at(-1);
  if (asking) ask(asking, 'pending', 'Family dinner I could not skip.');
  // Gym Nos: Erin's latest asked, Kazzy's first forgiven as a visit.
  const gymNos = (uid: string) =>
    entries.filter((e) => e.user_id === uid && e.rule_id === 'gym' && !e.done);
  const erinNo = gymNos(DEMO_IDS.Erin).at(-1);
  if (erinNo) ask(point(erinNo, 'day_forgiveness'), 'pending', 'Fever.');
  const kazzyNo = gymNos(DEMO_IDS.Kazzy)[0];
  if (kazzyNo) {
    kazzyNo.status = 'excused';
    ask(
      point(kazzyNo, 'day_forgiveness', { forgiven: true }),
      'approved',
      'Gym was closed for repairs.',
    );
  }
  // One open dispute on an answer still awaiting review.
  const disputed = entries.find(
    (e) =>
      e.user_id === DEMO_IDS.Kazzy &&
      e.status === 'pending' &&
      !e.rule_id.includes('gym'),
  );
  if (disputed) disputed.status = 'disputed';

  // Closed weeks assessed as challenge_rescore does: one slot per target, voided once met.
  const base = { entries, points, requests } as Data,
    asked = askedPoints(base);
  for (const w of DEMO_WEEKS)
    if (closed(w.end, now))
      for (const p of profiles)
        for (const r of weeklyRules(p.name)) {
          const t = targetFor(w, r.id),
            met =
              weeklyCredit(base, p.id, r.id, w) +
              weeklyForgiven(base, p.id, r.id, w, asked).asking;
          for (let i = 1; i <= t; i++)
            points.push({
              id: `p:${p.id}:${r.id}:${w.end}:${i}`,
              user_id: p.id,
              rule_id: r.id,
              day: w.end,
              reason: 'weekly_shortfall',
              forgiven: false,
              voided: i > t - met,
              entry_id: null,
              created_at: `${shift(w.end, 2)}T04:00:00Z`,
            });
        }

  const journals = NOTES.map((text, i) => {
    const day = shift(last, -i);
    return {
      id: `j${i}`,
      user_id: i % 2 ? DEMO_IDS.Kazzy : DEMO_IDS.Erin,
      day: day < START ? START : day,
      text,
      created_at: `${day < START ? START : day}T${20 + (i % 3)}:15:00Z`,
    };
  });

  return {
    profiles,
    entries,
    points,
    requests,
    disputes: disputed
      ? [
          {
            id: 'd1',
            entry_id: disputed.id,
            raised_by: DEMO_IDS.Erin,
            comment: 'The screenshot shows a different day.',
            status: 'open',
          },
        ]
      : [],
    finalizations: [],
    journals,
    photos: [],
    weeks: DEMO_WEEKS,
  };
}
