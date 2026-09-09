-- Forgiveness fixes:
--  * Asking again after a denial (or editing a pending ask) updates the existing
--    request instead of failing on the one-request-per-point rule.
--  * New challenge_partner_forgive: the partner can forgive (or undo forgiving)
--    any active point directly, without waiting for a request.
-- Safe to rerun; changes no data.

create or replace function public.challenge_forgive(p_point uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform challenge_assert();if length(trim(p_reason))=0 or not exists(select 1 from challenge_points where id=p_point and user_id=auth.uid() and not forgiven and not voided) then raise exception 'An active point and reason are required.';end if;
 insert into challenge_requests(point_id,requester_id,reason) values(p_point,auth.uid(),left(p_reason,2000))
 on conflict(point_id) do update set reason=excluded.reason,status='pending',decided_by=null,decided_at=null where challenge_requests.status<>'approved';
 delete from challenge_finalizations where true;end $$;

create or replace function public.challenge_partner_forgive(p_point uuid,p_forgive boolean) returns void language plpgsql security definer set search_path=public as $$ declare p challenge_points;begin
 perform challenge_assert();select * into p from challenge_points where id=p_point for update;
 if p.id is null or p.user_id=auth.uid() or p.voided then raise exception 'Only your partner can forgive an active point.';end if;
 update challenge_points set forgiven=p_forgive where id=p.id;
 if p.entry_id is not null then update challenge_entries set status=case when p_forgive then 'excused' when status='excused' then 'missed' else status end where id=p.entry_id;end if;
 update challenge_requests set status=case when p_forgive then 'approved' else 'denied' end,decided_by=auth.uid(),decided_at=now() where point_id=p.id and status in ('pending','approved','denied');
 insert into challenge_audit(entry_id,actor,action,details) values(p.entry_id,auth.uid(),'partner_forgive',jsonb_build_object('point',p.id,'forgiven',p_forgive));
 delete from challenge_finalizations where true;perform challenge_rescore();end $$;

grant execute on function public.challenge_partner_forgive(uuid,boolean) to authenticated;
