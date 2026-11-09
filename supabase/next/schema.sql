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
  -- Ending a running challenge early takes both: who asked, and when. The other accepts or declines.
  end_asked_by uuid references public.profiles,
  end_asked_at timestamptz,
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
  -- A number rule where each person sets their own target (a calorie limit): `limits` holds each
  -- one's value by person id, set when they sign; target_value is the suggestion until then.
  personal boolean not null default false,
  limits jsonb not null default '{}',
  -- A number rule counted in minutes (nx_can_time) with the timer on. Either person turns it on or off
  -- at any time (nx_set_timed); it changes how the minutes are counted, not what counts.
  timed boolean not null default false,
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
  -- Saved by itself from the day's timer sessions (nx_timer_log); an answer saved by hand clears it.
  from_timer boolean not null default false,
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

-- A timer someone has started on a timed rule and not stopped: one per person per challenge. Its time
-- is `banked` (seconds from stretches before a pause) plus, while running, nx_now() - running_since.
-- `day` is the day it started on, in the challenge's time zone: its session counts toward that day.
create table public.timer_runs(
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles,
  rule_id uuid not null references public.rules on delete cascade,
  day date not null,
  started_at timestamptz not null,
  running_since timestamptz,
  banked integer not null default 0 check (banked >= 0),
  primary key (challenge_id, person_id)
);

-- One stretch of timing, Start to Stop, with the seconds on the clock (pauses left out).
create table public.timer_sessions(
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles,
  rule_id uuid not null references public.rules on delete cascade,
  day date not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  seconds integer not null check (seconds > 0)
);
create index timer_sessions_challenge on public.timer_sessions(challenge_id, person_id, rule_id, day);

-- A named copy of a challenge's rules and settings, owned by the couple. Never answers or points.
create table public.saved_challenges(
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples on delete cascade,
  -- The challenge it was saved from, while that still exists. Its name can change; this can't.
  challenge_id uuid references public.challenges on delete set null,
  name text not null check (length(trim(name)) between 1 and 60),
  look text not null default 'classic',
  days integer not null,
  step numeric(10,2) not null,
  cap numeric(10,2),
  rules jsonb not null default '[]',
  link_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  link_on boolean not null default false,
  -- Whose 'me' the rules' who means; the other member is 'partner'.
  saved_by uuid references public.profiles on delete set null,
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

-- A rule the timer can time: a number rule counted in minutes ("min", "mins", "minute", "minutes"),
-- like canTime() in lib/next/selectors.ts.
create function public.nx_can_time(p_kind text, p_unit text) returns boolean language sql immutable as $$
  select coalesce(p_kind = 'number' and btrim(p_unit) ~* '^min(ute)?s?$', false)
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
declare c challenges; wr rules; mem record; wk record; visits integer; target integer; i integer; last_closed date; g record;
begin
  select * into c from challenges where id = p_challenge;
  if c.id is null or c.status not in ('running','finished') then return; end if;
  -- The latest day whose deadline has passed.
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);

  -- Timed days first, so one with sessions gets its answer instead of an unlogged miss: every day
  -- that can be logged, has sessions and no answer yet (none, or unlogged with no late answer
  -- waiting). nx_timer_log has the whole rule; an answer already there only changes at a Stop.
  if c.status = 'running' then
    for g in
      select distinct s.person_id, s.rule_id, s.day from timer_sessions s
      where s.challenge_id = c.id and (s.day < nx_today(c) or (s.day = nx_today(c) and c.deadline_days = 0))
        and not exists(select 1 from entries e where e.person_id = s.person_id and e.rule_id = s.rule_id and e.day = s.day
                       and (e.status <> 'unlogged' or e.correction_at is not null))
    loop
      perform nx_timer_log(c, g.person_id, g.rule_id, g.day);
    end loop;
  end if;

  -- Unlogged misses: every closed day a daily rule applied and nothing was logged. A day with a timer
  -- still going on that rule waits: its answer is saved when the timer stops.
  if last_closed >= c.start_date then
    insert into entries(challenge_id, person_id, rule_id, day, done, status)
    select c.id, m.person_id, r.id, d::date, null, 'unlogged'
    from rules r
    join couple_members m on m.couple_id = c.couple_id and (r.who is null or r.who = m.person_id)
    cross join generate_series(c.start_date, last_closed, interval '1 day') d
    where r.challenge_id = c.id and r.kind <> 'weekly' and nx_applies(c, r, d::date)
      and not exists(select 1 from timer_runs t
                     where t.challenge_id = c.id and t.person_id = m.person_id and t.rule_id = r.id and t.day = d::date)
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

  -- It's over once the last deadline has passed and nothing can still change the result: every
  -- dispute settled, every answer reviewed (48 hours at most, above), every timer stopped (a timer
  -- only starts on a day of the challenge, and its time still counts). Until then there's no verdict.
  if c.status = 'running' and nx_now() > nx_lock_time(c, nx_last_day(c))
     and not exists(select 1 from disputes where challenge_id = c.id and status = 'open')
     and not exists(select 1 from entries where challenge_id = c.id and status = 'pending' and correction_at is null)
     and not exists(select 1 from timer_runs where challenge_id = c.id) then
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
-- 'both', 'me' (the caller), 'partner', or a member's id. `timed` sticks only to a rule the timer can time.
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
                      target_op, target_value, target_unit, who, for_invitee, proof, starts_on, ends_on, personal, limits, timed)
    values (c.id, i, trim(x->>'title'), trim(x->>'question'), coalesce(x->>'description', ''),
            coalesce(x->>'group', 'Mind'), x->>'kind',
            array(select jsonb_array_elements_text(x->'days')::integer),
            (x->>'weeklyTarget')::integer,
            x->'target'->>'op', (x->'target'->>'value')::numeric, x->'target'->>'unit',
            who, x->>'who' = 'partner' and partner is null, coalesce(x->>'proof', 'none'), (x->>'startsOn')::date, (x->>'endsOn')::date,
            x->>'kind' = 'number' and coalesce((x->>'personalTarget')::boolean, false),
            -- Limits already set stay with the rule, for the couple's own members only.
            case when x->>'kind' = 'number' and coalesce((x->>'personalTarget')::boolean, false) then coalesce((
              select jsonb_object_agg(l.key, l.value) from jsonb_each(case when jsonb_typeof(x->'limits') = 'object' then x->'limits' else '{}' end) l
              where jsonb_typeof(l.value) = 'number' and (l.value #>> '{}')::numeric > 0
                and exists(select 1 from couple_members m where m.couple_id = c.couple_id and m.person_id::text = l.key)), '{}')
            else '{}' end,
            coalesce((x->>'timed')::boolean, false) and nx_can_time(x->>'kind', x->'target'->>'unit'));
    i := i + 1;
  end loop;
end $$;

-- Starts a challenge in draft. A person can have several at once, with the same partner or different
-- ones. p_couple: with that partner. p_new_partner: with someone new, so a couple of one until they
-- accept the invite. Neither: the couple joined most recently (a first one makes it). Returns its id.
create function public.nx_create_challenge(p_name text, p_look text, p_theme text, p_start date, p_days integer,
  p_time_zone text, p_step numeric, p_cap numeric, p_rules jsonb, p_couple uuid default null, p_new_partner boolean default false)
  returns uuid language plpgsql security definer set search_path = public as $$
declare couple uuid; c challenges;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if not exists(select 1 from pg_timezone_names where name = p_time_zone) then raise exception 'Unknown time zone.'; end if;
  if p_couple is not null then
    if not nx_in_couple(p_couple) then raise exception 'That couple isn''t yours.'; end if;
    couple := p_couple;
  elsif not coalesce(p_new_partner, false) then
    select couple_id into couple from couple_members where person_id = auth.uid() order by joined_at desc limit 1;
  end if;
  -- A couple of one with a challenge is waiting on that invite. Whoever accepts joins the couple and
  -- sees all of it, so another challenge gets a couple of its own.
  if (select count(*) from couple_members where couple_id = couple) = 1
     and exists(select 1 from challenges where couple_id = couple) then
    couple := null;
  end if;
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

-- Changes a challenge before Day 1. Any change to the terms clears both signatures. Null leaves a field as it is.
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
  if c.status in ('invited','signing') and (p_start is not null or p_days is not null or p_time_zone is not null or p_step is not null
     or p_cap is not null or p_clear_cap or p_rules is not null or p_deadline_days is not null or p_deadline_time is not null
     or p_week_start is not null) then
    delete from signatures where challenge_id = c.id;
  end if;
end $$;

-- Setup is done and the pact opens: the viewer reads it and signs (nx_sign_pact), then invites the
-- partner, or, with the partner already in the couple, waits for them to sign.
create function public.nx_finish_setup(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status not in ('draft','invited','signing') then raise exception 'This challenge has started.'; end if;
  if not exists(select 1 from rules where challenge_id = c.id) then raise exception 'Add at least one rule.'; end if;
  if c.status = 'draft' then
    update challenges set status = case when nx_partner(c.id, auth.uid()) is null then 'invited' else 'signing' end where id = c.id;
  end if;
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
  -- Links already sent keep working until they expire; only expired ones are cleared.
  delete from invites i where i.challenge_id = c.id and i.accepted_at is null and i.expires_at <= nx_now();
  insert into invites(challenge_id, from_id, to_name, to_email, token_hash, code, expires_at)
  values (c.id, auth.uid(), left(trim(coalesce(p_to_name, '')), 40), left(trim(coalesce(p_to_email, '')), 200),
          encode(sha256(convert_to(t, 'UTF8')), 'hex'), k, nx_now() + interval '7 days');
  return query select t, k;
end $$;

-- Only the full link opens an invite: the short code is too easy to guess to let anyone join with it.
create function public.nx_find_invite(p_token text) returns public.invites language sql stable security definer set search_path = public as $$
  select * from invites
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
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
declare i invites := nx_find_invite(p_token); c challenges; solo record; shared uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  if i.id is null then raise exception 'This invite has expired or was already used. Ask for a new link.'; end if;
  if i.from_id = auth.uid() then raise exception 'This is your own invite. Send it to your partner.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(i.challenge_id::text, 0));
  select * into c from challenges where id = i.challenge_id;
  if (select count(*) from couple_members where couple_id = c.couple_id) >= 2 then raise exception 'This challenge already has two people.'; end if;
  -- A couple the invitee made on their own that has no challenge (only them in it): its saved
  -- challenges come along. One with a challenge is waiting for someone else to join, so it stays.
  for solo in
    select m.couple_id from couple_members m
    where m.person_id = auth.uid() and m.couple_id <> c.couple_id
      and (select count(*) from couple_members x where x.couple_id = m.couple_id) = 1
      and not exists(select 1 from challenges x where x.couple_id = m.couple_id)
  loop
    update saved_challenges set couple_id = c.couple_id where couple_id = solo.couple_id;
    delete from couples where id = solo.couple_id;
  end loop;
  -- Two people who are already a couple stay one: the challenge moves there.
  select a.couple_id into shared from couple_members a join couple_members b using (couple_id)
  where a.person_id = i.from_id and b.person_id = auth.uid() limit 1;
  if shared is not null then
    update challenges set couple_id = shared where couple_id = c.couple_id;
    update saved_challenges set couple_id = shared where couple_id = c.couple_id;
    delete from couples where id = c.couple_id;
  else
    insert into couple_members(couple_id, person_id) values (c.couple_id, auth.uid()) on conflict do nothing;
  end if;
  update invites set accepted_at = nx_now(), accepted_by = auth.uid() where id = i.id;
  update rules set who = auth.uid(), for_invitee = false where challenge_id = c.id and for_invitee;
  update challenges set status = 'signing' where id = c.id and status in ('draft','invited');
  return c.id;
end $$;

-- Signs the pact, with the signer's own limits as {rule id: value} for the rules where each person
-- sets their own. A limit is set once, with the signature. Once both have signed, the challenge is running.
create function public.nx_sign_pact(p_challenge uuid, p_limits jsonb default null) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); k text; v jsonb; r rules;
begin
  if c.status not in ('invited','signing') then raise exception 'There''s nothing to sign right now.'; end if;
  if exists(select 1 from signatures where challenge_id = c.id and person_id = auth.uid()) then return; end if;
  if jsonb_typeof(p_limits) = 'object' then
    for k, v in select l.key, l.value from jsonb_each(p_limits) l loop
      select * into r from rules where challenge_id = c.id and id::text = k;
      if r.id is null or not r.personal or not nx_rule_for(r, auth.uid()) then raise exception 'That rule has no limit of your own.'; end if;
      if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <= 0 then raise exception 'Enter your limit first.'; end if;
      update rules set limits = limits || jsonb_build_object(auth.uid()::text, v) where id = r.id;
    end loop;
  end if;
  insert into signatures(challenge_id, person_id) values (c.id, auth.uid());
  if c.status = 'signing' and (select count(*) from signatures where challenge_id = c.id) = 2 then
    -- Day 1 is never before the day after both signed: nobody starts a day already under way.
    update challenges set status = 'running', start_date = greatest(start_date, nx_today(c) + 1) where id = c.id;
  end if;
end $$;

/* ── Checking in ───────────────────────────────────────────────────────── */

-- Whether `p_value` meets the rule's target for `p_person`: their own limit on a personal rule.
create function public.nx_meets(r public.rules, p_value numeric, p_person uuid) returns boolean language sql immutable as $$
  select case r.target_op
    when '>=' then p_value >= coalesce((r.limits->>p_person::text)::numeric, r.target_value)
    when '<=' then p_value <= coalesce((r.limits->>p_person::text)::numeric, r.target_value)
    else false end
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
-- The answer became a Yes: its point (forgiven or not) stops counting, and a pending request on it goes.
create function public.nx_void_point_of(p_entry uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  delete from forgiveness_requests where status = 'pending'
    and point_id in (select id from points where entry_id = p_entry and not voided);
  update points set voided = true where entry_id = p_entry and not voided;
end $$;

-- The point for an entry's miss (slot 0). A point still counting keeps its place and its forgiveness
-- (the answer was only edited); a new or voided one comes back unforgiven, priced as the newest.
-- Returns the point; the entry shows as forgiven when its point is.
create function public.nx_add_point(e public.entries, p_reason text) returns public.points language plpgsql security definer set search_path = public as $$
declare pt points;
begin
  insert into points(challenge_id, person_id, rule_id, day, reason, entry_id, created_at)
  values (e.challenge_id, e.person_id, e.rule_id, e.day, p_reason, e.id, nx_now())
  on conflict (person_id, rule_id, day, slot) do update
    set reason = excluded.reason, entry_id = excluded.entry_id,
        forgiven = points.forgiven and not points.voided,
        created_at = case when points.voided then excluded.created_at else points.created_at end,
        voided = false
  returning * into pt;
  if pt.forgiven then update entries set status = 'excused' where id = e.id; end if;
  return pt;
end $$;

-- One whole check-in, like saveCheckin() in lib/next/actions.ts. Before the deadline it is the answer;
-- after it, a late answer the partner has to approve. Saved by hand, so never from the timer: the
-- timer doesn't change it afterwards (nx_timer_log). A late answer clears from_timer once approved.
create function public.nx_save_checkin(p_challenge uuid, p_rule uuid, p_day date, p_done boolean default null,
  p_value numeric default null, p_note text default '', p_proofs jsonb default '[]', p_forgiveness text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); r rules; e entries; v_done boolean; v_proofs jsonb; v_note text := left(coalesce(p_note, ''), 2000);
  ask text := nullif(trim(coalesce(p_forgiveness, '')), ''); pt points;
begin
  perform nx_tick(c.id);
  select * into c from challenges where id = c.id;
  if c.status not in ('running','finished') then raise exception 'The challenge hasn''t started yet.'; end if;
  select * into r from rules where id = p_rule and challenge_id = c.id;
  if r.id is null or not nx_rule_for(r, auth.uid()) or not nx_applies(c, r, p_day) then raise exception 'That rule isn''t asked on that day.'; end if;
  -- A day is logged once it's over, or during the day itself when its deadline is that night.
  if p_day > nx_today(c) or (p_day = nx_today(c) and c.deadline_days > 0) then
    raise exception 'You can log a day once it''s over.';
  end if;
  v_done := case when r.kind = 'number' then p_value is not null and nx_meets(r, p_value, auth.uid()) else coalesce(p_done, false) end;
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

  insert into entries(challenge_id, person_id, rule_id, day, done, value, status, note, proofs, logged_at, from_timer)
  values (c.id, auth.uid(), r.id, p_day, v_done, case when r.kind = 'number' then p_value end,
          case when v_done then 'pending' when r.kind = 'weekly' then 'confirmed' else 'missed' end, v_note, v_proofs, nx_now(), false)
  on conflict (person_id, rule_id, day) do update set done = excluded.done, value = excluded.value, status = excluded.status,
    note = excluded.note, proofs = excluded.proofs, logged_at = excluded.logged_at, from_timer = false,
    correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null
  returning * into e;
  if e.status = 'missed' then
    pt := nx_add_point(e, 'missed');
    if ask is not null and not pt.forgiven then
      insert into forgiveness_requests(challenge_id, point_id, from_id, reason) values (c.id, pt.id, auth.uid(), left(ask, 2000))
      on conflict (point_id) where status = 'pending' do update set reason = excluded.reason;
    end if;
  else
    perform nx_void_point_of(e.id);
  end if;
  perform nx_tick(c.id);
end $$;

/* ── Reviewing ─────────────────────────────────────────────────────────── */

-- The partner reviews an answer: 'approve' (an answer or a late answer), 'reject' (a late answer), or 'dispute'.
create function public.nx_review(p_entry uuid, p_action text, p_comment text default '') returns void language plpgsql security definer set search_path = public as $$
declare e entries; c challenges; r rules;
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
      -- The late answer was typed by hand: the timer no longer changes it.
      update entries set done = correction_done, value = correction_value, note = coalesce(correction_note, ''),
        proofs = coalesce(correction_proofs, '[]'), logged_at = nx_now(), from_timer = false,
        status = case when correction_done or r.kind = 'weekly' then 'confirmed' else 'missed' end,
        correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null
      where id = e.id returning * into e;
      if e.status = 'missed' then perform nx_add_point(e, 'missed'); else perform nx_void_point_of(e.id); end if;
    end if;
  elsif p_action = 'reject' then
    if e.correction_at is null then raise exception 'There''s no late answer to turn down.'; end if;
    update entries set correction_done = null, correction_value = null, correction_note = null, correction_proofs = null, correction_at = null where id = e.id;
  elsif p_action = 'dispute' then
    if c.status = 'finished' then raise exception 'This challenge is over.'; end if;
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

/* ── Timer ─────────────────────────────────────────────────────────────── */

-- A timed day's answer, saved by itself from its sessions (like the Timer page's timedMinutes()):
-- * When: the challenge is running, the day can be logged (it's over, or it's today with a same-night
--   deadline, as in nx_save_checkin) and no timer is still going on that rule and day. Called at each
--   Stop (nx_stop_timer) and by nx_tick, which only fills a day with no answer yet, before it gives
--   unlogged misses. So removing a session (nx_remove_session) never changes an answer already saved.
-- * What: the day's sessions added up, in whole minutes rounded down, scored like a check-in
--   (nx_meets: pending if met, missed with a point if not), from_timer = true. The sessions stand in
--   for screenshots, even when the rule asks for them. Sessions count whether or not the timer is
--   still on: turning it off saves the one going.
-- * Never over: an answer typed by hand (from_timer false), a late answer waiting on the partner, a
--   disputed or conceded one, or one the partner approved once the day's deadline has passed. Before
--   the deadline an approved timer answer changes like a hand edit would, and goes back for review.
--   An unlogged day (nobody answered, no late answer waiting) is filled.
-- * Only days the rule asks, and only the rule's own people.
create function public.nx_timer_log(c public.challenges, p_person uuid, p_rule uuid, p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare r rules; e entries; total integer; v_min integer; v_done boolean;
begin
  if c.status <> 'running' then return; end if;
  select * into r from rules where id = p_rule and challenge_id = c.id;
  if r.id is null or r.kind <> 'number' or not nx_rule_for(r, p_person) or not nx_applies(c, r, p_day) then return; end if;
  if p_day > nx_today(c) or (p_day = nx_today(c) and c.deadline_days > 0) then return; end if;
  if exists(select 1 from timer_runs where challenge_id = c.id and person_id = p_person and rule_id = r.id and day = p_day) then return; end if;
  select coalesce(sum(seconds), 0) into total from timer_sessions
  where challenge_id = c.id and person_id = p_person and rule_id = r.id and day = p_day;
  if total <= 0 then return; end if;
  v_min := total / 60;
  v_done := nx_meets(r, v_min, p_person);
  select * into e from entries where person_id = p_person and rule_id = r.id and day = p_day;
  if e.id is not null then
    if e.correction_at is not null then return; end if;
    if e.from_timer then
      if e.value is not distinct from v_min::numeric or e.status in ('disputed','conceded')
         or (e.status = 'confirmed' and nx_now() > nx_lock_time(c, p_day)) then return; end if;
    elsif e.status <> 'unlogged' then
      return;
    end if;
  end if;
  insert into entries(challenge_id, person_id, rule_id, day, done, value, status, logged_at, from_timer)
  values (c.id, p_person, r.id, p_day, v_done, v_min, case when v_done then 'pending' else 'missed' end, nx_now(), true)
  on conflict (person_id, rule_id, day) do update set done = excluded.done, value = excluded.value,
    status = excluded.status, logged_at = excluded.logged_at, from_timer = true
  returning * into e;
  if e.status = 'missed' then perform nx_add_point(e, 'missed'); else perform nx_void_point_of(e.id); end if;
end $$;

-- Stops `p_person`'s timer, if any: its time (pauses left out) becomes a session on the day it started,
-- and that day's answer is saved from the timer when it can be (nx_timer_log). 0 seconds saves nothing.
create function public.nx_stop_timer(c public.challenges, p_person uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t timer_runs; secs integer;
begin
  delete from timer_runs where challenge_id = c.id and person_id = p_person returning * into t;
  if t.person_id is null then return; end if;
  secs := t.banked + case when t.running_since is null then 0
                          else greatest(0, floor(extract(epoch from nx_now() - t.running_since)))::integer end;
  if secs > 0 then
    insert into timer_sessions(challenge_id, person_id, rule_id, day, started_at, ended_at, seconds)
    values (c.id, p_person, t.rule_id, t.day, t.started_at, nx_now(), secs);
    perform nx_timer_log(c, p_person, t.rule_id, t.day);
  end if;
end $$;

-- The viewer's timer, like startTimer()/pauseTimer()/resumeTimer()/stopTimer() in lib/next/actions.ts:
-- 'start' (p_rule), 'pause', 'resume' or 'stop'. The database stamps every time. One timer per person
-- per challenge: starting stops and saves the one going. It starts only while the challenge runs, before
-- the day's deadline. On a day the rule doesn't ask, the time is kept (it shows in the history) but is
-- never saved as an answer. Pausing, resuming or stopping when there's nothing to pause, resume or stop
-- changes nothing, as in the pure actions.
create function public.nx_timer(p_challenge uuid, p_action text, p_rule uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); r rules;
begin
  perform nx_tick(c.id);
  select * into c from challenges where id = c.id;
  if c.status <> 'running' then raise exception 'The timer works while the challenge is running.'; end if;
  if p_action = 'start' then
    select * into r from rules where id = p_rule and challenge_id = c.id;
    if r.id is null or not r.timed or not nx_can_time(r.kind, r.target_unit) or not nx_rule_for(r, auth.uid()) then
      raise exception 'That rule isn''t timed for you.';
    end if;
    if nx_now() > nx_lock_time(c, nx_today(c)) then raise exception 'Today''s deadline has passed.'; end if;
    perform nx_stop_timer(c, auth.uid());
    insert into timer_runs(challenge_id, person_id, rule_id, day, started_at, running_since, banked)
    values (c.id, auth.uid(), r.id, nx_today(c), nx_now(), nx_now(), 0);
  elsif p_action = 'pause' then
    update timer_runs set banked = banked + greatest(0, floor(extract(epoch from nx_now() - running_since)))::integer,
      running_since = null
    where challenge_id = c.id and person_id = auth.uid() and running_since is not null;
  elsif p_action = 'resume' then
    update timer_runs set running_since = nx_now()
    where challenge_id = c.id and person_id = auth.uid() and running_since is null;
  elsif p_action = 'stop' then
    perform nx_stop_timer(c, auth.uid());
  else
    raise exception 'Unknown timer action.';
  end if;
  perform nx_tick(c.id);
end $$;

-- Either person turns the timer on or off for a rule counted in minutes, at any time, even after
-- signing: it doesn't change what counts, so the signatures stay. Off stops and saves any timer going
-- on that rule, either person's.
create function public.nx_set_timed(p_challenge uuid, p_rule uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); r rules; t record;
begin
  select * into r from rules where id = p_rule and challenge_id = c.id;
  if r.id is null then raise exception 'That rule is gone.'; end if;
  if not nx_can_time(r.kind, r.target_unit) then raise exception 'Only a rule counted in minutes can be timed.'; end if;
  if r.timed = coalesce(p_on, false) then return; end if;
  if not coalesce(p_on, false) then
    for t in select person_id from timer_runs where challenge_id = c.id and rule_id = r.id loop
      perform nx_stop_timer(c, t.person_id);
    end loop;
  end if;
  update rules set timed = coalesce(p_on, false) where id = r.id;
  perform nx_tick(c.id);
end $$;

-- Removes one of the viewer's own sessions (timed by mistake). An answer already saved stays as it is.
create function public.nx_remove_session(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s timer_sessions;
begin
  select * into s from timer_sessions where id = p_session;
  if s.id is null then raise exception 'That session is gone.'; end if;
  perform nx_enter(s.challenge_id);
  if s.person_id <> auth.uid() then raise exception 'You can only remove your own sessions.'; end if;
  delete from timer_sessions where id = s.id;
end $$;

/* ── Saved challenges ──────────────────────────────────────────────────── */

-- Saves a challenge's rules and settings under a name. Returns the saved challenge's id.
create function public.nx_save_challenge(p_challenge uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); s uuid;
begin
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Give it a name.'; end if;
  insert into saved_challenges(couple_id, challenge_id, name, look, days, step, cap, rules, saved_by)
  values (c.couple_id, c.id, left(trim(p_name), 60), c.look, c.days, c.step, c.cap, coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'title', r.title, 'question', r.question, 'description', r.description, 'group', r.rule_group, 'kind', r.kind,
      'days', to_jsonb(r.days), 'weeklyTarget', r.weekly_target,
      'target', case when r.target_op is not null then jsonb_build_object('op', r.target_op, 'value', r.target_value, 'unit', coalesce(r.target_unit, '')) end,
      'who', case when r.for_invitee then 'partner' when r.who is null then 'both' when r.who = auth.uid() then 'me' else 'partner' end,
      'proof', r.proof, 'personalTarget', case when r.personal then true end,
      'timed', case when r.timed then true end)) order by r.position)
    from rules r where r.challenge_id = c.id), '[]'), auth.uid())
  returning id into s;
  return s;
end $$;

-- Hides a finished challenge from the viewer's own Your challenges, or brings it back. Their partner's
-- stays as it is.
create function public.nx_hide_challenge(p_challenge uuid, p_hidden boolean) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status <> 'finished' then raise exception 'This challenge has to end first.'; end if;
  if p_hidden then
    insert into hidden_challenges(challenge_id, person_id, status) values (c.id, auth.uid(), 'hidden')
    on conflict (challenge_id, person_id) do update set status = 'hidden', changed_at = nx_now();
  else
    delete from hidden_challenges where challenge_id = c.id and person_id = auth.uid() and status = 'hidden';
  end if;
end $$;

-- Deletes a finished challenge from the viewer's account for good. Their partner keeps theirs. True once
-- neither has it: the app then removes its screenshots and calls nx_erase_challenge.
create function public.nx_delete_challenge(p_challenge uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status <> 'finished' then raise exception 'This challenge has to end first.'; end if;
  insert into hidden_challenges(challenge_id, person_id, status) values (c.id, auth.uid(), 'deleted')
  on conflict (challenge_id, person_id) do update set status = 'deleted', changed_at = nx_now();
  return not exists(select 1 from couple_members m where m.couple_id = c.couple_id
    and not exists(select 1 from hidden_challenges h where h.challenge_id = c.id and h.person_id = m.person_id and h.status = 'deleted'));
end $$;

-- Erases a challenge both people have deleted, with everything in it.
create function public.nx_erase_challenge(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if exists(select 1 from couple_members m where m.couple_id = c.couple_id
    and not exists(select 1 from hidden_challenges h where h.challenge_id = c.id and h.person_id = m.person_id and h.status = 'deleted')) then
    raise exception 'Your partner still has this challenge.';
  end if;
  delete from challenges where id = c.id;
end $$;

-- A saved challenge, the same way: hidden or deleted for the viewer only, and gone once neither has it.
create function public.nx_hide_saved(p_saved uuid, p_hidden boolean) returns void language plpgsql security definer set search_path = public as $$
declare s saved_challenges;
begin
  select * into s from saved_challenges where id = p_saved;
  if s.id is null or not nx_in_couple(s.couple_id) then raise exception 'That saved challenge is gone.'; end if;
  if p_hidden then
    insert into hidden_saved(saved_id, person_id, status) values (s.id, auth.uid(), 'hidden')
    on conflict (saved_id, person_id) do update set status = 'hidden', changed_at = nx_now();
  else
    delete from hidden_saved where saved_id = s.id and person_id = auth.uid() and status = 'hidden';
  end if;
end $$;

create function public.nx_delete_saved(p_saved uuid) returns void language plpgsql security definer set search_path = public as $$
declare s saved_challenges;
begin
  select * into s from saved_challenges where id = p_saved;
  if s.id is null or not nx_in_couple(s.couple_id) then raise exception 'That saved challenge is gone.'; end if;
  insert into hidden_saved(saved_id, person_id, status) values (s.id, auth.uid(), 'deleted')
  on conflict (saved_id, person_id) do update set status = 'deleted', changed_at = nx_now();
  if not exists(select 1 from couple_members m where m.couple_id = s.couple_id
    and not exists(select 1 from hidden_saved h where h.saved_id = s.id and h.person_id = m.person_id and h.status = 'deleted')) then
    delete from saved_challenges where id = s.id;
  end if;
end $$;

create function public.nx_set_share_link(p_saved uuid, p_on boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  update saved_challenges set link_on = p_on where id = p_saved and nx_in_couple(couple_id);
  if not found then raise exception 'That saved challenge isn''t yours.'; end if;
end $$;

/* ── Gifts given ───────────────────────────────────────────────────────── */

-- Which finished challenge's gifts have been given, by who receives them. Either person can mark one.
create table if not exists public.gifts_given(
  challenge_id uuid not null references public.challenges on delete cascade,
  recipient_id uuid not null references public.profiles,
  marked_by uuid not null references public.profiles,
  given_at timestamptz not null default now(),
  primary key (challenge_id, recipient_id)
);
alter table public.gifts_given enable row level security;
drop policy if exists read_own on public.gifts_given;
create policy read_own on public.gifts_given for select to authenticated using (nx_in_challenge(challenge_id));
grant select on public.gifts_given to authenticated;
revoke insert, update, delete on public.gifts_given from anon, authenticated;

-- What each person has hidden or deleted. It's their own: their partner's Your challenges doesn't change.
create table if not exists public.hidden_challenges(
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles on delete cascade,
  status text not null check (status in ('hidden','deleted')),
  changed_at timestamptz not null default now(),
  primary key (challenge_id, person_id)
);
create table if not exists public.hidden_saved(
  saved_id uuid not null references public.saved_challenges on delete cascade,
  person_id uuid not null references public.profiles on delete cascade,
  status text not null check (status in ('hidden','deleted')),
  changed_at timestamptz not null default now(),
  primary key (saved_id, person_id)
);
alter table public.hidden_challenges enable row level security;
alter table public.hidden_saved enable row level security;
drop policy if exists read_own on public.hidden_challenges;
drop policy if exists read_own on public.hidden_saved;
create policy read_own on public.hidden_challenges for select to authenticated using (person_id = auth.uid());
create policy read_own on public.hidden_saved for select to authenticated using (person_id = auth.uid());
grant select on public.hidden_challenges, public.hidden_saved to authenticated;
revoke insert, update, delete on public.hidden_challenges, public.hidden_saved from anon, authenticated;

-- True once everyone in the challenge has deleted it: only then can its screenshots be removed.
create or replace function public.nx_deleted_by_all(p_challenge uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists(
    select 1 from challenges c join couple_members m on m.couple_id = c.couple_id
    where c.id = p_challenge and not exists(
      select 1 from hidden_challenges h where h.challenge_id = c.id and h.person_id = m.person_id and h.status = 'deleted'))
$$;

-- Marks the gift `p_recipient` gets as given (or not) once the challenge is over.
create or replace function public.nx_mark_gift(p_challenge uuid, p_recipient uuid, p_given boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  perform nx_tick(c.id);
  if (select status from challenges where id = c.id) <> 'finished' then raise exception 'Gifts are given once the challenge is over.'; end if;
  if not exists(select 1 from couple_members where couple_id = c.couple_id and person_id = p_recipient) then
    raise exception 'That gift isn''t part of this challenge.';
  end if;
  if p_given then
    insert into gifts_given(challenge_id, recipient_id, marked_by, given_at) values (c.id, p_recipient, auth.uid(), nx_now())
    on conflict (challenge_id, recipient_id) do nothing;
  else
    delete from gifts_given where challenge_id = c.id and recipient_id = p_recipient;
  end if;
end $$;

revoke all on function public.nx_mark_gift(uuid, uuid, boolean) from public, anon;
grant execute on function public.nx_mark_gift(uuid, uuid, boolean) to authenticated;

/* ── Share links: anyone with a saved challenge's link can read it while the link is on ── */

create or replace function public.nx_shared_preview(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'name', s.name, 'look', s.look, 'days', s.days, 'step', s.step,
                            'cap', s.cap, 'rules', s.rules, 'created_at', s.created_at)
  from saved_challenges s
  where s.link_token = p_token and s.link_on
$$;

create or replace function public.nx_save_shared(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s saved_challenges; couple uuid; out_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  select * into s from saved_challenges where link_token = p_token and link_on;
  if s.id is null then raise exception 'This link was turned off.'; end if;
  if nx_in_couple(s.couple_id) then return s.id; end if;
  select couple_id into couple from couple_members where person_id = auth.uid() order by joined_at desc limit 1;
  if couple is null then
    insert into couples default values returning id into couple;
    insert into couple_members(couple_id, person_id) values (couple, auth.uid());
  end if;
  insert into saved_challenges(couple_id, name, look, days, step, cap, rules, saved_by)
  values (couple, s.name, s.look, s.days, s.step, s.cap, s.rules, auth.uid())
  returning id into out_id;
  return out_id;
end $$;

/* ── Cancelling: deleted before Day 1, ended now while it runs ────────── */

-- Ends a running challenge now: the days whose deadline has passed count, later days' answers and
-- points go, and the verdict opens. One that no day has closed on yet is deleted; with screenshots,
-- it's left deleted by both for the app to erase, because they can't be found once it's gone.
-- Internal: it runs once both have agreed. Returns 'deleted', 'erase' or 'ended'.
create function public.nx_end_now(p_challenge uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges; last_closed date; t record;
begin
  perform nx_tick(p_challenge);
  select * into c from challenges where id = p_challenge;
  -- The latest day whose deadline has passed (as in nx_tick).
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);
  -- Timers still going stop and save, like a Stop; sessions on the days that no longer count go.
  for t in select person_id from timer_runs where challenge_id = c.id loop
    perform nx_stop_timer(c, t.person_id);
  end loop;
  delete from timer_sessions where challenge_id = c.id and day > last_closed;
  if last_closed < c.start_date then
    if exists(select 1 from storage.objects where bucket_id = 'proofs' and name like c.id::text || '/%') then
      insert into hidden_challenges(challenge_id, person_id, status)
      select c.id, m.person_id, 'deleted' from couple_members m where m.couple_id = c.couple_id
      on conflict (challenge_id, person_id) do update set status = 'deleted', changed_at = nx_now();
      update challenges set status = 'finished', end_asked_by = null, end_asked_at = null where id = c.id;
      return 'erase';
    end if;
    delete from challenges where id = c.id;
    return 'deleted';
  end if;
  if exists(select 1 from disputes where challenge_id = c.id and status = 'open') then
    raise exception 'Settle the open disputes first.';
  end if;
  delete from points where challenge_id = c.id and day > last_closed;
  delete from entries where challenge_id = c.id and day > last_closed;
  -- Both agreed to end it, so answers still waiting for review stand.
  update entries set status = 'confirmed' where challenge_id = c.id and status = 'pending';
  update challenges set days = last_closed - start_date + 1, status = 'finished', end_asked_by = null, end_asked_at = null
  where id = c.id;
  -- The last, shorter week's shortfalls, at its share of the target.
  perform nx_tick(c.id);
  return 'ended';
end $$;

-- Before Day 1, the challenge and everything in it is deleted, by either person. While it runs, it
-- ends only once both agree: this is the partner accepting the other's request (nx_end_request).
-- Returns 'deleted', 'erase' (see nx_end_now) or 'ended'.
create function public.nx_cancel_challenge(p_challenge uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status = 'finished' then raise exception 'This challenge is already over.'; end if;
  if c.status in ('draft','invited','signing') then
    delete from challenges where id = c.id;
    return 'deleted';
  end if;
  if c.end_asked_by is null or c.end_asked_by = auth.uid() then
    raise exception 'A running challenge ends once you both agree. Ask your partner first.';
  end if;
  return nx_end_now(c.id);
end $$;

-- Asking to end a running challenge early: 'ask', 'withdraw' (the one who asked) or 'decline' (the
-- other). Asking after the partner already asked means both agree, so it ends. Accepting is
-- nx_cancel_challenge. Returns 'asked', 'withdrawn', 'declined', 'ended', 'deleted' or 'erase'.
create function public.nx_end_request(p_challenge uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  select * into c from challenges where id = c.id for update;
  if c.status <> 'running' then raise exception 'Only a running challenge can be ended early.'; end if;
  if p_action = 'ask' then
    if exists(select 1 from disputes where challenge_id = c.id and status = 'open') then
      raise exception 'Settle the open disputes first.';
    end if;
    if c.end_asked_by is not null and c.end_asked_by <> auth.uid() then return nx_end_now(c.id); end if;
    update challenges set end_asked_by = auth.uid(), end_asked_at = nx_now() where id = c.id;
    return 'asked';
  elsif p_action = 'withdraw' then
    if c.end_asked_by is distinct from auth.uid() then raise exception 'You haven''t asked to end it.'; end if;
    update challenges set end_asked_by = null, end_asked_at = null where id = c.id;
    return 'withdrawn';
  elsif p_action = 'decline' then
    if c.end_asked_by is null or c.end_asked_by = auth.uid() then raise exception 'Nobody else asked to end it.'; end if;
    update challenges set end_asked_by = null, end_asked_at = null where id = c.id;
    return 'declined';
  end if;
  raise exception 'Unknown request.';
end $$;


/* ── Reads ─────────────────────────────────────────────────────────────── */

do $$ declare t text; begin
  foreach t in array array['profiles','couples','couple_members','challenges','rules','signatures','invites','entries','points',
                           'forgiveness_requests','disputes','journal_notes','saved_challenges','timer_runs','timer_sessions'] loop
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
  -- Both people read each other's timers and sessions (the partner sees them when reviewing).
  foreach t in array array['rules','signatures','invites','entries','points','forgiveness_requests','disputes','journal_notes',
                           'timer_runs','timer_sessions'] loop
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
    'nx_void_point_of(uuid)','nx_add_point(public.entries,text)','nx_forgive(uuid)','nx_end_now(uuid)',
    'nx_can_time(text,text)','nx_timer_log(public.challenges,uuid,uuid,date)','nx_stop_timer(public.challenges,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- What a signed-in person can call.
  foreach f in array array['nx_sync(uuid)','nx_set_name(text)','nx_deleted_by_all(uuid)',
    'nx_create_challenge(text,text,text,date,integer,text,numeric,numeric,jsonb,uuid,boolean)',
    'nx_update_challenge(uuid,text,text,date,integer,text,numeric,numeric,boolean,integer,time,integer,jsonb)',
    'nx_finish_setup(uuid)','nx_create_invite(uuid,text,text)','nx_accept_invite(text)','nx_sign_pact(uuid,jsonb)',
    'nx_save_checkin(uuid,uuid,date,boolean,numeric,text,jsonb,text)','nx_review(uuid,text,text)',
    'nx_resolve_dispute(uuid,text,text)','nx_ask_forgiveness(uuid,text)','nx_decide_forgiveness(uuid,boolean)',
    'nx_forgive_point(uuid)','nx_add_note(uuid,date,text)','nx_edit_note(uuid,text)','nx_remove_note(uuid)',
    'nx_save_challenge(uuid,text)','nx_hide_challenge(uuid,boolean)','nx_delete_challenge(uuid)','nx_erase_challenge(uuid)','nx_hide_saved(uuid,boolean)','nx_delete_saved(uuid)','nx_set_share_link(uuid,boolean)','nx_cancel_challenge(uuid)',
    'nx_end_request(uuid,text)','nx_timer(uuid,text,uuid)','nx_set_timed(uuid,uuid,boolean)','nx_remove_session(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- Anyone with the link can see the invite before signing up.
grant execute on function public.nx_invite_preview(text) to anon, authenticated;
-- And a shared challenge while its link is on; saving a copy needs an account.
revoke all on function public.nx_shared_preview(text), public.nx_save_shared(text) from public, anon;
grant execute on function public.nx_shared_preview(text) to anon, authenticated;
grant execute on function public.nx_save_shared(text) to authenticated;
revoke all on function public.nx_tick_all() from public, anon, authenticated;
grant execute on function public.nx_tick_all() to service_role;

/* ── Screenshots ───────────────────────────────────────────────────────── */

-- Stored as <challenge id>/<person id>/<file>; only the challenge's two members can open them.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid));
-- Nobody removes a screenshot during a challenge: they go when it's erased, once both have deleted it.
create policy proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid)
         and nx_deleted_by_all(((storage.foldername(name))[1])::uuid));
create policy proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid)
              and (storage.foldername(name))[2] = auth.uid()::text);

/* ── Live updates ──────────────────────────────────────────────────────── */

do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['challenges','rules','signatures','couple_members','entries','points','forgiveness_requests','disputes','journal_notes',
                             'timer_runs','timer_sessions'] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'gifts_given') then
    alter publication supabase_realtime add table public.gifts_given;
  end if;
end $$;

commit;
-- Optional: enable pg_cron in Database > Extensions, then run:
-- select cron.schedule('nx-hourly', '0 * * * *', 'select public.nx_tick_all()');
