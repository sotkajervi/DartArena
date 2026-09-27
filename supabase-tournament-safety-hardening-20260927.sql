-- DartArena tournament safety hardening 2026-09-27
-- Idempotent: safe to run again.
-- Does not delete or rewrite match results.

begin;

-- The archive trigger uses this timestamp.
alter table public.tournaments
  add column if not exists finished_at timestamptz;

-- A cup position must be unique. The old table UNIQUE includes nullable group_id,
-- which does not protect cup rows because PostgreSQL permits multiple NULLs.
-- Stop safely instead of guessing/deleting if old duplicate positions exist.
do $$
begin
  if exists (
    select 1
      from public.tournament_matches
     where stage = 'cup'
     group by tournament_id, round_no, match_no
    having count(*) > 1
  ) then
    raise exception 'DartArena safety check: duplicate cup positions exist. No changes were committed. Inspect the duplicate rows before applying the unique index.';
  end if;
end $$;

create unique index if not exists tournament_matches_cup_position_uidx
  on public.tournament_matches(tournament_id, round_no, match_no)
  where stage = 'cup';

-- Do not allow the tournament owner to overwrite live/finished match rows
-- directly. Creation/deletion of setup rows remains possible; result changes
-- must go through the constrained RPC functions.
drop policy if exists "owner manages tournament matches"
  on public.tournament_matches;
drop policy if exists "owner inserts tournament matches"
  on public.tournament_matches;
drop policy if exists "owner deletes pending tournament matches"
  on public.tournament_matches;

create policy "owner inserts tournament matches"
on public.tournament_matches
for insert
to authenticated
with check (
  exists (
    select 1
      from public.tournaments t
     where t.id = tournament_id
       and t.owner_id = auth.uid()
  )
);

create policy "owner deletes pending tournament matches"
on public.tournament_matches
for delete
to authenticated
using (
  status = 'pending'
  and exists (
    select 1
      from public.tournaments t
     where t.id = tournament_id
       and t.owner_id = auth.uid()
  )
);

-- Archive only a structurally valid final: the highest cup round must contain
-- exactly one match, it must be match 1, and it must have a winner.
create or replace function public.archive_tournament_after_final()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_round integer;
  v_final_count integer;
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

  if v_last_round is null or new.round_no <> v_last_round then
    return new;
  end if;

  select count(*)
    into v_final_count
    from public.tournament_matches
   where tournament_id = new.tournament_id
     and stage = 'cup'
     and round_no = v_last_round;

  if v_final_count = 1 and new.match_no = 1 then
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

drop trigger if exists tournament_archive_after_final
  on public.tournament_matches;

create trigger tournament_archive_after_final
after insert or update of winner_id,status
on public.tournament_matches
for each row
execute function public.archive_tournament_after_final();

commit;
