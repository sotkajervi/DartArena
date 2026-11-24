begin;
revoke update on table public.tournaments from authenticated;
revoke update(owner_id) on public.tournaments from authenticated;
grant update(id,name,tournament_type,starts_at,status,registration_open,created_at,updated_at,finished_at,stats_enabled,game,game_variant,cup_game,cup_game_variant,archived_at,archived_by) on public.tournaments to authenticated;
commit;
