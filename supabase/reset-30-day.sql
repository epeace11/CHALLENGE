-- 30 Day Challenge restart: run ONCE in the Supabase SQL editor before Tuesday, September 15, 2026.
-- Permanently deletes every log, point, request, dispute, audit row and proof photo from the
-- September 8 start, then moves the challenge to Sep 15 – Oct 14 with the new gym weeks.
-- Everything runs in one transaction under the same advisory lock the hourly job uses, so the
-- job cannot regenerate "unlogged" misses for the old dates in between.
begin;
select pg_advisory_xact_lock(8092026);

delete from public.challenge_finalizations;
delete from public.challenge_requests;
delete from public.challenge_disputes;
delete from public.challenge_points;
delete from public.challenge_audit;
delete from public.challenge_photos;
delete from public.challenge_entries;

update public.challenge_config set name='30 Day Challenge',start_date='2026-09-15',end_date='2026-10-14',finalized=false where id=1;

delete from public.challenge_weeks;
insert into public.challenge_weeks values('2026-09-15','2026-09-19',3),('2026-09-20','2026-09-26',4),('2026-09-27','2026-10-03',4),('2026-10-04','2026-10-10',4),('2026-10-11','2026-10-14',1);

-- The finalize message named October 1; derive it from the configured end date instead.
create or replace function public.challenge_finalize() returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();perform challenge_tick();
 if now()<((select end_date+1 from challenge_config)+time '14:00') at time zone 'America/Toronto' then raise exception 'Finalize after % at 2 pm.',to_char((select end_date+1 from challenge_config),'FMMonth FMDD');end if;
 if exists(select 1 from challenge_entries where status in ('pending','disputed') or proposed_done is not null) or exists(select 1 from challenge_requests where status='pending') then raise exception 'Resolve all reviews, corrections and forgiveness requests first.';end if;
 insert into challenge_finalizations(user_id) values(auth.uid()) on conflict do nothing;
 if (select count(*) from challenge_finalizations)=2 then update challenge_config set finalized=true where id=1;end if;end $$;

-- Old proof screenshots cannot be deleted from SQL (Supabase blocks direct storage deletes).
-- They are unreachable from the app once challenge_photos and challenge_entries are gone.
-- To remove the files themselves, empty the bucket in Storage > challenge-proof.

commit;

-- Sanity check: expect zero rows, Sep 15 / Oct 14, five weeks.
select (select count(*) from public.challenge_entries) entries,(select count(*) from public.challenge_points) points,start_date,end_date,name from public.challenge_config;
select * from public.challenge_weeks order by start_date;
