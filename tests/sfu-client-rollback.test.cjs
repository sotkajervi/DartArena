'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const src=fs.readFileSync('sfu-client-secure.js','utf8');
test('authenticated publish and subscribe, local close only, repeated rooms',async()=>{
 const requests=[],peers=[];let seq=0;
 class Peer{constructor(){this.signalingState='stable';this.iceGatheringState='complete';peers.push(this)} addTransceiver(){return {mid:'0'}} async createOffer(){return {type:'offer',sdp:'v=0'}} async createAnswer(){return {type:'answer',sdp:'v=0'}} async setLocalDescription(d){this.localDescription=d} async setRemoteDescription(d){this.remoteDescription=d} close(){this.signalingState='closed'}}
 const auth={auth:{getSession:async()=>({data:{session:{access_token:'test-token'}}})}};
 const ctx={window:{},RTCPeerConnection:Peer,setTimeout,clearTimeout,fetch:async(url,opt)=>{const path=new URL(url).pathname;requests.push({path,opt});return Response.json({sfu:path.endsWith('/session')?{sessionId:'session_'+(++seq)}:{sessionDescription:{type:'answer',sdp:'v=0'}}})}};
 vm.runInNewContext(src,ctx);
 for(let i=0;i<6;i++){const c=new ctx.window.DartArenaSecureSFU('https://example.invalid',{kind:'challenge',id:'room-'+i},auth);const pub=await c.publish({getTracks:()=>[{kind:'video'}]});a.equal(pub.tracks[0],'camera');await c.subscribe({sessionId:'remote',tracks:['camera']},()=>{});c.close();a.equal(c.publisher,null);a.equal(c.subscriber,null)}
 a.ok(peers.every(p=>p.signalingState==='closed'));a.equal(requests.length,30);
 a.ok(requests.every(r=>r.opt.headers.Authorization==='Bearer test-token'&&r.opt.headers['X-DartArena-Room-Kind']==='challenge'));a.ok(requests.some(r=>r.path.endsWith('/subscribe')&&r.opt.headers['X-DartArena-SFU-Intent']==='subscribe'));a.ok(!requests.some(r=>r.path.endsWith('/close')));
});
test('all active entrypoints use rollback cache version',()=>{for(const path of ["61-match.html","cricket.html","half-it-bootstrap.js","half-it.html","jdc-match.html","match.html","room.html","spectate.html","tournament-match-room.html","tournament-match-viewer.html"]){const s=fs.readFileSync(path,'utf8');a.match(s,/(sfu-client-secure|half-it-bootstrap)\.js\?v=20261128-rollback1/);a.doesNotMatch(s,/(sfu-client-secure|half-it-bootstrap)\.js\?v=20261127-close1/)}});