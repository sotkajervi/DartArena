\set ON_ERROR_STOP on
\ir player-identity-db.sql
reset role;
\ir ../supabase-player-presentation.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $check$ declare oldname text;stamp timestamptz;begin
 select username,nickname_changed_at into oldname,stamp from public.profiles where id=auth.uid();
 if public.save_player_presentation(auth.uid(),oldname,'','','','','Example Name','full')<>oldname then raise exception 'presentation changed nickname';end if;
 if (select display_mode from public.player_details where user_id=auth.uid())<>'full' then raise exception 'mode not saved';end if;
 if (select nickname_changed_at from public.profiles where id=auth.uid()) is distinct from stamp then raise exception 'cooldown changed';end if;
 perform public.save_player_presentation(auth.uid(),oldname,'','','','','Example Name','both');
 perform public.save_player_presentation(auth.uid(),oldname,'','','','','','nick');
 begin perform public.save_player_presentation(auth.uid(),oldname,'','','','','','full');raise exception 'missing full name allowed';exception when invalid_parameter_value then null;end;
 begin perform public.save_player_presentation(auth.uid(),'ChangedTooSoon','','','','','','nick');raise exception 'cooldown bypass';exception when invalid_parameter_value then null;end;
 begin perform public.save_player_presentation('22222222-2222-4222-8222-222222222222','Other','','','','','Someone','full');raise exception 'foreign edit allowed';exception when insufficient_privilege then null;end;
end $check$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $check$ begin
 perform public.save_player_presentation('11111111-1111-4111-8111-111111111111','StaffCorrected','','','','','Example Name','both');
 if (select display_mode from public.player_details where user_id='11111111-1111-4111-8111-111111111111')<>'both' then raise exception 'staff mode failed';end if;
end $check$;
reset role;
set role anon;
do $check$ begin
 begin perform public.save_player_presentation('11111111-1111-4111-8111-111111111111','Hack','','','','','','nick');raise exception 'anon allowed';exception when insufficient_privilege then null;end;
end $check$;
reset role;
