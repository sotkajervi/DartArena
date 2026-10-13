'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const G=require('./tracker.js');
const src=fs.readFileSync(path.join(__dirname,'match-share.js'),'utf8');

function makeHub(){
  const channels=[];
  return{
    channels,
    connect(){
      const handlers={};
      const channel={
        handlers,
        on(kind,filter,callback){(handlers[filter.event]??=[]).push(callback);return this},
        subscribe(callback){callback('SUBSCRIBED');return this},
        send:async({type,event,payload})=>{
          for(const peer of channels){
            if(peer===channel||peer.topic!==channel.topic)continue;
            for(const cb of peer.handlers[event]||[])cb({payload});
          }
          return 'ok';
        }
      };
      return{channel(topic){channel.topic=topic;channels.push(channel);return channel},
        removeChannel(c){const i=channels.indexOf(c);if(i>=0)channels.splice(i,1)},
        rpc:async function(name){return{data:!!(this.isOwner&&name==='is_owner'||this.isAdmin&&name==='is_admin'),error:null}},
        auth:{onAuthStateChange(){}}
      };
    }
  };
}
function fakeDom(){
  const originalVideoStream={getVideoTracks:()=>[{readyState:'live',enabled:true}]};
  const video={videoWidth:1920,videoHeight:1080,readyState:4,srcObject:originalVideoStream};
  const cards=[];
  const card={
    children:cards,
    appendChild(node){cards.push(node)},
    querySelector(){return null}
  };
  const document={
    getElementById:id=>id==='remoteVideo'?video:id==='remoteVideoCard'?card:null,
    createElement(){
      const label={textContent:''};
      const canvas={width:320,height:240,getContext:()=>({drawImage(){}})};
      return{style:{},className:'',setAttribute(){},innerHTML:'',
        querySelector:selector=>selector==='canvas'?canvas:selector==='.da-az-zoom-target'?label:null,
        remove(){this.removed=true}}
    }
  };
  return {document,card,video,originalVideoStream};
}
function mount(hub,id,{owner=false,admin=false}={}){
  const mock=hub.connect();
  mock.isOwner=owner;mock.isAdmin=admin;
  const dom=fakeDom();
  const frames=[];
  const context={
    m:{id:'test-match',player1_id:'player1',player2_id:'player2'},
    profile:{id},
    window:{DartArenaAutoZoom:G,supabase:{createClient:()=>mock},addEventListener(){}},
    document:dom.document,
    location:{search:'?id=test-match'},
    URLSearchParams,
    performance:{now:()=>1000},
    setInterval(){return 1},
    clearInterval(){},
    requestAnimationFrame(fn){frames.push(fn);return frames.length},
    cancelAnimationFrame(){}
  };
  vm.runInNewContext(src,context,{filename:'autozoom/match-share.js'});
  return{api:context.window.DartArenaMatchAutoZoomShare,...dom,frames,client:mock};
}
function settle(){
  return new Promise(resolve=>setImmediate(()=>setImmediate(resolve)));
}
const position={active:true,x:.48,y:.36,radius:.22,label:'T20',speed:'fast'};

test('sender shares zoom window with opponent without changing original video tracks',async()=>{
  const hub=makeHub();
  const sender=mount(hub,'player1',{owner:true});
  const receiver=mount(hub,'player2');
  sender.api.publish(position);
  await settle();
  assert.equal(receiver.card.children.length,1);
  assert.equal(receiver.card.children[0].className,'da-az-inset da-az-shared-inset');
  assert.equal(receiver.video.srcObject,receiver.originalVideoStream);
  assert.equal(sender.video.srcObject,sender.originalVideoStream);
  assert.ok(receiver.frames.length>0);
});

test('turning off sharing removes opponent zoom automatically',async()=>{
  const hub=makeHub();
  const sender=mount(hub,'player1',{owner:true});
  const receiver=mount(hub,'player2');
  sender.api.publish(position);
  await settle();
  const overlay=receiver.card.children[0];
  sender.api.stop();
  await settle();
  assert.equal(overlay.removed,true);
});

test('non admin player cannot publish an AutoZoom overlay',async()=>{
  const hub=makeHub();
  const sender=mount(hub,'player1');
  const receiver=mount(hub,'player2');
  sender.api.publish(position);
  await settle();
  assert.equal(receiver.card.children.length,0);
});

test('realtime recipient ignores forged sender identity and invalid coordinates',async()=>{
  const hub=makeHub();
  const receiver=mount(hub,'player2');
  const fake=hub.connect();
  const c=fake.channel('match-autozoom-test-match');
  const payload={from:'unrelated',matchId:'test-match',source:'local',active:true,
    session:'test',seq:1,x:.5,y:.4,radius:.3};
  await c.send({type:'broadcast',event:'autozoom-state',payload});
  assert.equal(receiver.card.children.length,0);
  await c.send({type:'broadcast',event:'autozoom-state',payload:{...payload,from:'player1',x:3}});
  assert.equal(receiver.card.children.length,0);
});

test('receiver connecting late requests current zoom position from sender',async()=>{
  const hub=makeHub();
  const sender=mount(hub,'player1',{admin:true});
  sender.api.publish(position);
  await settle();
  const receiver=mount(hub,'player2');
  await settle();
  assert.equal(receiver.card.children.length,1);
});

test('sharing sends state events only, not video, camera or scoring changes',()=>{
  assert.match(src,/autozoom-state/);
  assert.match(src,/autozoom-request/);
  assert.match(src,/db\.rpc\('is_owner'\)/);
  assert.match(src,/db\.rpc\('is_admin'\)/);
  assert.doesNotMatch(src,/getUserMedia\(|replaceTrack\(|addTrack\(|RTCPeerConnection|\.from\('matches'\)/);
});
