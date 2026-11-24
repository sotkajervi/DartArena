create role anon;create role authenticated;create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.matches(id uuid primary key,player1_id uuid,player2_id uuid,game int default 501,game_variant text default 'x01',game_config jsonb default '{}',status text default 'playing',player1_score int default 100,player2_score int default 501,player1_legs int default 0,player2_legs int default 0,legs int default 3,current_set int default 1,current_leg int default 1,match_mode text default 'legs',best_of_sets int default 1,player1_sets int default 0,player2_sets int default 0,match_starter_id uuid,turn_player_id uuid,winner_id uuid,finished_at timestamptz,updated_at timestamptz,deleted_at timestamptz);
create table public.match_throws(id bigint primary key,match_id uuid,player_id uuid,score int,darts_used int default 3,is_checkout bool default false,set_no int default 1,leg_no int default 1,created_at timestamptz default now(),updated_at timestamptz);
create table public.sixty_one_visits(id bigint primary key,match_id uuid);
create table public.sixty_one_match_state(match_id uuid primary key,undo_snapshot jsonb,undo_visit_id bigint,undo_player_id uuid,player1_target int,player2_target int,player1_attempts int,player2_attempts int,leg_started_at timestamptz,game_started_at timestamptz,leg_duration_seconds int,player1_high_checkout int,player2_high_checkout int,sudden_death bool,sudden_death_first_player_id uuid,sudden_death_first_result text,updated_at timestamptz);
CREATE OR REPLACE FUNCTION public.x01_can_checkout(p_score integer, p_darts integer)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_values integer[];
  v_doubles integer[];
  a integer;
  b integer;
begin
  if p_score is null or p_darts not between 1 and 3 or p_score < 2 or p_score > 170 then
    return false;
  end if;

  select array_agg(distinct v order by v)
    into v_values
  from (
    select 0 as v
    union all select generate_series(1,20)
    union all select generate_series(1,20) * 2
    union all select generate_series(1,20) * 3
    union all select 25
    union all select 50
  ) s;

  select array_agg(v order by v)
    into v_doubles
  from (
    select generate_series(1,20) * 2 as v
    union all select 50
  ) d;

  if p_darts = 1 then
    return p_score = any(v_doubles);
  end if;

  foreach a in array v_values loop
    if p_darts = 2 then
      if (p_score - a) = any(v_doubles) then
        return true;
      end if;
    else
      foreach b in array v_values loop
        if (p_score - a - b) = any(v_doubles) then
          return true;
        end if;
      end loop;
    end if;
  end loop;

  return false;
end;
$function$;
CREATE OR REPLACE FUNCTION public.x01_valid_visit_score(p_score integer)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select p_score between 0 and 180
     and p_score not in (163,166,169,172,173,175,176,178,179);
$function$;
