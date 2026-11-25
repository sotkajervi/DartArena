-- Additive optional player details. Identity and scoring remain in profiles.
begin;
create table if not exists public.player_details(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 nickname text not null default '' check(char_length(nickname)<=40),
 country text not null default '' check(char_length(country)<=60),
 club text not null default '' check(char_length(club)<=80),
 equipment text not null default '' check(char_length(equipment)<=100),
 bio text not null default '' check(char_length(bio)<=300)
);
alter table public.player_details enable row level security;
revoke all on public.player_details from public,anon,authenticated;
grant select on public.player_details to authenticated;
grant insert(user_id,nickname,country,club,equipment,bio) on public.player_details to authenticated;
grant update(user_id,nickname,country,club,equipment,bio) on public.player_details to authenticated;
create policy player_details_read on public.player_details for select to authenticated using ((select auth.uid()) is not null);
create policy player_details_insert_own on public.player_details for insert to authenticated with check (user_id=(select auth.uid()));
create policy player_details_update_own on public.player_details for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
commit;
