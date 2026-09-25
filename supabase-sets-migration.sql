-- DartArena: run once in Supabase SQL Editor
alter table public.matches
  add column if not exists match_mode text not null default 'legs',
  add column if not exists best_of_sets integer not null default 1,
  add column if not exists player1_sets integer not null default 0,
  add column if not exists player2_sets integer not null default 0,
  add column if not exists match_starter_id uuid,
  add column if not exists current_set integer not null default 1,
  add column if not exists current_leg integer not null default 1;

update public.matches
set match_mode = coalesce(match_mode,'legs'),
    best_of_sets = coalesce(best_of_sets,1),
    player1_sets = coalesce(player1_sets,0),
    player2_sets = coalesce(player2_sets,0),
    current_set = coalesce(current_set,1),
    current_leg = coalesce(current_leg,1),
    match_starter_id = coalesce(match_starter_id, turn_player_id)
where match_starter_id is null;

alter table public.matches drop constraint if exists matches_match_mode_check;
alter table public.matches add constraint matches_match_mode_check check (match_mode in ('legs','sets'));
alter table public.matches drop constraint if exists matches_best_of_sets_odd_check;
alter table public.matches add constraint matches_best_of_sets_odd_check check (best_of_sets >= 1 and best_of_sets % 2 = 1);
alter table public.matches drop constraint if exists matches_current_set_check;
alter table public.matches add constraint matches_current_set_check check (current_set >= 1);
alter table public.matches drop constraint if exists matches_current_leg_check;
alter table public.matches add constraint matches_current_leg_check check (current_leg >= 1);