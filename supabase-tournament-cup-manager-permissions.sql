-- DartArena: only tournament leader plus global Admin/Owner can manage cup setup.
-- public.is_admin() returns true for both admin and owner roles.

drop policy if exists "owner updates tournament" on public.tournaments;
drop policy if exists "manager updates tournament" on public.tournaments;
create policy "manager updates tournament"
on public.tournaments
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "owner inserts tournament matches" on public.tournament_matches;
drop policy if exists "manager inserts tournament matches" on public.tournament_matches;
create policy "manager inserts tournament matches"
on public.tournament_matches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and (t.owner_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "owner deletes pending tournament matches" on public.tournament_matches;
drop policy if exists "manager deletes pending tournament matches" on public.tournament_matches;
create policy "manager deletes pending tournament matches"
on public.tournament_matches
for delete
to authenticated
using (
  status = 'pending'
  and exists (
    select 1
    from public.tournaments t
    where t.id = tournament_id
      and (t.owner_id = auth.uid() or public.is_admin())
  )
);

create or replace function public.advance_tournament_cup(p_tournament_id uuid)
returns setof public.tournament_matches
language plpgsql
security definer
set search_path to ''
as $function$
declare
  t public.tournaments%rowtype;
  src public.tournament_matches%rowtype;
  dst public.tournament_matches%rowtype;
begin
  select * into t from public.tournaments
  where id = p_tournament_id for update;
  if not found then raise exception 'Tournament not found'; end if;
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if auth.uid() is distinct from t.owner_id
     and not public.is_admin()
     and not exists (
       select 1 from public.tournament_members
       where tournament_id = t.id and user_id = auth.uid()
         and role = 'participant'
     ) then
    raise exception 'Not a tournament participant or manager';
  end if;
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
$function$;

revoke all on function public.advance_tournament_cup(uuid) from public;
grant execute on function public.advance_tournament_cup(uuid) to authenticated;