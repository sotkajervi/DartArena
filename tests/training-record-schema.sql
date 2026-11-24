create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $uid$ select nullif(current_setting('test.actor',true),'')::uuid $uid$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.personal_training_results(id bigint generated always as identity primary key,user_id uuid not null default auth.uid(),game text not null,variant text not null,score integer not null,details jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
check (game in ('61','half_it')),check (score between -10000 and 100000),check(jsonb_typeof(details)='object'),
check (variant in ('5','10','15','20','standard','dartcounter')),
check ((game='61' and variant in ('10','20','30','45','60')) or (game='half_it' and variant in ('standard','dartcounter'))));
alter table public.personal_training_results enable row level security;
grant select,insert on public.personal_training_results to authenticated;
create policy own_read on public.personal_training_results for select to authenticated using(auth.uid()=user_id);
create policy own_insert on public.personal_training_results for insert to authenticated with check(auth.uid()=user_id);
