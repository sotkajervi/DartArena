'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const raw=fs.readFileSync(require('node:path').join(__dirname,'..','cloudflare','dartarena-realtime-cost-guard.js'),'utf8');
const script=raw.replace('import { DurableObject } from "cloudflare:workers";','').replace(/export\s*\{[\s\S]*?\};\s*$/,'')+'\nthis.api={admitNewSession,COST_LIMITS,SfuRoom,worker:dartarena_realtime_staging_default};';
const user=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
function storage(){
 const map=new Map();let tail=Promise.resolve();
 const tx={get:async k=>structuredClone(map.get(k)),put:async(k,v)=>map.set(k,structuredClone(v)),delete:async k=>map.delete(k)};
 return {...tx,map,transaction(fn){const p=tail.then(()=>fn(tx));tail=p.catch(()=>{});return p;}};
}
function load(fetch=async()=>{throw Error('Unexpected network');}){
 const ctx={DurableObject:class{constructor(ctx,env){this.ctx=ctx;this.env=env}},Response,Request,URL,TextDecoder,Uint8Array,console:{warn(){}},fetch};
 vm.runInNewContext(script,ctx);return ctx.api;
}
test('user limit across rooms and independent users',async()=>{
 const {admitNewSession}=load(),s=storage(),now=1000;
 for(let i=0;i<24;i++)assert.equal((await admitNewSession(s,user(1),now)).allowed,true);
 const denied=await admitNewSession(s,user(1),now);assert.equal(denied.allowed,false);assert.equal(denied.retryAfter,299);
 assert.equal((await admitNewSession(s,user(2),now)).allowed,true);
 assert.equal((await admitNewSession(s,user(1),300001)).allowed,true);
});
test('hour limit survives shorter window reset',async()=>{
 const {admitNewSession}=load(),s=storage();
 for(let w=0;w<3;w++)for(let i=0;i<24;i++)assert.equal((await admitNewSession(s,user(1),w*300000+1)).allowed,true);
 assert.equal((await admitNewSession(s,user(1),900001)).allowed,false);
 assert.equal((await admitNewSession(s,user(1),3600001)).allowed,true);
});
test('global minute cap and recovery',async()=>{
 const {admitNewSession}=load(),s=storage();let warnings=0;
 for(let i=0;i<360;i++){const r=await admitNewSession(s,user(i+1),1000);assert.equal(r.allowed,true);if(r.globalWarning)warnings++;}
 assert.equal(warnings,1);
 assert.equal((await admitNewSession(s,user(361),1000)).allowed,false);
 assert.equal((await admitNewSession(s,user(361),60001)).allowed,true);
});
test('global hourly cap across minutes',async()=>{
 const {admitNewSession}=load(),s=storage();
 for(let i=0;i<2400;i++)assert.equal((await admitNewSession(s,user(i+1),Math.floor(i/300)*60000+1)).allowed,true);
 assert.equal((await admitNewSession(s,user(2401),600001)).allowed,false);
 assert.equal((await admitNewSession(s,user(2401),3600001)).allowed,true);
});
test('parallel admission cannot overshoot per-user cap',async()=>{
 const {admitNewSession}=load(),s=storage();
 const rs=await Promise.all(Array.from({length:50},()=>admitNewSession(s,user(1),1000)));
 assert.equal(rs.filter(r=>r.allowed).length,24);
});
test('rejected requests do not consume global allowance',async()=>{
 const {admitNewSession}=load(),s=storage();
 for(let i=0;i<30;i++)await admitNewSession(s,user(1),1000);
 assert.equal(s.map.get('cost:global:minute').count,24);
});
function harness({allowed=true,admitted=true,emergency=false,authorized=true}={}){
 let upstream=0,guards=0,auth=0;
 const {worker}=load(async url=>{
  const p=new URL(url).pathname;
  if(p==='/auth/v1/user'){auth++;return allowed?Response.json({id:user(1)}):new Response(null,{status:401});}
  if(p.endsWith('/can_access_sfu_room'))return Response.json(authorized);
  throw Error('Unexpected fetch '+p);
 });
 const env={SUPABASE_URL:'https://example.invalid',SUPABASE_PUBLISHABLE_KEY:'fake',SFU_MEDIA_ENABLED:'true',SFU_NEW_SESSIONS_ENABLED:emergency?'false':'true',SFU_ROOMS:{getByName(name){return{fetch:async()=>{if(name==='cost-guard:v1'){guards++;return admitted?Response.json({ok:true}):new Response('{"ok":false}',{status:429,headers:{'Retry-After':'42'}});}upstream++;return Response.json({ok:true});}}}}};
 const req=path=>new Request('https://example.invalid'+path,{method:'POST',headers:{Authorization:'Bearer fake','X-DartArena-Room-Kind':'match','X-DartArena-Room-Id':user(2),'Content-Type':'application/json',Origin:'https://sotkajervi.github.io'},...(path.endsWith('/session')?{}:{body:'{"sessionId":"session_123"}'})});
 return {run:path=>worker.fetch(req(path),env),counts:()=>({upstream,guards,auth})};
}
test('valid new session passes guard before room',async()=>{const h=harness();assert.equal((await h.run('/api/sfu/session')).status,200);assert.deepEqual(h.counts(),{upstream:1,guards:1,auth:1});});
test('rate limit prevents room/upstream call and exposes retry-after',async()=>{const h=harness({admitted:false});const r=await h.run('/api/sfu/session');assert.equal(r.status,429);assert.equal(r.headers.get('Retry-After'),'42');assert.deepEqual(h.counts(),{upstream:0,guards:1,auth:1});});
test('emergency switch blocks new sessions only',async()=>{const h=harness({emergency:true});assert.equal((await h.run('/api/sfu/session')).status,503);assert.equal((await h.run('/api/sfu/subscribe')).status,200);assert.deepEqual(h.counts(),{upstream:1,guards:0,auth:2});});
test('unauthorized users and unauthorized rooms never reach admission',async()=>{for(const options of [{allowed:false},{authorized:false}]){const h=harness(options);assert.ok([401,403].includes((await h.run('/api/sfu/session')).status));assert.deepEqual(h.counts(),{upstream:0,guards:0,auth:1});}});
test('internal guard is not a public worker route',async()=>{const h=harness();assert.equal((await h.run('/admit-session')).status,404);assert.deepEqual(h.counts(),{upstream:0,guards:0,auth:0});});
