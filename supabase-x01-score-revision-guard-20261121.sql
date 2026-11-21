-- Additive score-only guard. Existing RPCs remain available to older clients.
-- A row lock makes the expected revision check and scoring one transaction.
create or replace function public.submit_x01_checked(
  p_match_id uuid, p_score integer, p_expected_at timestamptz, p_darts integer default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  m public.matches%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into m from public.matches where id=p_match_id for update;
  if not found or v_uid not in (m.player1_id,m.player2_id) then
    raise exception 'Match access denied';
  end if;
  if p_expected_at is null or m.updated_at is distinct from p_expected_at then
    raise exception 'DA_STALE_SCORE_STATE';
  end if;
  if m.status <> 'playing' or m.turn_player_id is distinct from v_uid
     or coalesce(m.game_variant,'x01') <> 'x01' or m.deleted_at is not null then
    raise exception 'DA_INVALID_SCORE_TURN';
  end if;
  if lower(coalesce(m.game_config->>'chicago','false'))='true' then
    if p_darts is null then
      return public.submit_chicago_x01_visit(p_match_id,p_score);
    else
      return public.submit_chicago_checkout(p_match_id,p_score,p_darts);
    end if;
  else
    if p_darts is null then
      return public.submit_x01_visit(p_match_id,p_score);
    else
      return public.submit_match_checkout(p_match_id,p_score,p_darts);
    end if;
  end if;
end;
$$;
revoke all on function public.submit_x01_checked(uuid,integer,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.submit_x01_checked(uuid,integer,timestamptz,integer) to authenticated;
