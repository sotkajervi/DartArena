\set ON_ERROR_STOP on
create role authenticated;
create role anon;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
create function public.is_admin() returns boolean language sql stable
as $$ select coalesce(current_setting('test.admin',true)='yes',false) $$;
grant usage on schema auth to authenticated;
create table public.tournaments (
 id uuid primary key,
 owner_id uuid not null,
 name text not null,
 starts_at timestamptz,
 status text not null default 'draft',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.tournaments enable row level security;
grant select,insert on public.tournaments to authenticated;
grant update(id,name,starts_at,status,created_at,updated_at) on public.tournaments to authenticated;
grant all on public.tournaments to service_role;
create policy tournament_read on public.tournaments for select to authenticated using(true);
create policy tournament_update on public.tournaments for update to authenticated
using(owner_id=auth.uid() or public.is_admin())
with check(owner_id=auth.uid() or public.is_admin());
create policy tournament_insert on public.tournaments for insert to authenticated with check(owner_id=auth.uid());
insert into public.tournaments(id,owner_id,name,created_at) values
 ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','Owned','2026-01-01'),
 ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002','Other','2026-01-01');
set role authenticated;
set test.actor='00000000-0000-0000-0000-000000000001';
update public.tournaments set created_at='2025-01-01' where id='00000000-0000-0000-0000-000000000011';
do $$ begin
 if not exists(select 1 from public.tournaments where name='Owned' and created_at='2025-01-01') then
   raise exception 'Baseline mutation not reproduced';
 end if;
end $$;
reset role;
\echo Baseline: owner could change creation timestamp in isolated RLS fixture.
\ir ../db/tournament-created-at-candidate.sql
do $$ begin
 if has_column_privilege('authenticated','public.tournaments','created_at','UPDATE')
    or has_column_privilege('anon','public.tournaments','created_at','UPDATE')
    or not has_column_privilege('service_role','public.tournaments','created_at','UPDATE')
    or not has_column_privilege('authenticated','public.tournaments','starts_at','UPDATE')
    or not has_column_privilege('authenticated','public.tournaments','updated_at','UPDATE')
    or not has_column_privilege('authenticated','public.tournaments','name','UPDATE') then
   raise exception 'Unexpected privilege change';
 end if;
end $$;
set role authenticated;
set test.actor='00000000-0000-0000-0000-000000000001';
do $$ begin
 begin
   update public.tournaments set created_at='2024-01-01' where name='Owned';
   raise exception 'Owner timestamp mutation unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 update public.tournaments set name='Renamed', starts_at='2026-12-01', updated_at=now() where name='Owned';
 if not found then raise exception 'Normal owner update blocked'; end if;
 update public.tournaments set name='Forbidden' where name='Other';
 if found then raise exception 'Other owner update unexpectedly allowed'; end if;
end $$;
set test.admin='yes';
do $$ begin
 begin
   update public.tournaments set created_at='2024-01-01' where name='Renamed';
   raise exception 'Browser administrator timestamp mutation unexpectedly allowed';
 exception when insufficient_privilege then null;
 end;
 update public.tournaments set status='active' where name='Other';
 if not found then raise exception 'Normal administrator update blocked'; end if;
end $$;
reset role;
\echo Candidate: creation timestamp protected; normal owner and admin updates preserved.
\ir ../db/tournament-created-at-rollback.sql
do $$ begin
 if not has_column_privilege('authenticated','public.tournaments','created_at','UPDATE') then
   raise exception 'Rollback did not restore column grant';
 end if;
end $$;
set role authenticated;
set test.admin='no';
update public.tournaments set created_at='2026-02-01' where name='Renamed';
reset role;
do $$ begin
 if not exists(select 1 from public.tournaments where name='Renamed' and created_at='2026-02-01') then
   raise exception 'Rollback behavior not restored';
 end if;
end $$;
\echo Rollback restores original privilege and behavior.
