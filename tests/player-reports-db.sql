\set ON_ERROR_STOP on
\ir issue-center-db.sql
create table public.profiles(id uuid primary key,username text not null);
insert into public.profiles values ('11111111-1111-4111-8111-111111111111','Reporter'),('22222222-2222-4222-8222-222222222222','Admin'),('33333333-3333-4333-8333-333333333333','OldNick');
create table public.player_details(user_id uuid primary key,full_name text,display_mode text);
insert into public.player_details values('33333333-3333-4333-8333-333333333333','Original Name','both');
create table public.player_avatars(user_id uuid primary key,updated_at timestamptz);
insert into public.player_avatars values('33333333-3333-4333-8333-333333333333',now());
\ir ../supabase-player-reports.sql
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.submit_player_report('33333333-3333-4333-8333-333333333333','name','Name report');
select public.submit_player_report('33333333-3333-4333-8333-333333333333','avatar','Image report','/9j/AA==');
do $check$begin
 if (select count(*) from public.player_reports)<>0 then raise exception 'reporter can read';end if;
 update public.player_reports set status='resolved';if found then raise exception 'reporter update allowed';end if;
 begin insert into public.player_reports(reporter_id,target_id,category,description,target_nickname,reporter_nickname) values(auth.uid(),'33333333-3333-4333-8333-333333333333','name','spoof','fake','fake');raise exception 'direct insert allowed';exception when insufficient_privilege then null;end;
 begin perform public.submit_player_report(auth.uid(),'name','self');raise exception 'self allowed';exception when insufficient_privilege then null;end;
 begin perform public.submit_player_report('33333333-3333-4333-8333-333333333333','avatar','bad image','YWJjZA==');raise exception 'bad image accepted';exception when invalid_parameter_value then null;end;
 begin perform public.submit_player_report('33333333-3333-4333-8333-333333333333','other','bad category image','/9j/AA==');raise exception 'wrong evidence accepted';exception when invalid_parameter_value then null;end;
end $check$;
select public.submit_player_report('22222222-2222-4222-8222-222222222222','behavior','Report about staff');
do $check$begin
 begin perform public.submit_player_report('33333333-3333-4333-8333-333333333333','spam','Fourth report');raise exception 'rate limit bypass' using errcode='XX000';exception when sqlstate 'P0001' then null;end;
end $check$;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $check$begin if (select count(*) from public.player_reports)<>0 then raise exception 'target can read';end if;end $check$;
reset role;
update public.profiles set username='NewNick' where id='33333333-3333-4333-8333-333333333333';
update public.player_details set full_name='Changed Name' where user_id='33333333-3333-4333-8333-333333333333';
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $check$begin
 if exists(select 1 from public.player_reports where target_id=auth.uid()) then raise exception 'reported staff can read own case';end if;
 if (select count(*) from public.player_reports where target_nickname='OldNick' and target_full_name='Original Name' and reporter_nickname='Reporter')<>2 then raise exception 'snapshot not preserved';end if;
 if (select count(*) from public.player_reports where avatar_evidence='/9j/AA==' and avatar_updated_at is not null)<>1 then raise exception 'evidence missing';end if;
 update public.player_reports set status='dismissed',internal_note='Reviewed' where category='name';
 if not exists(select 1 from public.player_reports where status='dismissed' and handled_by=auth.uid() and handled_at is not null) then raise exception 'staff update missing';end if;
 begin update public.player_reports set target_nickname='changed';raise exception 'snapshot mutation allowed';exception when insufficient_privilege then null;end;
end $check$;
reset role;
do $check$begin if (select count(*) from dartarena_moderation_private.report_audit)<>1 then raise exception 'audit missing';end if;end $check$;
update public.player_reports set created_at=now()-interval '31 days' where category='avatar';
do $check$begin if dartarena_moderation_private.purge_expired_evidence()<>1 then raise exception 'retention failed';end if;if not exists(select 1 from public.player_reports where category='avatar' and avatar_evidence is null) then raise exception 'report lost';end if;end $check$;
set role anon;
do $check$begin
 begin perform count(*) from public.player_reports;raise exception 'anon read allowed';exception when insufficient_privilege then null;end;
 begin perform public.submit_player_report('33333333-3333-4333-8333-333333333333','name','anon');raise exception 'anon write allowed';exception when insufficient_privilege then null;end;
end $check$;
reset role;
