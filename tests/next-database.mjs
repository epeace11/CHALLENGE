// The new schema (supabase/next/schema.sql) on PGlite: two couples, the whole daily loop, deadlines,
// weekly shortfalls, and that one couple can never read or change the other's challenge.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { buildWorld, verdictFor, withShared } from '../lib/live/world.ts';
import { activePoints, owes, reviewQueue } from '../lib/next/selectors.ts';

const db = new PGlite();
const maya = '00000000-0000-0000-0000-00000000000a',
  jordan = '00000000-0000-0000-0000-00000000000b',
  priya = '00000000-0000-0000-0000-00000000000c',
  sam = '00000000-0000-0000-0000-00000000000d';
await db.exec(
  `create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
   grant usage on schema public, auth, storage to anon, authenticated, service_role;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.objects(bucket_id text,name text);
   create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
   insert into auth.users values('${maya}','maya@example.com','{}'),('${jordan}','jordan@example.com','{}'),('${priya}','priya@example.com','{}'),('${sam}','sam@example.com','{}');`,
);
await db.exec(
  readFileSync(new URL('../supabase/next/schema.sql', import.meta.url), 'utf8'),
);
// The rerunnable scripts run cleanly on a project that already has the schema.
for (const script of [
  'share-links.sql',
  'invite-links.sql',
  'gifts-given.sql',
  'fixes-oct-18.sql',
  'cancel-challenge.sql',
  'end-requests.sql',
])
  await db.exec(
    readFileSync(
      new URL(`../supabase/next/${script}`, import.meta.url),
      'utf8',
    ),
  );

/** Runs SQL as `id` (row-level security on), at `now` when given. */
async function as(id, sql, params = []) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated`,
  );
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec(`reset role`);
  }
}
const one = async (id, sql, params) => (await as(id, sql, params))[0];
const clock = (t) => db.exec(`select set_config('nx.now','${t}',false)`);
const fails = (promise, message) =>
  assert.rejects(promise, (e) => {
    assert.match(e.message, message);
    return true;
  });

// Monday Nov 2 2026, Toronto. A 14-day challenge, deadline 11:59 pm the next day.
await clock('2026-10-30T12:00:00-04:00');
for (const [id, name] of [
  [maya, 'Maya'],
  [jordan, 'Jordan'],
  [priya, 'Priya'],
  [sam, 'Sam'],
])
  await as(id, `select nx_set_name($1)`, [name]);

const rules = JSON.stringify([
  {
    title: 'Pray daily',
    question: 'Did you pray?',
    kind: 'yesno',
    days: [0, 1, 2, 3, 4, 5, 6],
    who: 'both',
  },
  {
    title: '10,000 steps',
    question: 'How many steps?',
    kind: 'number',
    days: [0, 1, 2, 3, 4, 5, 6],
    target: { op: '>=', value: 10000, unit: 'steps' },
    who: 'me',
    proof: 'required',
  },
  {
    title: 'Gym',
    question: 'Did you go to the gym?',
    kind: 'weekly',
    days: [0, 1, 2, 3, 4, 5, 6],
    weeklyTarget: 4,
    who: 'both',
  },
]);
const { nx_create_challenge: fall } = await one(
  maya,
  `select nx_create_challenge('Fall Reset','classic',null,'2026-11-02',14,'America/Toronto',1,null,$1::jsonb)`,
  [rules],
);
assert.equal(
  (await one(maya, `select status from challenges where id=$1`, [fall])).status,
  'draft',
);
const rule = async (title) =>
  (await one(maya, `select id from rules where title=$1`, [title])).id;
// A personal rule for a partner who hasn't joined yet waits for them.
await as(maya, `select nx_update_challenge($1,p_rules=>$2::jsonb)`, [
  fall,
  JSON.stringify([
    ...JSON.parse(rules),
    {
      title: 'No alcohol',
      question: 'Did you skip alcohol?',
      kind: 'yesno',
      days: [0, 1, 2, 3, 4, 5, 6],
      who: 'partner',
    },
  ]),
]);
const pray = await rule('Pray daily'),
  steps = await rule('10,000 steps'),
  gym = await rule('Gym'),
  alcohol = await rule('No alcohol');

// Invite: Maya finishes setup, makes a link; Jordan previews it signed out, then accepts.
await as(maya, `select nx_finish_setup($1)`, [fall]);
const { token, code } = await one(
  maya,
  `select * from nx_create_invite($1,'Jordan','jordan@example.com')`,
  [fall],
);
assert.equal(code.length, 6);
assert.equal(
  (await as(maya, `select id,code from invites`)).length,
  1,
  'members see their invite',
);
await fails(
  as(maya, `select token_hash from invites`),
  /permission denied/,
  'but never its hash',
);
await db.exec(`set role anon`);
const preview = (await db.query(`select nx_invite_preview($1) p`, [token]))
  .rows[0].p;
await db.exec(`reset role`);
assert.equal(preview.from.name, 'Maya');
assert.equal(preview.challenge.name, 'Fall Reset');
assert.equal(preview.rules.length, 4);
await fails(
  as(maya, `select nx_accept_invite($1)`, [token]),
  /your own invite/,
);
await fails(
  as(jordan, `select nx_accept_invite($1)`, [code]),
  /expired or was already used/,
  'the short code is too easy to guess to open an invite',
);
// A second link (another device) leaves the first one working.
const second = await one(
  maya,
  `select * from nx_create_invite($1,'Jordan','')`,
  [fall],
);
assert.notEqual(second.token, token);
assert.equal(
  (await one(jordan, `select nx_accept_invite($1) id`, [token])).id,
  fall,
);
for (const t of [token, second.token])
  await fails(
    as(priya, `select nx_accept_invite($1)`, [t]),
    /expired or was already used|already has two people/,
  );
assert.equal(
  (await one(jordan, `select status from challenges where id=$1`, [fall]))
    .status,
  'signing',
);
assert.deepEqual(
  await one(jordan, `select who,for_invitee from rules where id=$1`, [alcohol]),
  { who: jordan, for_invitee: false },
  "Jordan's own rule is his once he joins",
);

// Changing the stakes clears Maya's signature; both sign, and it runs.
await as(jordan, `select nx_update_challenge($1,p_step=>2)`, [fall]);
assert.equal(
  (await as(maya, `select * from signatures where challenge_id=$1`, [fall]))
    .length,
  0,
);
await as(maya, `select nx_sign_pact($1)`, [fall]);
await as(jordan, `select nx_sign_pact($1)`, [fall]);
assert.equal(
  (await one(maya, `select status from challenges where id=$1`, [fall])).status,
  'running',
);
await fails(
  as(maya, `select nx_update_challenge($1,p_days=>30)`, [fall]),
  /set once/,
);
await as(maya, `select nx_update_challenge($1,p_name=>'Fall Reset!')`, [fall]);

// A second couple, Priya and Sam, with their own challenge.
const { nx_create_challenge: dry } = await one(
  priya,
  `select nx_create_challenge('Dry October','dry','dry','2026-11-02',7,'America/Los_Angeles',1,null,$1::jsonb)`,
  [rules],
);
await as(priya, `select nx_finish_setup($1)`, [dry]);
const invite2 = await one(priya, `select * from nx_create_invite($1)`, [dry]);
await as(sam, `select nx_accept_invite($1)`, [invite2.token]);

// Tuesday Nov 3, 9 am: Monday is open.
await clock('2026-11-03T09:00:00-05:00');
await fails(
  as(maya, `select nx_save_checkin($1,$2,'2026-11-03',true)`, [fall, pray]),
  /once it's over/,
);
await as(maya, `select nx_save_checkin($1,$2,'2026-11-02',true)`, [fall, pray]);
await fails(
  as(maya, `select nx_save_checkin($1,$2,'2026-11-02',p_value=>11000)`, [
    fall,
    steps,
  ]),
  /Attach a screenshot/,
);
await fails(
  as(
    maya,
    `select nx_save_checkin($1,$2,'2026-11-02',p_value=>11000,p_proofs=>$3::jsonb)`,
    [fall, steps, JSON.stringify([{ path: `${fall}/${maya}/a.jpg` }])],
  ),
  /didn't upload/,
);
await db.exec(
  `insert into storage.objects values('proofs','${fall}/${maya}/a.jpg'),('proofs','${fall}/${jordan}/b.jpg')`,
);
await fails(
  as(
    maya,
    `select nx_save_checkin($1,$2,'2026-11-02',p_value=>11000,p_proofs=>$3::jsonb)`,
    [fall, steps, JSON.stringify([{ path: `${fall}/${jordan}/b.jpg` }])],
  ),
  /didn't upload/,
  "someone else's screenshot",
);
await as(
  maya,
  `select nx_save_checkin($1,$2,'2026-11-02',p_value=>11000,p_proofs=>$3::jsonb)`,
  [
    fall,
    steps,
    JSON.stringify([
      { path: `${fall}/${maya}/a.jpg`, takenAt: '2026-11-03T07:30:00Z' },
    ]),
  ],
);
await fails(
  as(jordan, `select nx_save_checkin($1,$2,'2026-11-02',p_value=>11000)`, [
    fall,
    steps,
  ]),
  /isn't asked/,
  "Jordan doesn't have Maya's steps",
);
// Jordan says No to prayer and asks for forgiveness in the same Save.
await as(
  jordan,
  `select nx_save_checkin($1,$2,'2026-11-02',false,p_forgiveness=>'Hospital night')`,
  [fall, pray],
);
await as(jordan, `select nx_save_checkin($1,$2,'2026-11-02',true)`, [
  fall,
  gym,
]);

const entry = async (person, ruleId, day) =>
  one(
    maya,
    `select * from entries where person_id=$1 and rule_id=$2 and day=$3`,
    [person, ruleId, day],
  );
assert.equal((await entry(maya, pray, '2026-11-02')).status, 'pending');
assert.equal((await entry(jordan, pray, '2026-11-02')).status, 'missed');
const req = await one(maya, `select * from forgiveness_requests`);
assert.equal(req.reason, 'Hospital night');

// Reviews.
const mayaPray = (await entry(maya, pray, '2026-11-02')).id;
await fails(
  as(maya, `select nx_review($1,'approve')`, [mayaPray]),
  /Only your partner/,
);
await as(jordan, `select nx_review($1,'dispute','You were at the movies')`, [
  mayaPray,
]);
await fails(
  as(maya, `select nx_save_checkin($1,$2,'2026-11-02',true)`, [fall, pray]),
  /Answer the dispute/,
);
const disputeId = (await one(maya, `select id from disputes`)).id;
await as(maya, `select nx_resolve_dispute($1,'reply','I prayed after')`, [
  disputeId,
]);
await as(maya, `select nx_resolve_dispute($1,'concede')`, [disputeId]);
assert.equal((await entry(maya, pray, '2026-11-02')).status, 'conceded');
await as(maya, `select nx_decide_forgiveness($1,true)`, [req.id]);
assert.equal((await entry(jordan, pray, '2026-11-02')).status, 'excused');
// Editing a forgiven No (adding a note) keeps it forgiven.
await as(
  jordan,
  `select nx_save_checkin($1,$2,'2026-11-02',false,p_note=>'Back at 2 am')`,
  [fall, pray],
);
assert.equal((await entry(jordan, pray, '2026-11-02')).status, 'excused');
assert.equal(
  (
    await one(
      maya,
      `select forgiven from points where person_id=$1 and rule_id=$2 and day='2026-11-02'`,
      [jordan, pray],
    )
  ).forgiven,
  true,
);
const mayaSteps = (await entry(maya, steps, '2026-11-02')).id;
await as(jordan, `select nx_review($1,'approve')`, [mayaSteps]);

const points = async (person) =>
  as(
    maya,
    `select reason,forgiven,voided,day::text from points where person_id=$1 and challenge_id=$2 order by created_at,slot`,
    [person, fall],
  );
assert.deepEqual(await points(maya), [
  { reason: 'conceded', forgiven: false, voided: false, day: '2026-11-02' },
]);
assert.deepEqual(await points(jordan), [
  { reason: 'missed', forgiven: true, voided: false, day: '2026-11-02' },
]);

// Thursday Nov 5, 9 am: Tuesday Nov 3 closed at 11:59 pm Wednesday. Nobody logged it.
await clock('2026-11-05T09:00:00-05:00');
await as(maya, `select nx_sync($1)`, [fall]);
assert.equal((await entry(maya, pray, '2026-11-03')).status, 'unlogged');
assert.equal((await entry(maya, steps, '2026-11-03')).status, 'unlogged');
assert.equal(
  await entry(jordan, steps, '2026-11-03'),
  undefined,
  'only the person who has a rule misses it',
);
assert.equal(
  (await entry(maya, gym, '2026-11-03')) ?? null,
  null,
  'a weekly rule never goes unlogged',
);
assert.equal(
  (
    await as(
      maya,
      `select count(*)::int n from points where reason='unlogged' and challenge_id=$1`,
      [fall],
    )
  )[0].n,
  5,
  'Maya: prayer and steps on Nov 3; Jordan: prayer on Nov 3, alcohol on Nov 2 and 3',
);
// A late answer is a correction the partner approves; approving a Yes voids the unlogged point.
await as(maya, `select nx_save_checkin($1,$2,'2026-11-03',true)`, [fall, pray]);
const late = await entry(maya, pray, '2026-11-03');
assert.equal(late.status, 'unlogged');
assert.equal(late.correction_done, true);
await as(jordan, `select nx_review($1,'approve')`, [late.id]);
assert.equal((await entry(maya, pray, '2026-11-03')).status, 'confirmed');
assert.equal(
  (
    await one(
      maya,
      `select voided from points where person_id=$1 and rule_id=$2 and day='2026-11-03'`,
      [maya, pray],
    )
  ).voided,
  true,
);

// 48 hours without review counts as approved.
await as(jordan, `select nx_save_checkin($1,$2,'2026-11-04',true)`, [
  fall,
  pray,
]);
await clock('2026-11-07T10:00:00-05:00');
await as(maya, `select nx_sync($1)`, [fall]);
assert.equal((await entry(jordan, pray, '2026-11-04')).status, 'confirmed');

// The first week runs Mon Nov 2 – Sun Nov 8 (week starts Monday). It closes 11:59 pm Monday Nov 9.
// Jordan went to the gym once (Nov 2), so is 3 short; Maya never went, so is 4 short.
await clock('2026-11-10T09:00:00-05:00');
await as(jordan, `select nx_sync($1)`, [fall]);
const weekly = async (person) =>
  (
    await as(
      maya,
      `select count(*) filter (where not voided)::int n from points where person_id=$1 and rule_id=$2 and day='2026-11-08'`,
      [person, gym],
    )
  )[0].n;
assert.equal(await weekly(jordan), 3);
assert.equal(await weekly(maya), 4);
await as(maya, `select nx_sync($1)`, [fall]);
assert.equal(await weekly(maya), 4, 'ticking again changes nothing');

// Journal.
const { nx_add_note: note } = await one(
  maya,
  `select nx_add_note($1,'2026-11-09','Rainy run')`,
  [fall],
);
await fails(
  as(jordan, `select nx_edit_note($1,'mine now')`, [note]),
  /your own notes/,
);
await as(maya, `select nx_remove_note($1)`, [note]);

// Saved challenges and share links.
const { nx_save_challenge: saved } = await one(
  maya,
  `select nx_save_challenge($1,'The Fall One')`,
  [fall],
);
const s = await one(maya, `select * from saved_challenges where id=$1`, [
  saved,
]);
assert.equal(s.rules.length, 4);
assert.equal(s.rules[3].who, 'partner');
assert.equal(s.rules[1].who, 'me');
await as(maya, `select nx_set_share_link($1,true)`, [saved]);
await fails(
  as(priya, `select nx_set_share_link($1,false)`, [saved]),
  /isn't yours/,
);
// The share-links script reruns cleanly on a project that already has the schema.
await db.exec(
  readFileSync(
    new URL('../supabase/next/share-links.sql', import.meta.url),
    'utf8',
  ),
);
// Anyone with the link reads the rules and settings while the link is on, never who saved it.
const linkToken = (
  await one(maya, `select link_token from saved_challenges where id=$1`, [
    saved,
  ])
).link_token;
await db.exec(`set role anon`);
const sharedPreview = (
  await db.query(`select nx_shared_preview($1) p`, [linkToken])
).rows[0].p;
await db.exec(`reset role`);
assert.equal(sharedPreview.name, 'The Fall One');
assert.equal(sharedPreview.rules.length, 4);
assert.equal(sharedPreview.couple_id, undefined);
// Another couple saves their own copy, with its link off; saving again from the owners is a no-op.
const { nx_save_shared: copy } = await one(priya, `select nx_save_shared($1)`, [
  linkToken,
]);
assert.notEqual(copy, saved);
const copyRow = await one(
  priya,
  `select name, link_on, link_token from saved_challenges where id=$1`,
  [copy],
);
assert.deepEqual([copyRow.name, copyRow.link_on], ['The Fall One', false]);
assert.notEqual(copyRow.link_token, linkToken);
assert.equal(
  (await one(maya, `select nx_save_shared($1) id`, [linkToken])).id,
  saved,
);
// Turned off, the link shows nothing and can't be saved.
await as(maya, `select nx_set_share_link($1,false)`, [saved]);
assert.equal(
  (await one(priya, `select nx_shared_preview($1) p`, [linkToken])).p,
  null,
);
await fails(as(sam, `select nx_save_shared($1)`, [linkToken]), /turned off/);

// The other couple sees nothing of Fall Reset and can change none of it.
await as(maya, `select nx_add_note($1,'2026-11-09','Long walk')`, [fall]);
const mayasCouple = (
  await one(maya, `select couple_id from challenges where id=$1`, [fall])
).couple_id;
for (const [t, column] of [
  ['challenges', 'id'],
  ['rules', 'challenge_id'],
  ['entries', 'challenge_id'],
  ['points', 'challenge_id'],
  ['forgiveness_requests', 'challenge_id'],
  ['disputes', 'challenge_id'],
  ['journal_notes', 'challenge_id'],
  ['signatures', 'challenge_id'],
  ['invites', 'challenge_id'],
  ['saved_challenges', 'couple_id'],
]) {
  const value = column === 'couple_id' ? mayasCouple : fall;
  assert.ok(
    (
      await as(
        maya,
        `select count(${column})::int n from ${t} where ${column}=$1`,
        [value],
      )
    )[0].n > 0,
    `${t}: Maya sees her own rows`,
  );
  assert.equal(
    (
      await as(
        priya,
        `select count(${column})::int n from ${t} where ${column}=$1`,
        [value],
      )
    )[0].n,
    0,
    `${t}: Priya sees none of them`,
  );
}
assert.deepEqual(
  (await as(priya, `select name from profiles order by name`)).map(
    (r) => r.name,
  ),
  ['Priya', 'Sam'],
);
for (const sql of [
  [`select nx_sync($1)`, [fall]],
  [`select nx_save_checkin($1,$2,'2026-11-09',true)`, [fall, pray]],
  [`select nx_add_note($1,'2026-11-09','hi')`, [fall]],
  [`select nx_update_challenge($1,p_name=>'Mine')`, [fall]],
  [`select nx_sign_pact($1)`, [fall]],
  [`select * from nx_create_invite($1)`, [fall]],
  [`select nx_save_challenge($1,'Stolen')`, [fall]],
])
  await fails(as(priya, sql[0], sql[1]), /isn't yours/);
const mayaPoint = (
  await one(maya, `select id from points where person_id=$1 limit 1`, [maya])
).id;
await fails(as(sam, `select nx_forgive_point($1)`, [mayaPoint]), /isn't yours/);
await fails(
  as(sam, `select nx_review($1,'approve')`, [mayaSteps]),
  /isn't yours/,
);
await fails(
  as(
    priya,
    `insert into points(challenge_id,person_id,rule_id,day,reason) values($1,$2,$3,'2026-11-09','missed')`,
    [fall, priya, pray],
  ),
  /permission denied/,
);
await fails(
  as(maya, `update entries set status='confirmed'`),
  /permission denied/,
  'nobody writes tables directly',
);

// Partner forgives without being asked; the owner can't forgive themself.
const jordanWeekly = (
  await one(
    maya,
    `select id from points where person_id=$1 and rule_id=$2 and not voided limit 1`,
    [jordan, gym],
  )
).id;
await fails(
  as(jordan, `select nx_forgive_point($1)`, [jordanWeekly]),
  /Only your partner/,
);
await as(maya, `select nx_forgive_point($1)`, [jordanWeekly]);

// After the last day's deadline, the challenge is finished.
await clock('2026-11-17T09:00:00-05:00');
await as(maya, `select nx_sync($1)`, [fall]);
assert.equal(
  (await one(maya, `select status from challenges where id=$1`, [fall])).status,
  'finished',
);

// Gifts are marked given once it's over, by either person, and only for this couple.
await as(jordan, `select nx_mark_gift($1,$2,true)`, [fall, maya]);
await as(maya, `select nx_mark_gift($1,$2,true)`, [fall, maya]);
assert.equal(
  (await as(maya, `select count(*)::int n from gifts_given`))[0].n,
  1,
);
await fails(
  as(maya, `select nx_mark_gift($1,$2,true)`, [fall, priya]),
  /isn't part/,
);
await fails(
  as(priya, `select nx_mark_gift($1,$2,true)`, [fall, maya]),
  /isn't yours/,
);
assert.equal(
  (await as(priya, `select count(*)::int n from gifts_given`))[0].n,
  0,
);
await fails(
  as(priya, `select nx_mark_gift($1,$2,true)`, [dry, priya]),
  /once the challenge is over/,
);

// The rows, as PostgREST would return them (JSON), become the World the pages read.
async function rowsFor(id) {
  const all = async (t, cols = 't') =>
    (await as(id, `select coalesce(jsonb_agg(${cols}), '[]') j from ${t} t`))[0]
      .j;
  const me = (
    await as(id, `select to_jsonb(p) j from profiles p where id=$1`, [id])
  )[0].j;
  const members = await as(id, `select person_id from couple_members`);
  return {
    me: { id: me.id, name: me.name, hue: me.hue, email: '' },
    members: (await all('profiles')).filter((p) =>
      members.some((m) => m.person_id === p.id),
    ),
    challenges: await all('challenges'),
    rules: await all('rules'),
    entries: await all('entries'),
    points: await all('points'),
    requests: await all('forgiveness_requests'),
    disputes: await all('disputes'),
    notes: await all('journal_notes'),
    signatures: await all('signatures'),
    invites: await all(
      'invites',
      "jsonb_build_object('id',t.id,'challenge_id',t.challenge_id,'from_id',t.from_id,'to_name',t.to_name,'to_email',t.to_email,'code',t.code,'sent_at',t.sent_at,'opened_at',t.opened_at,'accepted_at',t.accepted_at,'expires_at',t.expires_at)",
    ),
    saved: await all('saved_challenges'),
    gifts: await all('gifts_given'),
  };
}
const links = { origin: 'https://test.example' };
const built = buildWorld(
  await rowsFor(maya),
  '2026-11-17T14:00:00.000Z',
  'America/Toronto',
  links,
);
const w = built.world;
assert.equal(w.me.name, 'Maya');
assert.equal(w.partner.name, 'Jordan');
assert.equal(w.challenge.name, 'Fall Reset!');
assert.equal(w.challenge.status, 'finished');
assert.equal(w.challenge.step, 2);
assert.equal(w.challenge.rules.length, 4);
assert.equal(
  w.challenge.rules.find((r) => r.title === 'No alcohol').who,
  jordan,
);
const dbActive = async (person) =>
  (
    await as(
      maya,
      `select count(*)::int n from points where person_id=$1 and challenge_id=$2 and not forgiven and not voided`,
      [person, fall],
    )
  )[0].n;
assert.equal(activePoints(w, maya).length, await dbActive(maya));
assert.equal(activePoints(w, jordan).length, await dbActive(jordan));
const n = await dbActive(maya);
assert.equal(
  owes(w, maya),
  (2 * n * (n + 1)) / 2,
  'the nth point costs n steps of $2',
);
assert.equal(reviewQueue(w, maya).count, 0);
assert.equal(w.past.length, 1, 'the finished challenge has its verdict');
assert.equal(w.past[0].verdict.people[0].points, n);
assert.ok(
  w.past[0].verdict.people[0].giftGivenAt,
  "Maya's gift is marked given",
);
assert.equal(w.past[0].verdict.people[1].giftGivenAt, undefined);
assert.equal(verdictFor(w).people.length, 2);
assert.equal(w.saved[0].name, 'The Fall One');
assert.equal(w.saved[0].rules[3].who, jordan);

// A shared link shows first among the saved challenges, with 'me' and 'partner' as the viewer and partner.
const priyaWorld = buildWorld(
  await rowsFor(priya),
  '2026-11-17T14:00:00.000Z',
  'America/Toronto',
  links,
).world;
const opened = withShared(priyaWorld, sharedPreview, links);
assert.equal(opened.saved[0].source, 'link');
assert.equal(opened.saved[0].name, 'The Fall One');
assert.equal(opened.saved[0].sharedBy, null);
assert.equal(
  opened.saved[0].rules[1].who,
  priya,
  "Maya's own steps rule becomes the viewer's",
);
assert.equal(opened.saved[0].rules[3].who, opened.partner.id);

// One challenge at a time: a couple starts another once the unfinished one is done.
await fails(
  as(
    priya,
    `select nx_create_challenge('Solo Start','classic',null,'2026-12-01',30,'America/Toronto',1,null,'[]')`,
  ),
  /Finish Dry October before starting another/,
);
const sam2 = buildWorld(
  await rowsFor(sam),
  '2026-11-17T14:00:00.000Z',
  'America/Toronto',
  links,
);
assert.equal(sam2.world.partner.name, 'Priya');

// Signing after the planned first day: Day 1 becomes today. With a same-night deadline, today is logged
// today, and a day nobody logged is a miss once that night is over.
await as(priya, `select nx_update_challenge($1,p_deadline_days=>0)`, [dry]);
await as(priya, `select nx_sign_pact($1)`, [dry]);
await as(sam, `select nx_sign_pact($1)`, [dry]);
assert.deepEqual(
  await one(
    priya,
    `select status, start_date::text s from challenges where id=$1`,
    [dry],
  ),
  { status: 'running', s: '2026-11-17' },
);
const dryPray = (
  await one(
    priya,
    `select id from rules where challenge_id=$1 and title='Pray daily'`,
    [dry],
  )
).id;
await clock('2026-11-17T20:00:00-08:00');
await as(priya, `select nx_save_checkin($1,$2,'2026-11-17',true)`, [
  dry,
  dryPray,
]);
await fails(
  as(priya, `select nx_save_checkin($1,$2,'2026-11-18',true)`, [dry, dryPray]),
  /once it's over/,
);
await clock('2026-11-18T09:00:00-08:00');
await as(sam, `select nx_sync($1)`, [dry]);
assert.deepEqual(
  await as(
    priya,
    `select p.name, e.status from entries e join profiles p on p.id=e.person_id where e.rule_id=$1 order by 1`,
    [dryPray],
  ),
  [
    { name: 'Priya', status: 'pending' },
    { name: 'Sam', status: 'unlogged' },
  ],
);
assert.equal(
  (
    await as(
      priya,
      `select count(*)::int n from points where challenge_id=$1 and day<'2026-11-17'`,
      [dry],
    )
  )[0].n,
  0,
  'no misses before both had signed',
);

// Cancelling. A running challenge ends only once both agree: one asks, the other accepts (or
// declines), and the one who asked can withdraw. Ending keeps the days that have closed and drops
// later answers; only its own couple can, and once it's over it stays over. A challenge still in
// setup is deleted by either person.
await as(sam, `select nx_save_checkin($1,$2,'2026-11-18',true)`, [
  dry,
  dryPray,
]);
const endAsk = (id, action) =>
  one(id, `select nx_end_request($1,$2) r`, [dry, action]).then((x) => x.r);
const askedBy = async () =>
  (await one(priya, `select end_asked_by from challenges where id=$1`, [dry]))
    .end_asked_by;
await fails(as(maya, `select nx_end_request($1,'ask')`, [dry]), /isn't yours/);
await fails(as(maya, `select nx_cancel_challenge($1)`, [dry]), /isn't yours/);
// Nobody asked yet.
await fails(as(priya, `select nx_cancel_challenge($1)`, [dry]), /both agree/);
await fails(as(priya, `select nx_end_request($1,'decline')`, [dry]), /Nobody/);
await fails(
  as(priya, `select nx_end_request($1,'withdraw')`, [dry]),
  /haven't/,
);
assert.equal(await endAsk(priya, 'ask'), 'asked');
assert.equal(await askedBy(), priya);
// The one who asked can't accept it.
await fails(as(priya, `select nx_cancel_challenge($1)`, [dry]), /both agree/);
await fails(as(sam, `select nx_end_request($1,'withdraw')`, [dry]), /haven't/);
assert.equal(await endAsk(sam, 'decline'), 'declined');
assert.equal(await askedBy(), null);
assert.equal(await endAsk(priya, 'ask'), 'asked');
assert.equal(await endAsk(priya, 'withdraw'), 'withdrawn');
assert.equal(await askedBy(), null);
await fails(as(priya, `select nx_end_request($1,'stop')`, [dry]), /Unknown/);
assert.equal(await endAsk(priya, 'ask'), 'asked');
assert.equal(
  (await one(sam, `select nx_cancel_challenge($1) r`, [dry])).r,
  'ended',
);
assert.equal(await askedBy(), null, 'the request is cleared once it ends');
await fails(as(priya, `select nx_end_request($1,'ask')`, [dry]), /running/);
assert.deepEqual(
  await one(priya, `select status, days from challenges where id=$1`, [dry]),
  { status: 'finished', days: 1 },
);
assert.deepEqual(
  (
    await as(
      priya,
      `select day::text d from entries where challenge_id=$1 group by day order by day`,
      [dry],
    )
  ).map((r) => r.d),
  ['2026-11-17'],
  "the open day's answers are gone",
);
assert.equal(
  (
    await one(
      priya,
      `select count(*)::int n from points where challenge_id=$1 and not forgiven and not voided`,
      [dry],
    )
  ).n,
  2,
  "the closed day's misses still count (Sam's prayer, Priya's steps)",
);
await fails(as(sam, `select nx_cancel_challenge($1)`, [dry]), /already over/);
const { nx_create_challenge: next } = await one(
  priya,
  `select nx_create_challenge('Next One','classic',null,'2026-12-01',30,'America/Toronto',1,null,$1::jsonb)`,
  [rules],
);
assert.equal(
  (await one(sam, `select nx_cancel_challenge($1) r`, [next])).r,
  'deleted',
);
assert.equal(
  (
    await one(priya, `select count(*)::int n from challenges where id=$1`, [
      next,
    ])
  ).n,
  0,
);

// An invitee who had started on their own: their saved challenge comes along, their setup goes, and
// the rules they called their own stay theirs for both of them.
const alex = '00000000-0000-0000-0000-00000000000e',
  blake = '00000000-0000-0000-0000-00000000000f';
await db.exec(
  `insert into auth.users values('${alex}','alex@example.com','{}'),('${blake}','blake@example.com','{}')`,
);
await as(alex, `select nx_set_name('Alex')`);
await as(blake, `select nx_set_name('Blake')`);
const { nx_create_challenge: alexDraft } = await one(
  alex,
  `select nx_create_challenge('Alex Draft','classic',null,'2026-12-01',30,'America/Toronto',1,null,$1::jsonb)`,
  [rules],
);
await as(alex, `select nx_save_challenge($1,'Alex Saved')`, [alexDraft]);
const { nx_create_challenge: blakePlan } = await one(
  blake,
  `select nx_create_challenge('Blake Plan','classic',null,'2026-12-01',30,'America/Toronto',1,null,$1::jsonb)`,
  [rules],
);
await as(blake, `select nx_finish_setup($1)`, [blakePlan]);
const blakeInvite = await one(blake, `select * from nx_create_invite($1)`, [
  blakePlan,
]);
await as(alex, `select nx_accept_invite($1)`, [blakeInvite.token]);
assert.deepEqual(
  (await as(alex, `select name from challenges order by name`)).map(
    (r) => r.name,
  ),
  ['Blake Plan'],
  "Alex's own setup is gone",
);
assert.equal(
  (
    await as(
      alex,
      `select count(distinct couple_id)::int n from couple_members where person_id=$1`,
      [alex],
    )
  )[0].n,
  1,
);
const blakeWorld = buildWorld(
  await rowsFor(blake),
  '2026-11-18T14:00:00.000Z',
  'America/Toronto',
  links,
).world;
const alexSaved = blakeWorld.saved.find((x) => x.name === 'Alex Saved');
assert.ok(alexSaved, "Alex's saved challenge is the couple's now");
assert.equal(
  alexSaved.rules[1].who,
  alex,
  "Alex's own steps rule stays Alex's when Blake starts it",
);

console.log('next database: ok');
