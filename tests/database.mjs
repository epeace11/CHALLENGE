import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table storage.objects(bucket_id text,name text);create table storage.buckets(id text,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;insert into auth.users values('00000000-0000-0000-0000-000000000001','erin@example.com','{}'),('00000000-0000-0000-0000-000000000002','kazzy@example.com','{}');`,
);
const sql = readFileSync(
  new URL('../supabase/setup.sql', import.meta.url),
  'utf8',
);
await db.exec(sql);
const erin = '00000000-0000-0000-0000-000000000001',
  kazzy = '00000000-0000-0000-0000-000000000002';
const actor = async (id) =>
  db.exec(`select set_config('request.jwt.claim.sub','${id}',false)`);
await actor(erin);
await db.exec(`select challenge_sync()`);
assert.equal(
  (await db.query(`select count(*)::int n from challenge_profiles`)).rows[0].n,
  2,
);
// Use actual Toronto date in the configured interval for a deterministic present-time edit.
await db.exec(
  `update challenge_config set start_date=(now() at time zone 'America/Toronto')::date,end_date=(now() at time zone 'America/Toronto')::date+2,allow_same_day=true`,
);
// Same-day logging is normally rejected; the app only offers days that have ended.
await assert.rejects(
  () =>
    db.exec(
      `update challenge_config set allow_same_day=false where id=1;select challenge_log('prayer',(now() at time zone 'America/Toronto')::date,true)`,
    ),
  /not available/,
);
await db.exec(`update challenge_config set allow_same_day=true where id=1`);
await db.exec(
  `select challenge_log('prayer',(now() at time zone 'America/Toronto')::date,false)`,
);
assert.equal(
  (
    await db.query(
      `select count(*)::int n from challenge_points where user_id='${erin}' and rule_id='prayer' and not voided and not forgiven`,
    )
  ).rows[0].n >= 1,
  true,
);
await db.exec(
  `select challenge_log('prayer',(now() at time zone 'America/Toronto')::date,true)`,
);
const entry = (
  await db.query(
    `select * from challenge_entries where user_id='${erin}' and rule_id='prayer' and day=(now() at time zone 'America/Toronto')::date`,
  )
).rows[0];
await assert.rejects(
  () => db.exec(`select challenge_review('${entry.id}','approve')`),
  /partner/,
);
await actor(kazzy);
await db.exec(`select challenge_review('${entry.id}','approve')`);
assert.equal(
  (
    await db.query(
      `select status from challenge_entries where id='${entry.id}'`,
    )
  ).rows[0].status,
  'confirmed',
);
await actor(erin);
await db.exec(
  `select challenge_log('prayer',(now() at time zone 'America/Toronto')::date,false)`,
);
const p = (
  await db.query(`select id from challenge_points where entry_id='${entry.id}'`)
).rows[0];
await db.exec(`select challenge_forgive('${p.id}','A reasonable exception')`);
const req = (
  await db.query(`select id from challenge_requests where point_id='${p.id}'`)
).rows[0];
await assert.rejects(
  () => db.exec(`select challenge_decide('${req.id}',true)`),
  /partner/,
);
await actor(kazzy);
await db.exec(`select challenge_decide('${req.id}',true)`);
assert.equal(
  (await db.query(`select forgiven from challenge_points where id='${p.id}'`))
    .rows[0].forgiven,
  true,
);
await actor(erin);
await assert.rejects(
  () =>
    db.exec(
      `select challenge_log('time',(now() at time zone 'America/Toronto')::date,true)`,
    ),
  /screenshot/,
);
// Proof: several screenshots, newline-separated; each must be the member's own upload; more than six is refused.
await db.exec(
  `insert into storage.objects values('challenge-proof','${erin}/a.jpg'),('challenge-proof','${erin}/b.jpg'),('challenge-proof','${kazzy}/c.jpg')`,
);
await db.exec(
  `select challenge_log('time',(now() at time zone 'America/Toronto')::date,true,'',E'${erin}/a.jpg\\n${erin}/b.jpg')`,
);
assert.equal(
  (
    await db.query(
      `select proof from challenge_entries where user_id='${erin}' and rule_id='time' and day=(now() at time zone 'America/Toronto')::date`,
    )
  ).rows[0].proof,
  `${erin}/a.jpg\n${erin}/b.jpg`,
);
await assert.rejects(
  () =>
    db.exec(
      `select challenge_log('time',(now() at time zone 'America/Toronto')::date,true,'',E'${erin}/a.jpg\\n${kazzy}/c.jpg')`,
    ),
  /Invalid proof/,
);
await assert.rejects(
  () =>
    db.exec(
      `select challenge_log('time',(now() at time zone 'America/Toronto')::date,true,'',E'${erin}/a.jpg\\n${erin}/missing.jpg')`,
    ),
  /Invalid proof/,
);
await assert.rejects(
  () =>
    db.exec(
      `select challenge_log('time',(now() at time zone 'America/Toronto')::date,true,'',(select string_agg('${erin}/a.jpg',E'\\n') from generate_series(1,7)))`,
    ),
  /at most six/,
);
await assert.rejects(
  () =>
    db.exec(
      `select challenge_log('calories',(now() at time zone 'America/Toronto')::date,false)`,
    ),
  /not available/,
);
await actor('00000000-0000-0000-0000-000000000099');
await assert.rejects(() => db.exec(`select challenge_sync()`), /Unauthorized/);
await actor(erin);
await db.exec(
  `update challenge_config set start_date=(now() at time zone 'America/Toronto')::date-3,end_date=(now() at time zone 'America/Toronto')::date+2;select challenge_tick()`,
);
await db.exec(
  `select challenge_log('prayer',(now() at time zone 'America/Toronto')::date-2,true)`,
);
const late = (
  await db.query(
    `select * from challenge_entries where user_id='${erin}' and rule_id='prayer' and day=(now() at time zone 'America/Toronto')::date-2`,
  )
).rows[0];
assert.equal(late.done, false);
assert.equal(late.proposed_done, true);
await actor(kazzy);
await db.exec(`select challenge_review('${late.id}','approve')`);
assert.equal(
  (
    await db.query(
      `select voided from challenge_points where entry_id='${late.id}'`,
    )
  ).rows[0].voided,
  true,
);
await actor(erin);
await db.exec(
  `select challenge_log('gym',(now() at time zone 'America/Toronto')::date-2,true);select challenge_tick()`,
);
const lateGym = (
  await db.query(
    `select * from challenge_entries where user_id='${erin}' and rule_id='gym' and day=(now() at time zone 'America/Toronto')::date-2`,
  )
).rows[0];
assert.equal(lateGym.done, false);
assert.equal(lateGym.proposed_done, true);
assert.equal(
  (
    await db.query(
      `select count(*)::int n from challenge_points where rule_id='gym' and slot=0`,
    )
  ).rows[0].n,
  0,
);
await db.exec(`set role authenticated`);
await assert.rejects(
  () => db.exec(`update challenge_entries set done=true`),
  /permission denied/,
);
await db.exec(`reset role`);
// Forgiveness: partner can forgive directly and undo it; owner cannot; re-asking after a denial works.
await actor(erin);
await db.exec(
  `select challenge_log('food',(now() at time zone 'America/Toronto')::date,false)`,
);
const foodPt = (
  await db.query(
    `select p.id from challenge_points p join challenge_entries e on e.id=p.entry_id where e.user_id='${erin}' and e.rule_id='food' and e.day=(now() at time zone 'America/Toronto')::date and not p.voided and not p.forgiven`,
  )
).rows[0];
await assert.rejects(
  () => db.exec(`select challenge_partner_forgive('${foodPt.id}',true)`),
  /partner/,
);
await actor(kazzy);
await db.exec(`select challenge_partner_forgive('${foodPt.id}',true)`);
assert.equal(
  (
    await db.query(
      `select forgiven from challenge_points where id='${foodPt.id}'`,
    )
  ).rows[0].forgiven,
  true,
);
assert.equal(
  (
    await db.query(
      `select status from challenge_entries where id=(select entry_id from challenge_points where id='${foodPt.id}')`,
    )
  ).rows[0].status,
  'excused',
);
await db.exec(`select challenge_partner_forgive('${foodPt.id}',false)`);
assert.equal(
  (
    await db.query(
      `select forgiven from challenge_points where id='${foodPt.id}'`,
    )
  ).rows[0].forgiven,
  false,
);
assert.equal(
  (
    await db.query(
      `select status from challenge_entries where id=(select entry_id from challenge_points where id='${foodPt.id}')`,
    )
  ).rows[0].status,
  'missed',
);
await actor(erin);
await db.exec(`select challenge_forgive('${foodPt.id}','first ask')`);
const ask = (
  await db.query(
    `select id from challenge_requests where point_id='${foodPt.id}'`,
  )
).rows[0];
await actor(kazzy);
await db.exec(`select challenge_decide('${ask.id}',false)`);
await actor(erin);
await db.exec(`select challenge_forgive('${foodPt.id}','second ask')`);
const again = (
  await db.query(
    `select status,reason from challenge_requests where point_id='${foodPt.id}'`,
  )
).rows;
assert.equal(again.length, 1);
assert.equal(again[0].status, 'pending');
assert.equal(again[0].reason, 'second ask');
// Weekend-only rule: Kazzy's 1 am bed rule is refused on a weekday and accepted on a weekend; Erin never has it.
await actor(erin);
await db.exec(
  `update challenge_config set start_date=(now() at time zone 'America/Toronto')::date-6 where id=1;select challenge_tick()`,
);
const weekday = `(select d::date from generate_series((now() at time zone 'America/Toronto')::date-6,(now() at time zone 'America/Toronto')::date,'1 day') d where extract(dow from d)<=4 limit 1)`,
  weekend = `(select d::date from generate_series((now() at time zone 'America/Toronto')::date-6,(now() at time zone 'America/Toronto')::date,'1 day') d where extract(dow from d)>4 limit 1)`;
await assert.rejects(
  () => db.exec(`select challenge_log('bed_1am',${weekend},true)`),
  /not available/,
);
await actor(kazzy);
await assert.rejects(
  () => db.exec(`select challenge_log('bed_1am',${weekday},true)`),
  /not available/,
);
await db.exec(`select challenge_log('bed_1am',${weekend},true)`);
assert.equal(
  (
    await db.query(
      `select count(*)::int n from challenge_entries where rule_id='bed_1am' and extract(dow from day)<=4`,
    )
  ).rows[0].n,
  0,
);
// Journal notes: several per day, both can read, only the author can remove, outsiders and out-of-range days rejected, direct writes blocked.
await actor(erin);
await db.exec(
  `select challenge_journal_add((now() at time zone 'America/Toronto')::date,'Rough start.')`,
);
await db.exec(
  `select challenge_journal_add((now() at time zone 'America/Toronto')::date,'  Better evening.  ')`,
);
assert.deepEqual(
  (
    await db.query(
      `select text from challenge_journal_notes where user_id='${erin}' order by created_at`,
    )
  ).rows.map((r) => r.text),
  ['Rough start.', 'Better evening.'],
);
await assert.rejects(
  () =>
    db.exec(
      `select challenge_journal_add((now() at time zone 'America/Toronto')::date,'   ')`,
    ),
  /Write something/,
);
await assert.rejects(
  () =>
    db.exec(
      `select challenge_journal_add((now() at time zone 'America/Toronto')::date+30,'x')`,
    ),
  /outside/,
);
await actor('00000000-0000-0000-0000-000000000099');
await assert.rejects(
  () =>
    db.exec(
      `select challenge_journal_add((now() at time zone 'America/Toronto')::date,'x')`,
    ),
  /only for/,
);
const noteId = (
  await db.query(
    `select id from challenge_journal_notes where text='Rough start.'`,
  )
).rows[0].id;
await actor(erin);
await db.exec(
  `select challenge_journal_edit('${noteId}',' Rough start, honestly. ')`,
);
assert.equal(
  (
    await db.query(
      `select text from challenge_journal_notes where id='${noteId}'`,
    )
  ).rows[0].text,
  'Rough start, honestly.',
);
await assert.rejects(
  () => db.exec(`select challenge_journal_edit('${noteId}','  ')`),
  /Write something/,
);
await actor(kazzy);
await assert.rejects(
  () => db.exec(`select challenge_journal_edit('${noteId}','mine now')`),
  /own notes/,
);
await actor(kazzy);
assert.equal(
  (await db.query(`select count(*)::int n from challenge_journal_notes`))
    .rows[0].n,
  2,
);
await assert.rejects(
  () => db.exec(`select challenge_journal_delete('${noteId}')`),
  /own notes/,
);
await actor(erin);
await db.exec(`select challenge_journal_delete('${noteId}')`);
assert.equal(
  (await db.query(`select count(*)::int n from challenge_journal_notes`))
    .rows[0].n,
  1,
);
await db.exec(`set role authenticated`);
await assert.rejects(
  () =>
    db.exec(
      `insert into challenge_journal_notes(user_id,day,text) values('${kazzy}',current_date,'x')`,
    ),
  /permission denied/,
);
await db.exec(`reset role`);
console.log(
  'PASS: journal notes add/edit/remove, read by both, author-only removal, member and date checks;',
);
console.log(
  'PASS: several screenshots per answer, each validated, capped at six; weekend-only rule gated on both sides;',
);
// Kazzy's weekly steps: targets come from challenge_weekly_targets; a closed week is assessed like the gym, a No adds no daily point, other people and target-less weeks are rejected.
const T = `(now() at time zone 'America/Toronto')::date`;
await actor(erin);
await db.exec(
  `update challenge_config set finalized=false,start_date=${T}-10,end_date=${T}+2,allow_same_day=false where id=1;delete from challenge_weekly_targets where true;delete from challenge_weeks where true;insert into challenge_weeks values(${T}-10,${T}-3);insert into challenge_weekly_targets values('steps_weekly',${T}-10,2)`,
);
await assert.rejects(
  () => db.exec(`select challenge_log('steps_weekly',${T}-5,false)`),
  /not available/,
);
await actor(kazzy);
await assert.rejects(
  () => db.exec(`select challenge_log('steps_weekly',${T}-5,true)`),
  /screenshot/,
);
await assert.rejects(
  () => db.exec(`select challenge_log('steps_weekly',${T}-2,false)`),
  /not available/,
); // no target that week
await db.exec(
  `insert into storage.objects values('challenge-proof','${kazzy}/steps.jpg');select challenge_log('steps_weekly',${T}-6,true,'',$$${kazzy}/steps.jpg$$);select challenge_log('steps_weekly',${T}-5,false)`,
);
// Both days are past their deadline, so they are late corrections until Erin approves the Yes.
const stepEntry = (
  await db.query(
    `select id from challenge_entries where rule_id='steps_weekly' and day=${T}-6`,
  )
).rows[0];
await actor(erin);
await db.exec(`select challenge_review('${stepEntry.id}','approve')`);
await actor(kazzy);
const stepPoints = (
  await db.query(
    `select user_id,slot,voided from challenge_points where rule_id='steps_weekly' order by slot`,
  )
).rows;
assert.deepEqual(
  stepPoints.map((r) => [r.user_id, r.slot, r.voided]),
  [
    [kazzy, 1, false],
    [kazzy, 2, true],
  ],
); // one of two days: one shortfall, no slot-0 point for the No
// Change history: members' changes carry their id; changes with no signed-in member (the hourly job, scripts) are recorded too; unchanged rewrites are skipped.
assert.ok(
  (
    await db.query(
      `select count(*)::int n from challenge_history where table_name='challenge_points' and actor='${kazzy}' and new_row->>'rule_id'='steps_weekly'`,
    )
  ).rows[0].n >= 2,
);
await actor('');
const before = (await db.query(`select count(*)::int n from challenge_history`))
  .rows[0].n;
await db.exec(`select challenge_rescore()`);
assert.equal(
  (await db.query(`select count(*)::int n from challenge_history`)).rows[0].n,
  before,
);
await db.exec(
  `update challenge_weekly_targets set target=3 where rule_id='steps_weekly'`,
);
const sys = (
  await db.query(
    `select actor,source,op,statement from challenge_history where table_name='challenge_weekly_targets' order by id desc limit 1`,
  )
).rows[0];
assert.equal(sys.actor, null);
assert.notEqual(sys.source, 'member');
assert.equal(sys.op, 'update');
assert.match(sys.statement, /set target=3/);
assert.ok(
  (await db.query(`select updated_at from challenge_points limit 1`)).rows[0]
    .updated_at,
);
await assert.rejects(() =>
  db.exec(
    `set role authenticated;insert into challenge_history(table_name,op,source) values('x','x','x')`,
  ),
);
await db.exec(`reset role`);
console.log(
  'PASS: weekly steps for Kazzy only, target-less weeks rejected, closed week assessed; change history records members and system changes, skips no-op rewrites, is read-only to clients.',
);
// Settled answers lock after their deadline: no edits, no forgiveness requests. Unlogged misses stay open; partners can still forgive directly.
await actor(erin);
await db.exec(
  `update challenge_config set finalized=false,start_date=${T}-10,end_date=${T}+2 where id=1;update challenge_rules set weeknights=false,weekends=false where id='screens'`,
);
await db.exec(
  `insert into challenge_entries(user_id,rule_id,day,done,status) values('${erin}','screens',${T}-4,false,'missed'),('${erin}','entertainment',${T}-4,true,'confirmed'),('${erin}','food',${T}-4,false,'unlogged') on conflict(user_id,rule_id,day) do update set done=excluded.done,status=excluded.status,proposed_done=null`,
);
await db.exec(
  `insert into challenge_points(user_id,rule_id,day,reason,entry_id) select user_id,rule_id,day,'missed',id from challenge_entries where user_id='${erin}' and day=${T}-4 and not done on conflict do nothing`,
);
await assert.rejects(
  () => db.exec(`select challenge_log('screens',${T}-4,true)`),
  /locked in/,
);
await assert.rejects(
  () => db.exec(`select challenge_log('entertainment',${T}-4,false)`),
  /locked in/,
);
const lockedPt = (
  await db.query(
    `select id from challenge_points where user_id='${erin}' and rule_id='screens' and day=${T}-4`,
  )
).rows[0];
await assert.rejects(
  () => db.exec(`select challenge_forgive('${lockedPt.id}','too late')`),
  /locked in/,
);
await db.exec(`select challenge_log('food',${T}-4,true)`); // unlogged: still a late correction
const openPt = (
  await db.query(
    `select id from challenge_points where user_id='${erin}' and rule_id='food' and day=${T}-4`,
  )
).rows[0];
await db.exec(`select challenge_forgive('${openPt.id}','never reviewed')`);
await actor(kazzy);
await db.exec(`select challenge_partner_forgive('${lockedPt.id}',true)`);
assert.equal(
  (
    await db.query(
      `select forgiven from challenge_points where id='${lockedPt.id}'`,
    )
  ).rows[0].forgiven,
  true,
);
console.log(
  'PASS: settled answers lock after the deadline (no edits or forgiveness requests); unlogged misses and partner forgiveness stay open.',
);
console.log(
  'PASS: partner forgive/undo, re-ask after denial; late corrections, no double gym penalties, direct writes blocked; schema, automatic assessment, edits, partner-only review, forgiveness, proof requirement, person-specific habits, outsider rejection.',
);
await db.close();
