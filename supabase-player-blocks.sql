-- Direct challenges only. No changes to tournaments, matches, or media.
begin;
create schema if not exists dartarena_moderation_private;
grant usage on schema dartarena_moderation_private to authenticated;
create table public.player_blocks(
 blocker_id uuid not null references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id),
 check(blocker_id<>blocked_id)
);
create index player_blocks_reverse_idx on public.player_blocks(blocked_id,blocker_id);
alter table public.player_blocks enable row level security;
revoke all on public.player_blocks from public,anon,authenticated;
grant select on public.player_blocks to authenticated;
create policy player_blocks_read_own on public.player_blocks for select to authenticated using(blocker_id=(select auth.uid()));
-- Shared unordered-pair lock. Block, unblock, and new direct invitations are serialized.
create function dartarena_moderation_private.block_pair_key(a uuid,b uuid) returns bigint
language sql immutable strict set search_path='' as $body$
 select pg_catalog.hashtextextended(least(a,b)::text||':'||greatest(a,b)::text,16072026)
$body$;
revoke all on function dartarena_moderation_private.block_pair_key(uuid,uuid) from public,anon,authenticated;
create function dartarena_moderation_private.set_block(p_target_id uuid,p_blocked boolean) returns boolean
language plpgsql security definer set search_path='' as $body$
declare actor uuid:=auth.uid();
begin
 if actor is null or p_target_id is null or actor=p_target_id or p_blocked is null then raise exception 'invalid_target' using errcode='22023';end if;
 if not exists(select 1 from public.profiles where id=actor) or not exists(select 1 from public.profiles where id=p_target_id) then raise exception 'invalid_target' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(dartarena_moderation_private.block_pair_key(actor,p_target_id));
 if p_blocked then
  insert into public.player_blocks(blocker_id,blocked_id) values(actor,p_target_id) on conflict do nothing;
  -- Existing pending requests expire as ordinary decline/cancel, without disclosing the block.
  update public.challenges set status=case when challenger_id=actor then 'cancelled' else 'declined' end
   where status='pending' and ((challenger_id=actor and challenged_id=p_target_id) or (challenger_id=p_target_id and challenged_id=actor));
 else
  delete from public.player_blocks where blocker_id=actor and blocked_id=p_target_id;
 end if;
 return p_blocked;
end $body$;
revoke all on function dartarena_moderation_private.set_block(uuid,boolean) from public,anon,authenticated;
grant execute on function dartarena_moderation_private.set_block(uuid,boolean) to authenticated;
create function public.set_player_block(p_target_id uuid,p_blocked boolean) returns boolean
language sql security invoker set search_path='' as $body$
 select dartarena_moderation_private.set_block(p_target_id,p_blocked)
$body$;
revoke all on function public.set_player_block(uuid,boolean) from public,anon;
grant execute on function public.set_player_block(uuid,boolean) to authenticated;
create function dartarena_moderation_private.guard_blocked_challenge() returns trigger
language plpgsql security definer set search_path='' as $body$
declare pair_key bigint;
begin
 if tg_op='UPDATE' then
  if old.status<>'pending' or new.status<>'room' then return new;end if;
 end if;
 pair_key:=dartarena_moderation_private.block_pair_key(new.challenger_id,new.challenged_id);
 if tg_op='INSERT' then
  perform pg_catalog.pg_advisory_xact_lock(pair_key);
 else
  -- UPDATE already has a row lock. Never wait on the pair lock, or deadlock with set_block.
  if not pg_catalog.pg_try_advisory_xact_lock(pair_key) then raise exception 'Challenge unavailable' using errcode='42501';end if;
 end if;
 if exists(select 1 from public.player_blocks where (blocker_id=new.challenger_id and blocked_id=new.challenged_id) or (blocker_id=new.challenged_id and blocked_id=new.challenger_id)) then
  raise exception 'Challenge unavailable' using errcode='42501';
 end if;
 return new;
end $body$;
revoke all on function dartarena_moderation_private.guard_blocked_challenge() from public,anon,authenticated;
create trigger challenge_block_insert before insert on public.challenges for each row execute function dartarena_moderation_private.guard_blocked_challenge();
create trigger challenge_block_accept before update of status on public.challenges for each row execute function dartarena_moderation_private.guard_blocked_challenge();
commit;
