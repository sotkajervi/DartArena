create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $body$
declare n text:=coalesce(new.raw_user_meta_data->>'username','Player-'||substr(new.id::text,1,8));
begin
 if new.raw_user_meta_data->>'nickname_signup'='true' then
   n=btrim(n);
   if not dartarena_identity_private.valid_nick(n) then raise exception 'invalid_nickname' using errcode='22023';end if;
   insert into public.profiles(id,username,status,nickname_changed_at) values(new.id,n,'unavailable',now());
   insert into public.player_details(user_id,nickname) values(new.id,n);
 else
   insert into public.profiles(id,username,status) values(new.id,n,'unavailable');
 end if;
 return new;
end $body$;
revoke all on function public.handle_new_user() from public,anon,authenticated;
alter table public.lobby_messages drop constraint if exists da_chat_body_raw_limit;
alter table public.tournaments drop constraint if exists da_tournament_name_raw_limit;
alter table public.player_reports drop constraint if exists da_player_report_raw_limit;
alter table public.issue_reports drop constraint if exists da_issue_report_raw_limit;
