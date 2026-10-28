// Run with: node --test cloudflare/sfu-security.test.mjs
// Local mock tests only: no Cloudflare, Supabase, or SFU network calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const workerSource=await readFile(new URL('./dartarena-realtime.staging.js',import.meta.url),'utf8');
const transformed=workerSource.replace("import { DurableObject } from 'cloudflare:workers';","class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }")
  .replace('export class SfuRoom','class SfuRoom').replace('export default {','const worker = {')+'\n globalThis.__out={SfuRoom,worker};';
const id1='11111111-1111-4111-8111-111111111111';
const id2='22222222-2222-4222-8222-222222222222';
const room1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const room2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const session1='session_ABCDEF123456';
const session2='session_QWERTY123456';
const logs=[];
const store=new Map();
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key',REALTIME_SFU_APP_ID:'test-app',REALTIME_SFU_BEARER_TOKEN:'test-only-secret'};
let allow=true;
let authorizedUser=id1;
const sandbox={Request,Response,Headers,URL,TextEncoder,Date,Set,JSON,Number,encodeURIComponent,console,fetch:async (url,opts={})=>{
 const u=String(url);
 if(u.includes('/auth/v1/user'))return new Response(JSON.stringify({id:authorizedUser}),{status:200});
 if(u.includes('/rest/v1/rpc/can_access_sfu_room'))return new Response(JSON.stringify(allow),{status:200});
 logs.push(u);
 if(u.endsWith('/sessions/new'))return new Response(JSON.stringify({sessionId:session1}),{status:200});
 return new Response(JSON.stringify({sessionDescription:{type:'answer',sdp:'v=0'}}),{status:200});
}};
vm.runInNewContext(transformed,sandbox,{filename:'dartarena-realtime.staging.js'});
const {SfuRoom,worker}=sandbox.__out;
const ctx={storage:{get:async k=>store.get(k),put:async(k,v)=>store.set(k,v),delete:async k=>store.delete(k)}};
const object=new SfuRoom(ctx,env);
env.SFU_ROOMS={getByName:()=>({fetch:(input,init)=>object.fetch(new Request(input,init))})};
function req(path,body,headers={},method='POST'){
 return new Request('https://test.example'+path,{method,headers:{Origin:'https://sotkajervi.github.io',Authorization:'Bearer test', 'X-DartArena-Room-Kind':'match','X-DartArena-Room-Id':room1,...headers},body:body===undefined?undefined:JSON.stringify(body)});
}
test('health endpoint responds without secrets',async()=>{const r=await worker.fetch(new Request('https://test.example/health'),env);assert.equal(r.status,200)});
test('unapproved origin rejected',async()=>{const r=await worker.fetch(req('/api/sfu/session',undefined,{Origin:'https://attacker.example'}),env);assert.equal(r.status,403)});
test('missing auth denied',async()=>{const r=await worker.fetch(req('/api/sfu/session',undefined,{Authorization:''}),env);assert.equal(r.status,401)});
test('invalid room id denied',async()=>{const r=await worker.fetch(req('/api/sfu/session',undefined,{'X-DartArena-Room-Id':'invalid'}),env);assert.equal(r.status,403)});
test('unauthorized room denied before SFU',async()=>{allow=false;let before=logs.length;const r=await worker.fetch(req('/api/sfu/session'),env);assert.equal(r.status,403);assert.equal(logs.length,before);allow=true});
test('session created for authorized user',async()=>{const r=await worker.fetch(req('/api/sfu/session'),env);assert.equal(r.status,200);assert.equal(store.get('s:'+session1).owner,id1)});
test('another user cannot publish owned session',async()=>{authorizedUser=id2;const before=logs.length;const r=await worker.fetch(req('/api/sfu/publish',{sessionId:session1,sessionDescription:{type:'offer',sdp:'v=0'},tracks:[{location:'local',mid:'0',trackName:'camera'}]}),env);assert.equal(r.status,403);assert.equal(logs.length,before);authorizedUser=id1});
test('other room cannot access session',async()=>{const before=logs.length;const isolated=new SfuRoom({storage:{get:async()=>undefined,put:async()=>{},delete:async()=>{}}},env);env.SFU_ROOMS={getByName:name=>({fetch:(r,init)=>name.endsWith(room2)?isolated.fetch(new Request(r,init)):object.fetch(new Request(r,init))})};const r=await worker.fetch(req('/api/sfu/renegotiate',{sessionId:session1,sessionDescription:{type:'answer',sdp:'v=0'}},{'X-DartArena-Room-Id':room2},'PUT'),env);assert.equal(r.status,403);assert.equal(logs.length,before)});
test('unknown remote publication rejected',async()=>{const before=logs.length;const r=await worker.fetch(req('/api/sfu/subscribe',{sessionId:session1,tracks:[{location:'remote',sessionId:session2,trackName:'camera'}]}),env);assert.equal(r.status,403);assert.equal(logs.length,before)});
test('expired sessions denied',async()=>{store.set('s:'+session1,{owner:id1,createdAt:Date.now()-4*3600*1000,published:[]});const r=await worker.fetch(req('/api/sfu/renegotiate',{sessionId:session1,sessionDescription:{type:'answer',sdp:'v=0'}}, {},'PUT'),env);assert.equal(r.status,403)});

test('tournament access denied even when membership RPC would allow it',async()=>{const before=logs.length;const r=await worker.fetch(req('/api/sfu/session',undefined,{'X-DartArena-Room-Kind':'tournament_match'}),env);assert.equal(r.status,403);assert.equal(logs.length,before)});
test('malformed publish does not reach Cloudflare',async()=>{store.set('s:'+session1,{owner:id1,createdAt:Date.now(),published:[]});const before=logs.length;const r=await worker.fetch(req('/api/sfu/publish',{sessionId:session1,sessionDescription:{type:'offer',sdp:''},tracks:[{location:'local',mid:'0',trackName:'camera'}]}),env);assert.equal(r.status,400);assert.equal(logs.length,before)});

test('unauthenticated user cannot subscribe to another session',async()=>{
 const previous=authorizedUser;authorizedUser=id2;
 const before=logs.length;
 allow=false;
 try{
  const r=await worker.fetch(req('/api/sfu/subscribe',{sessionId:session1,tracks:[{location:'remote',sessionId:session2,trackName:'camera'}]}),env);
  assert.equal(r.status,403);
  assert.equal(logs.length,before);
 }finally{allow=true;authorizedUser=previous}
});
test('missing authorization configuration fails closed',async()=>{
 const before=logs.length;
 const r=await worker.fetch(req('/api/sfu/session'),{...env,SUPABASE_PUBLISHABLE_KEY:''});
 assert.equal(r.status,503);
 assert.equal(logs.length,before);
});
test('invalid room kind denied before authenticating or calling SFU',async()=>{
 const before=logs.length;
 const r=await worker.fetch(req('/api/sfu/session',undefined,{'X-DartArena-Room-Kind':'spectator'}),env);
 assert.equal(r.status,403);
 assert.equal(logs.length,before);
});
