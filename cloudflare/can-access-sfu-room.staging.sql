-- STAGING DESIGN ONLY: NOT applied to the database.
-- This function must be validated against actual room statuses and RLS before use.
-- Tournament rooms and spectators intentionally fail closed.
-- Verified against room.js (challenge status 'room') and match.js ('playing').
-- Historical database rows alone do not establish whether a live room is active.
CREATE OR REPLACE FUNCTION public.can_access_sfu_room(
    p_kind text,
    p_room_id uuid,
    p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_room_id IS NULL OR p_kind IS NULL
     OR p_action NOT IN ('publish','subscribe') THEN
    RETURN false;
  END IF;

  IF p_kind = 'challenge' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = p_room_id
        AND c.status = 'room'
        AND v_uid IN (c.challenger_id, c.challenged_id)
    );
  ELSIF p_kind = 'match' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = p_room_id
        AND m.status = 'playing'
        AND m.deleted_at IS NULL
        AND v_uid IN (m.player1_id, m.player2_id)
    );
  END IF;

  -- Tournament and spectator authorization are not yet verified.
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_sfu_room(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_sfu_room(text,uuid,text) TO authenticated;
