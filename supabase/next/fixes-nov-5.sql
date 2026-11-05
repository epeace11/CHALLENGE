-- Fixes from the seventh audit (November 5, 2026). Rerunnable; run once on PROD CHALLENGE, after
-- hide-challenges.sql, before deploying the app that uses it. Fresh installs get the same from schema.sql.
--
-- 1. A late answer waiting on a pending entry no longer holds up the result for ever (nx_tick).
-- 2. A saved copy follows a rename of its challenge (nx_update_challenge).
begin;

-- Idempotent. Runs before every write and on every load (nx_sync), and hourly if pg_cron is set up.
create or replace function public.nx_tick(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
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

  -- It's over once the last deadline has passed and nothing can still change the result: every
  -- dispute settled, every answer reviewed (48 hours at most, above). Until then there's no verdict.
  if c.status = 'running' and nx_now() > nx_lock_time(c, nx_last_day(c))
     and not exists(select 1 from disputes where challenge_id = c.id and status = 'open')
     and not exists(select 1 from entries where challenge_id = c.id and status = 'pending' and correction_at is null) then
    update challenges set status = 'finished' where id = c.id;
  end if;
end $$;

-- Changes a challenge before Day 1. Any change clears both signatures. Null leaves a field as it is.
create or replace function public.nx_update_challenge(p_challenge uuid, p_name text default null, p_look text default null,
  p_start date default null, p_days integer default null, p_time_zone text default null, p_step numeric default null,
  p_cap numeric default null, p_clear_cap boolean default false, p_deadline_days integer default null,
  p_deadline_time time default null, p_week_start integer default null, p_rules jsonb default null)
  returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); was text := c.name;
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
  -- A saved copy goes by the challenge's name, so it follows a rename.
  if c.name <> was then
    update saved_challenges set name = c.name where couple_id = c.couple_id and name = was;
  end if;
  if c.status in ('invited','signing') and (p_start is not null or p_days is not null or p_step is not null
     or p_cap is not null or p_clear_cap or p_rules is not null or p_deadline_days is not null or p_deadline_time is not null) then
    delete from signatures where challenge_id = c.id;
  end if;
end $$;

commit;
