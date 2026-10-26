-- Step 2 of bringing The Original into PROD CHALLENGE. Run this in PROD CHALLENGE, after
-- supabase/next/import-original.sql (which adds nx_import_original) and after the two have paired
-- with an invite, so the Original joins their couple as a finished challenge.
--
-- Before running: put the two new accounts' emails in the two lines marked EMAIL, and paste the
-- value from supabase/next/export-original.sql over the words between the two $original$ markers
-- (keep both markers).
-- The old rows are held in temporary tables that disappear when it finishes; nothing else is kept.
begin;

create temporary table original_blob on commit drop as select $original$PASTE HERE$original$::jsonb j;

create temporary table challenge_config(id integer, start_date date, end_date date) on commit drop;
create temporary table challenge_profiles(id uuid, name text) on commit drop;
create temporary table challenge_rules(id text, title text, person text, weeknights boolean, weekends boolean,
  weekly boolean, proof_required boolean, sundays boolean, starts date) on commit drop;
create temporary table challenge_entries(id uuid, user_id uuid, rule_id text, day date, done boolean, status text,
  note text, proof text, proposed_done boolean, proposed_note text, proposed_proof text, updated_at timestamptz) on commit drop;
create temporary table challenge_points(id uuid, user_id uuid, rule_id text, day date, reason text, forgiven boolean,
  voided boolean, entry_id uuid, slot integer, created_at timestamptz) on commit drop;
create temporary table challenge_requests(point_id uuid, requester_id uuid, reason text, status text,
  decided_at timestamptz) on commit drop;
create temporary table challenge_disputes(entry_id uuid, raised_by uuid, comment text, status text,
  created_at timestamptz, resolved_at timestamptz) on commit drop;
create temporary table challenge_journal_notes(user_id uuid, day date, text text, created_at timestamptz) on commit drop;

insert into challenge_config select * from jsonb_populate_record(null::challenge_config, (select j->'config' from original_blob));
insert into challenge_profiles select * from jsonb_populate_recordset(null::challenge_profiles, (select j->'profiles' from original_blob));
insert into challenge_rules select * from jsonb_populate_recordset(null::challenge_rules, (select j->'rules' from original_blob));
insert into challenge_entries select * from jsonb_populate_recordset(null::challenge_entries, (select j->'entries' from original_blob));
insert into challenge_points select * from jsonb_populate_recordset(null::challenge_points, (select j->'points' from original_blob));
insert into challenge_requests select * from jsonb_populate_recordset(null::challenge_requests, (select j->'requests' from original_blob));
insert into challenge_disputes select * from jsonb_populate_recordset(null::challenge_disputes, (select j->'disputes' from original_blob));
insert into challenge_journal_notes select * from jsonb_populate_recordset(null::challenge_journal_notes, (select j->'notes' from original_blob));

do $$
declare erin uuid; kazzy uuid;
begin
  select id into erin from auth.users where lower(email) = lower('ERIN-EMAIL');   -- EMAIL
  select id into kazzy from auth.users where lower(email) = lower('KAZZY-EMAIL'); -- EMAIL
  if erin is null or kazzy is null then raise exception 'No account with one of those emails. Check the two EMAIL lines.'; end if;
  raise notice 'The Original is challenge %', public.nx_import_original(erin, kazzy);
end $$;

commit;
