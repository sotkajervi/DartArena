'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../room-sfu-media.js'),'utf8');
const preview='dartarena-sfu-preview.sotkajervi.workers.dev';

function harness(){
 let now=100000;
 let attempts=0;
 let failing=false;
 let session=null;
 let suspendedSession=null;
 let releaseSuspended=null;
 let publicationCallback=null;
 class MockStream{
   constructor(){this.tracks=[]}
   getTracks(){return this.tracks}
   getVideoTracks(){return this.tracks.filter(x=>x.kind==='video')}
   addTrack(track){this.tracks.push(track)}
 }
 const video={srcObject:null,muted:false,playsInline:false,readyState:0,videoWidth:0,videoHeight:0,pause(){},async play(){}};
 const placeholder={classList:{add(){},remove(){}},textContent:''};
 const roomDebug={};
 const client={async subscribe(publication){
   attempts++;
   if(failing)throw Error('temporary SFU failure');
   if(publication.sessionId===suspendedSession){
     await new Promise(resolve=>{releaseSuspended=resolve});
   }
 },close(){}};
 const window={DartArenaSFU:function(){return client},DARTARENA_SFU:{workerUrl:'https://isolated.test'},addEventListener(){},navigator:{}};
 const elements={remoteVideo:video,remotePlaceholder:placeholder};
 const channel={
   on(type,options,callback){
     if(type==='broadcast'&&options?.event==='media-state')publicationCallback=callback;
     return this;
   },
   subscribe(){return this},
   async send(){},
   state:'joined'
 };
 const db={channel(){return channel},removeChannel(){}};

 const sandbox={
   window,document:{getElementById(id){return id==='roomSfuDebug'?roomDebug:null}},
   Date:class TestClock extends Date{static now(){return now}},
   MediaStream:MockStream,
   $:id=>elements[id]||null,
   profile:{id:'test-1'},other:'test-2',challengeId:'test-room',names:{'test-2':'Opponent'},
   db,localReady:false,remoteReady:false,stream:null,leaving:false,
   helloTimer:null,pc:null,send:async()=>{},setStatus(){},destroyPeer(){},
   console:{debug(){}},setInterval(){return 1},clearInterval(){},setTimeout(){return 1},clearTimeout(){}
 };
 // A test seam: expose an inner function in VM without altering production source.
 const instrumented=source.replace(
   "  window.DartArenaRoomMedia={mode:'sfu',",
   "  window.__testSubscribeRemote=subscribeRemote;window.__testSetupChannel=setupSfuChannel;\n  window.DartArenaRoomMedia={mode:'sfu',"
 );
 assert.notEqual(instrumented,source,'test seam was not found');
 vm.runInNewContext(instrumented,sandbox);
 return{
   publish:{sessionId:'session-1',tracks:['camera','microphone-1']},
   video,client,
   subscribe:window.__testSubscribeRemote,
   beginReception:window.__testSetupChannel,
   receive:publication=>{
     assert.ok(publicationCallback,'reception channel not subscribed');
     return publicationCallback({payload:{from:'test-2',publication}});
   },
   debug:()=>window.DartArenaRoomMedia.debugText(),
   tick:ms=>{now+=ms},
   attempts:()=>attempts,
   fail:value=>{failing=value},
   hold:sessionId=>{suspendedSession=sessionId},
   release:()=>{assert.ok(releaseSuspended);releaseSuspended();releaseSuspended=null}
 };
}

test('first subscription is not repeatedly torn down every 1.8 seconds',async()=>{
 const h=harness();
 await h.subscribe(h.publish);
 assert.equal(h.attempts(),1);
 for(let i=0;i<4;i++){h.tick(1800);await h.subscribe(h.publish)}
 assert.equal(h.attempts(),1);
 h.tick(801);
 await h.subscribe(h.publish);
 assert.equal(h.attempts(),2,'a stalled video can reconnect after an eight second grace period');
});
test('once first video is playable, no further subscription attempt is made',async()=>{
 const h=harness();
 await h.subscribe(h.publish);
 h.video.srcObject.addTrack({kind:'video',readyState:'live'});
 h.video.videoWidth=640;h.video.videoHeight=480;h.video.readyState=3;
 h.tick(20000);
 await h.subscribe(h.publish);
 assert.equal(h.attempts(),1);
});
test('failed subscription remains immediately retryable',async()=>{
 const h=harness();
 h.fail(true);
 await h.subscribe(h.publish);
 assert.equal(h.attempts(),1);
 h.fail(false);
 await h.subscribe(h.publish);
 assert.equal(h.attempts(),2);
});
test('the room displays phase timings without exposing tokens',()=>{
 assert.match(source,/PUBLISH start/);
 assert.match(source,/PUBLISH ok/);
 assert.match(source,/SUBSCRIBE start/);
 assert.match(source,/SUBSCRIBE ok/);
 assert.match(source,/REMOTE first video frame/);
 assert.match(source,/VIDEO timeout – retrying subscription/);
 assert.doesNotMatch(source,/console\.log\([^\n]*access_token/);
});
test('regression is scoped to waiting-room media on the separate test branch',()=>{
 assert.match(source,/kind:'challenge'/);
 const config=fs.readFileSync(path.join(__dirname,'../sfu-config.js'),'utf8');
 assert.ok(config.includes(preview));
 assert.ok(!config.includes("get('sfuSecurityTest')"));
});

test('repeated announcements remain useful for recovery without overwhelming the debug log',async()=>{
 const h=harness();
 h.beginReception();
 await h.receive(h.publish);
 for(let i=0;i<50;i++){
   h.tick(100);
   await h.receive(h.publish);
 }
 const debug=h.debug();
 assert.match(debug,/SFU module loaded/);
 assert.equal((debug.match(/REMOTE publication changed/g)||[]).length,1);
 assert.match(debug,/REPEATED PUBLICATIONS: 50/);
 assert.match(debug,/FIRST REMOTE PUBLICATION: 0s after load/);
 assert.match(debug,/FIRST PLAYABLE VIDEO: not confirmed/);
 assert.equal(h.attempts(),1,'unchanged publication must not recreate subscriber');
});

test('newer remote publication preempts an old in-flight subscription',async()=>{
 const h=harness();
 h.beginReception();
 h.hold('session-1');
 const old=h.receive(h.publish);
 await Promise.resolve();
 assert.equal(h.attempts(),1);
 const replacement={sessionId:'session-2',tracks:['camera','microphone-1']};
 await h.receive(replacement);
 assert.equal(h.attempts(),2,'new publication must not wait for old network operations');
 assert.match(h.debug(),/REMOTE PUBLICATION: session-2/);
 assert.match(h.debug(),/SUBSCRIBE ok/);
 h.release();
 await old;
 assert.match(h.debug(),/REMOTE PUBLICATION: session-2/);
 assert.equal((h.debug().match(/SUBSCRIBE error/g)||[]).length,0);
});

test('temporary empty publication does not discard newer known media state',async()=>{
 const h=harness();
 h.beginReception();
 await h.receive(h.publish);
 await h.receive(null);
 assert.equal(h.attempts(),1);
 assert.match(h.debug(),/REMOTE PUBLICATION: session-1/);
 assert.match(h.debug(),/REMOTE empty announcement ignored/);
});
