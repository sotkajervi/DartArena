-- Restore previous browser RPC grants. Anonymous practice grants are intentionally not restored:
-- anonymous clients were already blocked by RLS; they are unrelated to scoring compatibility.
begin;
grant execute on function public.submit_x01_visit(uuid,integer) to authenticated;
grant execute on function public.submit_match_checkout(uuid,integer,integer) to authenticated;
grant execute on function public.submit_chicago_x01_visit(uuid,integer) to authenticated;
grant execute on function public.submit_chicago_checkout(uuid,integer,integer) to authenticated;
grant execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb) to authenticated;
grant execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean) to authenticated;
commit;
