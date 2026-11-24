create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.user_roles(user_id uuid,role text);
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
create table public.tournaments(id uuid primary key,owner_id uuid,status text,tournament_type text);
create table public.tournament_groups(id uuid primary key,tournament_id uuid,best_of int);
create table public.tournament_group_players(tournament_id uuid,group_id uuid,user_id uuid);
create table public.tournament_matches(id uuid primary key default gen_random_uuid(),tournament_id uuid not null,stage text not null,group_id uuid,round_no int not null,match_no int not null,player1_id uuid,player2_id uuid,best_of int not null check(best_of between 3 and 21 and mod(best_of,2)=1),player1_legs int,player2_legs int,winner_id uuid,status text not null default 'pending',is_wo boolean not null default false,live_match_id uuid,result_corrected_at timestamptz,result_corrected_by uuid,is_final boolean not null default false,ai_rival_wo boolean not null default false);
grant select on public.tournaments,public.tournament_groups,public.tournament_group_players to authenticated;
grant select,insert,delete on public.tournament_matches to authenticated;
grant update(best_of,is_final) on public.tournament_matches to authenticated;
alter table public.tournament_matches enable row level security;
create policy "finalists update pending final best of" on public.tournament_matches for UPDATE to authenticated using ((is_final AND (stage = 'cup'::text) AND (status = 'pending'::text) AND (live_match_id IS NULL) AND (player1_id IS NOT NULL) AND (player2_id IS NOT NULL) AND ((auth.uid() = player1_id) OR (auth.uid() = player2_id) OR (EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND ((t.owner_id = auth.uid()) OR is_admin()))))))) with check ((is_final AND (stage = 'cup'::text) AND (status = 'pending'::text) AND (live_match_id IS NULL) AND (player1_id IS NOT NULL) AND (player2_id IS NOT NULL) AND ((best_of >= 3) AND (best_of <= 21)) AND (mod(best_of, 2) = 1) AND ((auth.uid() = player1_id) OR (auth.uid() = player2_id) OR (EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND ((t.owner_id = auth.uid()) OR is_admin())))))));
create policy "manager deletes pending tournament matches" on public.tournament_matches for DELETE to authenticated using (((status = 'pending'::text) AND (EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND ((t.owner_id = auth.uid()) OR is_admin()))))));
create policy "manager inserts tournament matches" on public.tournament_matches for INSERT to authenticated with check ((EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND ((t.owner_id = auth.uid()) OR is_admin())))));
create policy "managers update cup final flag" on public.tournament_matches for UPDATE to authenticated using (((stage = 'cup'::text) AND (EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND ((t.owner_id = auth.uid()) OR is_admin())))))) with check (((stage = 'cup'::text) AND (EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND ((t.owner_id = auth.uid()) OR is_admin()))))));
create policy "tournament matches readable" on public.tournament_matches for SELECT to authenticated using (true);
CREATE OR REPLACE FUNCTION public.sync_tournament_cup_final_flag()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.stage<>'cup' then return null; end if;
  update public.tournament_matches tm
  set is_final=(
    tm.match_no=1
    and tm.round_no=(
      select max(x.round_no)
      from public.tournament_matches x
      where x.tournament_id=new.tournament_id and x.stage='cup'
    )
    and 1=(
      select count(*)
      from public.tournament_matches y
      where y.tournament_id=new.tournament_id and y.stage='cup' and y.round_no=tm.round_no
    )
  )
  where tm.tournament_id=new.tournament_id and tm.stage='cup';
  return null;
end;
$function$;
create constraint trigger tournament_cup_final_flag_sync after insert on public.tournament_matches deferrable initially deferred for each row when(new.stage='cup') execute function public.sync_tournament_cup_final_flag();
