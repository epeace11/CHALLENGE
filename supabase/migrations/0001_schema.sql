-- ============================================================================
-- Challenge Tracker — schema, row level security, and transition functions
-- ============================================================================
-- Two users (Erin and Kazzy) log daily habits, review each other's entries,
-- and accumulate escalating dollar penalties. Everything time-related is
-- computed in the challenge's timezone (America/Toronto by default).
--
-- Run this in the Supabase SQL editor (or `supabase db push`). Then run
-- seed.sql after the two auth users exist.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_slug as enum ('erin', 'kazzy');
create type rule_cadence as enum ('daily', 'weekly');
create type rule_applies_to as enum ('both', 'erin', 'kazzy');
create type entry_status as enum ('pending', 'confirmed', 'disputed', 'conceded', 'excused');
create type point_reason as enum ('missed', 'unlogged', 'weekly_shortfall', 'dispute_conceded');
create type request_status as enum ('pending', 'approved', 'denied');
create type dispute_status as enum ('open', 'conceded', 'withdrawn');
create type unlogged_policy as enum ('all_missed', 'flat_one');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  slug user_slug not null unique,
  display_name text not null
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date not null,
  timezone text not null default 'America/Toronto',
  log_deadline_time time not null default '12:00',
  dispute_window_hours integer not null default 48,
  unlogged_policy unlogged_policy not null default 'all_missed',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table rules (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references challenges (id) on delete cascade,
  sort_order integer not null default 0,
  title text not null,
  description text not null default '',
  cadence rule_cadence not null default 'daily',
  applies_to rule_applies_to not null default 'both',
  -- 0 = Sunday … 6 = Saturday. Daily rules only.
  active_days smallint[] not null default '{0,1,2,3,4,5,6}',
  weekly_target integer,
  proof_required boolean not null default false,
  check (cadence <> 'weekly' or weekly_target is not null)
);
create index rules_challenge_idx on rules (challenge_id, sort_order);

-- One row per user × rule × date. Used for both daily and weekly rules
-- (the spec's `weekly_logs` table is folded in here: the shape is identical
-- and it keeps photos, disputes and RLS to a single code path).
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  rule_id uuid not null references rules (id) on delete cascade,
  date date not null,
  -- null = placeholder (photo attached but not yet logged)
  done boolean,
  note text,
  status entry_status not null default 'pending',
  -- true when the noon lock created this row because nothing was logged
  unlogged boolean not null default false,
  -- set by an approved forgiveness on an unlogged point: editable until then
  reopen_until timestamptz,
  logged_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, rule_id, date)
);
create index entries_user_date_idx on entries (user_id, date);
create index entries_status_idx on entries (status) where status = 'pending';

create table photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries (id) on delete cascade,
  storage_path text not null unique,
  taken_at timestamptz,
  uploaded_at timestamptz not null default now()
);
create index photos_entry_idx on photos (entry_id);

create table points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  challenge_id uuid not null references challenges (id) on delete cascade,
  rule_id uuid not null references rules (id) on delete cascade,
  date date not null,
  reason point_reason not null,
  forgiven boolean not null default false,
  entry_id uuid references entries (id) on delete set null,
  created_at timestamptz not null default now()
);
create index points_user_idx on points (user_id, challenge_id, created_at);
create index points_entry_idx on points (entry_id);

create table forgiveness_requests (
  id uuid primary key default gen_random_uuid(),
  point_id uuid not null unique references points (id) on delete cascade,
  requester_id uuid not null references profiles (id) on delete cascade,
  reason text not null,
  status request_status not null default 'pending',
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries (id) on delete cascade,
  raised_by uuid not null references profiles (id) on delete cascade,
  comment text not null,
  status dispute_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index disputes_entry_idx on disputes (entry_id);

-- Bookkeeping for idempotent scheduled jobs.
create table day_locks (
  challenge_id uuid not null references challenges (id) on delete cascade,
  date date not null,
  locked_at timestamptz not null default now(),
  primary key (challenge_id, date)
);

create table weekly_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  rule_id uuid not null references rules (id) on delete cascade,
  period_end date not null,
  done_count integer not null,
  shortfall integer not null,
  assessed_at timestamptz not null default now(),
  unique (user_id, rule_id, period_end)
);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger entries_updated_at before update on entries
  for each row execute function set_updated_at();

-- Who is the current user, as a profile row.
create or replace function current_profile() returns profiles
language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;

-- The instant a given day locks for a challenge (deadline time on the
-- following day, in the challenge timezone).
create or replace function lock_at(p_challenge_id uuid, p_date date) returns timestamptz
language sql stable security definer set search_path = public as $$
  select ((p_date + 1) + c.log_deadline_time) at time zone c.timezone
  from challenges c where c.id = p_challenge_id;
$$;

-- Can the given entry (rule/date) still be edited by its owner?
create or replace function entry_editable(p_rule_id uuid, p_date date, p_reopen_until timestamptz)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    now() < lock_at(r.challenge_id, p_date)
    or (p_reopen_until is not null and now() < p_reopen_until)
  from rules r where r.id = p_rule_id;
$$;

-- Does a rule apply to a user on a date?
create or replace function rule_applies(p_rule rules, p_slug user_slug, p_date date) returns boolean
language sql immutable as $$
  select (p_rule.applies_to = 'both' or p_rule.applies_to::text = p_slug::text)
     and (p_rule.cadence = 'weekly' or extract(dow from p_date)::smallint = any (p_rule.active_days));
$$;

-- ---------------------------------------------------------------------------
-- Transition functions (SECURITY DEFINER, all authorization checks inside)
-- ---------------------------------------------------------------------------

-- Save (upsert) one of the caller's own entries.
create or replace function save_entry(p_rule_id uuid, p_date date, p_done boolean, p_note text)
returns entries
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  r rules;
  c challenges;
  e entries;
  photo_count integer;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into r from rules where id = p_rule_id;
  if r.id is null then raise exception 'rule not found'; end if;
  select * into c from challenges where id = r.challenge_id;
  if p_date < c.start_date or p_date > c.end_date then raise exception 'date outside challenge'; end if;
  if not rule_applies(r, me.slug, p_date) then raise exception 'rule does not apply on this day'; end if;

  select * into e from entries where user_id = me.id and rule_id = p_rule_id and date = p_date;
  if not entry_editable(p_rule_id, p_date, e.reopen_until) then
    raise exception 'this day is locked';
  end if;

  if p_done and r.proof_required then
    select count(*) into photo_count from photos where entry_id = e.id;
    if coalesce(photo_count, 0) = 0 then raise exception 'a photo is required to mark this done'; end if;
  end if;

  if e.id is null then
    insert into entries (user_id, rule_id, date, done, note, status)
    values (me.id, p_rule_id, p_date, p_done, nullif(trim(p_note), ''),
            case when p_done then 'pending' else 'confirmed' end::entry_status)
    returning * into e;
  else
    -- changing the answer to "not done" settles any open dispute in the
    -- disputer's favour
    if not p_done then
      update disputes set status = 'conceded', resolved_at = now()
      where entry_id = e.id and status = 'open';
    end if;
    update entries set
      done = p_done,
      note = nullif(trim(p_note), ''),
      unlogged = false,
      status = case
        when not p_done then 'confirmed'
        when exists (select 1 from disputes where entry_id = e.id and status = 'open') then 'disputed'
        else 'pending' end::entry_status,
      logged_at = case when e.done is null then now() else e.logged_at end
    where id = e.id
    returning * into e;
  end if;

  -- Points for daily rules: a miss is a point right away; a done removes any
  -- unforgiven miss point created while the day was still open.
  if r.cadence = 'daily' then
    if p_done then
      delete from points where entry_id = e.id and reason in ('missed', 'unlogged') and not forgiven;
    else
      if not exists (select 1 from points where entry_id = e.id and not forgiven) then
        insert into points (user_id, challenge_id, rule_id, date, reason, entry_id)
        values (me.id, c.id, r.id, p_date, 'missed', e.id);
      end if;
    end if;
  end if;
  return e;
end $$;

-- Attach a photo (already uploaded to storage) to one of the caller's entries,
-- creating a placeholder entry if needed.
create or replace function add_photo(p_rule_id uuid, p_date date, p_storage_path text, p_taken_at timestamptz)
returns photos
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  r rules;
  c challenges;
  e entries;
  p photos;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  if split_part(p_storage_path, '/', 1) <> me.id::text then raise exception 'bad storage path'; end if;
  select * into r from rules where id = p_rule_id;
  if r.id is null then raise exception 'rule not found'; end if;
  select * into c from challenges where id = r.challenge_id;
  if p_date < c.start_date or p_date > c.end_date then raise exception 'date outside challenge'; end if;
  select * into e from entries where user_id = me.id and rule_id = p_rule_id and date = p_date;
  if not entry_editable(p_rule_id, p_date, e.reopen_until) then raise exception 'this day is locked'; end if;
  if e.id is null then
    insert into entries (user_id, rule_id, date, done, status) values (me.id, p_rule_id, p_date, null, 'pending')
    returning * into e;
  end if;
  insert into photos (entry_id, storage_path, taken_at) values (e.id, p_storage_path, p_taken_at)
  returning * into p;
  return p;
end $$;

-- Remove one of the caller's photos. Returns the storage path so the caller
-- can delete the object.
create or replace function remove_photo(p_photo_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  p photos;
  e entries;
  r rules;
  remaining integer;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into p from photos where id = p_photo_id;
  if p.id is null then raise exception 'photo not found'; end if;
  select * into e from entries where id = p.entry_id;
  if e.user_id <> me.id then raise exception 'not your photo'; end if;
  if not entry_editable(e.rule_id, e.date, e.reopen_until) then raise exception 'this day is locked'; end if;
  select * into r from rules where id = e.rule_id;
  select count(*) into remaining from photos where entry_id = e.id and id <> p.id;
  if r.proof_required and e.done and remaining = 0 then
    raise exception 'this rule needs a photo while it is marked done';
  end if;
  delete from photos where id = p.id;
  return p.storage_path;
end $$;

-- Partner approves a pending entry.
create or replace function approve_entry(p_entry_id uuid) returns entries
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  e entries;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into e from entries where id = p_entry_id;
  if e.id is null then raise exception 'entry not found'; end if;
  if e.user_id = me.id then raise exception 'you cannot review your own entry'; end if;
  if e.status <> 'pending' or e.done is distinct from true then raise exception 'entry is not awaiting review'; end if;
  update entries set status = 'confirmed' where id = e.id returning * into e;
  return e;
end $$;

-- Partner disputes a pending entry (comment required).
create or replace function dispute_entry(p_entry_id uuid, p_comment text) returns disputes
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  e entries;
  d disputes;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_comment), '') = '' then raise exception 'a comment is required'; end if;
  select * into e from entries where id = p_entry_id;
  if e.id is null then raise exception 'entry not found'; end if;
  if e.user_id = me.id then raise exception 'you cannot dispute your own entry'; end if;
  if e.status <> 'pending' or e.done is distinct from true then raise exception 'entry is not awaiting review'; end if;
  update entries set status = 'disputed' where id = e.id;
  insert into disputes (entry_id, raised_by, comment) values (e.id, me.id, trim(p_comment)) returning * into d;
  return d;
end $$;

-- Logger concedes an open dispute: entry conceded, point created.
create or replace function concede_dispute(p_dispute_id uuid) returns disputes
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  d disputes;
  e entries;
  r rules;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into d from disputes where id = p_dispute_id;
  if d.id is null or d.status <> 'open' then raise exception 'dispute is not open'; end if;
  select * into e from entries where id = d.entry_id;
  if e.user_id <> me.id then raise exception 'only the logger can concede'; end if;
  select * into r from rules where id = e.rule_id;
  update disputes set status = 'conceded', resolved_at = now() where id = d.id returning * into d;
  update entries set status = 'conceded' where id = e.id;
  -- weekly rules are scored at week close (a conceded entry just doesn't count)
  if r.cadence = 'daily' and not exists (select 1 from points where entry_id = e.id and not forgiven) then
    insert into points (user_id, challenge_id, rule_id, date, reason, entry_id)
    values (e.user_id, r.challenge_id, r.id, e.date, 'dispute_conceded', e.id);
  end if;
  return d;
end $$;

-- Disputer withdraws: entry confirmed.
create or replace function withdraw_dispute(p_dispute_id uuid) returns disputes
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  d disputes;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into d from disputes where id = p_dispute_id;
  if d.id is null or d.status <> 'open' then raise exception 'dispute is not open'; end if;
  if d.raised_by <> me.id then raise exception 'only the disputer can withdraw'; end if;
  update disputes set status = 'withdrawn', resolved_at = now() where id = d.id returning * into d;
  update entries set status = 'confirmed' where id = d.entry_id;
  return d;
end $$;

-- Owner of a point asks for forgiveness (one request per point).
create or replace function request_forgiveness(p_point_id uuid, p_reason text) returns forgiveness_requests
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  p points;
  fr forgiveness_requests;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'a reason is required'; end if;
  select * into p from points where id = p_point_id;
  if p.id is null then raise exception 'point not found'; end if;
  if p.user_id <> me.id then raise exception 'not your point'; end if;
  if p.forgiven then raise exception 'already forgiven'; end if;
  if exists (select 1 from forgiveness_requests where point_id = p.id) then
    raise exception 'forgiveness was already requested for this point';
  end if;
  insert into forgiveness_requests (point_id, requester_id, reason) values (p.id, me.id, trim(p_reason))
  returning * into fr;
  return fr;
end $$;

-- Partner approves or denies a forgiveness request.
create or replace function decide_forgiveness(p_request_id uuid, p_approve boolean) returns forgiveness_requests
language plpgsql security definer set search_path = public as $$
declare
  me profiles := current_profile();
  fr forgiveness_requests;
  p points;
begin
  if me.id is null then raise exception 'not signed in'; end if;
  select * into fr from forgiveness_requests where id = p_request_id;
  if fr.id is null or fr.status <> 'pending' then raise exception 'request is not pending'; end if;
  if fr.requester_id = me.id then raise exception 'you cannot decide your own request'; end if;
  update forgiveness_requests
    set status = case when p_approve then 'approved' else 'denied' end::request_status,
        decided_by = me.id, decided_at = now()
  where id = fr.id returning * into fr;
  if p_approve then
    select * into p from points where id = fr.point_id;
    update points set forgiven = true where id = p.id;
    if p.entry_id is not null then
      update entries set
        status = 'excused',
        -- an unlogged day gets 24 hours to be logged properly
        reopen_until = case when p.reason = 'unlogged' then now() + interval '24 hours' else reopen_until end
      where id = p.entry_id;
    end if;
  end if;
  return fr;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table challenges enable row level security;
alter table rules enable row level security;
alter table entries enable row level security;
alter table photos enable row level security;
alter table points enable row level security;
alter table forgiveness_requests enable row level security;
alter table disputes enable row level security;
alter table day_locks enable row level security;
alter table weekly_assessments enable row level security;

-- Both users can read everything (they review each other).
create policy "read profiles" on profiles for select to authenticated using (true);
create policy "read challenges" on challenges for select to authenticated using (true);
create policy "read rules" on rules for select to authenticated using (true);
create policy "read entries" on entries for select to authenticated using (true);
create policy "read photos" on photos for select to authenticated using (true);
create policy "read points" on points for select to authenticated using (true);
create policy "read forgiveness" on forgiveness_requests for select to authenticated using (true);
create policy "read disputes" on disputes for select to authenticated using (true);
create policy "read day_locks" on day_locks for select to authenticated using (true);
create policy "read weekly_assessments" on weekly_assessments for select to authenticated using (true);

-- Challenge/rule administration is open to both users (the "Settings" view).
create policy "manage challenges" on challenges for all to authenticated using (true) with check (true);
create policy "manage rules" on rules for all to authenticated using (true) with check (true);

-- All other writes go through the SECURITY DEFINER functions above, which
-- check ownership and lock state themselves. No direct insert/update/delete
-- policies exist for entries, photos, points, disputes or forgiveness.

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on challenges, rules to authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on function
  save_entry, add_photo, remove_photo, approve_entry, dispute_entry,
  concede_dispute, withdraw_dispute, request_forgiveness, decide_forgiveness,
  current_profile, lock_at, entry_editable
to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private "proofs" bucket, one folder per user
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "proofs read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs');
create policy "proofs upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
