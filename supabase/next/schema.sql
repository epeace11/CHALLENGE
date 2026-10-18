-- The Challenge for any couple: the fresh-install script for the new schema (prod-challenge branch).
-- Run once in the PROD CHALLENGE project's SQL editor. It never touches the old challenge_* tables,
-- which can stay alongside it. tests/next-database.mjs runs this file on PGlite.
--
-- Every row belongs to a challenge (or to a couple). Reads go through row-level security with
-- nx_in_challenge() / nx_in_couple(); every write is a security-definer function below that checks
-- membership first and takes that challenge's own lock.
begin;

/* ── Clock ─────────────────────────────────────────────────────────────── */

-- now(), unless a test has set nx.now. Clients cannot set it: set_config is not exposed by the API.
create function public.nx_now() returns timestamptz language sql stable as $$
  select coalesce(nullif(current_setting('nx.now', true), '')::timestamptz, now())
$$;

/* ── People and couples ────────────────────────────────────────────────── */

create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  hue integer not null default 265 check (hue between 0 and 360),
  created_at timestamptz not null default now()
);

-- Two accounts that play together. A couple with one member is waiting on its invite.
create table public.couples(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.couple_members(
  couple_id uuid not null references public.couples on delete cascade,
  person_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, person_id)
);
create index couple_members_person on public.couple_members(person_id);

/* ── Challenges and rules ──────────────────────────────────────────────── */

create table public.challenges(
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  look text not null default 'classic' check (look in ('classic','seventy-five','sleep','dry','fitness')),
  theme text,
  start_date date not null,
  days integer not null check (days between 1 and 366),
  time_zone text not null,
  deadline_days integer not null default 1 check (deadline_days between 0 and 3),
  deadline_time time not null default '23:59',
  step numeric(10,2) not null default 1 check (step > 0),
  cap numeric(10,2) check (cap is null or cap > 0),
  week_start integer not null default 1 check (week_start between 0 and 6),
  -- draft: being set up. invited: waiting on the partner's account. signing: both in, pact open.
  -- running: both signed. finished: the last day's deadline has passed.
  status text not null default 'draft' check (status in ('draft','invited','signing','running','finished')),
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);
create index challenges_couple on public.challenges(couple_id);

create table public.rules(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  position integer not null default 0,
  title text not null check (length(trim(title)) between 1 and 80),
  question text not null check (length(trim(question)) between 1 and 160),
  description text not null default '',
  rule_group text not null default 'Mind',
  kind text not null check (kind in ('yesno','number','weekly')),
  days integer[] not null check (cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]),
  weekly_target integer check (weekly_target between 1 and 7),
  target_op text check (target_op in ('>=','<=')),
  target_value numeric,
  target_unit text,
  -- null for both people, or the one person who has it. for_invitee: the partner's own rule, set
  -- before they joined; accepting the invite makes them its `who`.
  who uuid references public.profiles,
  for_invitee boolean not null default false,
  proof text not null default 'none' check (proof in ('none','optional','required')),
  starts_on date,
  ends_on date,
  check (kind <> 'weekly' or weekly_target is not null),
  check (kind <> 'number' or (target_op is not null and target_value is not null))
);
create index rules_challenge on public.rules(challenge_id, position);

-- Both people sign before Day 1. Changing the rules clears the signatures.
create table public.signatures(
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles on delete cascade,
  signed_at timestamptz not null default now(),
  primary key (challenge_id, person_id)
);

-- A one-time link for the partner. Only its SHA-256 is stored; the code is a short form to type.
create table public.invites(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  from_id uuid not null references public.profiles,
  to_name text not null default '',
  to_email text not null default '',
  token_hash text not null unique,
  code text not null unique,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles,
  expires_at timestamptz not null
);
create index invites_challenge on public.invites(challenge_id);

/* ── Playing ───────────────────────────────────────────────────────────── */

-- One person's answer to one rule on one day. Proofs are [{path, takenAt}] in the proofs bucket.
-- correction_* is a late answer waiting on the partner.
create table public.entries(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles,
  rule_id uuid not null references public.rules on delete cascade,
  day date not null,
  done boolean,
  value numeric,
  status text not null check (status in ('pending','confirmed','missed','disputed','excused','conceded','unlogged')),
  note text not null default '',
  proofs jsonb not null default '[]',
  logged_at timestamptz,
  correction_done boolean,
  correction_value numeric,
  correction_note text,
  correction_proofs jsonb,
  correction_at timestamptz,
  unique (person_id, rule_id, day)
);
create index entries_challenge on public.entries(challenge_id, day);

-- A miss. Weekly shortfalls take slots 1…target on the week's last day; everything else is slot 0.
create table public.points(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles,
  rule_id uuid not null references public.rules on delete cascade,
  day date not null,
  reason text not null check (reason in ('missed','unlogged','conceded','weekly')),
  entry_id uuid references public.entries on delete set null,
  slot integer not null default 0,
  forgiven boolean not null default false,
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  unique (person_id, rule_id, day, slot)
);
create index points_challenge on public.points(challenge_id);

create table public.forgiveness_requests(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  point_id uuid not null references public.points on delete cascade,
  from_id uuid not null references public.profiles,
  reason text not null check (length(trim(reason)) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index forgiveness_one_pending on public.forgiveness_requests(point_id) where status = 'pending';
create index forgiveness_challenge on public.forgiveness_requests(challenge_id);

create table public.disputes(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  entry_id uuid not null references public.entries on delete cascade,
  raised_by uuid not null references public.profiles,
  comment text not null check (length(trim(comment)) between 1 and 2000),
  reply text,
  status text not null default 'open' check (status in ('open','conceded','withdrawn')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index disputes_one_open on public.disputes(entry_id) where status = 'open';
create index disputes_challenge on public.disputes(challenge_id);

create table public.journal_notes(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles,
  day date not null,
  text text not null check (length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index journal_notes_challenge on public.journal_notes(challenge_id, day);

-- A named copy of a challenge's rules and settings, owned by the couple. Never answers or points.
create table public.saved_challenges(
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  look text not null default 'classic',
  days integer not null,
  step numeric(10,2) not null,
  cap numeric(10,2),
  rules jsonb not null default '[]',
  link_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  link_on boolean not null default false,
  created_at timestamptz not null default now()
);
create index saved_challenges_couple on public.saved_challenges(couple_id);

/* ── Membership ────────────────────────────────────────────────────────── */

create function public.nx_in_couple(p_couple uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from couple_members where couple_id = p_couple and person_id = auth.uid())
$$;

create function public.nx_in_challenge(p_challenge uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from challenges c join couple_members m on m.couple_id = c.couple_id
    where c.id = p_challenge and m.person_id = auth.uid())
$$;

-- People who share a couple with the viewer (the viewer included).
create function public.nx_knows(p_person uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_person = auth.uid() or exists(
    select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
    where a.person_id = auth.uid() and b.person_id = p_person)
$$;

-- Checks the viewer is in the challenge, takes its lock, and returns it.
create function public.nx_enter(p_challenge uuid) returns public.challenges language plpgsql security definer set search_path = public as $$
declare c challenges;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not nx_in_challenge(p_challenge) then raise exception 'This challenge isn''t yours.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_challenge::text, 0));
  select * into c from challenges where id = p_challenge;
  return c;
end $$;

-- The other member of the challenge's couple, or null before the invite is accepted.
create function public.nx_partner(p_challenge uuid, p_person uuid) returns uuid language sql stable security definer set search_path = public as $$
  select m.person_id from challenges c join couple_members m on m.couple_id = c.couple_id
  where c.id = p_challenge and m.person_id <> p_person limit 1
$$;

/* ── Dates ─────────────────────────────────────────────────────────────── */

create function public.nx_last_day(c public.challenges) returns date language sql immutable as $$
  select c.start_date + c.days - 1
$$;

-- When logging for `day` closes: deadline_time, deadline_days later, in the challenge's time zone.
create function public.nx_lock_time(c public.challenges, p_day date) returns timestamptz language sql stable as $$
  select ((p_day + c.deadline_days) + c.deadline_time) at time zone c.time_zone
$$;

create function public.nx_today(c public.challenges) returns date language sql stable as $$
  select (nx_now() at time zone c.time_zone)::date
$$;

-- True when the rule asks something on `day` (its weekday, inside its dates and the challenge's).
create function public.nx_applies(c public.challenges, r public.rules, p_day date) returns boolean language sql stable as $$
  select p_day between greatest(c.start_date, coalesce(r.starts_on, c.start_date))
                   and least(nx_last_day(c), coalesce(r.ends_on, nx_last_day(c)))
     and extract(dow from p_day)::integer = any(r.days)
$$;

create function public.nx_rule_for(r public.rules, p_person uuid) returns boolean language sql stable as $$
  select r.who is null or r.who = p_person
$$;

-- A weekly rule's target in the week [p_from, p_to] (already clipped to the challenge): the full target
-- for a full week, otherwise its share of the days the rule applies, rounded down. Matches weekTarget().
create function public.nx_week_target(c public.challenges, r public.rules, p_from date, p_to date) returns integer language sql stable as $$
  select case when n >= cardinality(r.days) then r.weekly_target
              else floor(r.weekly_target * n / cardinality(r.days))::integer end
  from (select count(*)::integer n from generate_series(p_from, p_to, interval '1 day') d where nx_applies(c, r, d::date)) x
$$;

/* ── Deadlines: unlogged misses, weekly shortfalls, auto-approval ──────── */

-- Idempotent. Runs before every write and on every load (nx_sync), and hourly if pg_cron is set up.
create function public.nx_tick(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges; wr rules; mem record; wk record; visits integer; target integer; i integer; last_closed date;
begin
  select * into c from challenges where id = p_challenge;
  if c.id is null or c.status not in ('running','finished') then return; end if;
  -- The latest day whose deadline has passed.
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);

  -- Unlogged misses: every closed day a daily rule applied and nothing was logged.
  if last_closed >= c.start_date then
    insert into entries(challenge_id, person_id, rule_id, day, done, status)
    select c.id, m.person_id, r.id, d::date, null, 'unlogged'
    from rules r
    join couple_members m on m.couple_id = c.couple_id and (r.who is null or r.who = m.person_id)
    cross join generate_series(c.start_date, last_closed, interval '1 day') d
    where r.challenge_id = c.id and r.kind <> 'weekly' and nx_applies(c, r, d::date)
    on conflict (person_id, rule_id, day) do nothing;

    insert into points(challenge_id, person_id, rule_id, day, reason, entry_id)
    select e.challenge_id, e.person_id, e.rule_id, e.day, 'unlogged', e.id
    from entries e join rules r on r.id = e.rule_id
    where e.challenge_id = c.id and e.status = 'unlogged' and r.kind <> 'weekly' and e.day <= last_closed
    on conflict (person_id, rule_id, day, slot) do nothing;
  end if;

  -- Weekly shortfalls, once a week's last day has closed: one point per visit short of the target.
  for wr in select * from rules where challenge_id = c.id and kind = 'weekly' loop
    for wk in
      with s as (
        select d::date ws from generate_series(c.start_date, nx_last_day(c), interval '1 day') d
        where d::date = c.start_date or extract(dow from d)::integer = c.week_start)
      select ws, least(nx_last_day(c), coalesce(
        (select min(s2.ws) - 1 from s s2 where s2.ws > s.ws), nx_last_day(c))) we
      from s
    loop
      continue when wk.we > last_closed;
      target := nx_week_target(c, wr, wk.ws, wk.we);
      for mem in select person_id from couple_members where couple_id = c.couple_id and (wr.who is null or wr.who = person_id) loop
        select count(*) into visits from entries
        where person_id = mem.person_id and rule_id = wr.id and day between wk.ws and wk.we
          and done is true and status in ('confirmed','pending','disputed');
        for i in 1..coalesce(target, 0) loop
          insert into points(challenge_id, person_id, rule_id, day, reason, slot, voided)
          values (c.id, mem.person_id, wr.id, wk.we, 'weekly', i, i > greatest(0, target - visits))
          on conflict (person_id, rule_id, day, slot) do update set voided = excluded.voided
          where points.voided is distinct from excluded.voided;
        end loop;
      end loop;
    end loop;
  end loop;

  -- Answers nobody reviewed in 48 hours count as approved.
  update entries set status = 'confirmed'
  where challenge_id = c.id and status = 'pending' and correction_at is null and logged_at <= nx_now() - interval '48 hours';

  if c.status = 'running' and nx_now() > nx_lock_time(c, nx_last_day(c)) then
    update challenges set status = 'finished' where id = c.id;
  end if;
end $$;

create function public.nx_sync(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform nx_enter(p_challenge);
  perform nx_tick(p_challenge);
end $$;

-- Every challenge, for pg_cron: select cron.schedule('nx-hourly', '0 * * * *', 'select public.nx_tick_all()');
create function public.nx_tick_all() returns void language plpgsql security definer set search_path = public as $$
declare c record;
begin
  for c in select id from challenges where status = 'running' loop
    perform pg_advisory_xact_lock(hashtextextended(c.id::text, 0));
    perform nx_tick(c.id);
  end loop;
end $$;

/* ── Accounts ──────────────────────────────────────────────────────────── */

-- Called after sign-up and on every sign-in: makes or renames the viewer's profile.
create function public.nx_set_name(p_name text) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Add your first name.'; end if;
  if length(trim(p_name)) > 40 then raise exception 'Keep your name under 40 characters.'; end if;
  insert into profiles(id, name, hue) values (auth.uid(), trim(p_name), abs(hashtext(auth.uid()::text)) % 360)
  on conflict (id) do update set name = excluded.name;
end $$;

/* ── Setting up ────────────────────────────────────────────────────────── */

-- Replaces a challenge's rules from a JSON array of Rule objects (lib/next/model.ts). `who` is
-- 'both', 'me' (the caller), 'partner', or a member's id.
create function public.nx_put_rules(c public.challenges, p_rules jsonb) returns void language plpgsql security definer set search_path = public as $$
declare x jsonb; i integer := 0; who uuid; partner uuid := nx_partner(c.id, auth.uid());
begin
  if jsonb_typeof(p_rules) <> 'array' then raise exception 'Rules must be a list.'; end if;
  if jsonb_array_length(p_rules) > 20 then raise exception 'Keep it to 20 rules or fewer.'; end if;
  delete from rules where challenge_id = c.id;
  for x in select * from jsonb_array_elements(p_rules) loop
    who := case
      when coalesce(x->>'who', 'both') = 'both' then null
      when x->>'who' = 'me' then auth.uid()
      when x->>'who' = 'partner' then partner
      when exists(select 1 from couple_members where couple_id = c.couple_id and person_id::text = x->>'who') then (x->>'who')::uuid
      else null end;
    insert into rules(challenge_id, position, title, question, description, rule_group, kind, days, weekly_target,
                      target_op, target_value, target_unit, who, for_invitee, proof, starts_on, ends_on)
    values (c.id, i, trim(x->>'title'), trim(x->>'question'), coalesce(x->>'description', ''),
            coalesce(x->>'group', 'Mind'), x->>'kind',
            array(select jsonb_array_elements_text(x->'days')::integer),
            (x->>'weeklyTarget')::integer,
            x->'target'->>'op', (x->'target'->>'value')::numeric, x->'target'->>'unit',
            who, x->>'who' = 'partner' and partner is null, coalesce(x->>'proof', 'none'), (x->>'startsOn')::date, (x->>'endsOn')::date);
    i := i + 1;
  end loop;
end $$;

-- Starts a challenge in draft: makes the viewer's couple on their first one. Returns its id.
create function public.nx_create_challenge(p_name text, p_look text, p_theme text, p_start date, p_days integer,
  p_time_zone text, p_step numeric, p_cap numeric, p_rules jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare couple uuid; c challenges;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if not exists(select 1 from pg_timezone_names where name = p_time_zone) then raise exception 'Unknown time zone.'; end if;
  select couple_id into couple from couple_members where person_id = auth.uid() order by joined_at limit 1;
  if couple is null then
    insert into couples default values returning id into couple;
    insert into couple_members(couple_id, person_id) values (couple, auth.uid());
  end if;
  insert into challenges(couple_id, name, look, theme, start_date, days, time_zone, step, cap, created_by)
  values (couple, trim(p_name), coalesce(p_look, 'classic'), p_theme, p_start, p_days, p_time_zone, coalesce(p_step, 1), p_cap, auth.uid())
  returning * into c;
  perform nx_put_rules(c, coalesce(p_rules, '[]'));
  return c.id;
end $$;

-- Changes a challenge before Day 1. Any change clears both signatures. Null leaves a field as it is.
create function public.nx_update_challenge(p_challenge uuid, p_name text default null, p_look text default null,
  p_start date default null, p_days integer default null, p_time_zone text default null, p_step numeric default null,
  p_cap numeric default null, p_clear_cap boolean default false, p_deadline_days integer default null,
  p_deadline_time time default null, p_week_start integer default null, p_rules jsonb default null)
  returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  -- Name and look can change at any time; everything else only before Day 1.
  if c.status in ('running','finished') and (p_start is not null or p_days is not null or p_time_zone is not null
     or p_step is not null or p_cap is not null or p_clear_cap or p_deadline_days is not null or p_deadline_time is not null
     or p_week_start is not null or p_rules is not null) then
    raise exception 'The rules are set once you''ve both signed.';
  end if;
  if p_time_zone is not null and not exists(select 1 from pg_timezone_names where name = p_time_zone) then
    raise exception 'Unknown time zone.';
  end if;
  update challenges set
    name = coalesce(nullif(trim(p_name), ''), name),
    look = coalesce(p_look, look),
    start_date = coalesce(p_start, start_date),
    days = coalesce(p_days, days),
    time_zone = coalesce(p_time_zone, time_zone),
    step = coalesce(p_step, step),
    cap = case when p_clear_cap then null else coalesce(p_cap, cap) end,
    deadline_days = coalesce(p_deadline_days, deadline_days),
    deadline_time = coalesce(p_deadline_time, deadline_time),
    week_start = coalesce(p_week_start, week_start)
  where id = c.id returning * into c;
  if p_rules is not null then perform nx_put_rules(c, p_rules); end if;
  if c.status in ('invited','signing') and (p_start is not null or p_days is not null or p_step is not null
     or p_cap is not null or p_clear_cap or p_rules is not null or p_deadline_days is not null or p_deadline_time is not null) then
    delete from signatures where challenge_id = c.id;
  end if;
end $$;

-- Setup is done: the viewer signs, and the partner is invited (or, if already in the couple, asked to sign).
create function public.nx_finish_setup(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status not in ('draft','invited','signing') then raise exception 'This challenge has started.'; end if;
  if not exists(select 1 from rules where challenge_id = c.id) then raise exception 'Add at least one rule.'; end if;
  if c.status = 'draft' then
    update challenges set status = case when nx_partner(c.id, auth.uid()) is null then 'invited' else 'signing' end where id = c.id;
  end if;
  perform nx_sign_pact(c.id);
end $$;

-- Makes (or remakes) the invite link. Returns the token once; only its hash is kept.
create function public.nx_create_invite(p_challenge uuid, p_to_name text default '', p_to_email text default '')
  returns table(token text, code text) language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); t text := replace(gen_random_uuid()::text, '-', ''); k text;
begin
  if nx_partner(c.id, auth.uid()) is not null then raise exception 'Your partner is already in.'; end if;
  if c.status not in ('draft','invited') then raise exception 'This challenge has started.'; end if;
  loop
    k := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists(select 1 from invites i where i.code = k);
  end loop;
  delete from invites i where i.challenge_id = c.id and i.accepted_at is null;
  insert into invites(challenge_id, from_id, to_name, to_email, token_hash, code, expires_at)
  values (c.id, auth.uid(), left(trim(coalesce(p_to_name, '')), 40), left(trim(coalesce(p_to_email, '')), 200),
          encode(sha256(convert_to(t, 'UTF8')), 'hex'), k, nx_now() + interval '7 days');
  return query select t, k;
end $$;

create function public.nx_find_invite(p_token text) returns public.invites language sql stable security definer set search_path = public as $$
  select * from invites
  where (token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') or code = upper(trim(p_token)))
    and accepted_at is null and expires_at > nx_now()
  limit 1
$$;

-- What the invite page shows before the partner has an account: who invited them and the challenge.
create function public.nx_invite_preview(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare i invites := nx_find_invite(p_token); c challenges;
begin
  if i.id is null then return null; end if;
  update invites set opened_at = coalesce(opened_at, nx_now()) where id = i.id;
  select * into c from challenges where id = i.challenge_id;
  return jsonb_build_object(
    'from', (select jsonb_build_object('id', id, 'name', name, 'hue', hue) from profiles where id = i.from_id),
    'toName', i.to_name,
    'challenge', to_jsonb(c) - 'couple_id' - 'created_by',
    'rules', coalesce((select jsonb_agg(to_jsonb(r) - 'challenge_id' order by r.position) from rules r where r.challenge_id = c.id), '[]'));
end $$;

-- The partner joins the couple and the pact opens.
create function public.nx_accept_invite(p_token text) returns uuid language plpgsql security definer set search_path = public as $$
declare i invites := nx_find_invite(p_token); c challenges;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if i.id is null then raise exception 'This invite has expired or was already used. Ask for a new link.'; end if;
  if i.from_id = auth.uid() then raise exception 'This is your own invite. Send it to your partner.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(i.challenge_id::text, 0));
  select * into c from challenges where id = i.challenge_id;
  if (select count(*) from couple_members where couple_id = c.couple_id) >= 2 then raise exception 'This challenge already has two people.'; end if;
  insert into couple_members(couple_id, person_id) values (c.couple_id, auth.uid()) on conflict do nothing;
  update invites set accepted_at = nx_now(), accepted_by = auth.uid() where id = i.id;
  update rules set who = auth.uid(), for_invitee = false where challenge_id = c.id and for_invitee;
  update challenges set status = 'signing' where id = c.id and status in ('draft','invited');
  return c.id;
end $$;

-- Signs the pact. Once both have signed, the challenge is running.
create function public.nx_sign_pact(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status not in ('invited','signing') then raise exception 'There''s nothing to sign right now.'; end if;
  insert into signatures(challenge_id, person_id) values (c.id, auth.uid()) on conflict do nothing;
  if c.status = 'signing' and (select count(*) from signatures where challenge_id = c.id) = 2 then
    update challenges set status = 'running' where id = c.id;
  end if;
end $$;

/* ── Checking in ───────────────────────────────────────────────────────── */

create function public.nx_meets(r public.rules, p_value numeric) returns boolean language sql immutable as $$
  select case r.target_op when '>=' then p_value >= r.target_value when '<=' then p_value <= r.target_value else false end
$$;

-- Proofs must be the caller's own uploads in this challenge's folder: [{path, takenAt}], at most six.
create function public.nx_check_proofs(c public.challenges, p_proofs jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare x jsonb;
begin
  if p_proofs is null or jsonb_typeof(p_proofs) <> 'array' then return '[]'; end if;
  if jsonb_array_length(p_proofs) > 6 then raise exception 'Attach at most six screenshots.'; end if;
  for x in select * from jsonb_array_elements(p_proofs) loop
    if not exists(select 1 from storage.objects where bucket_id = 'proofs' and name = x->>'path'
                  and name like c.id::text || '/' || auth.uid()::text || '/%') then
      raise exception 'A screenshot didn''t upload. Try adding it again.';
    end if;
  end loop;
  return (select coalesce(jsonb_agg(jsonb_build_object('path', y->>'path', 'takenAt', y->>'takenAt')), '[]') from jsonb_array_elements(p_proofs) y);
end $$;

-- Voids an entry's active point and drops a pending forgiveness request on it (the answer changed).
create function public.nx_void_point_of(p_entry uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from forgiveness_requests where status = 'pending'
    and point_id in (select id from points where entry_id = p_entry and not voided and not forgiven);
  update points set voided = true where entry_id = p_entry and not voided and not forgiven;
end $$;

-- A point for an entry's miss (slot 0), new or brought back, priced as the newest.
create function public.nx_add_point(e public.entries, p_reason text) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  insert into points(challenge_id, person_id, rule_id, day, reason, entry_id)
  values (e.challenge_id, e.person_id, e.rule_id, e.day, p_reason, e.id)
  on conflict (person_id, rule_id, day, slot) do update
    set reason = excluded.reason, entry_id = excluded.entry_id, voided = false, forgiven = false, created_at = nx_now()
  returning id into pid;
  return pid;
end $$;

-- One whole check-in, like saveCheckin() in lib/next/actions.ts. Before the deadline it is the answer;
-- after it, a late answer the partner has to approve.
create function public.nx_save_checkin(p_challenge uuid, p_rule uuid, p_day date, p_done boolean default null,
  p_value numeric default null, p_note text default '', p_proofs jsonb default '[]', p_forgiveness text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); r rules; e entries; v_done boolean; v_proofs jsonb; v_note text := left(coalesce(p_note, ''), 2000);
  ask text := nullif(trim(coalesce(p_forgiveness, '')), ''); pid uuid;
begin
  perform nx_tick(c.id);
  select * into c from challenges where id = c.id;
  if c.status not in ('running','finished') then raise exception 'The challenge hasn''t started yet.'; end if;
  select * into r from rules where id = p_rule and challenge_id = c.id;
  if r.id is null or not nx_rule_for(r, auth.uid()) or not nx_applies(c, r, p_day) then raise exception 'That rule isn''t asked on that day.'; end if;
  if p_day >= nx_today(c) then raise exception 'You can log a day once it''s over.'; end if;
  v_done := case when r.kind = 'number' then p_value is not null and nx_meets(r, p_value) else coalesce(p_done, false) end;
  if r.kind = 'number' and p_value is null then raise exception 'Enter a number first.'; end if;
  v_proofs := nx_check_proofs(c, p_proofs);
  if v_done and r.proof = 'required' and jsonb_array_length(v_proofs) = 0 then raise exception 'Attach a screenshot first.'; end if;
  if ask is not null and v_done then raise exception 'Forgiveness can only be asked for with a No.'; end if;
  select * into e from entries where person_id = auth.uid() and rule_id = r.id and day = p_day;
  if e.status = 'disputed' then raise exception 'Answer the dispute on this first.'; end if;

  if nx_now() > nx_lock_time(c, p_day) then
    if e.id is null then
      insert into entries(challenge_id, person_id, rule_id, day, done, status)
      values (c.id, auth.uid(), r.id, p_day, null, 'unlogged') returning * into e;
    end if;
    update entries set correction_done = v_done, correction_value = case when r.kind = 'number' then p_value end,
      correction_note = v_note, correction_proofs = v_proofs, correction_at = nx_now() where id = e.id;
    return;
  end if;

  if e.id is not null then perform nx_void_point_of(e.id); end if;
  insert into entries(challenge_id, person_id, rule_id, day, done, value, status, note, proofs, logged_at)
  values (c.id, auth.uid(), r.id, p_day, v_done, case when r.kind = 'number' then p_value end,
          case when v_done then 'pending' when r.kind = 'weekly' then 'confirmed' else 'missed' end, v_note, v_proofs, nx_now())
  on conflict (person_id, rule_id, day) do update set done = excluded.done, value = excluded.value, status = excluded.status,
    note = excluded.note, proofs = excluded.proofs, logged_at = excluded.logged_at,
    correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null
  returning * into e;
  if e.status = 'missed' then
    pid := nx_add_point(e, 'missed');
    if ask is not null then
      insert into forgiveness_requests(challenge_id, point_id, from_id, reason) values (c.id, pid, auth.uid(), left(ask, 2000));
    end if;
  end if;
  perform nx_tick(c.id);
end $$;

/* ── Reviewing ─────────────────────────────────────────────────────────── */

-- The partner reviews an answer: 'approve' (an answer or a late answer), 'reject' (a late answer), or 'dispute'.
create function public.nx_review(p_entry uuid, p_action text, p_comment text default '') returns void language plpgsql security definer set search_path = public as $$
declare e entries; c challenges; r rules; had boolean;
begin
  select * into e from entries where id = p_entry;
  if e.id is null then raise exception 'That answer is gone.'; end if;
  c := nx_enter(e.challenge_id);
  select * into e from entries where id = p_entry for update;
  if e.person_id = auth.uid() then raise exception 'Only your partner can review this.'; end if;
  select * into r from rules where id = e.rule_id;
  if p_action = 'approve' then
    if e.correction_at is null then
      if e.status <> 'pending' then raise exception 'This answer isn''t waiting on you.'; end if;
      update entries set status = 'confirmed' where id = e.id;
    else
      had := exists(select 1 from points where entry_id = e.id and not voided and not forgiven);
      update entries set done = correction_done, value = correction_value, note = coalesce(correction_note, ''),
        proofs = coalesce(correction_proofs, '[]'), logged_at = nx_now(),
        status = case when correction_done or r.kind = 'weekly' then 'confirmed' else 'missed' end,
        correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null
      where id = e.id returning * into e;
      if e.done and had then perform nx_void_point_of(e.id); end if;
      if not e.done and not had and e.status = 'missed' then perform nx_add_point(e, 'missed'); end if;
    end if;
  elsif p_action = 'reject' then
    if e.correction_at is null then raise exception 'There''s no late answer to turn down.'; end if;
    update entries set correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null where id = e.id;
  elsif p_action = 'dispute' then
    if length(trim(coalesce(p_comment, ''))) = 0 then raise exception 'Say what doesn''t look right.'; end if;
    if e.status not in ('pending','confirmed') or e.done is not true then raise exception 'Only a Yes can be disputed.'; end if;
    insert into disputes(challenge_id, entry_id, raised_by, comment) values (e.challenge_id, e.id, auth.uid(), left(trim(p_comment), 2000));
    update entries set status = 'disputed' where id = e.id;
  else
    raise exception 'Unknown review action.';
  end if;
  perform nx_tick(e.challenge_id);
end $$;

-- 'concede' or 'reply' (the answer's owner), or 'withdraw' (whoever raised it).
create function public.nx_resolve_dispute(p_dispute uuid, p_action text, p_text text default '') returns void language plpgsql security definer set search_path = public as $$
declare d disputes; e entries; r rules;
begin
  select * into d from disputes where id = p_dispute;
  if d.id is null then raise exception 'That dispute is gone.'; end if;
  perform nx_enter(d.challenge_id);
  select * into d from disputes where id = p_dispute for update;
  select * into e from entries where id = d.entry_id;
  select * into r from rules where id = e.rule_id;
  if d.status <> 'open' then raise exception 'This dispute is settled.'; end if;
  if p_action = 'concede' then
    if e.person_id <> auth.uid() then raise exception 'Only the person who answered can accept this.'; end if;
    update disputes set status = 'conceded', resolved_at = nx_now() where id = d.id;
    update entries set status = 'conceded' where id = e.id returning * into e;
    -- A weekly rule's conceded visit simply stops counting; the week's shortfall carries the point.
    if r.kind <> 'weekly' then perform nx_add_point(e, 'conceded'); end if;
  elsif p_action = 'withdraw' then
    if d.raised_by <> auth.uid() then raise exception 'Only the person who raised this can take it back.'; end if;
    update disputes set status = 'withdrawn', resolved_at = nx_now() where id = d.id;
    update entries set status = 'confirmed' where id = e.id;
  elsif p_action = 'reply' then
    if e.person_id <> auth.uid() then raise exception 'Only the person who answered can reply.'; end if;
    if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Write a reply first.'; end if;
    update disputes set reply = left(trim(p_text), 2000) where id = d.id;
  else
    raise exception 'Unknown dispute action.';
  end if;
  perform nx_tick(d.challenge_id);
end $$;

/* ── Forgiveness ───────────────────────────────────────────────────────── */

create function public.nx_forgive(p_point uuid) returns void language plpgsql security definer set search_path = public as $$
declare p points;
begin
  update points set forgiven = true where id = p_point returning * into p;
  if p.entry_id is not null then update entries set status = 'excused' where id = p.entry_id; end if;
end $$;

-- The point's owner asks their partner to forgive it.
create function public.nx_ask_forgiveness(p_point uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare p points;
begin
  select * into p from points where id = p_point;
  if p.id is null then raise exception 'That point is gone.'; end if;
  perform nx_enter(p.challenge_id);
  select * into p from points where id = p_point;
  if p.person_id <> auth.uid() then raise exception 'You can only ask about your own points.'; end if;
  if p.forgiven or p.voided then raise exception 'This point doesn''t count anymore.'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Say why it should be forgiven.'; end if;
  if exists(select 1 from forgiveness_requests where point_id = p.id and status = 'pending') then raise exception 'You''ve already asked.'; end if;
  insert into forgiveness_requests(challenge_id, point_id, from_id, reason) values (p.challenge_id, p.id, auth.uid(), left(trim(p_reason), 2000));
end $$;

-- The partner decides a forgiveness request.
create function public.nx_decide_forgiveness(p_request uuid, p_approve boolean) returns void language plpgsql security definer set search_path = public as $$
declare q forgiveness_requests;
begin
  select * into q from forgiveness_requests where id = p_request;
  if q.id is null then raise exception 'That request is gone.'; end if;
  perform nx_enter(q.challenge_id);
  select * into q from forgiveness_requests where id = p_request for update;
  if q.from_id = auth.uid() then raise exception 'Only your partner can decide this.'; end if;
  if q.status <> 'pending' then raise exception 'This was already decided.'; end if;
  update forgiveness_requests set status = case when p_approve then 'approved' else 'denied' end, decided_at = nx_now() where id = q.id;
  if p_approve then perform nx_forgive(q.point_id); end if;
end $$;

-- The partner forgives a point without being asked.
create function public.nx_forgive_point(p_point uuid) returns void language plpgsql security definer set search_path = public as $$
declare p points;
begin
  select * into p from points where id = p_point;
  if p.id is null then raise exception 'That point is gone.'; end if;
  perform nx_enter(p.challenge_id);
  select * into p from points where id = p_point for update;
  if p.person_id = auth.uid() then raise exception 'Only your partner can forgive your points.'; end if;
  if p.forgiven or p.voided then raise exception 'This point doesn''t count anymore.'; end if;
  update forgiveness_requests set status = 'approved', decided_at = nx_now() where point_id = p.id and status = 'pending';
  perform nx_forgive(p.id);
end $$;

/* ── Journal ───────────────────────────────────────────────────────────── */

create function public.nx_add_note(p_challenge uuid, p_day date, p_text text) returns uuid language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); n uuid;
begin
  if p_day not between c.start_date and nx_last_day(c) then raise exception 'That day is outside the challenge.'; end if;
  if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Write something first.'; end if;
  if length(p_text) > 4000 then raise exception 'Keep each note under 4,000 characters.'; end if;
  insert into journal_notes(challenge_id, person_id, day, text) values (c.id, auth.uid(), p_day, trim(p_text)) returning id into n;
  return n;
end $$;

create function public.nx_edit_note(p_note uuid, p_text text) returns void language plpgsql security definer set search_path = public as $$
declare n journal_notes;
begin
  select * into n from journal_notes where id = p_note;
  if n.id is null or n.person_id <> auth.uid() then raise exception 'You can only change your own notes.'; end if;
  perform nx_enter(n.challenge_id);
  if length(trim(coalesce(p_text, ''))) = 0 then
    delete from journal_notes where id = n.id;
  else
    if length(p_text) > 4000 then raise exception 'Keep each note under 4,000 characters.'; end if;
    update journal_notes set text = trim(p_text) where id = n.id;
  end if;
end $$;

create function public.nx_remove_note(p_note uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform nx_edit_note(p_note, '');
end $$;

/* ── Saved challenges ──────────────────────────────────────────────────── */

-- Saves a challenge's rules and settings under a name. Returns the saved challenge's id.
create function public.nx_save_challenge(p_challenge uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); s uuid;
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give it a name.'; end if;
  insert into saved_challenges(couple_id, name, look, days, step, cap, rules)
  values (c.couple_id, left(trim(p_name), 60), c.look, c.days, c.step, c.cap, coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'title', r.title, 'question', r.question, 'description', r.description, 'group', r.rule_group, 'kind', r.kind,
      'days', to_jsonb(r.days), 'weeklyTarget', r.weekly_target,
      'target', case when r.target_op is not null then jsonb_build_object('op', r.target_op, 'value', r.target_value, 'unit', coalesce(r.target_unit, '')) end,
      'who', case when r.for_invitee then 'partner' when r.who is null then 'both' when r.who = auth.uid() then 'me' else 'partner' end,
      'proof', r.proof)) order by r.position)
    from rules r where r.challenge_id = c.id), '[]'))
  returning id into s;
  return s;
end $$;

create function public.nx_set_share_link(p_saved uuid, p_on boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  update saved_challenges set link_on = p_on where id = p_saved and nx_in_couple(couple_id);
  if not found then raise exception 'That saved challenge isn''t yours.'; end if;
end $$;

/* ── Reads ─────────────────────────────────────────────────────────────── */

do $$ declare t text; begin
  foreach t in array array['profiles','couples','couple_members','challenges','rules','signatures','invites','entries','points',
                           'forgiveness_requests','disputes','journal_notes','saved_challenges'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
end $$;

create policy read_known on public.profiles for select to authenticated using (nx_knows(id));
create policy read_own on public.couples for select to authenticated using (nx_in_couple(id));
create policy read_own on public.couple_members for select to authenticated using (nx_in_couple(couple_id));
create policy read_own on public.challenges for select to authenticated using (nx_in_couple(couple_id));
create policy read_own on public.saved_challenges for select to authenticated using (nx_in_couple(couple_id));
do $$ declare t text; begin
  foreach t in array array['rules','signatures','invites','entries','points','forgiveness_requests','disputes','journal_notes'] loop
    execute format('create policy read_own on public.%I for select to authenticated using (nx_in_challenge(challenge_id))', t);
  end loop;
end $$;
-- The invite's hash stays private even to members.
revoke select on public.invites from authenticated;
grant select (id, challenge_id, from_id, to_name, to_email, code, sent_at, opened_at, accepted_at, expires_at) on public.invites to authenticated;

/* ── Function access ───────────────────────────────────────────────────── */

do $$ declare f text; begin
  -- Internal helpers: nobody calls these directly.
  foreach f in array array['nx_enter(uuid)','nx_partner(uuid,uuid)','nx_tick(uuid)','nx_tick_all()',
    'nx_put_rules(public.challenges,jsonb)','nx_find_invite(text)','nx_check_proofs(public.challenges,jsonb)',
    'nx_void_point_of(uuid)','nx_add_point(public.entries,text)','nx_forgive(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- What a signed-in person can call.
  foreach f in array array['nx_sync(uuid)','nx_set_name(text)',
    'nx_create_challenge(text,text,text,date,integer,text,numeric,numeric,jsonb)',
    'nx_update_challenge(uuid,text,text,date,integer,text,numeric,numeric,boolean,integer,time,integer,jsonb)',
    'nx_finish_setup(uuid)','nx_create_invite(uuid,text,text)','nx_accept_invite(text)','nx_sign_pact(uuid)',
    'nx_save_checkin(uuid,uuid,date,boolean,numeric,text,jsonb,text)','nx_review(uuid,text,text)',
    'nx_resolve_dispute(uuid,text,text)','nx_ask_forgiveness(uuid,text)','nx_decide_forgiveness(uuid,boolean)',
    'nx_forgive_point(uuid)','nx_add_note(uuid,date,text)','nx_edit_note(uuid,text)','nx_remove_note(uuid)',
    'nx_save_challenge(uuid,text)','nx_set_share_link(uuid,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Anyone with the link can see the invite before signing up.
grant execute on function public.nx_invite_preview(text) to anon, authenticated;
revoke all on function public.nx_tick_all() from public, anon, authenticated;
grant execute on function public.nx_tick_all() to service_role;

/* ── Screenshots ───────────────────────────────────────────────────────── */

-- Stored as <challenge id>/<person id>/<file>; only the challenge's two members can open them.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid));
create policy proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid)
              and (storage.foldername(name))[2] = auth.uid()::text);

/* ── Live updates ──────────────────────────────────────────────────────── */

do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['challenges','rules','signatures','couple_members','entries','points','forgiveness_requests','disputes','journal_notes'] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;

commit;
-- Optional: enable pg_cron in Database > Extensions, then run:
-- select cron.schedule('nx-hourly', '0 * * * *', 'select public.nx_tick_all()');
