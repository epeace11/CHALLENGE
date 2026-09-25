-- Gym weeks run Monday–Sunday instead of Sunday–Saturday (September 24, 2026).
-- Sep 15–20 (target 3), then full weeks to Oct 11 (target 4), then Oct 12–14 (target 1).
-- The first week was already assessed on its old end date (Sep 19); its shortfall points,
-- with any forgiveness and requests attached, move to the new end date (Sep 20) and are
-- rescored so Sunday Sep 20 visits count. No other week had been assessed yet.
-- Run once in the Supabase SQL editor, after fix-deadline-1159pm.sql; safe to rerun.

do $$ begin
 perform pg_advisory_xact_lock(8092026);
 delete from public.challenge_weeks where true;
 insert into public.challenge_weeks values('2026-09-15','2026-09-20',3),('2026-09-21','2026-09-27',4),('2026-09-28','2026-10-04',4),('2026-10-05','2026-10-11',4),('2026-10-12','2026-10-14',1);
 update public.challenge_points p set day='2026-09-20'
  where p.rule_id='gym' and p.reason='weekly_shortfall' and p.day='2026-09-19'
    and not exists(select 1 from public.challenge_points q where q.user_id=p.user_id and q.rule_id='gym' and q.day='2026-09-20' and q.slot=p.slot);
 perform public.challenge_rescore();
end $$;

select * from public.challenge_weeks order by start_date;
