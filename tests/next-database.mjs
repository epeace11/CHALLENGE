// The new schema (supabase/next/schema.sql) on PGlite: two couples, the whole daily loop, deadlines,
// weekly shortfalls, and that one couple can never read or change the other's challenge.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  buildWorld,
  currentChallenge,
  nextLock,
  personOf,
  verdictFor,
  withShared,
} from '../lib/live/world.ts';
import {
  activePoints,
  owes,
  reviewQueue,
  timedMinutes,
  timedSeconds,
  timerSeconds,
} from '../lib/next/selectors.ts';
import { stopTimer } from '../lib/next/actions.ts';

const db = new PGlite();
const maya = '00000000-0000-0000-0000-00000000000a',
  jordan = '00000000-0000-0000-0000-00000000000b',
  priya = '00000000-0000-0000-0000-00000000000c',
  sam = '00000000-0000-0000-0000-00000000000d',
  lee = '00000000-0000-0000-0000-0000000000a1',
  kim = '00000000-0000-0000-0000-0000000000a2',
  ana = '00000000-0000-0000-0000-0000000000a3';
await db.exec(
  `create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
   grant usage on schema public, auth, storage to anon, authenticated, service_role;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.objects(bucket_id text,name text);
   create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
   alter table storage.objects enable row level security;
   grant select,insert,update,delete on storage.objects to authenticated;
   insert into auth.users values('${maya}','maya@example.com','{}'),('${jordan}','jordan@example.com','{}'),('${priya}','priya@example.com','{}'),('${sam}','sam@example.com','{}'),('${lee}','lee@example.com','{}'),('${kim}','kim@example.com','{}'),('${ana}','ana@example.com','{}');`,
);
await db.exec(
  readFileSync(new URL('../supabase/next/schema.sql', import.meta.url), 'utf8'),
);
// The functions timer.sql, rule-limit.sql and goals.sql replace, as the fresh install defines them.
const timerFunctions = [
  ...new Set(
    ['timer.sql', 'rule-limit.sql', 'goals.sql'].flatMap((script) =>
      [
        ...readFileSync(
          new URL(`../supabase/next/${script}`, import.meta.url),
          'utf8',
        ).matchAll(/create or replace function public\.(\w+)\(/g),
      ].map((m) => m[1]),
    ),
  ),
];
const definitions = async () =>
  (
    await db.query(
      `select p.proname, pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = any($1) order by p.proname`,
      [timerFunctions],
    )
  ).rows;
const freshDefinitions = await definitions();
assert.equal(freshDefinitions.length, timerFunctions.length);
// The rerunnable scripts run cleanly on a project that already has the schema.
for (const script of [
  'share-links.sql',
  'invite-links.sql',
  'gifts-given.sql',
  'fixes-oct-18.sql',
  'cancel-challenge.sql',
  'end-requests.sql',
  'pact-limits.sql',
  'settle-and-many.sql',
  'hide-challenges.sql',
  'fixes-nov-5.sql',
  'saved-copies.sql',
  'fixes-nov-6.sql',
  'timer.sql',
  'rule-limit.sql',
  'goals.sql',
])
  await db.exec(
    readFileSync(
      new URL(`../supabase/next/${script}`, import.meta.url),
      'utf8',
    ),
  );
// Run last, those scripts leave every function they replace as the fresh install has it.
assert.deepEqual(await definitions(), freshDefinitions);

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
  [lee, 'Lee'],
  [kim, 'Kim'],
  [ana, 'Ana'],
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

// Invite: Maya finishes setup and signs the pact herself, makes a link; Jordan previews it signed
// out, then accepts.
await as(maya, `select nx_finish_setup($1)`, [fall]);
assert.equal(
  (await as(maya, `select * from signatures where challenge_id=$1`, [fall]))
    .length,
  0,
  'finishing setup opens the pact without signing it',
);
await as(maya, `select nx_sign_pact($1)`, [fall]);
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
    couples: await as(
      id,
      `select couple_id, person_id, joined_at::text from couple_members`,
    ),
    hidden: await as(id, `select challenge_id, status from hidden_challenges`),
    hiddenSaved: await as(id, `select saved_id, status from hidden_saved`),
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
    timers: await all('timer_runs'),
    sessions: await all('timer_sessions'),
    goals: await all('goals'),
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

// Several at once: a couple can start another while one is under way.
const { nx_create_challenge: alongside } = await one(
  priya,
  `select nx_create_challenge('Alongside','classic',null,'2026-12-01',30,'America/Toronto',1,null,'[]')`,
);
assert.equal(
  (
    await one(priya, `select couple_id from challenges where id=$1`, [
      alongside,
    ])
  ).couple_id,
  (await one(priya, `select couple_id from challenges where id=$1`, [dry]))
    .couple_id,
);
await as(priya, `select nx_cancel_challenge($1)`, [alongside]);
const sam2 = buildWorld(
  await rowsFor(sam),
  '2026-11-17T14:00:00.000Z',
  'America/Toronto',
  links,
);
assert.equal(sam2.world.partner.name, 'Priya');

// A calorie limit each sets for themselves: the suggested 2,000 until they sign with their own. Only
// the couple's own members keep a limit when the rules are saved.
const calories = {
  title: 'Stay under your calorie limit',
  question: 'How many calories did you eat?',
  kind: 'number',
  days: [0, 1, 2, 3, 4, 5, 6],
  target: { op: '<=', value: 2000, unit: 'kcal' },
  personalTarget: true,
  who: 'both',
};
await as(priya, `select nx_update_challenge($1,p_rules=>$2::jsonb)`, [
  dry,
  JSON.stringify([
    ...JSON.parse(rules),
    { ...calories, limits: { [sam]: 2100, [maya]: 1500 } },
  ]),
]);
const dryCalories = (
  await one(priya, `select id from rules where challenge_id=$1 and personal`, [
    dry,
  ])
).id;
const dryPray = (
  await one(
    priya,
    `select id from rules where challenge_id=$1 and title='Pray daily'`,
    [dry],
  )
).id;
assert.deepEqual(
  (await one(priya, `select limits from rules where id=$1`, [dryCalories]))
    .limits,
  { [sam]: 2100 },
);

// Signing after the planned first day: Day 1 is the next day, so no day under way when both signed
// counts. With a same-night deadline, a day is logged that day, and a day nobody logged is a miss once
// that night is over.
await as(priya, `select nx_update_challenge($1,p_deadline_days=>0)`, [dry]);
await as(priya, `select nx_sign_pact($1,$2::jsonb)`, [
  dry,
  JSON.stringify({ [dryCalories]: 1800 }),
]);
// A limit is set once, with the signature.
await as(priya, `select nx_sign_pact($1,$2::jsonb)`, [
  dry,
  JSON.stringify({ [dryCalories]: 3000 }),
]);
await fails(
  as(sam, `select nx_sign_pact($1,$2::jsonb)`, [
    dry,
    JSON.stringify({ [dryPray]: 5 }),
  ]),
  /no limit of your own/,
);
await fails(
  as(sam, `select nx_sign_pact($1,$2::jsonb)`, [
    dry,
    JSON.stringify({ [dryCalories]: 0 }),
  ]),
  /Enter your limit/,
);
await as(sam, `select nx_sign_pact($1,$2::jsonb)`, [
  dry,
  JSON.stringify({ [dryCalories]: 2400 }),
]);
assert.deepEqual(
  (await one(priya, `select limits from rules where id=$1`, [dryCalories]))
    .limits,
  { [priya]: 1800, [sam]: 2400 },
);
assert.deepEqual(
  await one(
    priya,
    `select status, start_date::text s from challenges where id=$1`,
    [dry],
  ),
  { status: 'running', s: '2026-11-18' },
);
await clock('2026-11-18T20:00:00-08:00');
await as(priya, `select nx_save_checkin($1,$2,'2026-11-18',true)`, [
  dry,
  dryPray,
]);
await fails(
  as(priya, `select nx_save_checkin($1,$2,'2026-11-19',true)`, [dry, dryPray]),
  /once it's over/,
);
// Each answer is checked against its owner's own limit.
const caloriesOf = async (id) =>
  (
    await one(
      id,
      `select status from entries where rule_id=$1 and person_id=$2`,
      [dryCalories, id],
    )
  ).status;
await as(priya, `select nx_save_checkin($1,$2,'2026-11-18',p_value=>1900)`, [
  dry,
  dryCalories,
]);
assert.equal(await caloriesOf(priya), 'missed', "over Priya's own 1,800");
await as(priya, `select nx_save_checkin($1,$2,'2026-11-18',p_value=>1700)`, [
  dry,
  dryCalories,
]);
await as(sam, `select nx_save_checkin($1,$2,'2026-11-18',p_value=>2300)`, [
  dry,
  dryCalories,
]);
assert.equal(
  await caloriesOf(sam),
  'pending',
  "over the suggested 2,000 but under Sam's own 2,400",
);
const limitsWorld = buildWorld(
  await rowsFor(priya),
  '2026-11-19T04:00:00.000Z',
  'America/Los_Angeles',
  links,
).world;
assert.deepEqual(
  limitsWorld.challenge.rules.find((r) => r.personalTarget)?.limits,
  { [priya]: 1800, [sam]: 2400 },
);
await clock('2026-11-19T09:00:00-08:00');
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
      `select count(*)::int n from points where challenge_id=$1 and day<'2026-11-18'`,
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
await as(sam, `select nx_save_checkin($1,$2,'2026-11-19',true)`, [
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
  ['2026-11-18'],
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

// An invitee who had saved a challenge on their own: it comes along, and the rules they called their
// own stay theirs for both of them.
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
await as(alex, `select nx_cancel_challenge($1)`, [alexDraft]);
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
  'only the challenge Alex joined',
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

// A tab left open reloads when the oldest open day locks: 11:59 pm the next day, Toronto time.
const lockC = {
  start: '2026-11-01',
  days: 30,
  timeZone: 'America/Toronto',
  deadline: { daysAfter: 1, time: '23:59' },
};
const at = (iso) => Date.parse(iso);
assert.equal(
  nextLock(lockC, at('2026-11-05T12:00:00-05:00')),
  at('2026-11-05T23:59:00-05:00'),
  'midday Nov 5: Nov 4 locks tonight',
);
assert.equal(
  nextLock(lockC, at('2026-11-06T00:30:00-05:00')),
  at('2026-11-06T23:59:00-05:00'),
  'just after midnight: Nov 5 locks next',
);
assert.equal(
  nextLock(lockC, at('2026-10-20T12:00:00-04:00')),
  at('2026-11-02T23:59:00-05:00'),
  'before Day 1: Day 1 locks first',
);
assert.equal(
  nextLock(lockC, at('2026-12-02T00:00:00-05:00')),
  null,
  'after the last day locked: nothing left',
);
// A name that starts with an emoji keeps the whole emoji as its initial.
assert.equal(personOf({ id: 'x', name: '🌸 Maya', hue: 0 }).initial, '🌸');
assert.equal(personOf({ id: 'x', name: '  ', hue: 0 }).initial, '?');

// A challenge isn't over until it's settled: after the last deadline it waits for every dispute to
// be settled and every answer reviewed, and it can't be ended early with a dispute open.
await clock('2026-12-01T09:00:00-05:00');
const prayRule = JSON.stringify([
  {
    title: 'Pray daily',
    question: 'Did you pray?',
    kind: 'yesno',
    days: [0, 1, 2, 3, 4, 5, 6],
    who: 'both',
  },
]);
const { nx_create_challenge: short } = await one(
  maya,
  `select nx_create_challenge('Short','classic',null,'2026-12-02',1,'America/Toronto',1,null,$1::jsonb)`,
  [prayRule],
);
await as(maya, `select nx_finish_setup($1)`, [short]);
await as(maya, `select nx_sign_pact($1)`, [short]);
await as(jordan, `select nx_sign_pact($1)`, [short]);
const shortStatus = async () =>
  (await one(maya, `select status from challenges where id=$1`, [short]))
    .status;
assert.equal(await shortStatus(), 'running');
const shortRule = (
  await one(maya, `select id from rules where challenge_id=$1`, [short])
).id;
await clock('2026-12-03T09:00:00-05:00');
for (const id of [maya, jordan])
  await as(id, `select nx_save_checkin($1,$2,'2026-12-02',true)`, [
    short,
    shortRule,
  ]);
const mayaEntry = (
  await one(maya, `select id from entries where rule_id=$1 and person_id=$2`, [
    shortRule,
    maya,
  ])
).id;
await as(jordan, `select nx_review($1,'dispute','You were asleep')`, [
  mayaEntry,
]);
await fails(
  as(maya, `select nx_end_request($1,'ask')`, [short]),
  /Settle the open disputes/,
);
await clock('2026-12-04T09:00:00-05:00');
await as(maya, `select nx_sync($1)`, [short]);
assert.equal(await shortStatus(), 'running', 'waits for the open dispute');
const shortDispute = (
  await one(maya, `select id from disputes where entry_id=$1`, [mayaEntry])
).id;
await as(maya, `select nx_resolve_dispute($1,'concede')`, [shortDispute]);
assert.equal(
  await shortStatus(),
  'running',
  "and for Jordan's answer, still to review",
);
await clock('2026-12-05T10:00:00-05:00');
await as(maya, `select nx_sync($1)`, [short]);
assert.equal(await shortStatus(), 'finished', 'unreviewed for 48 hours: over');
const jordanEntry = (
  await one(
    jordan,
    `select id from entries where rule_id=$1 and person_id=$2`,
    [shortRule, jordan],
  )
).id;
await fails(
  as(maya, `select nx_review($1,'dispute','Too late')`, [jordanEntry]),
  /is over/,
);

// A saved copy knows its challenge, and keeps the name it was saved under through a rename.
const { nx_save_challenge: copyOfDry } = await one(
  priya,
  `select nx_save_challenge($1,'Dry October')`,
  [dry],
);
await as(priya, `select nx_update_challenge($1,p_name=>'Dry Again')`, [dry]);
const dryCopy = await one(
  priya,
  `select name, challenge_id from saved_challenges where id=$1`,
  [copyOfDry],
);
assert.equal(dryCopy.name, 'Dry October');
assert.equal(dryCopy.challenge_id, dry);

// Nobody lands on a draft their partner is setting up, unless it's all there is or they open it.
{
  const me = { id: 'me' };
  const theirs = {
    id: 'theirs',
    status: 'draft',
    created_by: 'them',
    created_at: '2026-11-02',
  };
  const done = {
    id: 'done',
    status: 'finished',
    created_by: 'me',
    created_at: '2026-01-01',
  };
  const on = (challenges, wanted) =>
    currentChallenge({ me, challenges, hidden: [] }, wanted)?.id;
  assert.equal(on([theirs, done]), 'done');
  assert.equal(on([theirs]), 'theirs');
  assert.equal(on([theirs, done], 'theirs'), 'theirs');
  assert.equal(on([{ ...theirs, created_by: 'me' }, done]), 'theirs');
}

// Several partners: a challenge with someone new is its own couple, a person can be in two, and each
// sees only their own. Inviting someone who's already a partner keeps them one couple.
const { nx_create_challenge: withPriya } = await one(
  maya,
  `select nx_create_challenge('With Priya','classic',null,'2026-12-20',30,'America/Toronto',1,null,$1::jsonb,null,true)`,
  [prayRule],
);
const coupleOf = async (id, challenge) =>
  (await one(id, `select couple_id from challenges where id=$1`, [challenge]))
    .couple_id;
const priyaCouple = await coupleOf(maya, withPriya);
assert.notEqual(priyaCouple, await coupleOf(maya, short));
await as(maya, `select nx_finish_setup($1)`, [withPriya]);
const priyaInvite = await one(maya, `select * from nx_create_invite($1)`, [
  withPriya,
]);
await as(priya, `select nx_accept_invite($1)`, [priyaInvite.token]);
assert.equal(
  (
    await one(
      priya,
      `select count(distinct couple_id)::int n from couple_members where person_id=$1`,
      [priya],
    )
  ).n,
  2,
  'Priya has two partners',
);
assert.equal(
  (await as(sam, `select id from challenges where id=$1`, [withPriya])).length,
  0,
  "Sam never sees Priya's challenge with Maya",
);
await fails(
  as(
    sam,
    `select nx_create_challenge('Not yours','classic',null,'2026-12-20',30,'America/Toronto',1,null,'[]',$1)`,
    [priyaCouple],
  ),
  /isn't yours/,
);
const mayaRows = await rowsFor(maya);
const seen = (id) =>
  buildWorld(
    mayaRows,
    '2026-12-05T15:00:00.000Z',
    'America/Toronto',
    links,
    {},
    id,
  ).world;
assert.equal(seen(withPriya).partner.name, 'Priya');
assert.equal(seen(short).partner.name, 'Jordan');
assert.deepEqual(
  seen(withPriya)
    .partners.map((p) => p.person.name)
    .sort(),
  ['Jordan', 'Priya'],
);
assert.ok(
  seen(short).others.some((o) => o.id === withPriya && o.partner === 'Priya'),
  'the other challenge is listed, with its partner',
);
const { nx_create_challenge: jordanAgain } = await one(
  maya,
  `select nx_create_challenge('Jordan again','classic',null,'2026-12-20',30,'America/Toronto',1,null,$1::jsonb,null,true)`,
  [prayRule],
);
const stray = await coupleOf(maya, jordanAgain);
await as(maya, `select nx_finish_setup($1)`, [jordanAgain]);
const jordanInvite = await one(maya, `select * from nx_create_invite($1)`, [
  jordanAgain,
]);
await as(jordan, `select nx_accept_invite($1)`, [jordanInvite.token]);
assert.equal(
  await coupleOf(maya, jordanAgain),
  await coupleOf(maya, short),
  'already a couple: it moves to theirs',
);
assert.equal(
  (await as(maya, `select id from couples where id=$1`, [stray])).length,
  0,
);
// An invitee setting something up with someone else keeps it when they accept.
const { nx_create_challenge: samOwn } = await one(
  sam,
  `select nx_create_challenge('Sam alone','classic',null,'2026-12-20',30,'America/Toronto',1,null,$1::jsonb,null,true)`,
  [prayRule],
);
const { nx_create_challenge: withSam } = await one(
  blake,
  `select nx_create_challenge('With Sam','classic',null,'2026-12-20',30,'America/Toronto',1,null,$1::jsonb,null,true)`,
  [prayRule],
);
await as(blake, `select nx_finish_setup($1)`, [withSam]);
const samInvite = await one(blake, `select * from nx_create_invite($1)`, [
  withSam,
]);
await as(sam, `select nx_accept_invite($1)`, [samInvite.token]);
assert.equal(
  (await as(sam, `select id from challenges where id=$1`, [samOwn])).length,
  1,
);

// Hiding and deleting are each person's own: the partner keeps theirs, and it's only erased once neither
// has it. Only a member can, and a running challenge has to end first.
await as(maya, `select nx_mark_gift($1,$2,true)`, [short, jordan]);
const hiddenFor = async (id) =>
  (
    await as(id, `select status from hidden_challenges where challenge_id=$1`, [
      short,
    ])
  ).map((r) => r.status);
await fails(
  as(sam, `select nx_hide_challenge($1,true)`, [short]),
  /isn't yours/,
);
await as(maya, `select nx_hide_challenge($1,true)`, [short]);
assert.deepEqual(await hiddenFor(maya), ['hidden']);
assert.deepEqual(await hiddenFor(jordan), [], "Maya's hiding is only hers");
const hideSeen = buildWorld(
  await rowsFor(maya),
  '2026-12-05T15:00:00.000Z',
  'America/Toronto',
  links,
).world;
assert.equal(hideSeen.past.find((p) => p.challenge.id === short)?.hidden, true);
assert.notEqual(
  buildWorld(
    await rowsFor(maya),
    '2026-12-05T15:00:00.000Z',
    'America/Toronto',
    links,
    {},
    short,
  ).current?.id,
  short,
  'a hidden one is never on screen, even if it was the one last open',
);
await as(maya, `select nx_hide_challenge($1,false)`, [short]);
assert.deepEqual(await hiddenFor(maya), []);
assert.equal(
  (await one(maya, `select nx_delete_challenge($1) gone`, [short])).gone,
  false,
  'Jordan still has it',
);
assert.equal(
  buildWorld(
    await rowsFor(maya),
    '2026-12-05T15:00:00.000Z',
    'America/Toronto',
    links,
  ).world.past.some((p) => p.challenge.id === short),
  false,
  'gone from Maya',
);
assert.equal(
  buildWorld(
    await rowsFor(jordan),
    '2026-12-05T15:00:00.000Z',
    'America/Toronto',
    links,
  ).world.past.some((p) => p.challenge.id === short),
  true,
  'still there for Jordan',
);
await as(maya, `select nx_hide_challenge($1,false)`, [short]);
assert.deepEqual(await hiddenFor(maya), ['deleted'], 'deleted is for good');
await fails(
  as(maya, `select nx_erase_challenge($1)`, [short]),
  /still has this challenge/,
);
assert.equal(
  (await one(jordan, `select nx_delete_challenge($1) gone`, [short])).gone,
  true,
  'now neither has it',
);
await as(jordan, `select nx_erase_challenge($1)`, [short]);
for (const [table, column] of [
  ['challenges', 'id'],
  ['entries', 'challenge_id'],
  ['points', 'challenge_id'],
  ['disputes', 'challenge_id'],
  ['gifts_given', 'challenge_id'],
  ['rules', 'challenge_id'],
  ['hidden_challenges', 'challenge_id'],
])
  assert.equal(
    (await db.query(`select 1 from ${table} where ${column}=$1`, [short])).rows
      .length,
    0,
    `nothing left in ${table}`,
  );
const { nx_create_challenge: stillOn } = await one(
  maya,
  `select nx_create_challenge('Still on','classic',null,'2026-12-06',5,'America/Toronto',1,null,$1::jsonb)`,
  [prayRule],
);
await as(maya, `select nx_finish_setup($1)`, [stillOn]);
await as(maya, `select nx_sign_pact($1)`, [stillOn]);
await as(priya, `select nx_sign_pact($1)`, [stillOn]);
for (const call of ['nx_delete_challenge($1)', 'nx_hide_challenge($1,true)'])
  await fails(as(maya, `select ${call}`, [stillOn]), /has to end first/);
const { nx_save_challenge: keptCopy } = await one(
  maya,
  `select nx_save_challenge($1,'Kept copy')`,
  [stillOn],
);
await fails(as(sam, `select nx_delete_saved($1)`, [keptCopy]), /is gone/);
const savedThere = async (id) =>
  (await as(id, `select id from saved_challenges where id=$1`, [keptCopy]))
    .length;
await as(priya, `select nx_delete_saved($1)`, [keptCopy]);
assert.equal(await savedThere(maya), 1, 'Maya keeps her saved copy');
await as(maya, `select nx_delete_saved($1)`, [keptCopy]);
assert.equal(await savedThere(maya), 0, 'gone once neither has it');

// The November 6 security review. Lee and Kim's challenge, with Ana outside it.
await clock('2027-03-01T12:00:00-05:00');
const startSql = `select nx_create_challenge($1,'classic',null,'2027-03-08',14,'America/Toronto',1,null,$2::jsonb) id`;
const { id: spring } = await one(lee, startSql, ['Spring', rules]);
await as(lee, `select nx_finish_setup($1)`, [spring]);
const springInvite = await one(lee, `select * from nx_create_invite($1)`, [
  spring,
]);
await as(kim, `select nx_accept_invite($1)`, [springInvite.token]);

// Every term clears a signature already there; the name doesn't.
const signedBy = async () =>
  (
    await as(lee, `select person_id from signatures where challenge_id=$1`, [
      spring,
    ])
  ).length;
for (const change of [`p_time_zone=>'America/Vancouver'`, `p_week_start=>3`]) {
  await as(kim, `select nx_sign_pact($1)`, [spring]);
  assert.equal(await signedBy(), 1);
  await as(lee, `select nx_update_challenge($1,${change})`, [spring]);
  assert.equal(await signedBy(), 0, `${change} clears the signature`);
}
await as(kim, `select nx_sign_pact($1)`, [spring]);
await as(lee, `select nx_update_challenge($1,p_name=>'Spring!')`, [spring]);
assert.equal(await signedBy(), 1, 'a new name is not a new term');
await as(lee, `select nx_sign_pact($1)`, [spring]);

// Day 1 logged, its deadline still ahead: a dispute, a forgiveness ask, a note and a saved copy.
await clock('2027-03-09T12:00:00-05:00');
const { id: springPray } = await one(
  lee,
  `select id from rules where challenge_id=$1 and title='Pray daily'`,
  [spring],
);
await as(lee, `select nx_save_checkin($1,$2,'2027-03-08',true)`, [
  spring,
  springPray,
]);
await as(
  kim,
  `select nx_save_checkin($1,$2,'2027-03-08',false,null,'','[]','please')`,
  [spring, springPray],
);
const { id: leeEntry } = await one(
  lee,
  `select id from entries where challenge_id=$1 and person_id=$2`,
  [spring, lee],
);
await as(kim, `select nx_review($1,'dispute','Not sure')`, [leeEntry]);
const { id: springDispute } = await one(
  lee,
  `select id from disputes where challenge_id=$1`,
  [spring],
);
const { id: kimPoint } = await one(
  kim,
  `select id from points where challenge_id=$1 and person_id=$2`,
  [spring, kim],
);
const { id: kimAsk } = await one(
  lee,
  `select id from forgiveness_requests where challenge_id=$1`,
  [spring],
);
const { id: leeNote } = await one(
  lee,
  `select nx_add_note($1,'2027-03-08','Mine') id`,
  [spring],
);
const { id: springCopy } = await one(
  lee,
  `select nx_save_challenge($1,'Copy') id`,
  [spring],
);
const { id: springCouple } = await one(
  lee,
  `select couple_id id from challenges where id=$1`,
  [spring],
);

// Someone with an account and no part in it can do none of this, and nothing changes.
const springState = async () =>
  JSON.stringify(
    (
      await db.query(
        `select (select count(*) from points where forgiven) forgiven,
          (select string_agg(status,',') from disputes where challenge_id=$1) disputes,
          (select string_agg(status,',') from forgiveness_requests where challenge_id=$1) asks,
          (select count(*) from journal_notes where challenge_id=$1) notes,
          (select count(*) from saved_challenges where couple_id=$2) saved,
          (select count(*) from hidden_challenges where challenge_id=$1) hidden,
          (select status||coalesce(end_asked_by::text,'') from challenges where id=$1) challenge`,
        [spring, springCouple],
      )
    ).rows,
  );
const springBefore = await springState();
for (const [sql, params] of [
  [`select nx_finish_setup($1)`, [spring]],
  [`select nx_cancel_challenge($1)`, [spring]],
  [`select nx_end_request($1,'ask')`, [spring]],
  [`select nx_hide_challenge($1,true)`, [spring]],
  [`select nx_delete_challenge($1)`, [spring]],
  [`select nx_erase_challenge($1)`, [spring]],
  [`select nx_mark_gift($1,$2,true)`, [spring, ana]],
  [`select nx_hide_saved($1,true)`, [springCopy]],
  [`select nx_delete_saved($1)`, [springCopy]],
  [`select nx_set_share_link($1,true)`, [springCopy]],
  [`select nx_resolve_dispute($1,'concede')`, [springDispute]],
  [`select nx_resolve_dispute($1,'withdraw')`, [springDispute]],
  [`select nx_resolve_dispute($1,'reply','Hi')`, [springDispute]],
  [`select nx_ask_forgiveness($1,'Hi')`, [kimPoint]],
  [`select nx_decide_forgiveness($1,true)`, [kimAsk]],
  [`select nx_forgive_point($1)`, [kimPoint]],
  [`select nx_edit_note($1,'Hi')`, [leeNote]],
  [`select nx_remove_note($1)`, [leeNote]],
  [`select nx_review($1,'approve')`, [leeEntry]],
  [
    `select nx_create_challenge('Mine','classic',null,'2027-04-01',5,'America/Toronto',1,null,'[]'::jsonb,$1::uuid)`,
    [springCouple],
  ],
])
  await fails(as(ana, sql, params), /isn't yours|is gone|only change your own/);
assert.equal(await springState(), springBefore, 'nothing changed');

// The helpers behind those functions can't be called directly, even by someone in the challenge.
for (const [sql, params] of [
  [`select nx_enter($1)`, [spring]],
  [`select nx_tick($1)`, [spring]],
  [`select nx_tick_all()`, []],
  [`select nx_end_now($1)`, [spring]],
  [`select nx_forgive($1)`, [kimPoint]],
  [`select nx_void_point_of($1)`, [leeEntry]],
  [`select nx_partner($1,$2)`, [spring, lee]],
  [`select nx_find_invite('x')`, []],
  [`select nx_put_rules(null::public.challenges,'[]'::jsonb)`, []],
  [`select nx_check_proofs(null::public.challenges,'[]'::jsonb)`, []],
  [`select nx_add_point(null::public.entries,'missed')`, []],
])
  await fails(as(lee, sql, params), /permission denied/);

// Screenshots: both can open them, nobody else, and nobody removes one during the challenge.
const leeShot = `${spring}/${lee}/a.jpg`,
  kimShot = `${spring}/${kim}/b.jpg`;
await db.query(
  `insert into storage.objects values('proofs',$1),('proofs',$2)`,
  [leeShot, kimShot],
);
const shots = async (id) =>
  (
    await as(id, `select name from storage.objects where name like $1`, [
      `${spring}/%`,
    ])
  ).length;
assert.equal(await shots(kim), 2, 'both see both');
assert.equal(await shots(ana), 0, 'an outsider sees none');
await fails(
  as(ana, `insert into storage.objects values('proofs',$1)`, [
    `${spring}/${ana}/x.jpg`,
  ]),
  /row-level security/,
);
await fails(
  as(kim, `insert into storage.objects values('proofs',$1)`, [
    `${spring}/${lee}/x.jpg`,
  ]),
  /row-level security/,
);
const removed = async (id, name) =>
  (
    await as(id, `delete from storage.objects where name=$1 returning name`, [
      name,
    ])
  ).length;
assert.equal(await removed(ana, leeShot), 0, 'an outsider removes nothing');
assert.equal(
  await removed(kim, leeShot),
  0,
  'not the partner’s, mid-challenge',
);
assert.equal(await removed(lee, leeShot), 0, 'not your own, mid-challenge');

// Both agree to end it before any day closed: with screenshots it waits to be erased, and only then
// can they go.
await as(kim, `select nx_resolve_dispute($1,'withdraw')`, [springDispute]);
assert.equal(
  (await one(lee, `select nx_end_request($1,'ask') r`, [spring])).r,
  'asked',
);
assert.equal(
  (await one(kim, `select nx_end_request($1,'ask') r`, [spring])).r,
  'erase',
);
assert.deepEqual(
  (
    await as(
      lee,
      `select status from hidden_challenges where challenge_id=$1`,
      [spring],
    )
  ).map((r) => r.status),
  ['deleted'],
);
assert.equal(await removed(ana, leeShot), 0, 'still not an outsider');
assert.equal(await removed(kim, leeShot), 1, 'now either can remove any');
assert.equal(await removed(lee, kimShot), 1);
await as(kim, `select nx_erase_challenge($1)`, [spring]);
assert.equal(
  (await as(lee, `select id from challenges where id=$1`, [spring])).length,
  0,
);

// A couple of one with a challenge is waiting on its invite: another challenge never joins it, by
// choice of couple or by default, so whoever accepts sees only what they were invited to.
const { id: forLee } = await one(ana, startSql, ['For Lee', rules]);
const { id: waiting } = await one(
  ana,
  `select couple_id id from challenges where id=$1`,
  [forLee],
);
const { id: forKim } = await one(
  ana,
  `select nx_create_challenge('For Kim','classic',null,'2027-04-01',5,'America/Toronto',1,null,$1::jsonb,$2::uuid) id`,
  [rules, waiting],
);
const { id: forAnyone } = await one(ana, startSql, ['For anyone', rules]);
const anasCouple = async (id) =>
  (await one(ana, `select couple_id id from challenges where id=$1`, [id])).id;
assert.notEqual(await anasCouple(forKim), waiting);
assert.notEqual(await anasCouple(forAnyone), waiting);
for (const [who, challenge, name] of [
  [lee, forLee, 'For Lee'],
  [kim, forKim, 'For Kim'],
]) {
  await as(ana, `select nx_finish_setup($1)`, [challenge]);
  const link = await one(ana, `select * from nx_create_invite($1)`, [
    challenge,
  ]);
  await as(who, `select nx_accept_invite($1)`, [link.token]);
  assert.deepEqual(
    (
      await as(who, `select name from challenges where created_by=$1`, [ana])
    ).map((r) => r.name),
    [name],
    'only the challenge they were invited to',
  );
}

// The timer for timed rules (timer.sql). Lee and Kim again, with Ana outside: "Timed" has the usual
// next-day deadline, "Tonight" a same-night one. April in Toronto is EDT.
await clock('2027-04-01T12:00:00-04:00');
const everyDay = [0, 1, 2, 3, 4, 5, 6];
const readRule = {
  title: 'Read',
  question: 'How long did you read?',
  kind: 'number',
  days: everyDay,
  target: { op: '>=', value: 20, unit: 'min' },
  who: 'both',
  proof: 'required',
  timed: true,
};
const timedRules = [
  readRule,
  {
    title: 'Steps',
    question: 'How many steps?',
    kind: 'number',
    days: everyDay,
    target: { op: '>=', value: 10000, unit: 'steps' },
    who: 'both',
    timed: true,
  },
  {
    title: 'Stretch',
    question: 'How long did you stretch?',
    kind: 'number',
    days: everyDay,
    target: { op: '>=', value: 10, unit: 'Minutes' },
    who: 'me',
  },
  {
    title: 'Pray',
    question: 'Did you pray?',
    kind: 'yesno',
    days: everyDay,
    who: 'both',
  },
];
const coupleSql = `select nx_create_challenge($1,'classic',null,$2::date,$3,'America/Toronto',1,null,$4::jsonb,$5::uuid) id`;
const { id: timed } = await one(lee, coupleSql, [
  'Timed',
  '2027-04-05',
  14,
  JSON.stringify(timedRules),
  springCouple,
]);
const { id: tonight } = await one(lee, coupleSql, [
  'Tonight',
  '2027-04-12',
  2,
  JSON.stringify([{ ...readRule, proof: 'none' }]),
  springCouple,
]);
await as(lee, `select nx_update_challenge($1,p_deadline_days=>0)`, [tonight]);
const ruleIn = (challenge, title) =>
  one(lee, `select id, timed from rules where challenge_id=$1 and title=$2`, [
    challenge,
    title,
  ]);
const read = await ruleIn(timed, 'Read'),
  walk = await ruleIn(timed, 'Steps'),
  stretch = await ruleIn(timed, 'Stretch');
assert.equal(read.timed, true, 'a rule counted in minutes keeps the timer');
assert.equal(walk.timed, false, 'a rule counted in steps never has it');
assert.equal(stretch.timed, false);
for (const c of [timed, tonight]) {
  await as(lee, `select nx_finish_setup($1)`, [c]);
  await as(lee, `select nx_sign_pact($1)`, [c]);
  await as(kim, `select nx_sign_pact($1)`, [c]);
}
const statusOf = async (c) =>
  (await one(lee, `select status from challenges where id=$1`, [c])).status;
const signatures = async (c) =>
  (
    await one(
      lee,
      `select count(*)::int n from signatures where challenge_id=$1`,
      [c],
    )
  ).n;
assert.equal(await statusOf(timed), 'running');

// Either person turns the timer on, at any time, for a rule counted in minutes; signatures stay.
await fails(
  as(lee, `select nx_set_timed($1,$2,true)`, [timed, walk.id]),
  /counted in minutes/,
);
await as(kim, `select nx_set_timed($1,$2,true)`, [timed, stretch.id]);
await as(kim, `select nx_set_timed($1,$2,true)`, [timed, stretch.id]);
assert.equal(
  (await ruleIn(timed, 'Stretch')).timed,
  true,
  "Kim turns it on for Lee's own rule after both signed",
);
assert.equal(await signatures(timed), 2, 'and the signatures stay');
assert.equal(await statusOf(timed), 'running');

const timer = (id, challenge, action, ruleId = null) =>
  as(id, `select nx_timer($1,$2,$3)`, [challenge, action, ruleId]);
const runOf = (id, challenge) =>
  one(
    lee,
    `select rule_id as rule, day::text as day, to_char(started_at at time zone 'America/Toronto','HH24:MI:SS') as started,
       to_char(running_since at time zone 'America/Toronto','HH24:MI:SS') as since, banked
     from timer_runs where challenge_id=$1 and person_id=$2`,
    [challenge, id],
  );
const sessionsOf = (id, ruleId, day) =>
  as(
    lee,
    `select id, seconds, to_char(started_at at time zone 'America/Toronto','HH24:MI:SS') started,
       to_char(ended_at at time zone 'America/Toronto','HH24:MI:SS') ended
     from timer_sessions where person_id=$1 and rule_id=$2 and day=$3 order by started_at`,
    [id, ruleId, day],
  );
const secondsOf = async (id, ruleId, day) =>
  (await sessionsOf(id, ruleId, day)).map((s) => s.seconds);
const answer = (id, ruleId, day) =>
  one(
    lee,
    `select value::int value, done, status, from_timer from entries where person_id=$1 and rule_id=$2 and day=$3`,
    [id, ruleId, day],
  );
const pointsOn = (id, ruleId, day) =>
  as(
    lee,
    `select reason, voided, forgiven from points where person_id=$1 and rule_id=$2 and day=$3`,
    [id, ruleId, day],
  );

// Only on the person's own timed rules. On a day the rule doesn't ask, the time is kept but never
// becomes an answer.
await clock('2027-04-04T12:00:00-04:00');
await timer(lee, timed, 'start', read.id);
await clock('2027-04-04T12:30:00-04:00');
await timer(lee, timed, 'stop');
assert.deepEqual(await secondsOf(lee, read.id, '2027-04-04'), [1800]);
await clock('2027-04-05T09:00:00-04:00');
await as(lee, `select nx_sync($1)`, [timed]);
assert.equal(await answer(lee, read.id, '2027-04-04'), undefined);
await db.exec(`delete from timer_sessions where day = '2027-04-04'`);
await fails(timer(kim, timed, 'start', stretch.id), /isn't timed for you/);
await fails(timer(kim, timed, 'start', walk.id), /isn't timed for you/);

// Monday Apr 5: start, pause, resume, stop. The database stamps every time; pauses don't count.
await clock('2027-04-05T10:00:00-04:00');
await timer(lee, timed, 'start', read.id);
assert.deepEqual(await runOf(lee, timed), {
  rule: read.id,
  day: '2027-04-05',
  started: '10:00:00',
  since: '10:00:00',
  banked: 0,
});
await clock('2027-04-05T10:05:00-04:00');
await timer(lee, timed, 'pause');
await clock('2027-04-05T10:05:30-04:00');
await timer(lee, timed, 'pause');
assert.deepEqual(
  await runOf(lee, timed),
  {
    rule: read.id,
    day: '2027-04-05',
    started: '10:00:00',
    since: null,
    banked: 300,
  },
  'paused at five minutes; pausing again changes nothing',
);
await clock('2027-04-05T10:30:00-04:00');
await timer(lee, timed, 'resume');
assert.equal((await runOf(lee, timed)).since, '10:30:00');
await clock('2027-04-05T10:40:30-04:00');
await timer(lee, timed, 'stop');
assert.equal(await runOf(lee, timed), undefined);
assert.deepEqual(
  (await sessionsOf(lee, read.id, '2027-04-05')).map(({ id: _, ...s }) => s),
  [{ seconds: 930, started: '10:00:00', ended: '10:40:30' }],
  '5:00 before the pause and 10:30 after it',
);
await timer(lee, timed, 'stop');
await clock('2027-04-05T11:00:00-04:00');
await timer(lee, timed, 'start', read.id);
await timer(lee, timed, 'stop');
assert.deepEqual(
  await secondsOf(lee, read.id, '2027-04-05'),
  [930],
  'a stop with nothing going, or at 0 seconds, saves nothing',
);
assert.equal(
  await answer(lee, read.id, '2027-04-05'),
  undefined,
  'nothing is saved before the day can be logged',
);
await clock('2027-04-05T20:00:00-04:00');
await timer(lee, timed, 'start', read.id);
await clock('2027-04-05T20:06:00-04:00');
await timer(lee, timed, 'stop');
await clock('2027-04-05T23:50:00-04:00');
await timer(kim, timed, 'start', read.id);

// Tuesday just after midnight Monday can be logged: nx_tick saves Lee's two sessions as its answer
// (21:30 in all, so 21 min), with no screenshot though Read asks for one. Kim's timer is still going.
await clock('2027-04-06T00:10:00-04:00');
await as(lee, `select nx_sync($1)`, [timed]);
assert.deepEqual(await answer(lee, read.id, '2027-04-05'), {
  value: 21,
  done: true,
  status: 'pending',
  from_timer: true,
});
assert.deepEqual(
  (
    await one(
      lee,
      `select proofs from entries where person_id=$1 and rule_id=$2 and day='2027-04-05'`,
      [lee, read.id],
    )
  ).proofs,
  [],
);
assert.equal(
  await answer(kim, read.id, '2027-04-05'),
  undefined,
  'a day with a timer still going waits for it to stop',
);
// Kim's stop: the session counts toward Monday, the day it started, and is saved at once, in full
// (30 min on a 20 min target).
await clock('2027-04-06T00:20:00-04:00');
await timer(kim, timed, 'stop');
assert.deepEqual(await secondsOf(kim, read.id, '2027-04-05'), [1800]);
assert.deepEqual(await answer(kim, read.id, '2027-04-05'), {
  value: 30,
  done: true,
  status: 'pending',
  from_timer: true,
});
// One timer at a time: starting Read saves the Stretch that was going.
await clock('2027-04-06T07:00:00-04:00');
await timer(lee, timed, 'start', stretch.id);
await clock('2027-04-06T07:12:00-04:00');
await timer(lee, timed, 'start', read.id);
assert.deepEqual(await secondsOf(lee, stretch.id, '2027-04-06'), [720]);
assert.equal((await runOf(lee, timed)).rule, read.id);
await clock('2027-04-06T07:22:00-04:00');
await timer(lee, timed, 'stop');
await clock('2027-04-06T18:00:00-04:00');
await timer(kim, timed, 'start', read.id);
await clock('2027-04-06T18:25:00-04:00');
await timer(kim, timed, 'stop');

// Wednesday: Tuesday's answers, scored like check-ins. 10 min is short of 20: a miss with its point.
await clock('2027-04-07T09:00:00-04:00');
await as(kim, `select nx_sync($1)`, [timed]);
assert.deepEqual(await answer(lee, read.id, '2027-04-06'), {
  value: 10,
  done: false,
  status: 'missed',
  from_timer: true,
});
assert.deepEqual(await pointsOn(lee, read.id, '2027-04-06'), [
  { reason: 'missed', voided: false, forgiven: false },
]);
assert.deepEqual(await answer(lee, stretch.id, '2027-04-06'), {
  value: 12,
  done: true,
  status: 'pending',
  from_timer: true,
});
assert.deepEqual(await answer(kim, read.id, '2027-04-06'), {
  value: 25,
  done: true,
  status: 'pending',
  from_timer: true,
});
// Changed by hand before the deadline, it's Lee's own answer: the point goes.
await db.query(`insert into storage.objects values('proofs',$1)`, [
  `${timed}/${lee}/read.jpg`,
]);
await as(
  lee,
  `select nx_save_checkin($1,$2,'2027-04-06',p_value=>20,p_proofs=>$3::jsonb)`,
  [timed, read.id, JSON.stringify([{ path: `${timed}/${lee}/read.jpg` }])],
);
assert.deepEqual(await answer(lee, read.id, '2027-04-06'), {
  value: 20,
  done: true,
  status: 'pending',
  from_timer: false,
});
assert.deepEqual(await pointsOn(lee, read.id, '2027-04-06'), [
  { reason: 'missed', voided: true, forgiven: false },
]);
await clock('2027-04-07T18:00:00-04:00');
await timer(kim, timed, 'start', read.id);
await clock('2027-04-07T18:25:00-04:00');
await timer(kim, timed, 'stop');

// Nobody opens the app again until Friday, after Wednesday's deadline: Kim's timed Wednesday gets its
// answer, not an unlogged point. Lee timed nothing on Wednesday, so his is unlogged.
await clock('2027-04-09T09:00:00-04:00');
await as(lee, `select nx_sync($1)`, [timed]);
assert.deepEqual(await answer(kim, read.id, '2027-04-07'), {
  value: 25,
  done: true,
  status: 'pending',
  from_timer: true,
});
assert.deepEqual(await pointsOn(kim, read.id, '2027-04-07'), []);
assert.deepEqual(await pointsOn(lee, read.id, '2027-04-07'), [
  { reason: 'unlogged', voided: false, forgiven: false },
]);

// The partner reads the sessions (to review them); nobody else can, and nobody writes them directly.
assert.equal(
  (await as(kim, `select id from timer_sessions where person_id=$1`, [lee]))
    .length,
  4,
);
for (const t of ['timer_runs', 'timer_sessions'])
  assert.equal(
    (
      await one(
        ana,
        `select count(*)::int n from ${t} where challenge_id=$1 or challenge_id=$2`,
        [timed, tonight],
      )
    ).n,
    0,
    `${t}: Ana sees none`,
  );
await fails(
  as(
    lee,
    `insert into timer_sessions(challenge_id,person_id,rule_id,day,started_at,ended_at,seconds) values($1,$2,$3,'2027-04-08',now(),now(),600)`,
    [timed, lee, read.id],
  ),
  /permission denied/,
);
await fails(as(lee, `update timer_runs set banked=9999`), /permission denied/);

// A person removes only their own session; an answer already saved stays as it is.
const [firstRead] = await sessionsOf(lee, read.id, '2027-04-05');
await fails(
  as(kim, `select nx_remove_session($1)`, [firstRead.id]),
  /your own sessions/,
);
await as(lee, `select nx_remove_session($1)`, [firstRead.id]);
assert.deepEqual(await secondsOf(lee, read.id, '2027-04-05'), [360]);
await as(lee, `select nx_sync($1)`, [timed]);
assert.equal((await answer(lee, read.id, '2027-04-05')).value, 21);

// Turning the timer off stops and saves a timer going on that rule, whoever's it is.
await clock('2027-04-09T10:00:00-04:00');
await timer(lee, timed, 'start', stretch.id);
await clock('2027-04-09T10:30:00-04:00');
await as(kim, `select nx_set_timed($1,$2,false)`, [timed, stretch.id]);
assert.equal(await runOf(lee, timed), undefined);
assert.deepEqual(await secondsOf(lee, stretch.id, '2027-04-09'), [1800]);
assert.equal((await ruleIn(timed, 'Stretch')).timed, false);
assert.equal(await signatures(timed), 2);
await fails(timer(lee, timed, 'start', stretch.id), /isn't timed/);
await as(kim, `select nx_set_timed($1,$2,true)`, [timed, stretch.id]);

// The rows become the World the Timer page reads, and the page's pure actions agree with the database.
await clock('2027-04-09T10:40:00-04:00');
await timer(lee, timed, 'start', read.id);
await timer(kim, timed, 'start', read.id);
await clock('2027-04-09T10:45:00-04:00');
await timer(kim, timed, 'pause');
const tw = buildWorld(
  await rowsFor(lee),
  '2027-04-09T14:50:00.000Z',
  'America/Toronto',
  links,
  {},
  timed,
).world;
assert.equal(tw.challenge.id, timed);
assert.equal(tw.challenge.rules.find((r) => r.title === 'Read').timed, true);
assert.equal(
  tw.challenge.rules.find((r) => r.title === 'Steps').timed,
  undefined,
);
assert.deepEqual(
  tw.timers
    .map((t) => [
      t.personId,
      t.ruleId,
      t.day,
      t.runningSince === null,
      t.banked,
    ])
    .sort((a, b) => a[0].localeCompare(b[0])),
  [
    [lee, read.id, '2027-04-09', false, 0],
    [kim, read.id, '2027-04-09', true, 300],
  ].sort((a, b) => a[0].localeCompare(b[0])),
);
assert.equal(
  tw.sessions.length,
  (
    await one(
      lee,
      `select count(*)::int n from timer_sessions where challenge_id=$1`,
      [timed],
    )
  ).n,
);
assert.equal(
  tw.sessions.some(
    (s) =>
      s.ruleId === read.id &&
      s.day === '2027-04-05' &&
      s.seconds === 360 &&
      s.personId === lee,
  ),
  true,
);
assert.equal(timedSeconds(tw, kim, read.id, '2027-04-05'), 1800);
assert.equal(
  timedMinutes(timedSeconds(tw, kim, read.id, '2027-04-06')),
  (await answer(kim, read.id, '2027-04-06')).value,
  'whole minutes, rounded down, as the database saves them',
);
assert.equal(
  timerSeconds(
    tw.timers.find((t) => t.personId === kim),
    '2027-04-09T15:30:00.000Z',
  ),
  300,
);
const entryIn = (person, day) =>
  tw.entries.find(
    (e) => e.personId === person && e.ruleId === read.id && e.day === day,
  );
assert.equal(entryIn(kim, '2027-04-06').fromTimer, true);
assert.equal(
  entryIn(lee, '2027-04-06').fromTimer,
  undefined,
  'changed by hand',
);
const pureStop = stopTimer(tw, lee, '2027-04-09T14:50:00.000Z').sessions.find(
  (s) => !tw.sessions.some((o) => o.id === s.id),
);
await clock('2027-04-09T10:50:00-04:00');
await timer(lee, timed, 'stop');
assert.deepEqual(
  (await sessionsOf(lee, read.id, '2027-04-09')).map((s) => s.seconds),
  [pureStop.seconds],
  "the page's stop and the database's agree",
);

// Ana, outside the challenge, is refused by every timer function, and nothing changes.
const timerState = async () =>
  JSON.stringify(
    (
      await db.query(
        `select (select count(*) from timer_runs where challenge_id=$1) runs,
          (select count(*) from timer_sessions where challenge_id=$1) sessions,
          (select string_agg(timed::text, ',' order by position) from rules where challenge_id=$1) timed`,
        [timed],
      )
    ).rows,
  );
const timerBefore = await timerState();
const [kimSession] = await sessionsOf(kim, read.id, '2027-04-05');
for (const [sql, params] of [
  [`select nx_timer($1,'start',$2)`, [timed, read.id]],
  [`select nx_timer($1,'pause')`, [timed]],
  [`select nx_timer($1,'resume')`, [timed]],
  [`select nx_timer($1,'stop')`, [timed]],
  [`select nx_set_timed($1,$2,false)`, [timed, read.id]],
  [`select nx_remove_session($1)`, [kimSession.id]],
])
  await fails(as(ana, sql, params), /isn't yours/);
assert.equal(await timerState(), timerBefore, 'nothing changed');
// The helpers behind them can't be called directly.
for (const [sql, params] of [
  [
    `select nx_timer_log(null::public.challenges,$1,$2,'2027-04-05')`,
    [lee, read.id],
  ],
  [`select nx_stop_timer(null::public.challenges,$1)`, [lee]],
  [`select nx_can_time('number','min')`, []],
])
  await fails(as(lee, sql, params), /permission denied/);

// Ending Timed early stops every timer still going (Kim's paused one, Lee's new one) and drops the
// sessions on days that no longer count; erasing it removes every timer row.
await clock('2027-04-10T10:00:00-04:00');
await timer(lee, timed, 'start', read.id);
await clock('2027-04-10T10:10:00-04:00');
assert.equal(
  (await one(lee, `select nx_end_request($1,'ask') r`, [timed])).r,
  'asked',
);
assert.equal(
  (await one(kim, `select nx_end_request($1,'ask') r`, [timed])).r,
  'ended',
);
assert.deepEqual(
  await one(lee, `select status, days from challenges where id=$1`, [timed]),
  { status: 'finished', days: 4 },
);
assert.equal(
  (
    await one(
      lee,
      `select count(*)::int n from timer_runs where challenge_id=$1`,
      [timed],
    )
  ).n,
  0,
  'every timer stopped',
);
assert.deepEqual(
  (
    await as(
      lee,
      `select distinct day::text d from timer_sessions where challenge_id=$1 order by 1`,
      [timed],
    )
  ).map((r) => r.d),
  ['2027-04-05', '2027-04-06', '2027-04-07'],
  'only the days that still count keep their sessions',
);
for (const id of [lee, kim])
  await as(id, `select nx_delete_challenge($1)`, [timed]);
await as(kim, `select nx_erase_challenge($1)`, [timed]);
for (const t of ['timer_runs', 'timer_sessions', 'entries'])
  assert.equal(
    (await db.query(`select 1 from ${t} where challenge_id=$1`, [timed])).rows
      .length,
    0,
    `nothing left in ${t}`,
  );

// Tonight (same-night deadline): each stop saves the day's answer at once, and later stops update it.
const tRead = (await ruleIn(tonight, 'Read')).id;
await clock('2027-04-12T19:00:00-04:00');
await timer(kim, tonight, 'start', tRead);
await clock('2027-04-12T19:15:00-04:00');
await timer(kim, tonight, 'stop');
assert.deepEqual(await answer(kim, tRead, '2027-04-12'), {
  value: 15,
  done: false,
  status: 'missed',
  from_timer: true,
});
assert.deepEqual(await pointsOn(kim, tRead, '2027-04-12'), [
  { reason: 'missed', voided: false, forgiven: false },
]);
await clock('2027-04-12T20:00:00-04:00');
await timer(lee, tonight, 'start', tRead);
await clock('2027-04-12T20:05:00-04:00');
await timer(lee, tonight, 'stop');
assert.equal((await answer(lee, tRead, '2027-04-12')).value, 5);
await clock('2027-04-12T20:30:00-04:00');
await as(lee, `select nx_save_checkin($1,$2,'2027-04-12',p_value=>22)`, [
  tonight,
  tRead,
]);
await clock('2027-04-12T21:00:00-04:00');
await timer(kim, tonight, 'start', tRead);
await clock('2027-04-12T21:10:00-04:00');
await timer(kim, tonight, 'stop');
assert.deepEqual(await answer(kim, tRead, '2027-04-12'), {
  value: 25,
  done: true,
  status: 'pending',
  from_timer: true,
});
assert.deepEqual(await pointsOn(kim, tRead, '2027-04-12'), [
  { reason: 'missed', voided: true, forgiven: false },
]);
// An answer typed by hand is never overwritten by the timer.
await clock('2027-04-12T21:15:00-04:00');
await timer(lee, tonight, 'start', tRead);
await clock('2027-04-12T21:45:00-04:00');
await timer(lee, tonight, 'stop');
assert.deepEqual(await secondsOf(lee, tRead, '2027-04-12'), [300, 1800]);
assert.deepEqual(await answer(lee, tRead, '2027-04-12'), {
  value: 22,
  done: true,
  status: 'pending',
  from_timer: false,
});
// Approved, but the day is still open: more time changes it, and it goes back for review.
const entryId = async (id, ruleId, day) =>
  (
    await one(
      lee,
      `select id from entries where person_id=$1 and rule_id=$2 and day=$3`,
      [id, ruleId, day],
    )
  ).id;
await clock('2027-04-12T21:50:00-04:00');
await as(lee, `select nx_review($1,'approve')`, [
  await entryId(kim, tRead, '2027-04-12'),
]);
await clock('2027-04-12T22:00:00-04:00');
await timer(kim, tonight, 'start', tRead);
await clock('2027-04-12T22:10:00-04:00');
await timer(kim, tonight, 'stop');
assert.deepEqual(await answer(kim, tRead, '2027-04-12'), {
  value: 35,
  done: true,
  status: 'pending',
  from_timer: true,
});
await clock('2027-04-12T22:20:00-04:00');
await as(lee, `select nx_review($1,'approve')`, [
  await entryId(kim, tRead, '2027-04-12'),
]);
await as(kim, `select nx_review($1,'approve')`, [
  await entryId(lee, tRead, '2027-04-12'),
]);
// Once the deadline has passed an approved answer stays, though a session started before it still
// counts toward the day.
await clock('2027-04-12T23:50:00-04:00');
await timer(kim, tonight, 'start', tRead);
await clock('2027-04-13T00:20:00-04:00');
await timer(kim, tonight, 'stop');
assert.deepEqual(
  await secondsOf(kim, tRead, '2027-04-12'),
  [900, 600, 600, 1800],
);
assert.deepEqual(await answer(kim, tRead, '2027-04-12'), {
  value: 35,
  done: true,
  status: 'confirmed',
  from_timer: true,
});
// The last day: a timer can't start once the day's deadline has passed, and one still going holds
// back both the day's unlogged point and the result until it stops.
await clock('2027-04-13T23:50:00-04:00');
await timer(kim, tonight, 'start', tRead);
await clock('2027-04-13T23:59:30-04:00');
await fails(timer(lee, tonight, 'start', tRead), /deadline has passed/);
await clock('2027-04-14T00:05:00-04:00');
await as(lee, `select nx_sync($1)`, [tonight]);
assert.equal((await answer(lee, tRead, '2027-04-13')).status, 'unlogged');
assert.equal(await answer(kim, tRead, '2027-04-13'), undefined);
assert.equal(await statusOf(tonight), 'running', 'waits for the timer');
await clock('2027-04-14T00:20:00-04:00');
await timer(kim, tonight, 'stop');
assert.deepEqual(await answer(kim, tRead, '2027-04-13'), {
  value: 30,
  done: true,
  status: 'pending',
  from_timer: true,
});
assert.deepEqual(await pointsOn(kim, tRead, '2027-04-13'), []);
await as(lee, `select nx_review($1,'approve')`, [
  await entryId(kim, tRead, '2027-04-13'),
]);
assert.equal(await statusOf(tonight), 'finished');
await fails(
  timer(kim, tonight, 'start', tRead),
  /while the challenge is running/,
);

// Up to 30 rules (rule-limit.sql): Erin and Kazzy's next challenge has 22.
{
  const many = (n) =>
    JSON.stringify(
      Array.from({ length: n }, (_, i) => ({
        title: `Rule ${i + 1}`,
        question: `Did you do rule ${i + 1}?`,
        kind: 'yesno',
        days: [0, 1, 2, 3, 4, 5, 6],
        who: 'both',
      })),
    );
  const big = (
    await one(
      ana,
      `select nx_create_challenge('Thirty','classic',null,'2027-06-01',30,'America/Toronto',1,null,$1::jsonb,null,true) id`,
      [many(30)],
    )
  ).id;
  assert.equal(
    (
      await one(
        ana,
        `select count(*)::int n from rules where challenge_id = $1`,
        [big],
      )
    ).n,
    30,
  );
  await fails(
    as(ana, `select nx_update_challenge($1, p_rules => $2::jsonb)`, [
      big,
      many(31),
    ]),
    /30 rules or fewer/,
  );
  await fails(
    as(
      ana,
      `select nx_create_challenge('Too many','classic',null,'2027-06-01',30,'America/Toronto',1,null,$1::jsonb,null,true)`,
      [many(31)],
    ),
    /30 rules or fewer/,
  );
}

// Goals (goals.sql): each person's own, in order, read by both, nobody else.
{
  const goalsOf = (id) =>
    as(
      lee,
      `select text, position from goals where challenge_id = $1 and person_id = $2 order by position`,
      [tonight, id],
    );
  await as(lee, `select nx_set_goals($1, $2::jsonb)`, [
    tonight,
    JSON.stringify(['  Run a 10K ', '', 'x'.repeat(150), 'a', 'b', 'c', 'd']),
  ]);
  assert.deepEqual(
    (await goalsOf(lee)).map((g) => [g.position, g.text.length]),
    [
      [0, 9],
      [1, 100],
      [2, 1],
      [3, 1],
      [4, 1],
    ],
    'trimmed, empty left out, 100 characters, 5 at most',
  );
  assert.equal((await goalsOf(lee))[0].text, 'Run a 10K');
  // The partner reads them; their own set leaves Lee's as they are.
  assert.equal(
    (
      await as(
        kim,
        `select count(*)::int n from goals where challenge_id = $1 and person_id = $2`,
        [tonight, lee],
      )
    )[0].n,
    5,
  );
  await as(kim, `select nx_set_goals($1, $2::jsonb)`, [
    tonight,
    JSON.stringify(['Play one song']),
  ]);
  assert.equal((await goalsOf(lee)).length, 5);
  assert.deepEqual(
    (await goalsOf(kim)).map((g) => g.text),
    ['Play one song'],
  );
  // Replacing: a new list, then none.
  await as(lee, `select nx_set_goals($1, $2::jsonb)`, [
    tonight,
    JSON.stringify(['Beach body']),
  ]);
  assert.deepEqual(
    (await goalsOf(lee)).map((g) => g.text),
    ['Beach body'],
  );
  await as(lee, `select nx_set_goals($1, '[]'::jsonb)`, [tonight]);
  assert.deepEqual(await goalsOf(lee), []);
  await fails(
    as(lee, `select nx_set_goals($1, '{}'::jsonb)`, [tonight]),
    /must be a list/,
  );
  // An outsider reads none and can't write any; nobody writes the table directly.
  assert.equal(
    (
      await as(
        ana,
        `select count(*)::int n from goals where challenge_id = $1`,
        [tonight],
      )
    )[0].n,
    0,
  );
  await fails(
    as(ana, `select nx_set_goals($1, '["Mine"]'::jsonb)`, [tonight]),
    /isn't yours/,
  );
  await fails(
    as(
      lee,
      `insert into goals(challenge_id, person_id, text) values ($1, $2, 'Sneaky')`,
      [tonight, lee],
    ),
    /permission denied/,
  );
  await fails(
    as(lee, `delete from goals where challenge_id = $1`, [tonight]),
    /permission denied/,
  );
  // The live app shows them: each person's in order, on the challenge they belong to.
  await as(lee, `select nx_set_goals($1, $2::jsonb)`, [
    tonight,
    JSON.stringify(['Beach body', 'Talk for 3 minutes in Arabic']),
  ]);
  const lw = buildWorld(
    await rowsFor(lee),
    '2027-04-14T12:00:00.000Z',
    'America/Toronto',
    links,
    {},
    tonight,
  ).world;
  assert.equal(lw.challenge.id, tonight);
  assert.deepEqual(
    lw.goals.filter((g) => g.personId === lee).map((g) => g.text),
    ['Beach body', 'Talk for 3 minutes in Arabic'],
  );
  assert.deepEqual(
    lw.goals.filter((g) => g.personId === kim).map((g) => g.text),
    ['Play one song'],
  );
  // Goals go with their challenge.
  await db.exec(`delete from goals where challenge_id = '${tonight}'`);
  await as(kim, `select nx_set_goals($1, '["Back again"]'::jsonb)`, [tonight]);
  const before = (
    await db.query(
      `select count(*)::int n from goals where challenge_id = $1`,
      [tonight],
    )
  ).rows[0].n;
  assert.equal(before, 1);
  await db.exec(`delete from challenges where id = '${tonight}'`);
  assert.equal(
    (
      await db.query(
        `select count(*)::int n from goals where challenge_id = $1`,
        [tonight],
      )
    ).rows[0].n,
    0,
  );
}

console.log('next database: ok');
