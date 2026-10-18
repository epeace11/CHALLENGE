-- Share links for saved challenges (October 18, 2026). Rerunnable; run once on PROD CHALLENGE, which
-- was set up before this. Fresh installs get the same functions from schema.sql.
--
-- A saved challenge with its link on can be read by anyone with the link: its name, look, length,
-- stakes and rules, never who saved it, their answers or points. A signed-in person can save their
-- own copy, which starts with its link off.
begin;

-- Whose 'me' a saved challenge's rules mean (also added by fixes-oct-18.sql).
alter table public.saved_challenges add column if not exists saved_by uuid references public.profiles on delete set null;

create or replace function public.nx_shared_preview(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'name', s.name, 'look', s.look, 'days', s.days, 'step', s.step,
                            'cap', s.cap, 'rules', s.rules, 'created_at', s.created_at)
  from saved_challenges s
  where s.link_token = p_token and s.link_on
$$;

create or replace function public.nx_save_shared(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare s saved_challenges; couple uuid; out_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists(select 1 from profiles where id = auth.uid()) then raise exception 'Add your first name first.'; end if;
  select * into s from saved_challenges where link_token = p_token and link_on;
  if s.id is null then raise exception 'This link was turned off.'; end if;
  if nx_in_couple(s.couple_id) then return s.id; end if;
  select couple_id into couple from couple_members where person_id = auth.uid() order by joined_at desc limit 1;
  if couple is null then
    insert into couples default values returning id into couple;
    insert into couple_members(couple_id, person_id) values (couple, auth.uid());
  end if;
  insert into saved_challenges(couple_id, name, look, days, step, cap, rules, saved_by)
  values (couple, s.name, s.look, s.days, s.step, s.cap, s.rules, auth.uid())
  returning id into out_id;
  return out_id;
end $$;

revoke all on function public.nx_shared_preview(text), public.nx_save_shared(text) from public, anon;
grant execute on function public.nx_shared_preview(text) to anon, authenticated;
grant execute on function public.nx_save_shared(text) to authenticated;

commit;
