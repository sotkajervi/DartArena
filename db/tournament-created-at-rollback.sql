-- Restore the exact authenticated column grant removed by the candidate.
grant update (created_at) on public.tournaments to authenticated;
