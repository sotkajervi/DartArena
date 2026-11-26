-- Apply only after the client compatibility tests and a quiet deployment window.
-- The checked RPC remains the only browser-facing X01/Chicago score submission.
-- Keep the underlying functions for the SECURITY DEFINER wrapper and service role.
begin;
revoke execute on function public.submit_x01_visit(uuid,integer) from public, anon, authenticated;
revoke execute on function public.submit_match_checkout(uuid,integer,integer) from public, anon, authenticated;
revoke execute on function public.submit_chicago_x01_visit(uuid,integer) from public, anon, authenticated;
revoke execute on function public.submit_chicago_checkout(uuid,integer,integer) from public, anon, authenticated;
revoke execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb) from public, anon, authenticated;
revoke execute on function public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean) from public, anon, authenticated;
-- RLS already denies anonymous access; remove redundant grants as defense in depth.
revoke all privileges on table public.practice_matches from anon;
-- Abort atomically if an expected privilege is missing or a legacy privilege remains.
do $check$
declare s text;
begin
 foreach s in array array['public.submit_x01_visit(uuid,integer)','public.submit_match_checkout(uuid,integer,integer)','public.submit_chicago_x01_visit(uuid,integer)','public.submit_chicago_checkout(uuid,integer,integer)','public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb)','public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean)'] loop
  if has_function_privilege('authenticated',s,'EXECUTE') or has_function_privilege('anon',s,'EXECUTE') then raise exception 'Legacy RPC remains exposed: %',s; end if;
  if not has_function_privilege('service_role',s,'EXECUTE') then raise exception 'Service role lost access: %',s; end if;
 end loop;
 if not has_function_privilege('authenticated','public.submit_x01_checked(uuid,integer,timestamptz,integer)','EXECUTE') or not has_function_privilege('authenticated','public.propose_challenge_match(uuid,text,integer,integer,text,integer,uuid,jsonb,boolean,boolean)','EXECUTE') then raise exception 'Required client RPC unavailable'; end if;
 if has_table_privilege('anon','public.practice_matches','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege('anon','public.practice_matches','SELECT,INSERT,UPDATE,REFERENCES') then raise exception 'Anonymous practice access remains'; end if;
end $check$;
commit;
