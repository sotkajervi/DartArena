-- Admin soft delete for finished matches.
-- Deleted matches stay in the database for recovery/audit, but are hidden from
-- global match history and excluded before form/average statistics are calculated.

alter table public.matches add column if not exists deleted_at timestamptz;
alter table public.matches add column if not exists deleted_by uuid references auth.users(id) on delete set null;
create index if not exists matches_deleted_at_idx on public.matches(deleted_at);

create or replace function public.admin_delete_match(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin required';
  end if;

  update public.matches
     set deleted_at=now(), deleted_by=auth.uid(), updated_at=now()
   where id=p_match_id and status='finished' and deleted_at is null;

  return found;
end;
$function$;

grant execute on function public.admin_delete_match(uuid) to authenticated;

-- get_global_match_history must include: and m.deleted_at is null
-- get_form_stats x01_tournament_matches must include: and m.deleted_at is null
