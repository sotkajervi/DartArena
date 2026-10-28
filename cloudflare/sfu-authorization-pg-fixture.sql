-- Offline PostgreSQL fixture, run only in an ephemeral GitHub Actions service.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT NULLIF(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
CREATE TABLE public.challenges (
 id uuid PRIMARY KEY, status text NOT NULL, challenger_id uuid, challenged_id uuid
);
CREATE TABLE public.matches (
 id uuid PRIMARY KEY, status text NOT NULL, deleted_at timestamptz,
 player1_id uuid, player2_id uuid
);
INSERT INTO challenges VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','room','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','closed','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
INSERT INTO matches VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','playing',NULL,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','finished',NULL,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','playing',now(),'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT ON challenges,matches TO authenticated;
CREATE POLICY participant_select_challenges ON challenges FOR SELECT TO authenticated
 USING (auth.uid() IN (challenger_id,challenged_id));
CREATE POLICY participant_select_matches ON matches FOR SELECT TO authenticated
 USING (auth.uid() IN (player1_id,player2_id));
