-- Runs as authenticated role against a disposable local PostgreSQL instance.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
BEGIN
 IF NOT public.can_access_sfu_room('challenge','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish') THEN RAISE EXCEPTION 'A challenge denied'; END IF;
 IF NOT public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','subscribe') THEN RAISE EXCEPTION 'A match denied'; END IF;
 IF public.can_access_sfu_room('challenge','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','publish') THEN RAISE EXCEPTION 'Closed challenge allowed'; END IF;
 IF public.can_access_sfu_room('match','dddddddd-dddd-4ddd-8ddd-dddddddddddd','publish') THEN RAISE EXCEPTION 'Finished match allowed'; END IF;
 IF public.can_access_sfu_room('match','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','publish') THEN RAISE EXCEPTION 'Deleted match allowed'; END IF;
 IF NOT public.can_access_sfu_room('tournament_match','ffffffff-ffff-4fff-8fff-ffffffffffff','publish') THEN RAISE EXCEPTION 'Tournament player A denied'; END IF;
 IF public.can_access_sfu_room('tournament_match','99999999-9999-4999-8999-999999999999','subscribe') THEN RAISE EXCEPTION 'Finished tournament allowed'; END IF;
 IF public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','invalid') THEN RAISE EXCEPTION 'Invalid action allowed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
BEGIN
 IF NOT public.can_access_sfu_room('challenge','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','subscribe') THEN RAISE EXCEPTION 'B challenge denied'; END IF;
 IF NOT public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','publish') THEN RAISE EXCEPTION 'B match denied'; END IF;
 IF NOT public.can_access_sfu_room('tournament_match','ffffffff-ffff-4fff-8fff-ffffffffffff','subscribe') THEN RAISE EXCEPTION 'Tournament player B denied'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $$
BEGIN
 IF public.can_access_sfu_room('challenge','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','publish') THEN RAISE EXCEPTION 'Unrelated C challenge allowed'; END IF;
 IF public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','subscribe') THEN RAISE EXCEPTION 'Unrelated C match allowed'; END IF;
 IF public.can_access_sfu_room('tournament_match','ffffffff-ffff-4fff-8fff-ffffffffffff','subscribe') THEN RAISE EXCEPTION 'Nonparticipant tournament access allowed'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$
BEGIN
 IF public.can_access_sfu_room('challenge','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','subscribe') THEN RAISE EXCEPTION 'Anonymous access allowed'; END IF;
END $$;

-- A spectator may be allowed to read match rows but must not acquire camera rights.
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
SELECT set_config('test.spectator_read','on',false);
DO $spectator$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.matches WHERE id='cccccccc-cccc-4ccc-8ccc-cccccccccccc') THEN
   RAISE EXCEPTION 'Spectator visibility fixture missing';
 END IF;
 IF public.can_access_sfu_room('match','cccccccc-cccc-4ccc-8ccc-cccccccccccc','subscribe') THEN
   RAISE EXCEPTION 'Read-only spectator received camera access';
 END IF;
END $spectator$;
SELECT set_config('test.spectator_read','off',false);
RESET ROLE;
SELECT 'PASS: tournament participant and nonparticipant SQL assertions' AS result;
