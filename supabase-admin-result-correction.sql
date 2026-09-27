-- DartArena: safe admin correction of finished tournament matches.
-- Run once in Supabase SQL Editor.
-- Allows score corrections on finished group/cup matches.
-- Group results lock once a cup bracket exists.
-- If the winner changes in a cup match, the next bracket slot is changed only
-- when the next match is still pending and has never started.

begin;

alter table public.tournament_matches
  add column if not exists result_corrected_at timestamptz;

alter table public.tournament_matches
  add column if not exists result_corrected_by uuid references auth.users(id) on delete set null;

create or replace function public.correct_finished_tournament_result(
  p_tournament_match_id uuid,
  p_player1_legs integer,
  p_player2_legs integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tm public.tournament_matches%rowtype;
  nxt public.tournament_matches%rowtype;
  v_owner uuid;
  v_needed integer;
  v_winner uuid;
  v_winner_changed boolean;
begin
  select *
    into tm
    from public.tournament_matches
   where id = p_tournament_match_id
   for update;

  if not found then
    raise exception 'Tournament match not found';
  end if;

  select owner_id
    into v_owner
    from public.tournaments
   where id = tm.tournament_id;

  if auth.uid() is null or auth.uid() is distinct from v_owner then
    raise exception 'Only the tournament leader can correct a finished result';
  end if;

  if tm.status not in ('finished','wo') then
    raise exception 'Only finished results can be corrected';
  end if;

  -- Once knockout matches exist, changing group standings could invalidate the
  -- bracket. Group corrections must therefore be done before cup creation.
  if tm.stage = 'group' and exists (
    select 1
      from public.tournament_matches
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

  -- Changing only the leg score is always safe. Changing the winner of a cup
  -- match is allowed only while its destination match has not started.
  if tm.stage = 'cup' and v_winner_changed then
    select *
      into nxt
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

  -- Do this explicitly as well as via the auto-advance trigger. This keeps the
  -- correction safe on databases where the trigger has not yet been installed.
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

commit;
