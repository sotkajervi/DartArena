\set ON_ERROR_STOP on
create table public.matches(id integer primary key, result text not null);
create table public.match_media_telemetry(id integer primary key, match_id integer references public.matches(id), captured_at timestamptz not null);
insert into public.matches values (1,'completed');
insert into public.match_media_telemetry select i,1,now()-interval '15 days' from generate_series(1,5002) i;
insert into public.match_media_telemetry values (5003,1,now()-interval '13 days'),(5004,1,now());
\ir ../db/media-telemetry-retention-batch-candidate.sql
do $$ begin
 if (select count(*) from public.match_media_telemetry)<>4 or (select count(*) from public.match_media_telemetry where captured_at < now()-interval '14 days')<>2 or (select count(*) from public.match_media_telemetry where id in (5003,5004))<>2 then raise exception 'Batch size or retention violated'; end if;
 if not exists(select 1 from public.matches where id=1 and result='completed') then raise exception 'Match changed'; end if;
end $$;
\ir ../db/media-telemetry-retention-batch-candidate.sql
\ir ../db/media-telemetry-retention-batch-candidate.sql
do $$ begin
 if (select count(*) from public.match_media_telemetry)<>2 or (select count(*) from public.match_media_telemetry where id in (5003,5004))<>2 then raise exception 'Repeated batch or recent retention failed'; end if;
 if not exists(select 1 from public.matches where id=1 and result='completed') then raise exception 'Match changed'; end if;
end $$;
\echo Bounded deletion, 14-day retention, recent data and match result preserved.
