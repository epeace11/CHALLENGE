-- Forgiveness on a gym day (October 5, 2026). Run once in the Supabase SQL editor, BEFORE deploying
-- the app version whose Log page offers a forgiveness request under a gym No; rerunnable.
--
-- Weekly habits (the gym, Kazzy's steps) have no point per day: a short week becomes points when it
-- closes. Now a No on a weekly day can carry a forgiveness request, sent before that day's deadline.
-- The request hangs on a slot-0 point for that day (reason 'day_forgiveness') that never costs
-- anything: while the request waits, and once it is approved, the day counts toward the week's target
-- as a forgiven visit (the entry is 'excused', not done), so the week may not fall short at all. A
-- denied request (or a partner undoing their forgiveness) voids the point, the day is a plain No again,
-- and the week is rescored. A Yes saved over the day withdraws the request and voids the point.
begin;

create or replace function public.challenge_rescore() returns void language plpgsql security definer set search_path=public as $$ declare w record;p record;n integer;i integer;begin
 for w in select k.start_date,k.end_date,t.rule_id,t.target from challenge_weeks k join challenge_weekly_targets t using(start_date) join challenge_rules r on r.id=t.rule_id where r.weekly and ((k.end_date+1)+time '23:59') at time zone 'America/Toronto'<=now() loop
 for p in select pr.* from challenge_profiles pr join challenge_rules r on r.id=w.rule_id where r.person is null or r.person=pr.name loop
 select greatest(0,w.target-(select count(*) from challenge_entries where user_id=p.id and rule_id=w.rule_id and day between w.start_date and w.end_date and done and status not in ('conceded','missed','unlogged'))::integer
  -(select count(*) from challenge_points q where q.user_id=p.id and q.rule_id=w.rule_id and q.slot=0 and q.day between w.start_date and w.end_date and not q.voided and (q.forgiven or exists(select 1 from challenge_requests r where r.point_id=q.id and r.status='pending')))::integer) into n;
 for i in 1..w.target loop
 insert into challenge_points(user_id,rule_id,day,reason,slot,voided) values(p.id,w.rule_id,w.end_date,'weekly_shortfall',i,i>n) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;
 end loop;end loop;end loop;end $$;
revoke all on function public.challenge_rescore() from public,anon,authenticated;

create or replace function public.challenge_checkin(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null,p_forgive text default null) returns void language plpgsql security definer set search_path=public as $$ declare pt challenge_points;e challenge_entries;ask text:=nullif(trim(coalesce(p_forgive,'')),'');begin
 if p_done and ask is not null then raise exception 'Forgiveness can only be requested with a No.';end if;
 perform challenge_log(p_rule,p_day,p_done,p_note,p_proof);
 select * into pt from challenge_points where user_id=auth.uid() and rule_id=p_rule and day=p_day and slot=0;
 if (select weekly from challenge_rules where id=p_rule) then
  select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
  if p_done and e.proposed_done is null and pt.id is not null then
   delete from challenge_requests where point_id=pt.id;
   update challenge_points set voided=true,forgiven=false where id=pt.id;
  elsif not p_done and pt.forgiven and not pt.voided then
   update challenge_entries set status='excused' where id=e.id;
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

create or replace function public.challenge_decide(p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_requests;p challenge_points;begin
 perform challenge_assert();select * into r from challenge_requests where id=p_request for update;
 if r.id is null or r.requester_id=auth.uid() or r.status<>'pending' then raise exception 'Only your partner can decide a pending request.';end if;
 update challenge_requests set status=case when p_approve then 'approved' else 'denied' end,decided_by=auth.uid(),decided_at=now() where id=r.id;
 if p_approve then update challenge_points set forgiven=true where id=r.point_id returning * into p;update challenge_entries set status='excused' where id=p.entry_id;
 else update challenge_points set voided=true where id=r.point_id and reason='day_forgiveness';end if;
 delete from challenge_finalizations where true;perform challenge_rescore();end $$;
revoke all on function public.challenge_decide(uuid,boolean) from public,anon;
grant execute on function public.challenge_decide(uuid,boolean) to authenticated;

create or replace function public.challenge_partner_forgive(p_point uuid,p_forgive boolean) returns void language plpgsql security definer set search_path=public as $$ declare p challenge_points;begin
 perform challenge_assert();select * into p from challenge_points where id=p_point for update;
 if p.id is null or p.user_id=auth.uid() or p.voided then raise exception 'Only your partner can forgive an active point.';end if;
 update challenge_points set forgiven=p_forgive,voided=(not p_forgive and reason='day_forgiveness') where id=p.id;
 if p.entry_id is not null then update challenge_entries set status=case when p_forgive then 'excused' when status='excused' then 'missed' else status end where id=p.entry_id;end if;
 update challenge_requests set status=case when p_forgive then 'approved' else 'denied' end,decided_by=auth.uid(),decided_at=now() where point_id=p.id and status in ('pending','approved','denied');
 insert into challenge_audit(entry_id,actor,action,details) values(p.entry_id,auth.uid(),'partner_forgive',jsonb_build_object('point',p.id,'forgiven',p_forgive));
 delete from challenge_finalizations where true;perform challenge_rescore();end $$;
revoke all on function public.challenge_partner_forgive(uuid,boolean) from public,anon;
grant execute on function public.challenge_partner_forgive(uuid,boolean) to authenticated;

insert into public.challenge_scripts(name,ran_at) values('weekly-day-forgiveness.sql',now()) on conflict(name) do update set ran_at=now(),runs=challenge_scripts.runs+1;
commit;
