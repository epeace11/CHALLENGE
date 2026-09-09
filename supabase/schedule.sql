create extension if not exists pg_cron;
select cron.schedule('challenge-hourly','0 * * * *','select public.challenge_tick()');
