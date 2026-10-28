-- STAGING DESIGN ONLY: NOT applied to the database.
-- Use server-side auth.uid() for identity. Authorization to view records does not
-- imply permission to stream/subscribe to camera feeds.
-- A real deployment also needs SFU session ownership/room scoping, enforced in Worker.

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
        AND m.status IN ('waiting','playing')
        AND m.deleted_at IS NULL
        AND v_uid IN (m.player1_id, m.player2_id)
    );
  END IF;

  -- Tournament waiting rooms and spectator permissions need a verified
  -- model of their state and must remain denied in this initial draft.
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_sfu_room(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_sfu_room(text,uuid,text) TO authenticated;
