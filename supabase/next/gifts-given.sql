-- Gifts given (October 18, 2026). Rerunnable; run once on PROD CHALLENGE, which was set up before
-- this. Fresh installs get the same from schema.sql.
--
-- The verdict's "Mark gift given" is saved, so both people see which gifts have been given.
begin;

-- Which finished challenge's gifts have been given, by who receives them. Either person can mark one.
create table if not exists public.gifts_given(
  challenge_id uuid not null references public.challenges on delete cascade,
  recipient_id uuid not null references public.profiles,
  marked_by uuid not null references public.profiles,
  given_at timestamptz not null default now(),
  primary key (challenge_id, recipient_id)
);
alter table public.gifts_given enable row level security;
drop policy if exists read_own on public.gifts_given;
create policy read_own on public.gifts_given for select to authenticated using (nx_in_challenge(challenge_id));
grant select on public.gifts_given to authenticated;
revoke insert, update, delete on public.gifts_given from anon, authenticated;

-- Marks the gift `p_recipient` gets as given (or not) once the challenge is over.
create or replace function public.nx_mark_gift(p_challenge uuid, p_recipient uuid, p_given boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c challenges := nx_enter(p_challenge);
begin
  perform nx_tick(c.id);
  if (select status from challenges where id = c.id) <> 'finished' then raise exception 'Gifts are given once the challenge is over.'; end if;
  if not exists(select 1 from couple_members where couple_id = c.couple_id and person_id = p_recipient) then
    raise exception 'That gift isn''t part of this challenge.';
  end if;
  if p_given then
    insert into gifts_given(challenge_id, recipient_id, marked_by, given_at) values (c.id, p_recipient, auth.uid(), nx_now())
    on conflict (challenge_id, recipient_id) do nothing;
  else
    delete from gifts_given where challenge_id = c.id and recipient_id = p_recipient;
  end if;
end $$;

revoke all on function public.nx_mark_gift(uuid, uuid, boolean) from public, anon;
grant execute on function public.nx_mark_gift(uuid, uuid, boolean) to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'gifts_given') then
    alter publication supabase_realtime add table public.gifts_given;
  end if;
end $$;

commit;
