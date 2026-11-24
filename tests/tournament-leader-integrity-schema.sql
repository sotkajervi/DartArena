create role anon;create role authenticated;create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.user_roles(user_id uuid,role text);
create table public.tournaments(id uuid primary key,name text,owner_id uuid not null,tournament_type text default 'groups_cup',starts_at timestamptz default now(),status text default 'registration',registration_open boolean default true,created_at timestamptz default now(),updated_at timestamptz default now(),finished_at timestamptz,stats_enabled boolean default true,game int default 501,game_variant text default 'x01',cup_game int default 501,cup_game_variant text default 'x01',archived_at timestamptz,archived_by uuid);
create table public.tournament_members(tournament_id uuid,user_id uuid,role text);
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.user_roles
    where user_id=auth.uid() and role in ('admin','owner')
  );
$function$;
CREATE OR REPLACE FUNCTION public.transfer_tournament_leader(p_tournament_id uuid, p_new_owner_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_tournament public.tournaments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Du må være innlogget';
  end if;

  if p_tournament_id is null or p_new_owner_id is null then
    raise exception 'Turnering og ny turneringsleder må velges';
  end if;

  select *
    into v_tournament
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
    select 1
      from public.tournament_members
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
CREATE OR REPLACE FUNCTION public.archive_finished_tournament()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
 if new.status='finished' and old.status is distinct from new.status and new.archived_at is null then
  new.archived_at=coalesce(new.finished_at,now());
 end if;
 return new;
end$function$;
create trigger tournament_auto_archive_finished before update of status on public.tournaments for each row execute function public.archive_finished_tournament();
revoke all on function public.transfer_tournament_leader(uuid,uuid) from public,anon;
grant execute on function public.transfer_tournament_leader(uuid,uuid) to authenticated,service_role;
grant select,insert,update on public.tournaments to authenticated;
alter table public.tournaments enable row level security;
create policy "manager updates tournament" on public.tournaments for update to authenticated using(owner_id=auth.uid() or public.is_admin()) with check(owner_id=auth.uid() or public.is_admin());
create policy "signed in users read tournaments" on public.tournaments for select to authenticated using(true);
create policy "users create owned tournaments" on public.tournaments for insert to authenticated with check(owner_id=auth.uid());
