-- DartArena lobby chat
-- One shared table, isolated by room_id:
--   main                 = main lobby
--   <tournament uuid>    = that tournament's lobby
-- Safe to run again. Does not modify tournament/match data.

begin;

create table if not exists public.lobby_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint lobby_messages_room_shape check (
    (tournament_id is null and room_id = 'main')
    or
    (tournament_id is not null and room_id = tournament_id::text)
  )
);

create index if not exists lobby_messages_room_created_idx
  on public.lobby_messages(room_id, created_at desc);
create index if not exists lobby_messages_sender_idx
  on public.lobby_messages(sender_id, created_at desc);

alter table public.lobby_messages enable row level security;

revoke all on public.lobby_messages from anon;
grant select, insert on public.lobby_messages to authenticated;

drop policy if exists "authenticated read lobby chat" on public.lobby_messages;
create policy "authenticated read lobby chat"
on public.lobby_messages
for select
to authenticated
using (true);

drop policy if exists "authenticated send lobby chat" on public.lobby_messages;
create policy "authenticated send lobby chat"
on public.lobby_messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and (
    (tournament_id is null and room_id = 'main')
    or exists (
      select 1
      from public.tournaments t
      where t.id = tournament_id
        and room_id = t.id::text
    )
  )
);

-- Messages are intentionally immutable from the client for now.
-- No UPDATE or DELETE grants/policies are created.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='lobby_messages'
  ) then
    alter publication supabase_realtime add table public.lobby_messages;
  end if;
end $$;

commit;
