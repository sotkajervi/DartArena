'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../sfu-client.js'),'utf8');
const script=new vm.Script(source);

class FakePC{
  constructor(){this.signalingState='stable';this.iceGatheringState='complete';this.localDescription=null;this.remoteDescription=null;this.ontrack=null}
  close(){this.signalingState='closed'}
  async setRemoteDescription(desc){if(this.signalingState==='closed')throw Error('closed');this.remoteDescription=desc}
  async createAnswer(){return{type:'answer',sdp:'v=0'}}
  async setLocalDescription(desc){if(this.signalingState==='closed')throw Error('closed');this.localDescription=desc}
}
function client(){
 const sandbox={window:{},RTCPeerConnection:FakePC};
 script.runInNewContext(sandbox);
 return new sandbox.window.DartArenaSFU('https://isolated.test',{kind:'challenge',id:'room-1'});
}
test('older delayed session response cannot overwrite a newer subscriber session',async()=>{
 const c=client(),pcs=[];
 c.newPeer=()=>{const pc=new FakePC();pcs.push(pc);return pc};
 let resolveOld=null,created=0;
 const calls=[];
 c.request=async(p,body)=>{
   calls.push({p,body});
   if(p==='/api/sfu/session'){
     created++;
     if(created===1)return new Promise(resolve=>{resolveOld=resolve});
     return{sessionId:'new-session'};
   }
   if(p==='/api/sfu/subscribe')return{sessionDescription:{type:'offer',sdp:'v=0'}};
   if(p==='/api/sfu/renegotiate')return{ok:true};
   throw Error('unexpected route: '+p);
 };
 const old=c.subscribe({sessionId:'old-publisher',tracks:['camera']},()=>{});
 assert.equal(created,1);
 const fresh=await c.subscribe({sessionId:'new-publisher',tracks:['camera']},()=>{});
 assert.equal(fresh,'new-session');
 assert.equal(c.subscriberSessionId,'new-session');
 assert.equal(pcs[0].signalingState,'closed');
 resolveOld({sessionId:'old-session'});
 await assert.rejects(old,/superseded/);
 assert.equal(c.subscriberSessionId,'new-session');
 assert.equal(pcs[1].signalingState,'stable');
 const negotiated=calls.filter(x=>x.p==='/api/sfu/renegotiate');
 assert.equal(negotiated.length,1);
 assert.equal(negotiated[0].body.sessionId,'new-session');
});
test('stale remote tracks are ignored after subscriber replacement',async()=>{
 const c=client(),pcs=[];
 c.newPeer=()=>{const pc=new FakePC();pcs.push(pc);return pc};
 let count=0;
 c.request=async p=>{
  if(p==='/api/sfu/session')return{sessionId:'s-'+(++count)};
  if(p==='/api/sfu/subscribe')return{sessionDescription:{type:'offer',sdp:'v=0'}};
  return{ok:true};
 };
 let callbacks=0;
 await c.subscribe({sessionId:'old',tracks:['camera']},()=>callbacks++);
 const staleHandler=pcs[0].ontrack;
 await c.subscribe({sessionId:'new',tracks:['camera']},()=>callbacks++);
 staleHandler({track:{kind:'video'}});
 pcs[1].ontrack({track:{kind:'video'}});
 assert.equal(callbacks,1);
 assert.equal(c.subscriberSessionId,'s-2');
});
