-- DartArena public role lookup for authenticated UI clients
-- Exposes only user_id + role. No emails or auth metadata.

create or replace function public.get_public_user_roles()
returns table(user_id uuid, role text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
  select ur.user_id, ur.role
  from public.user_roles ur;
end;
$$;

revoke all on function public.get_public_user_roles() from public;
revoke execute on function public.get_public_user_roles() from anon;
grant execute on function public.get_public_user_roles() to authenticated;
