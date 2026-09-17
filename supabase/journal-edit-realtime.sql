-- Journal note editing (author only) and live updates. Run once on the live project; safe to rerun.
create or replace function public.challenge_journal_edit(p_id uuid,p_text text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not challenge_member() then raise exception 'This challenge is only for Erin and Kazzy.'; end if;
 if length(trim(coalesce(p_text,'')))=0 then raise exception 'Write something first.'; end if;
 if length(p_text)>4000 then raise exception 'Keep each note under 4,000 characters.'; end if;
 update challenge_journal_notes set text=trim(p_text) where id=p_id and user_id=auth.uid();
 if not found then raise exception 'You can only edit your own notes.'; end if;
end $$;
revoke all on function public.challenge_journal_edit(uuid,text) from public,anon;
grant execute on function public.challenge_journal_edit(uuid,text) to authenticated;
-- Live updates: publish row changes so the app can refresh the moment the other person logs, reviews or writes.
-- Row-level security still applies, so only members receive them.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['challenge_entries','challenge_points','challenge_requests','challenge_disputes','challenge_finalizations','challenge_config','challenge_journal_notes'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;
