-- DartArena global admin role + moderation controls
-- Run after the tournament/chat schema migrations.
-- Assign admin users separately in public.user_roles; no user ID is hardcoded here.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon;
grant select on public.user_roles to authenticated;

drop policy if exists "users read own role" on public.user_roles;
create policy "users read own role"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_delete_chat_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  delete from public.lobby_messages where id = p_message_id;
  if not found then
    raise exception 'Chat message not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_chat_message(uuid) from public;
grant execute on function public.admin_delete_chat_message(uuid) to authenticated;

create or replace function public.admin_delete_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select status into v_status
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found';
  end if;

  if v_status = 'finished' then
    raise exception 'Finished tournaments cannot be deleted';
  end if;

  if exists (
    select 1
    from public.tournament_matches
    where tournament_id = p_tournament_id
      and live_match_id is not null
  ) then
    raise exception 'Tournament cannot be deleted after a match has started';
  end if;

  delete from public.tournaments where id = p_tournament_id;
end;
$$;

revoke all on function public.admin_delete_tournament(uuid) from public;
grant execute on function public.admin_delete_tournament(uuid) to authenticated;

create or replace function public.correct_finished_tournament_result(
  p_tournament_match_id uuid,
  p_player1_legs integer,
  p_player2_legs integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tm public.tournament_matches%rowtype;
  nxt public.tournament_matches%rowtype;
  v_owner uuid;
  v_needed integer;
  v_winner uuid;
  v_winner_changed boolean;
begin
  select * into tm
  from public.tournament_matches
  where id = p_tournament_match_id
  for update;

  if not found then
    raise exception 'Tournament match not found';
  end if;

  select owner_id into v_owner
  from public.tournaments
  where id = tm.tournament_id;

  if auth.uid() is null or (auth.uid() is distinct from v_owner and not public.is_admin()) then
    raise exception 'Only the tournament leader or an admin can correct a finished result';
  end if;

  if tm.status not in ('finished','wo') then
    raise exception 'Only finished results can be corrected';
  end if;

  if tm.stage = 'group' and exists (
    select 1 from public.tournament_matches
    where tournament_id = tm.tournament_id
      and stage = 'cup'
  ) then
    raise exception 'Group results are locked after the cup has been created';
  end if;

  if tm.player1_id is null or tm.player2_id is null then
    raise exception 'A BYE/WO without two players cannot be converted to a normal result';
  end if;

  if p_player1_legs < 0 or p_player2_legs < 0 then
    raise exception 'Leg scores cannot be negative';
  end if;

  v_needed := (tm.best_of / 2) + 1;

  if p_player1_legs = v_needed and p_player2_legs < v_needed then
    v_winner := tm.player1_id;
  elsif p_player2_legs = v_needed and p_player1_legs < v_needed then
    v_winner := tm.player2_id;
  else
    raise exception 'Result must have exactly one winner at % legs', v_needed;
  end if;

  v_winner_changed := v_winner is distinct from tm.winner_id;

  if tm.stage = 'cup' and v_winner_changed then
    select * into nxt
    from public.tournament_matches
    where tournament_id = tm.tournament_id
      and stage = 'cup'
      and round_no = tm.round_no + 1
      and match_no = (tm.match_no + 1) / 2
    for update;

    if found then
      if nxt.status <> 'pending' or nxt.live_match_id is not null then
        raise exception 'Cannot change cup winner because the next match has already started';
      end if;

      if mod(tm.match_no,2)=1 then
        if nxt.player1_id is not null and nxt.player1_id is distinct from tm.winner_id then
          raise exception 'Next-round bracket slot no longer matches the old winner';
        end if;
      else
        if nxt.player2_id is not null and nxt.player2_id is distinct from tm.winner_id then
          raise exception 'Next-round bracket slot no longer matches the old winner';
        end if;
      end if;
    end if;
  end if;

  update public.tournament_matches
  set player1_legs = p_player1_legs,
      player2_legs = p_player2_legs,
      winner_id = v_winner,
      status = 'finished',
      is_wo = false,
      result_corrected_at = now(),
      result_corrected_by = auth.uid(),
      updated_at = now()
  where id = tm.id;

  if tm.stage = 'cup' and v_winner_changed and nxt.id is not null then
    if mod(tm.match_no,2)=1 then
      update public.tournament_matches
      set player1_id = v_winner,
          updated_at = now()
      where id = nxt.id
        and status = 'pending'
        and live_match_id is null
        and (player1_id is null or player1_id = tm.winner_id);
    else
      update public.tournament_matches
      set player2_id = v_winner,
          updated_at = now()
      where id = nxt.id
        and status = 'pending'
        and live_match_id is null
        and (player2_id is null or player2_id = tm.winner_id);
    end if;
  end if;
end;
$$;

revoke all on function public.correct_finished_tournament_result(uuid, integer, integer) from public;
grant execute on function public.correct_finished_tournament_result(uuid, integer, integer) to authenticated;
