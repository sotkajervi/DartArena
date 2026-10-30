import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./sfu-video-test-page.js',import.meta.url),'utf8');
const {videoTestHtml}=await import('./sfu-video-test-page.js');
const html=videoTestHtml({SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key'});
test('isolated video page renders no private secrets',()=>{
 assert.match(html,/DartArena – isolert SFU-videotest/);
 assert.match(html,/public-test-key/);
 assert.doesNotMatch(html,/REALTIME_SFU_BEARER_TOKEN|service_role|SFU_ROOMS/);
 assert.match(html,/https:\/\/cdn.jsdelivr.net/);
});
test('video page browser JavaScript compiles',()=>{
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,1);
 new Function(scripts[0][1]);
});
test('video page calls authenticated media endpoints and provides two-way announcement',()=>{
 assert.match(source,/\/api\/sfu\/access-check/);
 assert.match(source,/\/api\/sfu\/publish/);
 assert.match(source,/\/api\/sfu\/subscribe/);
 assert.match(source,/event:'request-publication'/);
 assert.match(source,/persistSession:false/);
});
