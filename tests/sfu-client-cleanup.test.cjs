'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('sfu-client-secure.js','utf8');
const offer={type:'offer',sdp:'v=0'},answer={type:'answer',sdp:'v=0'};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
const tick=()=>new Promise(r=>setImmediate(r));
function make({fail='',sessionGate=null,closeFailure=false}={}){
 const requests=[],peers=[];let n=0;
 class Peer{
  constructor(){this.signalingState='stable';this.iceGatheringState='complete';peers.push(this);}
  addTransceiver(){return{mid:'0'}}
  async createOffer(){return offer}
  async createAnswer(){return answer}
  async setLocalDescription(s){this.localDescription=s}
  async setRemoteDescription(s){this.remoteDescription=s}
  close(){this.signalingState='closed'}
 }
 const ctx={window:{},RTCPeerConnection:Peer,fetch:async(url,opt)=>{
  const path=new URL(url).pathname,body=opt.body?JSON.parse(opt.body):null;requests.push({path,opt,body});
  if(path==='/api/sfu/session'){const id='session_'+(++n);if(sessionGate)await sessionGate.promise;return Response.json({sfu:{sessionId:id}})}
  if(path===fail||path==='/api/sfu/close'&&closeFailure)return Response.json({ok:false,error:'test'},{status:502});
  return Response.json({sfu:{sessionDescription:path==='/api/sfu/subscribe'?offer:answer}});
 },setTimeout,clearTimeout};
 vm.runInNewContext(src,ctx);
 const auth={auth:{getSession:async()=>({data:{session:{access_token:'mock-token'}}})}};
 const c=new ctx.window.DartArenaSecureSFU('https://example.invalid',{kind:'match',id:'room-id'},auth);
 const stream={getTracks:()=>[{kind:'video'}]},publication={sessionId:'remote_session',tracks:['camera']};
 return {c,requests,peers,stream,publication,closes:()=>requests.filter(x=>x.path==='/api/sfu/close')};
}
test('closing both peers sends separate keepalive requests for owned sessions only',async()=>{
 const h=make();await h.c.publish(h.stream);await h.c.subscribe(h.publication,()=>{});
 h.c.close();h.c.close();await tick();
 assert.equal(h.closes().length,2);
 assert.deepEqual(h.closes().map(x=>x.body.sessionId),['session_1','session_2']);
 for(const x of h.closes()){assert.equal(x.opt.keepalive,true);assert.equal(x.opt.headers.Authorization,'Bearer mock-token');assert.equal(x.opt.headers['X-DartArena-Room-Id'],'room-id')}
 assert.ok(h.peers.every(p=>p.signalingState==='closed'));
 assert.equal(h.c.publisherSessionId,null);assert.equal(h.c.subscriberSessionId,null);
});
test('failed publish cleans up owned session without waiting on server close',async()=>{
 const h=make({fail:'/api/sfu/publish',closeFailure:true});await assert.rejects(h.c.publish(h.stream));await tick();
 assert.equal(h.closes().length,1);assert.equal(h.closes()[0].body.sessionId,'session_1');assert.equal(h.c.publisher,null);
});
test('failed subscribe cleans up only the local subscriber session',async()=>{
 const h=make({fail:'/api/sfu/subscribe'});await assert.rejects(h.c.subscribe(h.publication,()=>{}));await tick();
 assert.equal(h.closes().length,1);assert.equal(h.closes()[0].body.sessionId,'session_1');assert.equal(h.c.subscriber,null);
});
for(const kind of ['publish','subscribe'])test('late '+kind+' session is released when closed during allocation',async()=>{
 const gate=deferred(),h=make({sessionGate:gate});
 const pending=kind==='publish'?h.c.publish(h.stream):h.c.subscribe(h.publication,()=>{});
 await tick();assert.ok(h.requests.some(x=>x.path==='/api/sfu/session'));
 h.c.close();gate.resolve();await assert.rejects(pending,/superseded/);await tick();
 assert.equal(h.closes().length,1);assert.equal(h.closes()[0].body.sessionId,'session_1');
 assert.equal(h.requests.filter(x=>x.path==='/api/sfu/'+kind).length,0);
});
test('replacement closes old subscriber, never the new session or remote publication',async()=>{
 const h=make();await h.c.subscribe(h.publication,()=>{});await h.c.subscribe(h.publication,()=>{});await tick();
 assert.equal(h.closes().length,1);assert.equal(h.closes()[0].body.sessionId,'session_1');assert.equal(h.c.subscriberSessionId,'session_2');
});
test('all entrypoints and Half-It bootstrap use a consistent versioned secure client',()=>{
 const versions=new Set();
 for(const p of ['61-match.html','jdc-match.html','half-it-bootstrap.js','match.html','room.html','cricket.html','spectate.html','tournament-match-room.html','tournament-match-viewer.html']){
  const matches=[...fs.readFileSync(p,'utf8').matchAll(/sfu-client-secure\.js\?v=([\w-]+)/g)];
  assert.ok(matches.length,p);for(const m of matches)versions.add(m[1]);
 }
 assert.equal(versions.size,1,'all pages must load the same secure client version');
 assert.match(fs.readFileSync('half-it.html','utf8'),/half-it-bootstrap\.js\?v=[\w-]+/);
});
