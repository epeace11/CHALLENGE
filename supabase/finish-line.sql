-- Finish-line fixes (October 5, 2026). Run once in the Supabase SQL editor, after
-- weekly-day-forgiveness.sql and BEFORE redeploying the remind Edge Function; rerunnable.
--
-- * challenge_checkin: re-saving a No whose miss is already forgiven (to edit its note, say) keeps the
--   answer excused. challenge_log rewrites a No as 'missed', which left a forgiven point under an answer
--   that showed as a miss; weekly days already kept it, now daily habits do too.
-- * challenge_weekly_reminders(): for the reminder function, each member whose weekly target (gym, steps)
--   is still short with at most two days of the week left, today included. Done and forgiven days count,
--   as the weekly assessment counts them. Only the service role may call it.
begin;

create or replace function public.challenge_checkin(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null,p_forgive text default null) returns void language plpgsql security definer set search_path=public as $$ declare pt challenge_points;e challenge_entries;ask text:=nullif(trim(coalesce(p_forgive,'')),'');begin
 if p_done and ask is not null then raise exception 'Forgiveness can only be requested with a No.';end if;
 perform challenge_log(p_rule,p_day,p_done,p_note,p_proof);
 select * into pt from challenge_points where user_id=auth.uid() and rule_id=p_rule and day=p_day and slot=0;
 select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
 if not p_done and pt.forgiven and not pt.voided then update challenge_entries set status='excused' where id=e.id;end if;
 if (select weekly from challenge_rules where id=p_rule) then
  if p_done and e.proposed_done is null and pt.id is not null then
   delete from challenge_requests where point_id=pt.id;
   update challenge_points set voided=true,forgiven=false where id=pt.id;
  end if;
  if ask is not null then
   if now()>((p_day+1)+time '23:59') at time zone 'America/Toronto' then raise exception 'A weekly day can only be forgiven before its deadline.';end if;
   if pt.forgiven and not pt.voided then raise exception 'This day is already forgiven.';end if;
   insert into challenge_points(user_id,rule_id,day,reason,entry_id) values(auth.uid(),p_rule,p_day,'day_forgiveness',e.id) on conflict(user_id,rule_id,day,slot) do update set voided=false,forgiven=false,entry_id=excluded.entry_id returning * into pt;
   perform challenge_forgive(pt.id,ask);
  end if;
  perform challenge_rescore();
  return;
 end if;
 if pt.voided then delete from challenge_requests where point_id=pt.id and status='pending';end if;
 if ask is not null then
  if pt.id is null or pt.voided or pt.forgiven then raise exception 'This answer has no miss to forgive yet.';end if;
  perform challenge_forgive(pt.id,ask);
 end if;
end $$;
revoke all on function public.challenge_checkin(text,date,boolean,text,text,text) from public,anon;
grant execute on function public.challenge_checkin(text,date,boolean,text,text,text) to authenticated;

create or replace function public.challenge_weekly_reminders() returns table(user_id uuid,name text,rule_id text,title text,have integer,target integer,days_left integer) language sql stable security definer set search_path=public as $$
 select * from (
  select p.id as user_id,p.name,r.id as rule_id,r.title,
   ((select count(*) from challenge_entries e where e.user_id=p.id and e.rule_id=r.id and e.day between k.start_date and k.end_date and e.done and e.status not in ('conceded','missed','unlogged'))
   +(select count(*) from challenge_points q where q.user_id=p.id and q.rule_id=r.id and q.slot=0 and q.day between k.start_date and k.end_date and not q.voided and q.forgiven))::integer as have,
   t.target,(k.end_date-c.today+1)::integer as days_left
  from (select finalized,(now() at time zone 'America/Toronto')::date as today from challenge_config where id=1) c
  join challenge_weeks k on c.today between k.start_date and k.end_date
  join challenge_weekly_targets t on t.start_date=k.start_date and t.target>0
  join challenge_rules r on r.id=t.rule_id and r.weekly
  join challenge_profiles p on r.person is null or r.person=p.name
  where not c.finalized and k.end_date-c.today<=1
 ) w where w.have<w.target $$;
revoke all on function public.challenge_weekly_reminders() from public,anon,authenticated;
grant execute on function public.challenge_weekly_reminders() to service_role;

insert into public.challenge_scripts(name,ran_at) values('finish-line.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
commit;
