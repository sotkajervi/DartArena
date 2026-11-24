create role anon;create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create table public.pentathlon_room_tests(id int primary key, match_id uuid, player1_id uuid not null, player2_id uuid not null, state jsonb not null, version bigint not null, last_actor uuid);
