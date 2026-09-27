-- DartArena: cup reliability + Best of 21
-- Safe to run in Supabase SQL Editor.

begin;

-- Allow odd Best-of values from Bo3 through Bo21.
alter table public.tournament_groups
  drop constraint if exists tournament_groups_best_of_check;

alter table public.tournament_groups
  add constraint tournament_groups_best_of_check
  check (best_of between 3 and 21 and mod(best_of,2)=1);

alter table public.tournament_matches
  drop constraint if exists tournament_matches_best_of_check;

alter table public.tournament_matches
  add constraint tournament_matches_best_of_check
  check (best_of between 3 and 21 and mod(best_of,2)=1);

-- Automatic winner propagation in the knockout bracket.
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
  v_old_winner uuid;
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

  if tg_op='UPDATE' then
    v_old_winner := old.winner_id;
  else
    v_old_winner := null;
  end if;

  select id,status,live_match_id
    into v_target_id,v_target_status,v_target_live
    from public.tournament_matches
   where tournament_id = new.tournament_id
     and stage = 'cup'
     and round_no = new.round_no + 1
     and match_no = (new.match_no + 1) / 2
   limit 1;

  if v_target_id is null then
    return new;
  end if;

  if v_target_status <> 'pending' or v_target_live is not null then
    return new;
  end if;

  if mod(new.match_no,2)=1 then
    if v_old_winner is not null and v_old_winner is distinct from new.winner_id then
      update public.tournament_matches
         set player1_id = new.winner_id,
             updated_at = now()
       where id = v_target_id
         and (player1_id is null or player1_id = v_old_winner);
    else
      update public.tournament_matches
         set player1_id = new.winner_id,
             updated_at = now()
       where id = v_target_id
         and player1_id is null;
    end if;
  else
    if v_old_winner is not null and v_old_winner is distinct from new.winner_id then
      update public.tournament_matches
         set player2_id = new.winner_id,
             updated_at = now()
       where id = v_target_id
         and (player2_id is null or player2_id = v_old_winner);
    else
      update public.tournament_matches
         set player2_id = new.winner_id,
             updated_at = now()
       where id = v_target_id
         and player2_id is null;
    end if;
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

-- Repair old/stale brackets: fill empty next-round slots from finished matches.
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

commit;
