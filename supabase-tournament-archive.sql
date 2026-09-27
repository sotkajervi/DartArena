-- DartArena: robust archive for completed tournaments
-- Run once in Supabase SQL Editor.
-- Marks a tournament finished as soon as the final cup match gets a winner,
-- even if the tournament leader does not have the tournament page open.

alter table public.tournaments
  add column if not exists finished_at timestamptz;

create or replace function public.archive_tournament_after_final()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_round integer;
begin
  if new.stage <> 'cup'
     or new.winner_id is null
     or new.status not in ('finished','wo') then
    return new;
  end if;

  select max(round_no)
    into v_last_round
    from public.tournament_matches
   where tournament_id = new.tournament_id
     and stage = 'cup';

  if v_last_round is not null and new.round_no = v_last_round then
    update public.tournaments
       set status = 'finished',
           finished_at = coalesce(finished_at, now()),
           updated_at = now()
     where id = new.tournament_id
       and status in ('cup','finished');
  end if;

  return new;
end;
$$;

drop trigger if exists tournament_archive_after_final on public.tournament_matches;
create trigger tournament_archive_after_final
after insert or update of winner_id,status on public.tournament_matches
for each row
execute function public.archive_tournament_after_final();

-- Backfill tournaments that already have a completed final but were left in cup status.
with cup_last_round as (
  select tournament_id, max(round_no) as last_round
  from public.tournament_matches
  where stage = 'cup'
  group by tournament_id
), completed as (
  select distinct tm.tournament_id
  from public.tournament_matches tm
  join cup_last_round lr
    on lr.tournament_id = tm.tournament_id
   and lr.last_round = tm.round_no
  where tm.stage = 'cup'
    and tm.winner_id is not null
    and tm.status in ('finished','wo')
)
update public.tournaments t
   set status = 'finished',
       finished_at = coalesce(t.finished_at,t.updated_at,now()),
       updated_at = now()
  from completed c
 where t.id = c.tournament_id
   and t.status = 'cup';

update public.tournaments
   set finished_at = coalesce(finished_at,updated_at,now())
 where status = 'finished'
   and finished_at is null;
