-- Fix for Supabase's safeupdate guard: DELETE/UPDATE inside RPC functions
-- must carry a WHERE clause. Safe to run on the live project; it only
-- replaces function bodies and touches no data.
-- Functions updated: challenge_log, challenge_review, challenge_forgive, challenge_decide, challenge_finalize

create or replace function public.challenge_log(p_rule text,p_day date,p_done boolean,p_note text default '',p_proof text default null) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_rules;e challenge_entries;late boolean; begin
 perform challenge_assert(); perform challenge_tick(); select * into r from challenge_rules where id=p_rule;
 if r.id is null or p_day not between (select start_date from challenge_config) and least((select end_date from challenge_config),(now() at time zone 'America/Toronto')::date) or (r.person is not null and r.person<>(select name from challenge_profiles where id=auth.uid())) or (r.weeknights and extract(dow from p_day)>4) then raise exception 'This habit is not available for that date.'; end if;
 if p_done and r.proof_required and p_proof is null then raise exception 'Attach a screenshot first.'; end if;
 if p_proof is not null and not exists(select 1 from storage.objects where bucket_id='challenge-proof' and name=p_proof and (storage.foldername(name))[1]=auth.uid()::text) then raise exception 'Invalid proof attachment.'; end if;
 select * into e from challenge_entries where user_id=auth.uid() and rule_id=p_rule and day=p_day;
 if e.status='disputed' then raise exception 'Resolve the dispute before editing.'; end if;
 late:=now()>((p_day+1)+time '12:00') at time zone 'America/Toronto';
 if late and e.id is null then
 insert into challenge_entries(user_id,rule_id,day,done,status) values(auth.uid(),p_rule,p_day,false,'unlogged') returning * into e;
 end if;
 if late and e.id is not null then
 update challenge_entries set proposed_done=p_done,proposed_note=left(p_note,2000),proposed_proof=p_proof,updated_at=now() where id=e.id;
 else
 insert into challenge_entries(user_id,rule_id,day,done,status,note,proof) values(auth.uid(),p_rule,p_day,p_done,case when p_done then 'pending' else 'missed' end,left(p_note,2000),p_proof) on conflict(user_id,rule_id,day) do update set done=excluded.done,status=excluded.status,note=excluded.note,proof=excluded.proof,updated_at=now() returning * into e;
 if not r.weekly then
 insert into challenge_points(user_id,rule_id,day,reason,entry_id,voided) values(auth.uid(),p_rule,p_day,'missed',e.id,p_done) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;
 end if;end if;
 insert into challenge_audit(entry_id,actor,action,details) values(e.id,auth.uid(),'log',jsonb_build_object('done',p_done,'late',late));
 delete from challenge_finalizations where true;perform challenge_rescore();end $$;

create or replace function public.challenge_review(p_entry uuid,p_action text,p_comment text default '') returns void language plpgsql security definer set search_path=public as $$ declare e challenge_entries;d challenge_disputes;begin
 perform challenge_assert();select * into e from challenge_entries where id=p_entry for update;if e.id is null then raise exception 'Entry not found';end if;
 if p_action in ('approve','dispute','reject_correction') then
 if e.user_id=auth.uid() then raise exception 'Only your partner can review this.';end if;
 if p_action='approve' then
 if e.status<>'pending' and e.proposed_done is null then raise exception 'This entry is not awaiting approval.';end if;
 update challenge_entries set done=coalesce(proposed_done,done),note=coalesce(proposed_note,note),proof=case when proposed_done is not null then proposed_proof else proof end,status=case when coalesce(proposed_done,done) then 'confirmed' else 'missed' end,proposed_done=null,proposed_note=null,proposed_proof=null where id=e.id returning * into e;
 if e.rule_id<>'gym' then insert into challenge_points(user_id,rule_id,day,reason,entry_id,voided) values(e.user_id,e.rule_id,e.day,'missed',e.id,e.done) on conflict(user_id,rule_id,day,slot) do update set voided=excluded.voided;end if;
 elsif p_action='reject_correction' then update challenge_entries set proposed_done=null,proposed_note=null,proposed_proof=null where id=e.id;
 else
 if e.status<>'pending' or e.proposed_done is not null or length(trim(p_comment))=0 then raise exception 'A pending entry and dispute reason are required.';end if;
 insert into challenge_disputes(entry_id,raised_by,comment) values(e.id,auth.uid(),left(p_comment,2000)); update challenge_entries set status='disputed' where id=e.id;
 end if;
 elsif p_action in ('concede','withdraw') then
 select * into d from challenge_disputes where entry_id=e.id and status='open' for update;
 if d.id is null or (p_action='concede' and e.user_id<>auth.uid()) or (p_action='withdraw' and d.raised_by<>auth.uid()) then raise exception 'You cannot resolve this dispute that way.';end if;
 update challenge_disputes set status=case when p_action='concede' then 'conceded' else 'withdrawn' end,resolved_at=now() where id=d.id;
 update challenge_entries set status=case when p_action='concede' then 'conceded' else 'confirmed' end,done=p_action<>'concede' where id=e.id;
 if p_action='concede' and e.rule_id<>'gym' then insert into challenge_points(user_id,rule_id,day,reason,entry_id) values(e.user_id,e.rule_id,e.day,'dispute_conceded',e.id) on conflict(user_id,rule_id,day,slot) do update set voided=false,reason='dispute_conceded';end if;
 else raise exception 'Unknown review action';end if;
 insert into challenge_audit(entry_id,actor,action,details) values(e.id,auth.uid(),p_action,jsonb_build_object('comment',p_comment));delete from challenge_finalizations where true;perform challenge_rescore();end $$;

create or replace function public.challenge_forgive(p_point uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();if length(trim(p_reason))=0 or not exists(select 1 from challenge_points where id=p_point and user_id=auth.uid() and not forgiven and not voided) then raise exception 'An active point and reason are required.';end if;
 insert into challenge_requests(point_id,requester_id,reason) values(p_point,auth.uid(),left(p_reason,2000));delete from challenge_finalizations where true;end $$;

create or replace function public.challenge_decide(p_request uuid,p_approve boolean) returns void language plpgsql security definer set search_path=public as $$ declare r challenge_requests;p challenge_points;begin
 perform challenge_assert();select * into r from challenge_requests where id=p_request for update;
 if r.id is null or r.requester_id=auth.uid() or r.status<>'pending' then raise exception 'Only your partner can decide a pending request.';end if;
 update challenge_requests set status=case when p_approve then 'approved' else 'denied' end,decided_by=auth.uid(),decided_at=now() where id=r.id;
 if p_approve then update challenge_points set forgiven=true where id=r.point_id returning * into p;update challenge_entries set status='excused' where id=p.entry_id;end if;delete from challenge_finalizations where true;end $$;

create or replace function public.challenge_finalize() returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();perform challenge_tick();
 if now()<((select end_date+1 from challenge_config)+time '12:00') at time zone 'America/Toronto' then raise exception 'Finalize after October 1 at noon.';end if;
 if exists(select 1 from challenge_entries where status in ('pending','disputed') or proposed_done is not null) or exists(select 1 from challenge_requests where status='pending') then raise exception 'Resolve all reviews, corrections and forgiveness requests first.';end if;
 insert into challenge_finalizations(user_id) values(auth.uid()) on conflict do nothing;
 if (select count(*) from challenge_finalizations)=2 then update challenge_config set finalized=true where id=1;end if;end $$;
