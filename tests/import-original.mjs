// supabase/next/import-original.sql on PGlite: the old app's challenge, scored by the old functions,
// comes into the new schema with the same points, and the new rules engine changes none of them.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();
const oldErin = '00000000-0000-0000-0000-000000000001',
  oldKazzy = '00000000-0000-0000-0000-000000000002',
  erin = '00000000-0000-0000-0000-0000000000e1',
  kazzy = '00000000-0000-0000-0000-0000000000a2';
const file = (path) =>
  readFileSync(new URL(`../supabase/${path}`, import.meta.url), 'utf8');

await db.exec(
  `create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create table storage.objects(bucket_id text,name text);
   create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
   insert into auth.users values('${oldErin}','erin@example.com','{}'),('${oldKazzy}','kazzy@example.com','{}');`,
);
await db.exec(file('setup.sql'));

// Some of the month as it was played: answers, a forgiven miss, a conceded dispute, gym visits.
await db.exec(`
  insert into challenge_entries(user_id,rule_id,day,done,status,proof) values
    ('${oldErin}','prayer','2026-09-15',true,'confirmed',null),
    ('${oldErin}','prayer','2026-09-16',false,'excused',null),
    ('${oldErin}','steps','2026-09-15',true,'confirmed','${oldErin}/a.jpg'),
    ('${oldKazzy}','prayer','2026-09-15',true,'conceded',null),
    ('${oldKazzy}','gym','2026-09-15',true,'confirmed',null),
    ('${oldKazzy}','gym','2026-09-16',true,'confirmed',null),
    ('${oldKazzy}','gym','2026-09-17',true,'confirmed',null),
    ('${oldErin}','gym','2026-09-22',true,'confirmed',null),
    ('${oldKazzy}','steps_weekly','2026-09-29',true,'confirmed','${oldKazzy}/b.jpg');
  insert into challenge_points(user_id,rule_id,day,reason,entry_id,forgiven)
    select '${oldErin}','prayer','2026-09-16','missed',id,true from challenge_entries where user_id='${oldErin}' and rule_id='prayer' and day='2026-09-16';
  insert into challenge_points(user_id,rule_id,day,reason,entry_id)
    select '${oldKazzy}','prayer','2026-09-15','dispute_conceded',id from challenge_entries where user_id='${oldKazzy}' and rule_id='prayer' and day='2026-09-15';
  insert into challenge_disputes(entry_id,raised_by,comment,status,resolved_at)
    select id,'${oldErin}','Not that day','conceded',now() from challenge_entries where user_id='${oldKazzy}' and rule_id='prayer' and day='2026-09-15';
  insert into challenge_requests(point_id,requester_id,reason,status,decided_by,decided_at)
    select id,'${oldErin}','Sick','approved','${oldKazzy}',now() from challenge_points where user_id='${oldErin}' and day='2026-09-16';
  insert into challenge_journal_notes(user_id,day,text) values('${oldErin}','2026-09-20','Rainy week');
`);
// The old deadline job fills in every unlogged day and gym and step shortfall.
await db.exec(`select challenge_tick()`);

const oldPoints = async () =>
  (
    await db.query(
      `select p.rule_id rule, pr.name who, p.day::text as day, p.slot, p.voided, p.forgiven,
              case p.reason when 'dispute_conceded' then 'conceded' when 'weekly_shortfall' then 'weekly' else p.reason end reason
       from challenge_points p join challenge_profiles pr on pr.id=p.user_id
       order by 1,2,3,4`,
    )
  ).rows;
const before = await oldPoints();
assert.ok(before.length > 200, 'a whole month of points');

// The new schema, the two new accounts, and the import.
await db.exec(
  `insert into auth.users values('${erin}','erin@example.com','{}'),('${kazzy}','kazzy@example.com','{}');`,
);
await db.exec(file('next/schema.sql'));
await db.exec(file('next/import-original.sql'));
const id = (
  await db.query(`select nx_import_original($1,$2) id`, [erin, kazzy])
).rows[0].id;

const newPoints = (
  await db.query(
    `select o.old_id rule, pr.name who, p.day::text as day, p.slot, p.voided, p.forgiven, p.reason
     from points p join profiles pr on pr.id=p.person_id
     join (select r.id, o.id old_id from rules r join challenge_rules o on o.title=r.title) o on o.id=p.rule_id
     where p.challenge_id=$1 order by 1,2,3,4`,
    [id],
  )
).rows;
assert.deepEqual(
  newPoints,
  before,
  'every point comes across, and the new engine adds or voids none',
);

const active = async (sql) =>
  Object.fromEntries((await db.query(sql)).rows.map((r) => [r.name, r.n]));
assert.deepEqual(
  await active(
    `select pr.name, count(*)::int n from points p join profiles pr on pr.id=p.person_id where not voided and not forgiven group by 1`,
  ),
  await active(
    `select pr.name, count(*)::int n from challenge_points p join challenge_profiles pr on pr.id=p.user_id where not voided and not forgiven group by 1`,
  ),
  'the same active points, so the same gifts',
);

const c = (await db.query(`select * from challenges where id=$1`, [id]))
  .rows[0];
assert.equal(c.status, 'finished');
assert.equal(c.days, 30);
const steps = (
  await db.query(
    `select proofs from entries e join rules r on r.id=e.rule_id where r.title='10,000 steps' and e.person_id=$1 and e.day='2026-09-15'`,
    [erin],
  )
).rows[0].proofs;
assert.deepEqual(steps, [{ path: `${id}/${erin}/a.jpg` }]);
assert.equal(
  (await db.query(`select count(*)::int n from disputes`)).rows[0].n,
  1,
);
assert.equal(
  (await db.query(`select status from forgiveness_requests`)).rows[0].status,
  'approved',
);
assert.equal(
  (await db.query(`select text from journal_notes`)).rows[0].text,
  'Rainy week',
);
await assert.rejects(
  db.query(`select nx_import_original($1,$2)`, [erin, kazzy]),
  /already imported/,
);

console.log('import original: ok');
