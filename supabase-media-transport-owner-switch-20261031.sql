-- Default OFF. This persists one GLOBAL media selection for newly opened rooms.
-- Current/previous match pages do not automatically hot-switch transport.
create table if not exists public.media_transport_config (
  id smallint primary key default 1 check (id=1),
  mode text not null default 'legacy' check (mode in ('legacy','sfu')),
  updated_at timestamptz not null default now()
);
alter table public.media_transport_config enable row level security;
revoke all on table public.media_transport_config from public, anon, authenticated;
grant select on table public.media_transport_config to authenticated;
grant update(mode,updated_at) on table public.media_transport_config to authenticated;

drop policy if exists "Media mode is readable by signed-in players" on public.media_transport_config;
create policy "Media mode is readable by signed-in players"
  on public.media_transport_config for select to authenticated using (true);
drop policy if exists "Only DartArena owner may switch media mode" on public.media_transport_config;
create policy "Only DartArena owner may switch media mode"
  on public.media_transport_config for update to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

insert into public.media_transport_config(id,mode)
values (1,'legacy')
on conflict (id) do nothing;
