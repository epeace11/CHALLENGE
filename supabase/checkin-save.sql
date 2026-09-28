-- One Save per check-in (September 28, 2026). Run once in the Supabase SQL editor, BEFORE deploying
-- the app version whose Log page has a single Save button (it calls this function); rerunnable.
--
-- challenge_checkin submits a whole check-in in one transaction: the Yes/No answer with its note and
-- screenshots (challenge_log) and, with a No, an optional forgiveness request (challenge_forgive).
-- Every existing check still applies (member, rule and day, proof, deadline, lock, dispute,
-- finalization), and if any part fails nothing is saved, so a No can never land without the request
-- that was sent with it. A Yes with a request is refused. A Yes that clears the miss also withdraws a
-- request still pending on it, which would otherwise wait in the partner's Review for a miss that is gone.
create or replace function public.challenge_checkin(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null,p_forgive text default null) returns void language plpgsql security definer set search_path=public as $$ declare pt challenge_points;ask text:=nullif(trim(coalesce(p_forgive,'')),'');begin
 if p_done and ask is not null then raise exception 'Forgiveness can only be requested with a No.';end if;
 perform challenge_log(p_rule,p_day,p_done,p_note,p_proof);
 select * into pt from challenge_points where user_id=auth.uid() and rule_id=p_rule and day=p_day and slot=0;
 if pt.voided then delete from challenge_requests where point_id=pt.id and status='pending';end if;
 if ask is not null then
  if pt.id is null or pt.voided or pt.forgiven then raise exception 'This answer has no miss to forgive yet.';end if;
  perform challenge_forgive(pt.id,ask);
 end if;
end $$;
revoke all on function public.challenge_checkin(text,date,boolean,text,text,text) from public,anon;
grant execute on function public.challenge_checkin(text,date,boolean,text,text,text) to authenticated;
insert into public.challenge_scripts(name,ran_at) values('checkin-save.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
