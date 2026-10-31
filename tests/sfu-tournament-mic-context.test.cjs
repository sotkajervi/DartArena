'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'match-spectator-broadcast.js'),'utf8');
const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
const match=fs.readFileSync(path.join(root,'match.js'),'utf8');
const {capture}=require('../match-preferred-media.js');

const camera={deviceId:{exact:'camera-1'},width:{ideal:1280}};
const defaultCamera={width:{ideal:1280}};
const defaultAudio={echoCancellation:true};
function devices(accept){
  const calls=[];
  return{
    calls,
    async getUserMedia(constraints){
      calls.push(constraints);
      return accept(constraints);
    }
  };
}
const missing=()=>Object.assign(new Error('no device'),{name:'OverconstrainedError'});

test('X01 requests microphone selected in tournament waiting room rather than default',async()=>{
  const media=devices(c=>({track:'correct microphone'}));
  const result=await capture(media,{video:camera,audio:defaultAudio},{
    preferredMicId:'chosen-mic',cameraFallbackVideo:defaultCamera
  });
  assert.equal(result.stream.track,'correct microphone');
  assert.equal(result.usedDefaultMic,false);
  assert.deepEqual(media.calls[0].audio,{...defaultAudio,deviceId:{exact:'chosen-mic'}});
  assert.equal(media.calls.length,1);
});

test('invalid selected camera is replaced while keeping selected microphone',async()=>{
  const media=devices(c=>{
    if(c.video.deviceId)throw missing();
    return {track:'microphone stays selected'};
  });
  const result=await capture(media,{video:camera,audio:defaultAudio},{
    preferredMicId:'chosen-mic',cameraFallbackVideo:defaultCamera
  });
  assert.equal(result.usedDefaultCamera,true);
  assert.equal(result.usedDefaultMic,false);
  assert.equal(media.calls[1].audio.deviceId.exact,'chosen-mic');
});

test('missing microphone falls back to the working default without preventing game startup',async()=>{
  const media=devices(c=>{
    if(c.audio.deviceId)throw missing();
    return {track:'default microphone'};
  });
  const result=await capture(media,{video:camera,audio:defaultAudio},{
    preferredMicId:'stale-device',cameraFallbackVideo:defaultCamera
  });
  assert.equal(result.stream.track,'default microphone');
  assert.equal(result.usedDefaultMic,true);
  assert.equal(media.calls.length,3);
  assert.equal(media.calls[2].audio.deviceId,undefined);
  assert.ok(media.calls[2].video.deviceId);
});

test('missing camera and microphone fall back to defaults',async()=>{
  const media=devices(c=>{
    if(c.video.deviceId||c.audio.deviceId)throw missing();
    return {track:'fallback devices'};
  });
  const result=await capture(media,{video:camera,audio:defaultAudio},{
    preferredMicId:'stale-device',cameraFallbackVideo:defaultCamera
  });
  assert.equal(result.usedDefaultCamera,true);
  assert.equal(result.usedDefaultMic,true);
  assert.equal(media.calls.length,4);
});

test('permission denial never causes hidden alternate camera or microphone capture attempts',async()=>{
  const permission=Object.assign(new Error('denied'),{name:'NotAllowedError'});
  const media=devices(()=>{throw permission});
  await assert.rejects(capture(media,{video:camera,audio:defaultAudio},{
    preferredMicId:'chosen-mic',cameraFallbackVideo:defaultCamera
  }),error=>error===permission);
  assert.equal(media.calls.length,1);
});

test('no persisted mic preserves default capture',async()=>{
  const media=devices(()=>({track:'default'}));
  const result=await capture(media,{video:camera,audio:defaultAudio},{preferredMicId:''});
  assert.equal(result.stream.track,'default');
  assert.deepEqual(media.calls[0].audio,defaultAudio);
  assert.equal(media.calls.length,1);
});

test('match page loads mic preference helper before match.js and reads the shared storage key',()=>{
  const helper=html.indexOf('match-preferred-media.js?v=20261031-micpref1');
  const matchScript=html.indexOf('match.js?v=20261031-micpref1');
  assert.ok(helper>=0&&matchScript>helper);
  assert.match(match,/localStorage\.getItem\('dartarena-preferred-microphone'\)/);
  assert.match(match,/DartArenaMatchPreferredMedia\.capture\(navigator\.mediaDevices/);
});

test('isolated SFU preview does not issue unauthorized spectator publication requests',()=>{
  let createClients=0,intervals=0;
  const window={
    supabase:{createClient(){++createClients;return {}}},
    addEventListener(){}
  };
  vm.runInNewContext(source,{
    window,location:{hostname:'dartarena-sfu-preview.sotkajervi.workers.dev',search:'?id=match-id'},
    URLSearchParams,console:{info(){}},setInterval(){++intervals}
  });
  assert.equal(createClients,0);
  assert.equal(intervals,0);
  assert.match(html,/match-spectator-broadcast\.js\?v=20261031-spectatorgate1/);
});

test('normal public match retains the existing spectator publishing implementation',()=>{
  let createClients=0,subscribed=0;
  const fakeClient={
    channel(){return {
      on(){return this},
      subscribe(){++subscribed}
    }},
    removeChannel(){}
  };
  vm.runInNewContext(source,{
    window:{
      supabase:{createClient(){++createClients;return fakeClient}},
      addEventListener(){},
    },
    location:{hostname:'sotkajervi.github.io',search:'?id=match-id'},URLSearchParams,
    console:{info(){}},document:{getElementById(){return {textContent:'0'}}},
    setInterval(){return 1},clearInterval(){}
  });
  assert.equal(createClients,1);
  assert.equal(subscribed,1);
});
