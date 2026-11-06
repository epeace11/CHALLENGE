-- A saved copy knows the challenge it was saved from (November 5, 2026). Rerunnable; run once on PROD
-- CHALLENGE, after fixes-nov-5.sql, before deploying the app that uses it. Fresh installs get the same
-- from schema.sql.
--
-- 1. saved_challenges.challenge_id, filled in for copies saved before now where the couple has exactly
--    one challenge of that name. Others keep going by name.
-- 2. nx_save_challenge sets it.
-- 3. nx_update_challenge no longer renames saved copies: two copies with one name could both change.
begin;

alter table public.saved_challenges
  add column if not exists challenge_id uuid references public.challenges on delete set null;

update public.saved_challenges s set challenge_id = c.id
from public.challenges c
where s.challenge_id is null and c.couple_id = s.couple_id and c.name = s.name
  and (select count(*) from public.challenges x where x.couple_id = s.couple_id and x.name = s.name) = 1;

create or replace function public.nx_save_challenge(p_challenge uuid, p_name text) returns uuid language plpgsql security definer set search_path = public as $$
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
      'proof', r.proof, 'personalTarget', case when r.personal then true end)) order by r.position)
    from rules r where r.challenge_id = c.id), '[]'), auth.uid())
  returning id into s;
  return s;
end $$;

create or replace function public.nx_update_challenge(p_challenge uuid, p_name text default null, p_look text default null,
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

notify pgrst, 'reload schema';

commit;
