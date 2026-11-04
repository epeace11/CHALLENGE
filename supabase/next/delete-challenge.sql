-- Deleting a challenge (November 4, 2026). Rerunnable; run once on PROD CHALLENGE, after
-- settle-and-many.sql, before deploying the app that uses it. Fresh installs get the same from schema.sql.
--
-- nx_delete_challenge deletes a challenge for both people, with everything in it, and its saved copy.
-- nx_delete_saved deletes a saved challenge. proofs_delete lets a member remove a challenge's screenshots,
-- which the app does first.
begin;

-- Deletes a challenge for both people, with everything in it: answers, points, notes, gifts, and its
-- saved copy unless another challenge shares the name. The app removes its screenshots first. A running
-- challenge has to end first, which takes both.
create or replace function public.nx_delete_challenge(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status = 'running' then raise exception 'A running challenge has to end first. Ending takes you both.'; end if;
  delete from saved_challenges s where s.couple_id = c.couple_id and s.name = c.name
    and not exists(select 1 from challenges x where x.couple_id = c.couple_id and x.name = c.name and x.id <> c.id);
  delete from challenges where id = c.id;
end $$;

-- Deletes a saved challenge; its share link stops working.
create or replace function public.nx_delete_saved(p_saved uuid) returns void language plpgsql security definer set search_path = public as $$
declare s saved_challenges;
begin
  select * into s from saved_challenges where id = p_saved;
  if s.id is null or not nx_in_couple(s.couple_id) then raise exception 'That saved challenge is gone.'; end if;
  delete from saved_challenges where id = s.id;
end $$;

revoke all on function public.nx_delete_challenge(uuid), public.nx_delete_saved(uuid) from public, anon;
grant execute on function public.nx_delete_challenge(uuid), public.nx_delete_saved(uuid) to authenticated;

drop policy if exists proofs_delete on storage.objects;
create policy proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid));

commit;
