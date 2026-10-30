'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'remote-audio-autounlock.js'),'utf8');
const controls=fs.readFileSync(path.join(root,'match-controls.js'),'utf8');

function harness(){
  const callbacks={};
  let poll=null;
  let playCalls=0;
  const classList={add(){},remove(){}};
  class MediaStreamMock{
    constructor(tracks){this.tracks=tracks}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
  }
  const firstTrack={kind:'audio',readyState:'live',enabled:true,muted:false};
  const video={
    srcObject:new MediaStreamMock([firstTrack]),
    muted:false,
    paused:true,
    async play(){
      playCalls++;
      this.paused=false;
    },
    addEventListener(event,fn){callbacks[event]=fn}
  };
  const button={classList,textContent:'',title:'',addEventListener(){}};
  const document={
    getElementById(id){return id==='remoteVideo'?video:id==='remoteAudioBtn'?button:null},
    addEventListener(){},
    removeEventListener(){}
  };
  const window={addEventListener(){}};
  const context={window,document,MediaStream:MediaStreamMock,
    console:{debug(){}},Date,
    setInterval(fn){poll=fn;return 1},clearInterval(){}};
  vm.runInNewContext(source,context);
  return{
    video,callbacks,
    poll(){poll()},
    replace(){
      video.srcObject=new MediaStreamMock([{kind:'audio',readyState:'live',enabled:true,muted:false}]);
      video.paused=true;
      video.muted=true;
    },
    get playCalls(){return playCalls}
  };
}

test('unmuted-but-paused remote media automatically restarts playback after network loss',async()=>{
  const h=harness();
  await Promise.resolve();
  assert.equal(h.playCalls,1,'initial unmuted but paused remote video/audio must restart');
  assert.equal(h.video.paused,false);
  h.replace();
  h.poll();
  await Promise.resolve();
  assert.equal(h.playCalls,2,'new incoming audio stream must restart playback');
  assert.equal(h.video.muted,false);
  assert.equal(h.video.paused,false);
});

test('polling after healthy audio playback does not repeatedly call play',async()=>{
  const h=harness();
  await Promise.resolve();
  for(let i=0;i<10;i++)h.poll();
  assert.equal(h.playCalls,1);
});

test('legacy match audio timer does not override SFU reconnect autounlock',()=>{
  assert.match(controls,/if\(\['sfu','sfu-fallback'\]\.includes\(window\.DARTARENA_ACTIVE_MEDIA_MODE\)\)return/);
  assert.match(source,/if\(video\.muted\|\|video\.paused\)/);
});
