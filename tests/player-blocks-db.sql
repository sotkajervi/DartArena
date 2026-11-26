\set ON_ERROR_STOP on
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table public.profiles(id uuid primary key);
insert into public.profiles values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
create table public.challenges(id uuid primary key default gen_random_uuid(),challenger_id uuid not null,challenged_id uuid not null,status text not null default 'pending');
grant select,insert,update on public.challenges to authenticated;
alter table public.challenges enable row level security;
create policy challenge_read on public.challenges for select to authenticated using(auth.uid() in (challenger_id,challenged_id));
create policy challenge_insert on public.challenges for insert to authenticated with check(auth.uid()=challenger_id and status='pending');
create policy challenge_update on public.challenges for update to authenticated using(auth.uid() in (challenger_id,challenged_id));
create function public.guard_challenge_update() returns trigger language plpgsql as $body$
begin
 if old.status='pending' and new.status='room' and auth.uid()=old.challenged_id then return new;end if;
 if old.status='pending' and new.status='declined' and auth.uid()=old.challenged_id then return new;end if;
 if old.status='pending' and new.status='cancelled' and auth.uid()=old.challenger_id then return new;end if;
 raise exception 'Invalid challenge state transition';
end $body$;
create trigger challenge_update_guard before update on public.challenges for each row execute function public.guard_challenge_update();
create table public.tournament_matches(id uuid primary key default gen_random_uuid(),player1_id uuid,player2_id uuid,status text);
\ir ../supabase-player-blocks.sql
insert into public.challenges(challenger_id,challenged_id,status) values
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','pending'),
 ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','pending'),
 ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','room');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.set_player_block('22222222-2222-4222-8222-222222222222',true);
do $check$ begin
 if (select count(*) from public.player_blocks)<>1 then raise exception 'own block missing';end if;
 if (select count(*) from public.challenges where status='pending')<>0 or (select count(*) from public.challenges where status='room')<>1 then raise exception 'pending or active room handling';end if;
 if (select count(*) from public.challenges where status='cancelled')<>1 or (select count(*) from public.challenges where status='declined')<>1 then raise exception 'pending state mismatch';end if;
 begin insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'22222222-2222-4222-8222-222222222222');raise exception 'blocked outbound allowed';exception when insufficient_privilege then null;end;
 begin insert into public.player_blocks values(auth.uid(),'33333333-3333-4333-8333-333333333333',now());raise exception 'direct block insert allowed';exception when insufficient_privilege then null;end;
 begin perform public.set_player_block(auth.uid(),true);raise exception 'self block allowed';exception when invalid_parameter_value then null;end;
end $check$;
insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'33333333-3333-4333-8333-333333333333');
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $check$ begin
 if (select count(*) from public.player_blocks)<>0 then raise exception 'block leaked';end if;
 begin insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'11111111-1111-4111-8111-111111111111');raise exception 'blocked inbound allowed';exception when insufficient_privilege then null;end;
end $check$;
select public.set_player_block('11111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.set_player_block('22222222-2222-4222-8222-222222222222',false);
do $check$ begin
 begin insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'22222222-2222-4222-8222-222222222222');raise exception 'reciprocal block removed';exception when insufficient_privilege then null;end;
end $check$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.set_player_block('11111111-1111-4111-8111-111111111111',false);
insert into public.challenges(challenger_id,challenged_id) values(auth.uid(),'11111111-1111-4111-8111-111111111111');
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
update public.challenges set status='room' where status='pending' and challenged_id=auth.uid();
select public.set_player_block('22222222-2222-4222-8222-222222222222',true);
reset role;
insert into public.tournament_matches(player1_id,player2_id,status) values('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','playing');
do $check$ begin if (select count(*) from public.challenges where status='room')<>2 then raise exception 'existing room closed';end if;end $check$;
set role anon;
do $check$ begin
 begin perform count(*) from public.player_blocks;raise exception 'anon read allowed';exception when insufficient_privilege then null;end;
 begin perform public.set_player_block('11111111-1111-4111-8111-111111111111',true);raise exception 'anon write allowed';exception when insufficient_privilege then null;end;
end $check$;
reset role;
