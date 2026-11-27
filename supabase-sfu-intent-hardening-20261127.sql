-- Preserve existing authorized routes; deny NULL intent as well as unknown actions.
create or replace function public.can_access_sfu_room(p_kind text,p_room_id uuid,p_action text)
returns boolean language plpgsql stable set search_path to 'public' as $body$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or p_room_id is null or p_kind is null or p_action is null or p_action not in ('publish','subscribe') then return false; end if;
 if p_kind='challenge' then
  return exists(select 1 from public.challenges c where c.id=p_room_id and c.status='room' and v_uid in(c.challenger_id,c.challenged_id));
 elsif p_kind='match' then
  return exists(select 1 from public.matches m where m.id=p_room_id and m.status='playing' and m.deleted_at is null and (v_uid in(m.player1_id,m.player2_id) or (p_action='subscribe' and m.is_live is true)));
 elsif p_kind='tournament_match' then
  return exists(select 1 from public.tournament_matches tm where tm.id=p_room_id and tm.status='pending' and tm.player1_id is not null and tm.player2_id is not null and v_uid in(tm.player1_id,tm.player2_id));
 end if;
 return false;
end $body$;
revoke all on function public.can_access_sfu_room(text,uuid,text) from public,anon;
grant execute on function public.can_access_sfu_room(text,uuid,text) to authenticated;
