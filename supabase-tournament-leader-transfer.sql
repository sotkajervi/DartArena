-- DartArena: transfer an active tournament's leadership to a registered participant.
-- The caller must be the current leader. A finished/cancelled tournament is immutable.
create or replace function public.transfer_tournament_leader(
  p_tournament_id uuid,
  p_new_owner_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tournament public.tournaments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Du må være innlogget';
  end if;

  if p_tournament_id is null or p_new_owner_id is null then
    raise exception 'Turnering og ny turneringsleder må velges';
  end if;

  select * into v_tournament
    from public.tournaments
   where id = p_tournament_id
   for update;
  if not found then
    raise exception 'Turneringen finnes ikke';
  end if;

  if v_tournament.owner_id is distinct from auth.uid() then
    raise exception 'Bare nåværende turneringsleder kan overføre rollen';
  end if;

  if v_tournament.status in ('finished', 'cancelled') then
    raise exception 'En avsluttet turnering kan ikke få ny leder';
  end if;

  if v_tournament.owner_id = p_new_owner_id then
    raise exception 'Velg en annen deltaker';
  end if;

  if not exists (
    select 1 from public.tournament_members
    where tournament_id = p_tournament_id
      and user_id = p_new_owner_id
      and role = 'participant'
  ) then
    raise exception 'Ny turneringsleder må være påmeldt deltaker';
  end if;

  update public.tournaments
     set owner_id = p_new_owner_id,
         updated_at = now()
   where id = p_tournament_id;
  return p_new_owner_id;
end;
$function$;

revoke all on function public.transfer_tournament_leader(uuid, uuid) from public, anon, authenticated;
grant execute on function public.transfer_tournament_leader(uuid, uuid) to authenticated;
