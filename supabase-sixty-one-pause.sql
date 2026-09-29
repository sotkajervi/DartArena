-- Shared pause support for online 61 matches.
alter table public.sixty_one_match_state
  add column if not exists is_paused boolean not null default false,
  add column if not exists paused_at timestamptz,
  add column if not exists paused_by uuid;

create or replace function public.toggle_sixty_one_pause(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_match public.matches%rowtype;
  v_state public.sixty_one_match_state%rowtype;
  v_pause_length interval;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then raise exception 'Match not found'; end if;
  if v_match.game_variant <> 'sixty_one' then raise exception 'This is not a 61 match'; end if;
  if v_uid not in (v_match.player1_id, v_match.player2_id) then raise exception 'You are not a player in this match'; end if;
  if v_match.status <> 'playing' then raise exception 'Match is not active'; end if;

  select * into v_state
  from public.sixty_one_match_state
  where match_id = p_match_id
  for update;

  if not found then raise exception '61 state is missing'; end if;
  if v_state.sudden_death then raise exception 'Pause is not available in sudden death'; end if;

  if v_state.is_paused then
    v_pause_length := now() - coalesce(v_state.paused_at, now());
    update public.sixty_one_match_state
    set leg_started_at = leg_started_at + v_pause_length,
        is_paused = false,
        paused_at = null,
        paused_by = null,
        updated_at = now()
    where match_id = p_match_id;
    return jsonb_build_object('paused', false, 'resumed_by', v_uid);
  end if;

  if now() >= v_state.leg_started_at + make_interval(secs => v_state.leg_duration_seconds) then
    raise exception 'Time is up';
  end if;

  update public.sixty_one_match_state
  set is_paused = true,
      paused_at = now(),
      paused_by = v_uid,
      updated_at = now()
  where match_id = p_match_id;

  return jsonb_build_object('paused', true, 'paused_by', v_uid);
end;
$$;

revoke execute on function public.toggle_sixty_one_pause(uuid) from public;
revoke execute on function public.toggle_sixty_one_pause(uuid) from anon;
grant execute on function public.toggle_sixty_one_pause(uuid) to authenticated;