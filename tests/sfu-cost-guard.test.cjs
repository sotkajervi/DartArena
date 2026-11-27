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

function roomHarness(upstream){
 const calls=[];
 const {SfuRoom}=load(async(url,opts)=>{calls.push({url,method:opts.method,body:opts.body?JSON.parse(opts.body):undefined});return upstream(calls.at(-1));});
 const st=storage(),room=new SfuRoom({storage:st},{REALTIME_SFU_APP_ID:'fake-app',REALTIME_SFU_BEARER_TOKEN:'fake-token'});
 const session='session_123';
 const req=(path,body,owner=user(1),intent='publish')=>new Request('https://internal/sfu',{method:'POST',body:JSON.stringify({userId:owner,path,method:path.endsWith('/renegotiate')?'PUT':'POST',body:{sessionId:session,...body},intent})});
 return {st,calls,room,session,run:(...args)=>room.fetch(req(...args)),seed:extra=>st.put('s:'+session,{owner:user(1),createdAt:Date.now(),published:[],intent:'publish',trackAttempts:0,...extra})};
}
const publishBody={sessionDescription:{type:'offer',sdp:'v=0'},tracks:[{location:'local',trackName:'camera',mid:'0'},{location:'local',trackName:'microphone-1',mid:'1'}]};
test('cumulative track limit is enforced even when upstream fails',async()=>{
 const h=roomHarness(()=>Response.json({error:'mock failure'},{status:500}));await h.seed();
 for(let i=0;i<4;i++)assert.equal((await h.run('/api/sfu/publish',publishBody)).status,500);
 assert.equal((await h.run('/api/sfu/publish',publishBody)).status,429);assert.equal(h.calls.length,4);
});
test('concurrent additions share one cumulative quota',async()=>{
 const h=roomHarness(()=>Response.json({tracks:[]}));await h.seed();
 const results=await Promise.all(Array.from({length:8},()=>h.run('/api/sfu/publish',publishBody)));
 assert.equal(results.filter(r=>r.status===200).length,4);
 assert.equal(results.filter(r=>r.status===429).length,4);
 assert.equal(h.calls.length,4);
});
test('owner can force-close only their own session, using upstream mids',async()=>{
 const h=roomHarness(c=>c.method==='GET'?Response.json({tracks:[{mid:'0',status:'active'},{mid:'1',status:'inactive'},{mid:'2',status:'initializing'}]}):Response.json({tracks:[{mid:'0'},{mid:'2',errorCode:'close_track_error'}]}));
 await h.seed({createdAt:Date.now()-4*3600000});
 assert.equal((await h.run('/api/sfu/close',{},user(2))).status,403);assert.equal(h.calls.length,0);
 assert.equal((await h.run('/api/sfu/close',{})).status,200);
 assert.equal(h.calls[1].method,'PUT');assert.deepEqual(h.calls[1].body,{tracks:[{mid:'0'},{mid:'2'}],force:true});
 assert.equal(await h.st.get('s:'+h.session),undefined);
});
test('partial close failure retains ownership, rejects mutations and allows retry',async()=>{
 let fail=true;const h=roomHarness(c=>c.method==='GET'?Response.json({tracks:[{mid:'0',status:'active'},{mid:'1',status:'active'}]}):Response.json({tracks:[{mid:'0'},{mid:'1',...(fail?{errorCode:'internal_error'}:{})}]}));
 await h.seed();assert.equal((await h.run('/api/sfu/close',{})).status,502);
 assert.equal((await h.st.get('s:'+h.session)).closing,true);
 assert.equal((await h.run('/api/sfu/publish',publishBody)).status,409);
 fail=false;assert.equal((await h.run('/api/sfu/close',{})).status,200);
 assert.equal(await h.st.get('s:'+h.session),undefined);
});
test('inactive tracks require no close request',async()=>{
 const h=roomHarness(()=>Response.json({tracks:[{mid:'0',status:'inactive'}]}));await h.seed();
 assert.equal((await h.run('/api/sfu/close',{})).status,200);assert.equal(h.calls.length,1);
});
test('missing close results never release ownership',async()=>{
 const h=roomHarness(c=>c.method==='GET'?Response.json({tracks:[{mid:'0',status:'active'}]}):Response.json({tracks:[]}));
 await h.seed();assert.equal((await h.run('/api/sfu/close',{})).status,502);assert.ok(await h.st.get('s:'+h.session));
});
test('close reaches room even after membership ends, still requires authentication',async()=>{
 const h=harness({authorized:false});assert.equal((await h.run('/api/sfu/close')).status,200);assert.deepEqual(h.counts(),{upstream:1,guards:0,auth:1});
 const unauth=harness({allowed:false});assert.equal((await unauth.run('/api/sfu/close')).status,401);assert.equal(unauth.counts().upstream,0);
});
