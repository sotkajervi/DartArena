-- Candidate: only remove authenticated column UPDATE on the creation timestamp.
-- The production catalog confirmed this is a direct column grant, not a table grant.
revoke update (created_at) on public.tournaments from authenticated;
