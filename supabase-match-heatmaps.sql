-- Additive, isolated camera-estimate storage. No scoring tables are changed.
begin;
create or replace function public.valid_match_heatmap_points(p jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare x jsonb; u numeric; v numeric;
begin
 if p is null or jsonb_typeof(p)<>'array' then return false; end if;
 if jsonb_array_length(p)>600 or octet_length(p::text)>100000 then return false; end if;
 for x in select value from jsonb_array_elements(p) loop
  if jsonb_typeof(x)<>'object' then return false; end if;
  if not (x ?& array['u','v','time','tipDetected']) or x - array['u','v','time','tipDetected'] <> '{}'::jsonb then return false; end if;
  if jsonb_typeof(x->'u')<>'number' or jsonb_typeof(x->'v')<>'number' or jsonb_typeof(x->'tipDetected')<>'boolean' or jsonb_typeof(x->'time')<>'string' then return false; end if;
  if length(x->>'time')<>24 or (x->>'time') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' then return false; end if;
  u=(x->>'u')::numeric; v=(x->>'v')::numeric;
  if abs(u)>1.55 or abs(v)>1.55 or u*u+v*v>2.4025 then return false; end if;
 end loop;
 return true;
end $$;
create table if not exists public.match_heatmaps(
 match_id uuid not null references public.matches(id) on delete cascade,
 player_id uuid not null references public.profiles(id) on delete cascade,
 points jsonb not null check(public.valid_match_heatmap_points(points)),
 primary key(match_id,player_id)
);
create index if not exists match_heatmaps_player_idx on public.match_heatmaps(player_id,match_id);
alter table public.match_heatmaps enable row level security;
revoke all on public.match_heatmaps from public,anon,authenticated;
grant select,insert on public.match_heatmaps to authenticated;
grant update(points) on public.match_heatmaps to authenticated;
drop policy if exists heatmap_read on public.match_heatmaps;
create policy heatmap_read on public.match_heatmaps for select to authenticated using (
 exists(select 1 from public.matches m where m.id=match_id and m.deleted_at is null
 and (m.status='finished' or (m.status='playing' and (select auth.uid()) in (m.player1_id,m.player2_id))))
);
drop policy if exists heatmap_insert_own on public.match_heatmaps;
create policy heatmap_insert_own on public.match_heatmaps for insert to authenticated with check (
 player_id=(select auth.uid()) and exists(select 1 from public.matches m where m.id=match_id
 and player_id in (m.player1_id,m.player2_id) and m.deleted_at is null and m.status in ('playing','finished')
 and coalesce(m.game_variant,'x01')='x01' and lower(coalesce(m.game_config->>'chicago','false'))<>'true')
);
drop policy if exists heatmap_update_own on public.match_heatmaps;
create policy heatmap_update_own on public.match_heatmaps for update to authenticated using (
 player_id=(select auth.uid()) and exists(select 1 from public.matches m where m.id=match_id
 and player_id in (m.player1_id,m.player2_id) and m.deleted_at is null and m.status in ('playing','finished')
 and coalesce(m.game_variant,'x01')='x01' and lower(coalesce(m.game_config->>'chicago','false'))<>'true')
) with check (
 player_id=(select auth.uid()) and exists(select 1 from public.matches m where m.id=match_id
 and player_id in (m.player1_id,m.player2_id) and m.deleted_at is null and m.status in ('playing','finished')
 and coalesce(m.game_variant,'x01')='x01' and lower(coalesce(m.game_config->>'chicago','false'))<>'true')
);
-- Invoker: existing RLS applies. Only own data can be written. Concurrent and
-- repeated batches merge instead of replacing a longer or newer snapshot.
create or replace function public.save_match_heatmap(p_match_id uuid,p_points jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not public.valid_match_heatmap_points(p_points) then raise exception 'Invalid heatmap points'; end if;
 if jsonb_array_length(p_points)=0 then return; end if;
 insert into public.match_heatmaps as h(match_id,player_id,points)
 values(p_match_id,auth.uid(),p_points)
 on conflict(match_id,player_id) do update set points=(
   select coalesce(jsonb_agg(q.point order by q.point->>'time',q.point),'[]'::jsonb)
   from (select d.point from (select distinct value as point from jsonb_array_elements(h.points||excluded.points)) d
     order by d.point->>'time' desc,d.point desc limit 600) q
 );
end $$;
revoke all on function public.save_match_heatmap(uuid,jsonb) from public,anon;
grant execute on function public.save_match_heatmap(uuid,jsonb) to authenticated;
commit;
