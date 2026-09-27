-- DartArena cup progression.
-- Safe to run more than once in Supabase SQL Editor.

create or replace function public.advance_tournament_cup(p_tournament_id uuid)
returns setof public.tournament_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tournaments%rowtype;
  src public.tournament_matches%rowtype;
  dst public.tournament_matches%rowtype;
begin
  select * into t from public.tournaments
  where id = p_tournament_id for update;
  if not found then raise exception 'Tournament not found'; end if;
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if auth.uid() is distinct from t.owner_id and not exists (
    select 1 from public.tournament_members
    where tournament_id = t.id and user_id = auth.uid()
      and role = 'participant'
  ) then raise exception 'Not a tournament participant'; end if;
  if t.status <> 'cup' then raise exception 'Cup is not active'; end if;

  perform 1 from public.tournament_matches
  where tournament_id = t.id and stage = 'cup'
  order by round_no, match_no, id for update;

  for src in select * from public.tournament_matches
    where tournament_id = t.id and stage = 'cup'
      and status in ('finished','wo') and winner_id is not null
    order by round_no, match_no
  loop
    if src.winner_id is distinct from src.player1_id
       and src.winner_id is distinct from src.player2_id then
      raise exception 'Winner is not a player in the source match';
    end if;

    if (select count(*) from public.tournament_matches
        where tournament_id = t.id and stage = 'cup'
          and round_no = src.round_no and match_no = src.match_no) <> 1 then
      raise exception 'Duplicate cup match position';
    end if;

    select * into dst from public.tournament_matches
    where tournament_id = t.id and stage = 'cup'
      and round_no = src.round_no + 1
      and match_no = (src.match_no + 1) / 2;
    if not found then continue; end if;
    if (select count(*) from public.tournament_matches
        where tournament_id = t.id and stage = 'cup'
          and round_no = dst.round_no and match_no = dst.match_no) <> 1 then
      raise exception 'Duplicate next-round match position';
    end if;
    if dst.status <> 'pending' or dst.live_match_id is not null then continue; end if;

    if mod(src.match_no, 2) = 1 then
      update public.tournament_matches
      set player1_id = src.winner_id, updated_at = now()
      where id = dst.id and player1_id is null;
    else
      update public.tournament_matches
      set player2_id = src.winner_id, updated_at = now()
      where id = dst.id and player2_id is null;
    end if;
  end loop;

  return query select * from public.tournament_matches
  where tournament_id = t.id and stage = 'cup'
  order by round_no, match_no;
end;
$$;
revoke all on function public.advance_tournament_cup(uuid) from public;
grant execute on function public.advance_tournament_cup(uuid) to authenticated;

-- Database-level auto advancement. This removes the dependency on a browser page
-- being open when a cup match finishes.
create or replace function public.auto_advance_tournament_cup_winner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
  v_target_status text;
  v_target_live uuid;
begin
  if new.stage <> 'cup'
     or new.status not in ('finished','wo')
     or new.winner_id is null then
    return new;
  end if;

  if new.winner_id is distinct from new.player1_id
     and new.winner_id is distinct from new.player2_id then
    raise exception 'Winner is not a player in the source cup match';
  end if;

  select id,status,live_match_id
    into v_target_id,v_target_status,v_target_live
    from public.tournament_matches
   where tournament_id = new.tournament_id
     and stage = 'cup'
     and round_no = new.round_no + 1
     and match_no = (new.match_no + 1) / 2
   limit 1;

  -- No target means this is the final.
  if v_target_id is null then
    return new;
  end if;

  -- Never alter a next-round match that has already started or finished.
  if v_target_status <> 'pending' or v_target_live is not null then
    return new;
  end if;

  if mod(new.match_no,2)=1 then
    update public.tournament_matches
       set player1_id = new.winner_id,
           updated_at = now()
     where id = v_target_id
       and (player1_id is null or (tg_op='UPDATE' and player1_id = old.winner_id));
  else
    update public.tournament_matches
       set player2_id = new.winner_id,
           updated_at = now()
     where id = v_target_id
       and (player2_id is null or (tg_op='UPDATE' and player2_id = old.winner_id));
  end if;

  return new;
end;
$$;

drop trigger if exists tournament_cup_auto_advance on public.tournament_matches;
create trigger tournament_cup_auto_advance
after insert or update of winner_id,status
on public.tournament_matches
for each row
execute function public.auto_advance_tournament_cup_winner();

-- Repair already-finished cup matches whose winners have not yet been placed
-- into the next round. Only empty slots are filled.
update public.tournament_matches dst
   set player1_id = src.winner_id,
       updated_at = now()
  from public.tournament_matches src
 where src.tournament_id = dst.tournament_id
   and src.stage = 'cup'
   and dst.stage = 'cup'
   and src.status in ('finished','wo')
   and src.winner_id is not null
   and dst.round_no = src.round_no + 1
   and dst.match_no = (src.match_no + 1) / 2
   and mod(src.match_no,2)=1
   and dst.status='pending'
   and dst.live_match_id is null
   and dst.player1_id is null;

update public.tournament_matches dst
   set player2_id = src.winner_id,
       updated_at = now()
  from public.tournament_matches src
 where src.tournament_id = dst.tournament_id
   and src.stage = 'cup'
   and dst.stage = 'cup'
   and src.status in ('finished','wo')
   and src.winner_id is not null
   and dst.round_no = src.round_no + 1
   and dst.match_no = (src.match_no + 1) / 2
   and mod(src.match_no,2)=0
   and dst.status='pending'
   and dst.live_match_id is null
   and dst.player2_id is null;
