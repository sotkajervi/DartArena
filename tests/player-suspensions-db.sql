\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create schema dartarena_moderation_private;
revoke all on schema dartarena_moderation_private from public,anon,authenticated;
grant usage on schema dartarena_moderation_private to authenticated;
create table public.profiles(id uuid primary key,status text not null default 'available',last_seen timestamptz not null default now());
insert into public.profiles(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
create table public.user_roles(user_id uuid,role text);
insert into public.user_roles values('33333333-3333-4333-8333-333333333333','owner'),('44444444-4444-4444-8444-444444444444','admin');
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('owner','admin'))$$;
create table public.challenges(id uuid primary key default gen_random_uuid(),challenger_id uuid,challenged_id uuid,status text default 'pending');
create table public.matches(id uuid primary key default gen_random_uuid(),player1_id uuid,player2_id uuid,status text default 'playing',deleted_at timestamptz);
create table public.tournaments(id uuid primary key default gen_random_uuid(),owner_id uuid,status text default 'registration');
create table public.tournament_members(tournament_id uuid,user_id uuid);
create table public.tournament_group_players(tournament_id uuid,user_id uuid);
create table public.tournament_matches(tournament_id uuid,player1_id uuid,player2_id uuid,status text default 'pending');
create table public.lobby_messages(sender_id uuid,body text);
do $body$ declare tab text;begin
 foreach tab in array array['challenge_match_proposals','match_throws','cricket_match_state','cricket_visits','half_it_match_state','half_it_visits','sixty_one_match_state','sixty_one_visits','jdc_match_turns','tournament_groups','tournament_ai_rivals','tournament_ai_group_matches','pentathlon_room_tests'] loop
 execute format('create table public.%I(id int default 1)',tab);
 end loop;
end $body$;
grant select,insert,update,delete on all tables in schema public to authenticated;
\ir ../supabase-player-suspensions.sql
insert into public.challenges(challenger_id,challenged_id) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $check$begin
 begin perform public.manage_player_suspension('22222222-2222-4222-8222-222222222222','24h','test');raise exception 'ordinary moderation allowed';exception when insufficient_privilege then null;end;
end $check$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $check$begin
 begin perform public.manage_player_suspension('44444444-4444-4444-8444-444444444444','24h','test');raise exception 'staff suspended';exception when insufficient_privilege then null;end;
 begin perform public.manage_player_suspension('11111111-1111-4111-8111-111111111111','24h',' ');raise exception 'empty reason allowed';exception when invalid_parameter_value then null;end;
end $check$;
insert into public.matches(player1_id,player2_id) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
do $check$begin
 begin perform public.manage_player_suspension('11111111-1111-4111-8111-111111111111','24h','test');raise exception 'active match suspension allowed';exception when invalid_parameter_value then null;end;
end $check$;
update public.matches set status='finished';
insert into public.challenges(challenger_id,challenged_id,status) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','room');
do $check$begin
 begin perform public.manage_player_suspension('11111111-1111-4111-8111-111111111111','24h','test');raise exception 'room suspension allowed';exception when invalid_parameter_value then null;end;
end $check$;
update public.challenges set status='cancelled' where status='room';
insert into public.tournaments(owner_id) values('22222222-2222-4222-8222-222222222222');
insert into public.tournament_members(tournament_id,user_id) select id,'11111111-1111-4111-8111-111111111111' from public.tournaments;
do $check$begin
 begin perform public.manage_player_suspension('11111111-1111-4111-8111-111111111111','24h','test');raise exception 'tournament suspension allowed';exception when invalid_parameter_value then null;end;
end $check$;
update public.tournaments set status='finished';
select public.manage_player_suspension('11111111-1111-4111-8111-111111111111','24h','Misconduct');
do $check$begin
 if (select count(*) from public.player_suspensions)<>1 or not exists(select 1 from public.player_suspensions where imposed_by=auth.uid() and ends_at-imposed_at=interval '24 hours') then raise exception 'audit missing';end if;
 begin perform public.manage_player_suspension('11111111-1111-4111-8111-111111111111','7d','duplicate');raise exception 'duplicate suspension allowed';exception when invalid_parameter_value then null;end;
end $check$;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $check$begin
 if (public.get_my_suspension()->>'active')::boolean is distinct from true or public.get_my_suspension()->>'reason'<>'Misconduct' then raise exception 'own status missing';end if;
 if exists(select 1 from public.player_suspensions) then raise exception 'history leaked';end if;
 begin insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'22222222-2222-4222-8222-222222222222');raise exception 'outgoing allowed';exception when insufficient_privilege then null;end;
 begin insert into public.lobby_messages values(auth.uid(),'test');raise exception 'chat allowed';exception when insufficient_privilege then null;end;
 begin insert into public.tournaments(owner_id) values(auth.uid());raise exception 'tournament creation allowed';exception when insufficient_privilege then null;end;
 begin insert into public.tournament_members select id,auth.uid() from public.tournaments;raise exception 'registration allowed';exception when insufficient_privilege then null;end;
 begin insert into public.match_throws default values;raise exception 'score write allowed';exception when insufficient_privilege then null;end;
 begin insert into public.player_suspensions(player_id,imposed_by,reason) values(auth.uid(),auth.uid(),'spoof');raise exception 'direct insert allowed';exception when insufficient_privilege then null;end;
 update public.profiles set status='available',last_seen=now() where id=auth.uid();
 if exists(select 1 from public.profiles where id=auth.uid() and (status<>'unavailable' or last_seen>now()-interval '5 minutes')) then raise exception 'presence allowed';end if;
end $check$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $check$begin
 if (public.get_my_suspension()->>'active')::boolean is distinct from false then raise exception 'wrong own status';end if;
 begin insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'11111111-1111-4111-8111-111111111111');raise exception 'incoming allowed';exception when insufficient_privilege then null;end;
 begin update public.challenges set status='room' where status='pending';raise exception 'pending accept allowed';exception when insufficient_privilege then null;end;
 begin insert into public.matches(player1_id,player2_id) values(auth.uid(),'11111111-1111-4111-8111-111111111111');raise exception 'match creation allowed';exception when insufficient_privilege then null;end;
end $check$;
insert into public.lobby_messages values(auth.uid(),'normal chat');
insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'44444444-4444-4444-8444-444444444444');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.manage_player_suspension('11111111-1111-4111-8111-111111111111','revoke','Reviewed');
select public.manage_player_suspension('11111111-1111-4111-8111-111111111111','7d','New incident');
reset role;
update public.player_suspensions set imposed_at=now()-interval '8 days',ends_at=now()-interval '1 day' where revoked_at is null;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $check$begin if (public.get_my_suspension()->>'active')::boolean is distinct from false then raise exception 'automatic expiry failed';end if;end $check$;
insert into public.lobby_messages values(auth.uid(),'after expiry');
insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'22222222-2222-4222-8222-222222222222');
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
select public.manage_player_suspension('11111111-1111-4111-8111-111111111111','permanent','Permanent case');
do $check$begin if (select count(*) from public.player_suspensions)<>3 or not exists(select 1 from public.player_suspensions where revoked_by=auth.uid() and revocation_reason='Reviewed') or not exists(select 1 from public.player_suspensions where ends_at is null and revoked_at is null) then raise exception 'history failed';end if;end $check$;
reset role;
set role anon;
do $check$begin
 begin perform public.get_my_suspension();raise exception 'anon read allowed';exception when insufficient_privilege then null;end;
 begin perform public.manage_player_suspension('11111111-1111-4111-8111-111111111111','revoke','anon');raise exception 'anon write allowed';exception when insufficient_privilege then null;end;
end $check$;
reset role;
