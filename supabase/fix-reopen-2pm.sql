-- Re-open any day that the old noon job already auto-marked as unlogged but
-- whose new 2 pm deadline has not passed yet. Run once, after fix-deadline-2pm.sql.
-- Days whose 2 pm deadline has already passed are left exactly as they are.

-- 1. A late correction made on such a day becomes a normal log.
update public.challenge_entries e
   set done=e.proposed_done,
       status=case when e.proposed_done then 'pending' else 'missed' end,
       note=coalesce(e.proposed_note,''),
       proof=e.proposed_proof,
       proposed_done=null, proposed_note=null, proposed_proof=null,
       updated_at=now()
 where e.status='unlogged' and e.proposed_done is not null
   and now()<((e.day+1)+time '14:00') at time zone 'America/Toronto';

update public.challenge_points p
   set reason='missed', voided=e.done
  from public.challenge_entries e
 where p.entry_id=e.id and p.reason='unlogged' and e.status in ('pending','missed');

-- 2. Everything else that was auto-marked is simply removed so it can be logged.
delete from public.challenge_points p
 using public.challenge_entries e
 where p.entry_id=e.id and p.reason='unlogged' and e.status='unlogged'
   and now()<((e.day+1)+time '14:00') at time zone 'America/Toronto';

delete from public.challenge_entries
 where status='unlogged'
   and now()<((day+1)+time '14:00') at time zone 'America/Toronto';

select public.challenge_rescore();
