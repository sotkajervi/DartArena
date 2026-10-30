'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../match-sfu-media.js'),'utf8');
const matchId='f840b9e4-c6fb-4d1f-a29d-acabc66710f1';
const streamTrack={kind:'video',id:'local-video',readyState:'live',enabled:true};
const audioTrack={kind:'audio',id:'local-audio',readyState:'live',enabled:true};
const stream={getTracks:()=>[streamTrack,audioTrack],getVideoTracks:()=>[streamTrack],getAudioTracks:()=>[audioTrack]};

class MediaStreamStub{
  constructor(){this.tracks=[]}
  addTrack(t){this.tracks.push(t)}
  getTracks(){return this.tracks}
  getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
  getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
}

function harness(){
  let now=1_000_000,seq=0,cleared=new Set(),publishCount=0;
  const broadcasts=[],listeners={},intervals=[],timeouts=[],created=[];
  let subscribed,receive;
  const video={srcObject:null,readyState:0,pause(){},async play(){}};
  const placeholder={textContent:'',classList:{add(){},remove(){}}};
  const elements={remoteVideo:video,remotePlaceholder:placeholder};
  const channel={
    state:'joined',
    on(_type,opts,fn){if(opts?.event==='media-state')receive=fn;return this},
    subscribe(fn){subscribed=fn;return this},
    async send(msg){broadcasts.push(msg.payload);return 'ok'}
  };
  const db={channel(){return channel},removeChannel(){}};
  class FakeSFU{
    constructor(url,room){
      this.room=room;this.publisher=null;this.subscriber=null;
      this.pending={};this.subscribeCalls=[];created.push(this);
    }
    async publish(){
      this.publisher={connectionState:'connected',iceConnectionState:'connected'};
      ++publishCount;
      return {sessionId:'publisher-'+publishCount,tracks:['camera']};
    }
    async subscribe(pub,cb){
      const sessionId=pub.sessionId;
      this.subscribeCalls.push(sessionId);
      this.subscriber={signalingState:'stable'};
      if(sessionId==='remote-old')return new Promise(resolve=>{this.pending.old=resolve});
      await cb({track:{kind:'video',id:'v-'+sessionId,readyState:'live',muted:false},streams:[]});
      if(pub.tracks.some(name=>name.startsWith('microphone')||name==='audio')){
        await cb({track:{kind:'audio',id:'a-'+sessionId,readyState:'live',muted:false},streams:[]});
      }
      return 'subscriber-'+sessionId;
    }
    close(){this.publisher=null;this.subscriber=null}
  }
  const window={
    DartArenaSFU:FakeSFU,
    DARTARENA_SFU:{workerUrl:'https://security-worker.example'},
    DARTARENA_POSTMATCH_MEDIA_STOPPED:false,
    navigator:{onLine:true},
    addEventListener(event,fn){listeners[event]=fn},
    removeEventListener(event,fn){if(listeners[event]===fn)delete listeners[event]},
  };
  class FakeDate extends Date{
    constructor(...args){super(...(args.length?args:[now]))}
    static now(){return now}
  }
  const context={
    window,db,profile:{id:'player1'},other:'player2',m:{status:'playing'},
    matchId,stream,localReady:true,leaving:false,
    MediaStream:MediaStreamStub,Date:FakeDate,URLSearchParams,
    location:{search:'?id='+matchId},
    document:{getElementById(id){return elements[id]||null}},
    console:{debug(){}},setInterval(fn,delay){const id=++seq;intervals.push({id,fn,delay});return id},
    clearInterval(id){cleared.add(id)},
    setTimeout(fn,delay){const id=++seq;timeouts.push({id,fn,delay});return id},
    clearTimeout(id){cleared.add(id)}
  };
  vm.runInNewContext(source,context);
  return {
    window,video,placeholder,broadcasts,created,
    get publisher(){return created[0]?.publisher},
    get subscribeCalls(){return created[0]?.subscribeCalls||[]},
    get pendingOld(){return created[0]?.pending.old},
    get publishCount(){return publishCount},
    videoTrack:streamTrack,
    audioTrack,
    get debug(){return window.DartArenaMatchMedia.debugText()},
    clock(ms){now+=ms},
    async bootstrap(){await intervals.find(x=>x.delay===150).fn();await subscribed('SUBSCRIBED')},
    async tick(){for(const timer of intervals.filter(x=>x.delay===1000&&!cleared.has(x.id)))await timer.fn()},
    async receive(pub){return receive({payload:{from:'player2',publication:pub}})},
    offline(){window.navigator.onLine=false;listeners.offline()},
    async online(){window.navigator.onLine=true;listeners.online();for(const timer of timeouts.filter(x=>!cleared.has(x.id))){cleared.add(timer.id);await timer.fn()}},
    stop(){window.DartArenaMatchMedia.stop()},
    get listeners(){return listeners}
  };
}

test('browser offline then online creates a NEW publishing session with unchanged local tracks',async()=>{
  const h=harness();
  await h.bootstrap();
  assert.equal(h.publishCount,1);
  assert.equal(h.broadcasts.at(-1).publication.sessionId,'publisher-1');
  const original=h.publisher;
  h.offline();
  original.connectionState='failed';
  await h.tick();
  assert.equal(h.publishCount,1,'must not attempt Cloudflare calls while offline');
  await h.online();
  assert.equal(h.publishCount,2,'online recovery must force new publisher');
  assert.equal(h.broadcasts.at(-1).publication.sessionId,'publisher-2');
  assert.match(h.debug,/PUBLISH reconnect/);
  assert.match(h.debug,/NETWORK OFFLINE OBSERVED: false/);
  await h.tick();
  assert.equal(h.publishCount,2,'healthy stream must not republish in a loop');
});

test('failed ICE publisher is repaired without needing a browser offline event',async()=>{
  const h=harness();
  await h.bootstrap();
  h.publisher.iceConnectionState='failed';
  await h.tick();
  assert.equal(h.publishCount,2);
  assert.equal(h.broadcasts.at(-1).publication.sessionId,'publisher-2');
});

test('short disconnect is ignored, but prolonged publisher disconnect is repaired',async()=>{
  const h=harness();
  await h.bootstrap();
  h.publisher.connectionState='disconnected';
  await h.tick();
  h.clock(6000);
  await h.tick();
  assert.equal(h.publishCount,1,'must leave ICE a chance to recover');
  h.clock(1100);
  await h.tick();
  assert.equal(h.publishCount,2,'must rebuild a disconnected publisher after grace');
});

test('new remote publication preempts an old pending match subscription',async()=>{
  const h=harness();
  await h.bootstrap();
  const old=h.receive({sessionId:'remote-old',tracks:['camera']});
  assert.deepEqual(h.subscribeCalls,['remote-old']);
  await h.receive({sessionId:'remote-new',tracks:['camera']});
  assert.deepEqual(h.subscribeCalls,['remote-old','remote-new']);
  assert.match(h.debug,/REMOTE PUB: remote-new/);
  h.pendingOld();
  await old;
  assert.match(h.debug,/REMOTE PUB: remote-new/);
  assert.doesNotMatch(h.debug,/SUBSCRIBE error/);
});

test('stopping media prevents recovery and removes network listeners',async()=>{
  const h=harness();
  await h.bootstrap();
  h.offline();
  h.stop();
  assert.equal(h.listeners.online,undefined);
  assert.equal(h.listeners.offline,undefined);
  await h.tick();
  assert.equal(h.publishCount,1);
});

test('muting and unmuting microphone never rebuilds the active SFU video publisher',async()=>{
  const h=harness();
  h.audioTrack.enabled=true;
  h.videoTrack.enabled=true;
  try{
    await h.bootstrap();
    assert.equal(h.publishCount,1);
    assert.equal(h.broadcasts.at(-1).publication.sessionId,'publisher-1');
    h.audioTrack.enabled=false;
    await h.tick();
    assert.equal(h.publishCount,1,'muting audio must not rebuild the video sender');
    assert.equal(h.broadcasts.at(-1).publication.sessionId,'publisher-1');
    h.audioTrack.enabled=true;
    await h.tick();
    assert.equal(h.publishCount,1,'unmuting audio must not rebuild the video sender');
    assert.equal(h.videoTrack.enabled,true);
    assert.equal(h.publisher.connectionState,'connected');
  }finally{
    h.stop();
    h.audioTrack.enabled=true;
    h.videoTrack.enabled=true;
  }
});

test('muting camera changes only the track enabled flag, not its SFU session',async()=>{
  const h=harness();
  h.videoTrack.enabled=true;
  try{
    await h.bootstrap();
    h.videoTrack.enabled=false;
    await h.tick();
    assert.equal(h.publishCount,1,'camera off must not break other live media tracks');
    h.videoTrack.enabled=true;
    await h.tick();
    assert.equal(h.publishCount,1,'camera on must reuse existing publisher');
  }finally{
    h.stop();
    h.videoTrack.enabled=true;
  }
});

test('offline/online restores inbound audio subscription even when video track stays live',async()=>{
  const h=harness();
  await h.bootstrap();
  const pub={sessionId:'remote-with-audio',tracks:['camera','microphone-1']};
  await h.receive(pub);
  assert.equal(h.video.srcObject.getAudioTracks().length,1);
  assert.deepEqual(h.subscribeCalls,['remote-with-audio']);
  h.offline();
  await h.online();
  assert.equal(h.publishCount,2,'outgoing publisher also recovers');
  assert.deepEqual(h.subscribeCalls,['remote-with-audio','remote-with-audio'],
    'new inbound SFU session is required to restore audio on disconnected PC');
  assert.equal(h.video.srcObject.getAudioTracks().length,1);
  assert.match(h.debug,/SUBSCRIBE reconnect/);
});

test('broken subscriber ICE repairs incoming audio without rebuilding healthy publisher',async()=>{
  const h=harness();
  await h.bootstrap();
  await h.receive({sessionId:'remote-with-audio',tracks:['camera','microphone-1']});
  h.created[0].subscriber.iceConnectionState='failed';
  await h.tick();
  assert.deepEqual(h.subscribeCalls,['remote-with-audio','remote-with-audio']);
  assert.equal(h.publishCount,1);
});

test('missing expected remote audio track triggers a bounded subscriber restart',async()=>{
  const h=harness();
  await h.bootstrap();
  await h.receive({sessionId:'remote-with-audio',tracks:['camera','microphone-1']});
  h.video.srcObject.tracks=h.video.srcObject.tracks.filter(t=>t.kind!=='audio');
  h.clock(8500);
  await h.tick();
  assert.equal(h.subscribeCalls.length,2);
  await h.tick();
  assert.equal(h.subscribeCalls.length,2,'restored audio must not cause reconnect loops');
});
