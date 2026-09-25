-- Skip no-op point rewrites (September 25, 2026). Run once in the Supabase SQL editor; rerunnable.
--
-- Every load runs challenge_sync, whose weekly rescore upserts one row per target slot of every
-- closed week. Until now those upserts rewrote the rows even when nothing had changed. Postgres
-- publishes every write to Realtime, every open app reloaded on each one, and each reload synced
-- again: a loop that grew with every closed week. The touch trigger now returns null for an
-- unchanged row, so Postgres skips the write and nothing is published.
create or replace function public.challenge_touch() returns trigger language plpgsql as $$ begin
 if new is not distinct from old then return null; end if;
 new.updated_at:=now(); return new;end $$;
insert into public.challenge_scripts(name,ran_at) values('skip-noop-point-writes.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
