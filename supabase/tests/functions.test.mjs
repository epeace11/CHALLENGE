// End-to-end test of the SQL transition functions against PGlite (Postgres in
// WebAssembly). Supabase's auth/storage schemas are stubbed. Run: npm run test:db

import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
const ROOT = new URL("../..", import.meta.url).pathname;
const ERIN = "11111111-1111-1111-1111-111111111111";
const KAZZY = "22222222-2222-2222-2222-222222222222";

(async () => {
  const db = new PGlite();
  const q = (sql, params) => db.query(sql, params);
  const as = async (uid) => q(`select set_config('app.uid', $1, false)`, [uid ?? ""]);
  let failures = 0;
  const check = async (name, fn, expectError) => {
    try {
      const r = await fn();
      if (expectError) { console.log("✗", name, "— expected error, got success"); failures++; }
      else console.log("✓", name);
      return r;
    } catch (e) {
      const msg = e.message.split("\n")[0];
      if (expectError && msg.includes(expectError)) console.log("✓", name, "→", msg);
      else { console.log("✗", name, "→", msg); failures++; }
    }
  };

  // --- Supabase stubs -------------------------------------------------------
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text unique);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
    insert into auth.users values ('${ERIN}', 'erin@example.com'), ('${KAZZY}', 'kazzy@example.com');
  `);

  const schema = fs.readFileSync(`${ROOT}/supabase/migrations/0001_schema.sql`, "utf8").replace(/create extension[^;]*;/g, "");
  await check("migration applies", () => db.exec(schema));
  const seed = fs.readFileSync(`${ROOT}/supabase/seed.sql`, "utf8");
  await check("seed applies", () => db.exec(seed));

  const { rows: profiles } = await q("select * from profiles order by slug");
  console.log("  profiles:", profiles.map((p) => p.slug).join(", "));
  const { rows: rules } = await q("select id, title, cadence, proof_required, applies_to from rules order by sort_order");
  console.log("  rules:", rules.length);
  const bed = rules[0], screen = rules[6], steps = rules[8], workout = rules[5];
  const today = (await q("select (now() at time zone 'America/Toronto')::date::text as d")).rows[0].d;
  console.log("  Toronto today:", today);
  const date = today >= "2026-09-08" && today <= "2026-09-30" ? today : "2026-09-08";
  // 09-08 is a Tuesday: bedtime rule active
  const { rows: la } = await q("select lock_at('00000000-0000-0000-0000-000000000901', $1::date)::text as l", [date]);
  console.log("  lock_at for", date, "=", la[0].l);

  // --- anon cannot call --------------------------------------------------
  await as(null);
  await check("unauthenticated save rejected", () => q("select save_entry($1, $2, false, '')", [bed.id, date]), "not signed in");

  // --- Erin logs a miss, then a done ----------------------------------------
  await as(ERIN);
  await check("erin logs bedtime miss", () => q("select * from save_entry($1, $2, false, 'football')", [bed.id, date]));
  let pts = (await q("select reason from points where user_id=$1", [ERIN])).rows;
  console.log("  points after miss:", pts.map((p) => p.reason));
  if (pts.length !== 1 || pts[0].reason !== "missed") { console.log("✗ expected one missed point"); failures++; }
  await check("erin flips to done", () => q("select * from save_entry($1, $2, true, '')", [bed.id, date]));
  pts = (await q("select reason from points where user_id=$1", [ERIN])).rows;
  if (pts.length !== 0) { console.log("✗ expected miss point removed, got", pts); failures++; } else console.log("✓ miss point removed on done");
  const entry = (await q("select * from entries where user_id=$1 and rule_id=$2 and date=$3", [ERIN, bed.id, date])).rows[0];
  if (entry.status !== "pending" || entry.done !== true) { console.log("✗ entry should be pending/done", entry); failures++; } else console.log("✓ done entry is pending review");

  // --- proof required ---------------------------------------------------------
  await check("done without photo rejected", () => q("select save_entry($1, $2, true, '')", [screen.id, date]), "photo is required");
  await check("photo with wrong folder rejected", () => q("select add_photo($1, $2, $3, null)", [screen.id, date, `${KAZZY}/x.jpg`]), "bad storage path");
  await check("add photo", () => q("select add_photo($1, $2, $3, now())", [screen.id, date, `${ERIN}/${date}/${screen.id}/a.jpg`]));
  const placeholder = (await q("select done from entries where user_id=$1 and rule_id=$2 and date=$3", [ERIN, screen.id, date])).rows[0];
  if (placeholder.done !== null) { console.log("✗ placeholder should have done=null"); failures++; } else console.log("✓ placeholder entry has done = null");
  await check("done with photo ok", () => q("select save_entry($1, $2, true, '')", [screen.id, date]));
  const photoId = (await q("select id from photos")).rows[0].id;
  await check("removing only photo while done rejected", () => q("select remove_photo($1)", [photoId]), "needs a photo");
  await check("kazzy cannot remove erin's photo", async () => { await as(KAZZY); try { return await q("select remove_photo($1)", [photoId]); } finally { await as(ERIN); } }, "not your photo");

  // --- rule applicability ------------------------------------------------------
  await check("erin cannot log kazzy-only rule", () => q("select save_entry($1, $2, true, '')", [rules[9].id, date]), "does not apply");
  await check("date outside challenge rejected", () => q("select save_entry($1, '2026-10-05', true, '')", [bed.id]), "outside challenge");

  // --- review ------------------------------------------------------------------
  await check("erin cannot approve own entry", () => q("select approve_entry($1)", [entry.id]), "your own");
  await as(KAZZY);
  await check("kazzy disputes without comment rejected", () => q("select dispute_entry($1, '  ')", [entry.id]), "comment is required");
  const disp = await check("kazzy disputes", () => q("select * from dispute_entry($1, 'you were up at 11:30')", [entry.id]));
  const dispute = disp.rows[0];
  await check("cannot approve a disputed entry", () => q("select approve_entry($1)", [entry.id]), "not awaiting review");
  await check("kazzy cannot concede", () => q("select concede_dispute($1)", [dispute.id]), "only the logger");
  await as(ERIN);
  await check("erin cannot withdraw", () => q("select withdraw_dispute($1)", [dispute.id]), "only the disputer");
  await check("erin concedes", () => q("select concede_dispute($1)", [dispute.id]));
  pts = (await q("select reason from points where user_id=$1 order by created_at", [ERIN])).rows;
  console.log("  erin points now:", pts.map((p) => p.reason));
  if (!pts.some((p) => p.reason === "dispute_conceded")) { console.log("✗ expected dispute_conceded point"); failures++; }
  const st = (await q("select status from entries where id=$1", [entry.id])).rows[0].status;
  if (st !== "conceded") { console.log("✗ entry should be conceded, got", st); failures++; } else console.log("✓ entry conceded");

  // --- withdraw path on the screen-time entry ----------------------------------
  const screenEntry = (await q("select id from entries where user_id=$1 and rule_id=$2", [ERIN, screen.id])).rows[0];
  await as(KAZZY);
  const d2 = (await check("kazzy disputes screen time", () => q("select * from dispute_entry($1, 'that screenshot is from yesterday')", [screenEntry.id]))).rows[0];
  await check("kazzy withdraws", () => q("select withdraw_dispute($1)", [d2.id]));
  const st2 = (await q("select status from entries where id=$1", [screenEntry.id])).rows[0].status;
  if (st2 !== "confirmed") { console.log("✗ withdrawn dispute should confirm, got", st2); failures++; } else console.log("✓ withdrawn dispute confirms entry");
  await check("cannot re-dispute a confirmed entry", () => q("select dispute_entry($1, 'again')", [screenEntry.id]), "not awaiting review");

  // --- approve path ------------------------------------------------------------
  await as(KAZZY);
  const kEntry = (await check("kazzy logs prayer done", () => q("select * from save_entry($1, $2, true, '')", [rules[3].id, date]))).rows[0];
  await as(ERIN);
  await check("erin approves kazzy", () => q("select approve_entry($1)", [kEntry.id]));

  // --- forgiveness ----------------------------------------------------------------
  const point = (await q("select id from points where user_id=$1 and reason='dispute_conceded'", [ERIN])).rows[0];
  await as(KAZZY);
  await check("kazzy cannot request forgiveness on erin's point", () => q("select request_forgiveness($1, 'pls')", [point.id]), "not your point");
  await as(ERIN);
  const fr = (await check("erin requests forgiveness", () => q("select * from request_forgiveness($1, 'football ended at 11:30')", [point.id]))).rows[0];
  await check("second request rejected", () => q("select request_forgiveness($1, 'again')", [point.id]), "already requested");
  await check("erin cannot decide own request", () => q("select decide_forgiveness($1, true)", [fr.id]), "your own request");
  await as(KAZZY);
  await check("kazzy approves forgiveness", () => q("select decide_forgiveness($1, true)", [fr.id]));
  const forgiven = (await q("select forgiven from points where id=$1", [point.id])).rows[0].forgiven;
  const exc = (await q("select status from entries where id=$1", [entry.id])).rows[0].status;
  if (!forgiven || exc !== "excused") { console.log("✗ expected forgiven+excused", forgiven, exc); failures++; } else console.log("✓ point forgiven, entry excused");
  await check("deciding twice rejected", () => q("select decide_forgiveness($1, false)", [fr.id]), "not pending");

  // --- unlogged reopen flow (simulate the noon lock as service role) ------------
  await as(null);
  const kazzyBed = (await q(`insert into entries (user_id, rule_id, date, done, status, unlogged) values ($1,$2,$3,false,'confirmed',true) returning id`, [KAZZY, bed.id, date])).rows[0];
  const unl = (await q(`insert into points (user_id, challenge_id, rule_id, date, reason, entry_id) values ($1,'00000000-0000-0000-0000-000000000901',$2,$3,'unlogged',$4) returning id`, [KAZZY, bed.id, date, kazzyBed.id])).rows[0];
  await as(KAZZY);
  const fr2 = (await check("kazzy requests forgiveness for unlogged", () => q("select * from request_forgiveness($1, 'forgot to log')", [unl.id]))).rows[0];
  await as(ERIN);
  await check("erin forgives unlogged", () => q("select decide_forgiveness($1, true)", [fr2.id]));
  const reopen = (await q("select reopen_until, status from entries where id=$1", [kazzyBed.id])).rows[0];
  if (!reopen.reopen_until || reopen.status !== "excused") { console.log("✗ expected reopen window", reopen); failures++; } else console.log("✓ unlogged day reopened for 24h");
  await as(KAZZY);
  await check("kazzy re-logs reopened day as done", () => q("select save_entry($1, $2, true, 'did it')", [bed.id, date]));
  const relog = (await q("select status, unlogged, done from entries where id=$1", [kazzyBed.id])).rows[0];
  if (relog.status !== "pending" || relog.unlogged || relog.done !== true) { console.log("✗ relogged entry wrong", relog); failures++; } else console.log("✓ re-logged entry back to pending review");

  // --- locked day -----------------------------------------------------------------
  await as(null);
  await q(`insert into challenges (id, name, start_date, end_date) values ('00000000-0000-0000-0000-000000000801','Old','2026-08-01','2026-08-31')`);
  const old = (await q(`insert into rules (challenge_id, title) values ('00000000-0000-0000-0000-000000000801','x') returning id`)).rows[0];
  await as(ERIN);
  await check("locked day rejected", () => q("select save_entry($1, '2026-08-10', true, '')", [old.id]), "locked");
  await check("photo on locked day rejected", () => q("select add_photo($1, '2026-08-10', $2, null)", [old.id, `${ERIN}/a.jpg`]), "locked");

  // --- weekly rule: no immediate point ----------------------------------------------
  await check("workout not done creates no point", async () => {
    await q("select save_entry($1, $2, false, '')", [workout.id, date]);
    const n = (await q("select count(*)::int as n from points where rule_id=$1", [workout.id])).rows[0].n;
    if (n !== 0) throw new Error("weekly rule created a point");
  });

  // --- RLS sanity: authenticated role cannot write entries directly ----------------
  await check("direct entry insert blocked by RLS", async () => {
    await q("set role authenticated");
    try { await q(`insert into entries (user_id, rule_id, date, done) values ($1,$2,$3,true)`, [ERIN, steps.id, date]); }
    finally { await q("reset role"); }
  }, "permission denied");
  await check("direct point update blocked", async () => {
    await q("set role authenticated");
    try {
      const r = await q(`update points set forgiven = true where user_id=$1 returning id`, [ERIN]);
      if (r.rows.length) throw new Error("update went through");
    } finally { await q("reset role"); }
  }, "permission denied");
  await check("anon cannot execute save_entry", async () => {
    await q("set role anon");
    try { await q("select save_entry($1, $2, true, '')", [bed.id, date]); } finally { await q("reset role"); }
  }, "permission denied");

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASSED");
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
