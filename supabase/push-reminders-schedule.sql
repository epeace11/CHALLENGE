-- Schedules the hourly reminder call (September 25, 2026). Run once in the Supabase SQL editor
-- AFTER deploying the remind Edge Function and setting its secrets (README, Reminders), and after
-- replacing REMIND_SECRET below with the value from supabase/functions/.env. Rerunnable: it replaces the job.
--
-- The function runs every hour and only sends anything at 8 pm and 10 pm Toronto time, and only
-- to members with something still unlogged, so the hourly call is cheap.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname='challenge-remind';
select cron.schedule('challenge-remind','0 * * * *',$$select net.http_post(url:='https://llctyiwwcytwmemmnrvw.supabase.co/functions/v1/remind',headers:='{"Content-Type":"application/json","x-remind-secret":"REMIND_SECRET"}'::jsonb,body:='{}'::jsonb)$$);
insert into public.challenge_scripts(name,ran_at) values('push-reminders-schedule.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
