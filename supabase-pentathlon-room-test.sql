-- Owner-launched Pentathlon test inside the existing 1v1 waiting room.
-- Does not write to matches, tournaments, leaderboards, video or career stats.
create table if not exists public.pentathlon_room_tests(
  challenge_id uuid primary key references public.challenges(id) on delete cascade,
  player1_id uuid not null references public.profiles(id),
  player2_id uuid not null references public.profiles(id),
  state jsonb not null,
  version bigint not null default 1,
  last_actor uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pentathlon_room_tests enable row level security;
revoke all on public.pentathlon_room_tests from anon,authenticated;
grant select on public.pentathlon_room_tests to authenticated;
drop policy if exists "Pentathlon test participants can read" on public.pentathlon_room_tests;
create policy "Pentathlon test participants can read" on public.pentathlon_room_tests
  for select to authenticated
  using (auth.uid() in (player1_id,player2_id));

create or replace function public.start_pentathlon_room_test(
  p_challenge_id uuid,p_state jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare c public.challenges%rowtype;r public.pentathlon_room_tests%rowtype;
begin
  if auth.uid() is null or not public.is_owner() then raise exception 'Only the owner can launch this test';end if;
  select * into c from public.challenges where id=p_challenge_id for update;
  if not found or c.status<>'room' or auth.uid() not in(c.challenger_id,c.challenged_id)
    then raise exception 'Active 1v1 waiting room required';end if;
  if jsonb_typeof(p_state)<>'object' or p_state->>'status'<>'playing'
    or p_state->>'stageIndex'<>'0' or p_state->'current'->>'kind'<>'x01'
    or p_state->'current'->'entries'<>'[]'::jsonb
    or (p_state->'current'->>'turn') not in ('0','1')
    or jsonb_array_length(coalesce(p_state->'players','[]'::jsonb))<>2
    or octet_length(p_state::text)>150000
    then raise exception 'Invalid starting Pentathlon state';end if;
  insert into public.pentathlon_room_tests(challenge_id,player1_id,player2_id,state)
    values(c.id,c.challenger_id,c.challenged_id,p_state)
    on conflict(challenge_id) do nothing;
  select * into r from public.pentathlon_room_tests where challenge_id=p_challenge_id;
  return to_jsonb(r);
end;$$;
revoke all on function public.start_pentathlon_room_test(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.start_pentathlon_room_test(uuid,jsonb) to authenticated;

create or replace function public.apply_pentathlon_room_test(
  p_challenge_id uuid,p_expected_version bigint,p_action text,p_next jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare r public.pentathlon_room_tests%rowtype;v_user uuid:=auth.uid();v_slot integer;
  v_old jsonb;v_old_count integer;v_new_count integer;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  select * into r from public.pentathlon_room_tests where challenge_id=p_challenge_id for update;
  if not found or v_user not in(r.player1_id,r.player2_id) then raise exception 'Pentathlon test not found';end if;
  if r.version<>p_expected_version then raise exception 'PENTATHLON_STALE_VERSION';end if;
  if p_action not in ('turn','advance','undo') then raise exception 'Invalid Pentathlon action';end if;
  if jsonb_typeof(p_next)<>'object' or octet_length(p_next::text)>180000
    or p_next->'players' is distinct from r.state->'players'
    or p_next->'firstStarter' is distinct from r.state->'firstStarter'
    or p_next->'createdAt' is distinct from r.state->'createdAt'
    or p_next->>'version'<>'1'
    or (p_next->>'stageIndex')::integer not between 0 and 7
    or p_next->>'status' not in ('playing','review','finished')
    then raise exception 'Invalid Pentathlon state';end if;
  v_slot:=case when v_user=r.player1_id then 0 else 1 end;
  v_old:=r.state;
  if p_action='turn' then
    if v_old->>'status'<>'playing' or (v_old->'current'->>'turn')::integer<>v_slot
      or p_next->'stageIndex' is distinct from v_old->'stageIndex'
      or p_next->'summaries' is distinct from v_old->'summaries'
         and p_next->>'status'<>'review'
      then raise exception 'Not your turn';end if;
    v_old_count:=jsonb_array_length(coalesce(v_old->'current'->'entries','[]'::jsonb));
    v_new_count:=jsonb_array_length(coalesce(p_next->'current'->'entries','[]'::jsonb));
    if v_new_count<v_old_count or v_new_count>v_old_count+3
      or (v_old_count>0 and p_next->'current'->'entries'->(v_old_count-1) is distinct from v_old->'current'->'entries'->(v_old_count-1))
      then raise exception 'Unexpected turn data';end if;
  elsif p_action='advance' then
    if v_old->>'status'<>'review'
       or (p_next->>'stageIndex')::integer<>(v_old->>'stageIndex')::integer+1
       or p_next->'summaries' is distinct from v_old->'summaries'
       or p_next->'total' is distinct from v_old->'total'
       then raise exception 'Cannot advance Pentathlon stage';end if;
  else
    if r.last_actor is distinct from v_user or v_old->>'status' not in ('playing','review')
       or jsonb_array_length(coalesce(v_old->'undo','[]'::jsonb))<>1
       or p_next-'undo' is distinct from (v_old->'undo'->0)-'undo'
       then raise exception 'Cannot undo another player''s turn';end if;
  end if;
  update public.pentathlon_room_tests set state=p_next,version=version+1,
    last_actor=case when p_action='advance' then null else v_user end,
    updated_at=now()
  where challenge_id=p_challenge_id returning * into r;
  return to_jsonb(r);
end;$$;
revoke all on function public.apply_pentathlon_room_test(uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.apply_pentathlon_room_test(uuid,bigint,text,jsonb) to authenticated;

do $do$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pentathlon_room_tests')
  then alter publication supabase_realtime add table public.pentathlon_room_tests;end if;
end $do$;
