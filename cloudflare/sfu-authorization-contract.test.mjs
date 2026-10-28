// Offline authorization contract tests. They do NOT execute SQL or touch Supabase.
// Real authorization tests require an isolated database with authenticated users.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('./can-access-sfu-room.staging.sql',import.meta.url),'utf8');
test('uses caller identity rather than a supplied user id',()=>{
  assert.match(sql,/auth\.uid\(\)/);
  assert.doesNotMatch(sql,/p_user_id/i);
});
test('only active challenge participants can join',()=>{
  assert.match(sql,/c\.status\s*=\s*'room'/);
  assert.match(sql,/v_uid\s+IN\s*\(c\.challenger_id,\s*c\.challenged_id\)/i);
});
test('only active, nondeleted match participants can join',()=>{
  assert.match(sql,/m\.status\s*=\s*'playing'/);
  assert.match(sql,/m\.deleted_at\s+IS\s+NULL/i);
  assert.match(sql,/v_uid\s+IN\s*\(m\.player1_id,\s*m\.player2_id\)/i);
});
test('tournament access limited to registered players',()=>{
  assert.match(sql,/p_kind\s*=\s*'tournament_match'/);
  assert.match(sql,/RETURN false;\s*END;\s*\$\$;/);
});
test('RPC is restricted to authenticated invoker',()=>{
  assert.match(sql,/SECURITY INVOKER/i);
  assert.match(sql,/REVOKE ALL ON FUNCTION[^;]*FROM PUBLIC, anon/i);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION[^;]*TO authenticated/i);
});
