'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'autozoom/match-beta.js'),'utf8');
const G=require('./tracker.js');

function mockNode(tag='div'){
  const set=new Set(['hidden']);
  const listeners={};
  const children=[];
  const el={tag,listeners,children,style:{},className:'',value:'',disabled:false,
    classList:{
      add(n){set.add(n)},remove(n){set.delete(n)},contains(n){return set.has(n)}
    },
    addEventListener(n,fn){listeners[n]=fn},
    setAttribute(name,value){el[name]=value},
    append(...items){items.forEach(item=>{children.push(item);item.parentElement=el})},
    prepend(...items){children.unshift(...items)},
    remove(){el.removed=true},
    getContext(){return{drawImage(){},getImageData(){return {data:new Uint8ClampedArray(480*270*4)}}}},
    querySelector(selector){
      if(selector==='canvas')return mockNode('canvas');
      if(selector==='.da-az-zoom-target')return mockNode('span');
      if(!el.named)el.named={};
      if(!el.named[selector]){
        const child=mockNode();
        child.value=selector==='#azMatchSource'?'remote':
          selector==='#azMatchSensitivity'?'normal':
          selector==='#azMatchSpeed'?'normal':
          selector==='#azMatchEnabled'?'on':
          selector==='#azMatchShare'?'on':'';
        child.selectedOptions=[{textContent:child.value}];
        el.named[selector]=child;
      }
      return el.named[selector];
    }
  };
  return el;
}

async function setup(owner=false,admin=false){
  const actions=mockNode(),head=mockNode(),localCard=mockNode(),remoteCard=mockNode();
  const stream={getVideoTracks:()=>[{readyState:'live',enabled:true,muted:false}]};
  const local=mockNode('video'),remote=mockNode('video');
  for(const video of [local,remote]){
    video.srcObject=stream;
    video.readyState=4;
    video.videoWidth=1920;
    video.videoHeight=1080;
    video.getBoundingClientRect=()=>({left:0,top:0,width:960,height:540});
  }
  head.querySelector=selector=>selector==='.top-actions'?actions:null;
  head.insertAdjacentElement=(pos,el)=>{head.inserted=el};
  const mockDB={
    auth:{
      getUser:async()=>({data:{user:{id:'tester'}}}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
    },
    rpc:async(name)=>({data:name==='is_owner'?owner:admin,error:null})
  };
  const intervals=[],raf=[],published=[];
  let stopped=0;
  const ctx={
    window:{
      DartArenaAutoZoom:G,
      DartArenaMatchAutoZoomShare:{publish(state){published.push(state)},stop(){stopped++}},
      supabase:{createClient:()=>mockDB},
      addEventListener(){}
    },
    document:{
      querySelector:selector=>selector==='#matchView .match-head'?head:null,
      getElementById:id=>({localVideo:local,remoteVideo:remote,
        localVideoCard:localCard,remoteVideoCard:remoteCard})[id]||null,
      createElement:mockNode
    },
    setInterval(fn,delay){intervals.push(delay);return intervals.length},
    clearInterval(){},
    requestAnimationFrame(fn){raf.push(fn);return raf.length},
    cancelAnimationFrame(){},
    performance:{now:()=>1000},
    Uint8ClampedArray
  };
  vm.runInNewContext(src,ctx,{filename:'autozoom/match-beta.js'});
  await new Promise(resolve=>setImmediate(resolve));
  return {head,actions,local,remote,localCard,remoteCard,intervals,raf,published,
    get stopped(){return stopped},toggle:actions.children[0]};
}

test('501 match includes a beta overlay script, tracker and scoped styles',()=>{
  const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
  assert.match(html,/autozoom\/match-beta\.js\?v=20261013-matchaz2/);
  assert.match(html,/autozoom\/tracker\.js\?v=20261013-matchaz1/);
  assert.match(html,/autozoom\/match-share\.js\?v=20261013-matchaz2/);
  assert.match(html,/autozoom\/match-beta\.css\?v=20261013-matchaz1/);
});

test('normal player never sees AutoZoom control and has no media modifications',async()=>{
  const view=await setup(false,false);
  assert.equal(view.toggle.classList.contains('hidden'),true);
  assert.equal(view.head.inserted,undefined);
  const originalStream=view.remote.srcObject;
  await view.toggle.listeners.click();
  assert.equal(view.remote.srcObject,originalStream);
  assert.equal(view.local.srcObject,originalStream);
  assert.equal(view.head.inserted,undefined);
});

test('owner can launch overlay while original video stream stays untouched',async()=>{
  const view=await setup(true,false);
  assert.equal(view.toggle.classList.contains('hidden'),false);
  const original=view.remote.srcObject;
  await view.toggle.listeners.click();
  assert.ok(view.head.inserted);
  assert.equal(view.head.inserted.classList.contains('hidden'),false);
  assert.equal(view.remote.srcObject,original);
  assert.equal(view.local.srcObject,original);
  assert.equal(view.remoteCard.children.length,2,'calibration and zoom overlays only');
  assert.ok(view.intervals.includes(150),'Normal starts 150ms detection cadence');
});

test('admin can use Fast/Normal/Smooth with distinct confirmation intervals',async()=>{
  const view=await setup(false,true);
  await view.toggle.listeners.click();
  const speed=view.head.inserted.querySelector('#azMatchSpeed');
  speed.value='fast';speed.selectedOptions=[{textContent:'Rask'}];
  speed.listeners.change();
  speed.value='smooth';speed.selectedOptions=[{textContent:'Rolig'}];
  speed.listeners.change();
  assert.ok(view.intervals.includes(100));
  assert.ok(view.intervals.includes(150));
  assert.ok(view.intervals.includes(180));
});

test('source switch mounts a new overlay without touching camera streams',async()=>{
  const view=await setup(true,false);
  await view.toggle.listeners.click();
  const stream=view.local.srcObject;
  const srcSelect=view.head.inserted.querySelector('#azMatchSource');
  srcSelect.value='local';srcSelect.listeners.change();
  assert.equal(view.local.srcObject,stream);
  assert.equal(view.remote.srcObject,stream);
  assert.equal(view.localCard.children.length,2);
});

test('owner can calibrate Bull and D20 and capture an existing webcam frame',async()=>{
  const view=await setup(true,false);
  await view.toggle.listeners.click();
  const panel=view.head.inserted;
  const calibrate=panel.querySelector('#azMatchCalibrate');
  const reference=panel.querySelector('#azMatchReference');
  calibrate.listeners.click();
  const layer=view.remoteCard.children[0];
  layer.listeners.click({clientX:480,clientY:270}); // Bull
  layer.listeners.click({clientX:480,clientY:180}); // D20
  assert.equal(reference.disabled,false);
  const original=view.remote.srcObject;
  reference.listeners.click();
  assert.equal(view.remote.srcObject,original,'reference must never replace video stream');
  assert.match(panel.querySelector('#azMatchStatus').textContent,/Referanse tatt/);
});

test('closing the beta removes only zoom layers, keeping video and scoreboard',async()=>{
  const view=await setup(true,false);
  await view.toggle.listeners.click();
  const original=view.remote.srcObject;
  view.head.inserted.querySelector('#azMatchClose').listeners.click();
  assert.equal(view.head.inserted.classList.contains('hidden'),true);
  assert.equal(view.remote.srcObject,original);
  assert.equal(view.local.srcObject,original);
  assert.equal(view.remoteCard.children[0].removed,true);
  assert.equal(view.remoteCard.children[1].removed,true);
});

test('owner broadcasts a calibrated own-camera AutoZoom view and can disable sharing',async()=>{
  const view=await setup(true,false);
  await view.toggle.listeners.click();
  const panel=view.head.inserted;
  const src=panel.querySelector('#azMatchSource');
  src.value='local';src.listeners.change();
  panel.querySelector('#azMatchCalibrate').listeners.click();
  const layer=view.localCard.children[0];
  layer.listeners.click({clientX:480,clientY:270});
  layer.listeners.click({clientX:480,clientY:180});
  panel.querySelector('#azMatchReference').listeners.click();
  assert.ok(view.published.length>0,'Reference with own camera should publish');
  const last=view.published.at(-1);
  assert.equal(last.active,true);
  assert.ok(last.x>0&&last.x<1);
  assert.ok(last.y>0&&last.y<1);
  assert.ok(last.radius>0&&last.radius<.8);
  assert.equal(last.speed,'normal');
  const before=view.stopped;
  const share=panel.querySelector('#azMatchShare');
  share.value='off';share.listeners.change();
  assert.ok(view.stopped>before,'Turning sharing off should send an off-state');
});

test('choosing the opponent camera is local-only, even for Owner',async()=>{
  const view=await setup(true,false);
  await view.toggle.listeners.click();
  const panel=view.head.inserted;
  panel.querySelector('#azMatchCalibrate').listeners.click();
  const layer=view.remoteCard.children[0];
  layer.listeners.click({clientX:480,clientY:270});
  layer.listeners.click({clientX:480,clientY:180});
  panel.querySelector('#azMatchReference').listeners.click();
  assert.equal(view.published.length,0);
});

test('experimental match tracking searches beyond double ring, and only reads pixels',()=>{
  assert.match(src,/SEARCH_RADIUS=1\.65/);
  assert.match(src,/searchRadius:SEARCH_RADIUS/);
  assert.match(src,/G\.speedPreset\(ui\.speed\.value\)/);
  assert.match(src,/G\.createChangeGate/);
  assert.match(src,/db\.rpc\('is_owner'\)/);
  assert.match(src,/db\.rpc\('is_admin'\)/);
  assert.doesNotMatch(src,/getUserMedia|\.addTrack\(|\.replaceTrack\(|RTCPeerConnection|\.send\(|\.update\(|\.insert\(/);
});
