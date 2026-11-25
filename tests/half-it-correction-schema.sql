create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table public.matches(id uuid primary key,player1_id uuid not null,player2_id uuid not null,game_variant text not null,game_config jsonb,status text not null,current_leg integer default 1,player1_score integer default 0,player2_score integer default 0,turn_player_id uuid,match_starter_id uuid,player1_legs integer default 0,player2_legs integer default 0,legs integer default 3,winner_id uuid,finished_at timestamptz,updated_at timestamptz default now());
create table public.half_it_visits(id bigint generated always as identity primary key,match_id uuid not null references matches(id),player_id uuid not null,leg_no integer not null,round_no integer not null,darts jsonb not null,success boolean not null,round_points integer not null,score_before integer not null,score_after integer not null,exact_target integer,unique(match_id,player_id,leg_no,round_no));
create table public.half_it_match_state(match_id uuid primary key,exact_target integer,exact_options integer[],updated_at timestamptz default now());
