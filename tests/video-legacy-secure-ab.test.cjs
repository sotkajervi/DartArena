'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const legacyCode=read('sfu-client.js');
const secureCode=read('sfu-client-secure.js');
const matchRouter=read('match-media-router.js');
const roomRouter=read('room-media-router.js');
const participants=12, matches=6, spectators=6;

function transport(which){
  const logs={requests:[],authReads:0,refreshes:0,pcs:[],tracksAttached:0};
  let nextSession=0;
  class Peer {
    constructor(){this.connectionState='connected';this.signalingState='stable';this.iceGatheringState='complete';this.localDescription=null;this.remoteDescription=null;this.transceivers=[];logs.pcs.push(this)}
    addTransceiver(track,opts){const t={mid:String(this.transceivers.length),track,direction:opts.direction};this.transceivers.push(t);return t}
    async createOffer(){return {type:'offer',sdp:'offline-test-offer'}}
    async createAnswer(){return {type:'answer',sdp:'offline-test-answer'}}
    async setLocalDescription(desc){this.localDescription=desc}
    async setRemoteDescription(desc){this.remoteDescription=desc;if(this.ontrack){logs.tracksAttached++;this.ontrack({track:{kind:'video',readyState:'live'}})}}
    addEventListener(){}
    removeEventListener(){}
    close(){this.signalingState='closed';this.connectionState='closed'}
  }
  const worker='https://video-test.invalid';
  const fetch=async(url,opts={})=>{
    assert.ok(url.startsWith(worker+'/api/sfu/'),'No request may leave fake local test endpoint');
    const request={path:url.slice(worker.length),method:opts.method,headers:{...opts.headers},
      body:opts.body?JSON.parse(opts.body):null};
    logs.requests.push(request);
    if(which==='secure'){
      assert.match(request.headers.Authorization,/^Bearer fake-test-token$/);
      assert.ok(['tournament_match','match'].includes(request.headers['X-DartArena-Room-Kind']));
      assert.match(request.headers['X-DartArena-Room-Id'],/^(match|spec)-/);
      assert.ok(['publish','subscribe'].includes(request.headers['X-DartArena-SFU-Intent']));
      if(request.path.endsWith('/subscribe')||request.path.endsWith('/renegotiate'))
        assert.equal(request.headers['X-DartArena-SFU-Intent'],'subscribe');
    }else{
      assert.equal(request.headers.Authorization,undefined);
    }
    const payload=request.path.endsWith('/session')
      ?{sessionId:'session-'+(++nextSession)}
      :{sessionDescription:{type:'answer',sdp:'offline-test-answer'}};
    return{ok:true,status:200,json:async()=>({ok:true,sfu:payload})};
  };
  const win={};
  const ctx={window:win,RTCPeerConnection:Peer,fetch,setTimeout,clearTimeout,console};
  vm.runInNewContext(which==='secure'?secureCode:legacyCode,ctx);
  const makeAuth=()=>({auth:{
    getSession:async()=>{logs.authReads++;return{data:{session:{access_token:'fake-test-token'}},error:null}},
    refreshSession:async()=>{logs.refreshes++;return{data:{session:{access_token:'fake-test-token'}},error:null}}
  }});
  const newClient=(roomId,kind='tournament_match')=>which==='secure'?
    new win.DartArenaSecureSFU(worker,{kind,id:roomId},makeAuth()):
    new win.DartArenaSFU(worker);
  const stream={getTracks:()=>[{kind:'video',id:'fake-video',readyState:'live'},
    {kind:'audio',id:'fake-audio',readyState:'live'}]};
  return{logs,newClient,stream};
}

async function runRound(which){
  const t=transport(which);
  const clients=Array.from({length:participants},(_,i)=>t.newClient('match-'+Math.floor(i/2)));
  const publications=await Promise.all(clients.map(c=>c.publish(t.stream)));
  assert.equal(publications.length,12);
  const subscribed=await Promise.all(clients.map((client,i)=>client.subscribe(publications[i%2?i-1:i+1],()=>{})));
  assert.equal(subscribed.length,12);
  const watching=Array.from({length:spectators},(_,i)=>t.newClient('spec-'+i,'match'));
  await Promise.all(watching.map((viewer,i)=>viewer.subscribe(publications[2*i],()=>{})));
  // Reconnect three players without re-publishing; subscriber is replaced.
  await Promise.all([0,3,7].map(i=>clients[i].subscribe(publications[i%2?i-1:i+1],()=>{})));
  // Camera track changed for two players: re-publish, closes old publisher.
  await Promise.all([2,8].map(i=>clients[i].publish(t.stream)));
  const {logs}=t;
  const paths=Object.fromEntries(['/api/sfu/session','/api/sfu/publish','/api/sfu/subscribe','/api/sfu/renegotiate']
    .map(path=>[path,logs.requests.filter(x=>x.path===path).length]));
  assert.equal(paths['/api/sfu/session'],12+18+3+2);
  assert.equal(paths['/api/sfu/publish'],12+2);
  assert.equal(paths['/api/sfu/subscribe'],18+3);
  assert.equal(paths['/api/sfu/renegotiate'],18+3);
  assert.equal(logs.requests.length,91); // 12*5 + 6*3 + 3*3 + 2*2
  assert.equal(logs.tracksAttached,21);
  assert.equal(logs.pcs.length,35);
  const closedBeforeCleanup=logs.pcs.filter(pc=>pc.signalingState==='closed').length;
  assert.equal(closedBeforeCleanup,5,'Three reconnected subscribers and two republished cameras');
  clients.forEach(c=>c.close());watching.forEach(c=>c.close());
  assert.equal(logs.pcs.every(pc=>pc.signalingState==='closed'),true,'All mock media must close');
  return {
    mode:which,players:participants,simultaneousMatches:matches,spectators,
    publishing:12,subscribing:12,spectatorSubscriptions:6,reconnections:3,cameraRepublishes:2,
    sfuWorkerRequests:logs.requests.length,requestKinds:paths,
    fakeRtcConnections:logs.pcs.length,simulatedRemoteTrackCallbacks:logs.tracksAttached,
    authGetSessionCalls:logs.authReads,refreshCalls:logs.refreshes,
    secureRoomContextHeaders:which==='secure',allClosed:true
  };
}
async function checkRouter(which,page){
  const scripts=[],intervals=[],events=[],channels=[];
  const db={channel(name){
    const c={name,on(){return this},subscribe(){channels.push(name);return this},send:async()=>{}};
    return c;
  },removeChannel(){}};
  const selectors={remoteVideo:{srcObject:null,readyState:0},remotePlaceholder:{
    textContent:'',classList:{remove(){}}},headerStatus:{title:''}};
  const window={
    DartArenaMediaMode:{getMode:async()=>which},
    addEventListener(kind,cb){events.push({kind,cb})},
    dispatchEvent(){}
  };
  const document={getElementById:id=>selectors[id]||null,
    createElement(tag){return{src:'',async:false,onerror:null}},
    head:{appendChild(el){scripts.push(el.src)}}};
  const context={window,document,URLSearchParams,MediaStream:class {},
    CustomEvent:class {constructor(type,x){this.type=type;this.detail=x?.detail}},
    location:{search:page==='tournament'?'?id=match-0&tournamentMatch=tm-1':'?id=match-0'},
    db,matchId:'match-0',pc:{connectionState:'connected'},
    localReady:true,remoteReady:true,
    setInterval(fn,ms){const timer={fn,ms};intervals.push(timer);return timer},
    clearInterval(){},Date,console:{debug(){},error(){},warn(){}}
  };
  vm.runInNewContext(matchRouter,context);
  for(let i=0;i<12;i++)await Promise.resolve();
  if(which==='sfu')assert.match(scripts[0]||'',/match-sfu-media-secure\.js/);
  else if(page==='tournament')assert.match(scripts[0]||'',/match-sfu-media\.js/);
  else assert.equal(scripts.length,0);
  assert.equal(window.DARTARENA_ACTIVE_MEDIA_MODE,which==='sfu'?'sfu':page==='tournament'?'sfu':'peer');
  return{mode:which,page,loadedScripts:scripts,connectionMode:window.DARTARENA_ACTIVE_MEDIA_MODE,
    fallbackBroadcastChannels:channels.length};
}
test('12 simulated players + spectators: legacy vs secure SFU negotiation on a fully mocked worker',async()=>{
  const legacy=await runRound('legacy');
  const secure=await runRound('secure');
  assert.equal(legacy.sfuWorkerRequests,secure.sfuWorkerRequests);
  assert.equal(legacy.fakeRtcConnections,secure.fakeRtcConnections);
  assert.equal(legacy.authGetSessionCalls,0);
  assert.equal(secure.authGetSessionCalls,secure.sfuWorkerRequests);
  const routes=[
    await checkRouter('legacy','tournament'),await checkRouter('sfu','tournament'),
    await checkRouter('legacy','ordinary'),await checkRouter('sfu','ordinary')
  ];
  console.log('ISOLATED VIDEO A/B: no real video bits, no Cloudflare/Supabase requests');
  console.log(JSON.stringify({legacy,secure,routes},null,2));
});
test('Secure SFU refuses access denied instead of retrying after 403',async()=>{
  const win={};let calls=0,refreshes=0;
  const fakeFetch=async()=>{
    calls++;return{ok:false,status:403,json:async()=>({ok:false,error:'access denied'})}
  };
  vm.runInNewContext(secureCode,{window:win,RTCPeerConnection:class{},fetch:fakeFetch,setTimeout,clearTimeout,console});
  const authClient={auth:{
    getSession:async()=>({data:{session:{access_token:'fake-test-token'}},error:null}),
    refreshSession:async()=>{refreshes++;return{data:{session:{access_token:'refreshed'}},error:null}}
  }};
  const c=new win.DartArenaSecureSFU('https://video-test.invalid',{kind:'tournament_match',id:'match-403'},authClient);
  await assert.rejects(()=>c.request('/api/sfu/session',undefined,'POST','publish'),/403/);
  assert.equal(calls,1);
  assert.equal(refreshes,0);
});
test('Secure SFU refreshes authorization once on 401 only',async()=>{
  const win={};let calls=0,refreshes=0;
  const fakeFetch=async()=>{
    calls++;return calls===1?
      {ok:false,status:401,json:async()=>({ok:false,error:'expired'})}:
      {ok:true,status:200,json:async()=>({ok:true,sfu:{sessionId:'mock-session'}})};
  };
  vm.runInNewContext(secureCode,{window:win,RTCPeerConnection:class{},fetch:fakeFetch,setTimeout,clearTimeout,console});
  const c=new win.DartArenaSecureSFU('https://video-test.invalid',
    {kind:'tournament_match',id:'match-401'},
    {auth:{
      getSession:async()=>({data:{session:{access_token:'old-fake-token'}},error:null}),
      refreshSession:async()=>{refreshes++;return{data:{session:{access_token:'new-fake-token'}},error:null}}
    }});
  const answer=await c.request('/api/sfu/session');
  assert.equal(answer.sessionId,'mock-session');
  assert.equal(calls,2);assert.equal(refreshes,1);
});
