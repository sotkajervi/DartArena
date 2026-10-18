-- OWNER and ADMIN may read completed, non-deleted match records
-- surfaced by get_global_match_history. Match throw access already has
-- an is_admin()-gated SELECT policy.
-- No player result, throw or historical match row is modified.
drop policy if exists "Admin and owner can view finished match statistics" on public.matches;
create policy "Admin and owner can view finished match statistics"
  on public.matches
  for select
  to authenticated
  using (
    status = 'finished'
    and deleted_at is null
    and (select public.is_admin())
  );
