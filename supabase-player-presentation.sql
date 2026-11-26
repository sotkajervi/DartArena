-- Keep profiles.username canonical and unique. Presentation is optional and never changes identity.
begin;
alter table public.player_details add column if not exists display_mode text not null default 'nick' check(display_mode in ('nick','full','both'));
-- Existing cached clients may still clear the full name. Presentation then safely falls back to nick.
create or replace function dartarena_identity_private.save_presentation(p_user_id uuid,p_nickname text,p_country text,p_club text,p_equipment text,p_bio text,p_full_name text,p_display_mode text)
returns text language plpgsql security definer set search_path='' as $body$
declare actor uuid:=auth.uid();shown text;
begin
 if actor is null or p_user_id is null or (actor<>p_user_id and not (select public.is_admin())) then raise exception 'staff_required' using errcode='42501';end if;
 if p_display_mode is null or p_display_mode not in ('nick','full','both') or (p_display_mode<>'nick' and btrim(coalesce(p_full_name,''))='') then raise exception 'invalid_display_mode' using errcode='22023';end if;
 if actor=p_user_id then
   shown:=public.save_player_identity(p_nickname,p_country,p_club,p_equipment,p_bio,p_full_name);
 else
   shown:=public.staff_save_player_identity(p_user_id,p_nickname,p_country,p_club,p_equipment,p_bio,p_full_name);
 end if;
 update public.player_details set display_mode=p_display_mode where user_id=p_user_id;
 return shown;
end $body$;
revoke all on function dartarena_identity_private.save_presentation(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function dartarena_identity_private.save_presentation(uuid,text,text,text,text,text,text,text) to authenticated;
create or replace function public.save_player_presentation(p_user_id uuid,p_nickname text,p_country text,p_club text,p_equipment text,p_bio text,p_full_name text,p_display_mode text)
returns text language sql security invoker set search_path='' as $body$
 select dartarena_identity_private.save_presentation(p_user_id,p_nickname,p_country,p_club,p_equipment,p_bio,p_full_name,p_display_mode)
$body$;
revoke all on function public.save_player_presentation(uuid,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.save_player_presentation(uuid,text,text,text,text,text,text,text) to authenticated;
commit;
