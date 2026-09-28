-- Kazzy's steps start with the week of Sep 28 (September 28, 2026). Run once in the Supabase SQL editor; rerunnable.
-- Best run before Monday, Sep 28 at 11:59 pm Toronto time, when the Sep 21–27 week would be assessed;
-- it also cleans up if that has already happened.
--
-- Sep 21–27 asked for 10,000 steps on one day. He did not do it, and that week no longer counts at all:
-- its target row is removed, so the hourly job never assesses steps for it and the app no longer asks
-- or counts it. Anything already recorded against it goes too: the shortfall point the job adds when
-- the week closes, any forgiveness request on that point, and his steps answers for those days (with
-- any dispute on them). Every removed row stays in challenge_history.
-- Sep 28–Oct 4 asks for 10,000 steps on any 3 days of the week. Later weeks are unchanged.
begin;
delete from public.challenge_requests where point_id in (select id from public.challenge_points where rule_id='steps_weekly' and day between '2026-09-21' and '2026-09-27');
delete from public.challenge_points where rule_id='steps_weekly' and day between '2026-09-21' and '2026-09-27';
delete from public.challenge_disputes where entry_id in (select id from public.challenge_entries where rule_id='steps_weekly' and day between '2026-09-21' and '2026-09-27');
delete from public.challenge_entries where rule_id='steps_weekly' and day between '2026-09-21' and '2026-09-27';
delete from public.challenge_weekly_targets where rule_id='steps_weekly' and start_date='2026-09-21';
insert into public.challenge_weekly_targets values('steps_weekly','2026-09-28',3) on conflict(rule_id,start_date) do update set target=excluded.target;
insert into public.challenge_scripts(name,ran_at) values('steps-from-sep-28.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
commit;

select * from public.challenge_weekly_targets where rule_id='steps_weekly' order by start_date;
