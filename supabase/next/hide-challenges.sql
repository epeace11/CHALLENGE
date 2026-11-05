-- Hiding and deleting are per person (November 4, 2026). Rerunnable; run once on PROD CHALLENGE, after
-- settle-and-many.sql, before deploying the app that uses it. Fresh installs get the same from schema.sql.
-- It replaces delete-challenge.sql, which deleted a challenge for both people.
--
-- A finished challenge or a saved one can be hidden from your own Your challenges, brought back, or
-- deleted for good from your account. Your partner keeps theirs. It's only erased, with its screenshots,
-- once neither of you has it.
begin;

-- What each person has hidden or deleted. It's their own: their partner's Your challenges doesn't change.
create table if not exists public.hidden_challenges(
  challenge_id uuid not null references public.challenges on delete cascade,
  person_id uuid not null references public.profiles on delete cascade,
  status text not null check (status in ('hidden','deleted')),
  changed_at timestamptz not null default now(),
  primary key (challenge_id, person_id)
);
create table if not exists public.hidden_saved(
  saved_id uuid not null references public.saved_challenges on delete cascade,
  person_id uuid not null references public.profiles on delete cascade,
  status text not null check (status in ('hidden','deleted')),
  changed_at timestamptz not null default now(),
  primary key (saved_id, person_id)
);
alter table public.hidden_challenges enable row level security;
alter table public.hidden_saved enable row level security;
drop policy if exists read_own on public.hidden_challenges;
drop policy if exists read_own on public.hidden_saved;
create policy read_own on public.hidden_challenges for select to authenticated using (person_id = auth.uid());
create policy read_own on public.hidden_saved for select to authenticated using (person_id = auth.uid());
grant select on public.hidden_challenges, public.hidden_saved to authenticated;
revoke insert, update, delete on public.hidden_challenges, public.hidden_saved from anon, authenticated;

-- It now says whether anyone still has the challenge, which create or replace can't change.
drop function if exists public.nx_delete_challenge(uuid);

-- Hides a finished challenge from the viewer's own Your challenges, or brings it back. Their partner's
-- stays as it is.
create or replace function public.nx_hide_challenge(p_challenge uuid, p_hidden boolean) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status <> 'finished' then raise exception 'This challenge has to end first.'; end if;
  if p_hidden then
    insert into hidden_challenges(challenge_id, person_id, status) values (c.id, auth.uid(), 'hidden')
    on conflict (challenge_id, person_id) do update set status = 'hidden', changed_at = nx_now();
  else
    delete from hidden_challenges where challenge_id = c.id and person_id = auth.uid() and status = 'hidden';
  end if;
end $$;

-- Deletes a finished challenge from the viewer's account for good. Their partner keeps theirs. True once
-- neither has it: the app then removes its screenshots and calls nx_erase_challenge.
create or replace function public.nx_delete_challenge(p_challenge uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if c.status <> 'finished' then raise exception 'This challenge has to end first.'; end if;
  insert into hidden_challenges(challenge_id, person_id, status) values (c.id, auth.uid(), 'deleted')
  on conflict (challenge_id, person_id) do update set status = 'deleted', changed_at = nx_now();
  return not exists(select 1 from couple_members m where m.couple_id = c.couple_id
    and not exists(select 1 from hidden_challenges h where h.challenge_id = c.id and h.person_id = m.person_id and h.status = 'deleted'));
end $$;

-- Erases a challenge both people have deleted, with everything in it.
create or replace function public.nx_erase_challenge(p_challenge uuid) returns void language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  if exists(select 1 from couple_members m where m.couple_id = c.couple_id
    and not exists(select 1 from hidden_challenges h where h.challenge_id = c.id and h.person_id = m.person_id and h.status = 'deleted')) then
    raise exception 'Your partner still has this challenge.';
  end if;
  delete from challenges where id = c.id;
end $$;

-- A saved challenge, the same way: hidden or deleted for the viewer only, and gone once neither has it.
create or replace function public.nx_hide_saved(p_saved uuid, p_hidden boolean) returns void language plpgsql security definer set search_path = public as $$
declare s saved_challenges;
begin
  select * into s from saved_challenges where id = p_saved;
  if s.id is null or not nx_in_couple(s.couple_id) then raise exception 'That saved challenge is gone.'; end if;
  if p_hidden then
    insert into hidden_saved(saved_id, person_id, status) values (s.id, auth.uid(), 'hidden')
    on conflict (saved_id, person_id) do update set status = 'hidden', changed_at = nx_now();
  else
    delete from hidden_saved where saved_id = s.id and person_id = auth.uid() and status = 'hidden';
  end if;
end $$;

create or replace function public.nx_delete_saved(p_saved uuid) returns void language plpgsql security definer set search_path = public as $$
declare s saved_challenges;
begin
  select * into s from saved_challenges where id = p_saved;
  if s.id is null or not nx_in_couple(s.couple_id) then raise exception 'That saved challenge is gone.'; end if;
  insert into hidden_saved(saved_id, person_id, status) values (s.id, auth.uid(), 'deleted')
  on conflict (saved_id, person_id) do update set status = 'deleted', changed_at = nx_now();
  if not exists(select 1 from couple_members m where m.couple_id = s.couple_id
    and not exists(select 1 from hidden_saved h where h.saved_id = s.id and h.person_id = m.person_id and h.status = 'deleted')) then
    delete from saved_challenges where id = s.id;
  end if;
end $$;

revoke all on function public.nx_hide_challenge(uuid, boolean), public.nx_delete_challenge(uuid), public.nx_erase_challenge(uuid),
  public.nx_hide_saved(uuid, boolean), public.nx_delete_saved(uuid) from public, anon;
grant execute on function public.nx_hide_challenge(uuid, boolean), public.nx_delete_challenge(uuid), public.nx_erase_challenge(uuid),
  public.nx_hide_saved(uuid, boolean), public.nx_delete_saved(uuid) to authenticated;

commit;

-- On its own, so the functions above are saved even if this step needs attention.
drop policy if exists proofs_delete on storage.objects;
create policy proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and nx_in_challenge(((storage.foldername(name))[1])::uuid));
