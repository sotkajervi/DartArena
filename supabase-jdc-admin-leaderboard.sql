-- Expose the current best result id so admins can delete exactly the leaderboard result shown.
-- The existing jdc_challenge_best view already recalculates the best row per player,
-- so after deletion the next-highest result automatically becomes the player's tier/badge.

create or replace view public.jdc_challenge_best
with (security_invoker = true)
as
select distinct on (r.user_id)
  r.user_id,
  p.username,
  r.score as best_score,
  r.phase1_score,
  r.doubles_score,
  r.phase3_score,
  r.doubles_hit,
  r.shanghai_count,
  r.badge,
  r.created_at as achieved_at,
  r.id as result_id
from public.jdc_challenge_results r
join public.profiles p on p.id=r.user_id
order by r.user_id, r.score desc, r.created_at asc;

revoke all on public.jdc_challenge_best from anon;
grant select on public.jdc_challenge_best to authenticated;

-- admin_delete_jdc_result(bigint) is defined in supabase-jdc-challenge.sql
-- and verifies public.is_admin() server-side before deleting.
