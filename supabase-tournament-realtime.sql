-- DartArena: enable live updates for tournament match rows.
-- Run once in Supabase SQL Editor. Safe to run again.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tournament_matches'
  ) then
    alter publication supabase_realtime add table public.tournament_matches;
  end if;
end $$;
