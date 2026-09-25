-- DartArena: tillat alle X01-spill som finnes i venterommet.
-- Kjor denne EN gang i Supabase SQL Editor.
-- Trygt: ingen rader slettes eller endres.

begin;

-- Eldre oppsett kan ha en CHECK-constraint som bare tillater enkelte spill.
-- Fjern bare kjente/standard constraint-navn hvis de finnes.
alter table public.matches drop constraint if exists matches_game_check;
alter table public.matches drop constraint if exists matches_game_valid;

-- Legg tilbake eksplisitt regel som matcher DartArena-menyen.
alter table public.matches
  add constraint matches_game_check
  check (game in (170, 301, 501, 1001));

commit;
