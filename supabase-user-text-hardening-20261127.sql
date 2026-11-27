-- Validate every new signup, not a client-controlled metadata switch.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $body$
declare n text:=btrim(coalesce(new.raw_user_meta_data->>'username','Player-'||substr(new.id::text,1,8)));
begin
 if not dartarena_identity_private.valid_nick(n) then raise exception 'invalid_nickname' using errcode='22023';end if;
 insert into public.profiles(id,username,status,nickname_changed_at) values(new.id,n,'unavailable',now());
 insert into public.player_details(user_id,nickname) values(new.id,n);
 return new;
end $body$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
-- Enforce limits on the actual stored string, not just its trimmed portion.
alter table public.lobby_messages add constraint da_chat_body_raw_limit check(char_length(body)<=500);
alter table public.tournaments add constraint da_tournament_name_raw_limit check(char_length(name)<=80);
alter table public.player_reports add constraint da_player_report_raw_limit check(char_length(description)<=2000);
alter table public.issue_reports add constraint da_issue_report_raw_limit check(char_length(description)<=2000);
