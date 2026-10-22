-- Cancelling a challenge (October 21, 2026). Rerunnable; run once on PROD CHALLENGE, after
-- fixes-oct-18.sql. Fresh installs get the same from schema.sql.
--
-- nx_cancel_challenge: before Day 1 (still being set up, invited or signing), the challenge and
-- everything in it is deleted. While it runs, it ends now: the days whose deadline has passed count,
-- later days' answers and points go, and the challenge is finished so the verdict opens. Ending one
-- before any day has closed deletes it, since nothing counted yet. Either person can do it. Returns
-- 'deleted' or 'ended'.
begin;

create or replace function public.nx_cancel_challenge(p_challenge uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge); last_closed date;
begin
  if c.status = 'finished' then raise exception 'This challenge is already over.'; end if;
  if c.status in ('draft','invited','signing') then
    delete from challenges where id = c.id;
    return 'deleted';
  end if;
  perform nx_tick(c.id);
  -- The latest day whose deadline has passed (as in nx_tick).
  last_closed := least(nx_last_day(c), nx_today(c) - c.deadline_days - case when nx_now() > nx_lock_time(c, nx_today(c) - c.deadline_days) then 0 else 1 end);
  if last_closed < c.start_date then
    delete from challenges where id = c.id;
    return 'deleted';
  end if;
  delete from points where challenge_id = c.id and day > last_closed;
  delete from entries where challenge_id = c.id and day > last_closed;
  update challenges set days = last_closed - start_date + 1, status = 'finished' where id = c.id;
  -- The last, shorter week's shortfalls, at its share of the target.
  perform nx_tick(c.id);
  return 'ended';
end $$;

revoke all on function public.nx_cancel_challenge(uuid) from public, anon;
grant execute on function public.nx_cancel_challenge(uuid) to authenticated;

commit;
