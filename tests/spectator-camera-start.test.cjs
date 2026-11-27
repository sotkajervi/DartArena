const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('spectate-runtime.js','utf8');
function harness(){
 const requests=[],subs=[],intervals=[],videos=new Map(),players=new Map(),warnings=[];
 class Stream{constructor(){this.tracks=[]}getTracks(){return this.tracks}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}addTrack(t){this.tracks.push(t)}}
 class Client{constructor(url,ctx,db){this.ctx=ctx;this.closed=false}async subscribe(pub,cb){subs.push({pub,client:this,cb});if(pub.sessionId==='fail')throw Error('fixture fail')}close(){this.closed=true}}
 const channel={on(_a,_b,cb){this.receive=cb;return this},subscribe(cb){this.status=cb;return this},async send(msg){requests.push(msg)}};
 const db={channel(){return channel},removeChannel:async()=>{}};
 const el=id=>{if(!videos.has(id))videos.set(id,{srcObject:null,readyState:0,videoWidth:0,classList:{add(){},remove(){}},play:async()=>{}});return videos.get(id)};
 const code=source.slice(source.indexOf('    async function subscribePlayer('),source.indexOf('    async function pollFxVisits('))+
 source.slice(source.indexOf('    async function requestMissingMedia('),source.indexOf('    async function boot('));
 const ctx={window:{DartArenaSecureSFU:Client,DARTARENA_SFU:{secureWorkerUrl:'https://secure.invalid'}},db,matchId:'match',match:{status:'playing',player1_id:'a',player2_id:'b'},isX01:()=>true,leaving:false,channel:null,mediaRequestTimer:null,mediaRequestCount:0,mediaSubscribed:false,mediaAttempts:new Map(),publications:new Map(),clients:players,$:el,MediaStream:Stream,hardMuteVideo:()=>{},console:{debug(){},warn:(...x)=>warnings.push(x)},clearInterval(){},setInterval(fn){intervals.push(fn);return 1}};
 vm.createContext(ctx);vm.runInContext(code+';this.api={subscribePlayer,setupVideo,requestMissingMedia,checkStalledMedia};',ctx);
 return {ctx,api:ctx.api,channel,requests,subs,intervals,players};
}
test('retry a missed camera announcement without replacing the first subscription',async()=>{
 const h=harness();await h.api.setupVideo();await h.channel.status('SUBSCRIBED');a.equal(h.requests.length,1);
 await h.api.subscribePlayer('a',{sessionId:'a1',tracks:['camera','microphone-1']});
 a.equal(h.subs.length,1);a.deepEqual([...h.subs[0].pub.tracks],['camera']);
 await h.intervals[0]();a.equal(h.requests.length,2);
 await h.api.subscribePlayer('a',{sessionId:'a1',tracks:['camera']});a.equal(h.subs.length,1);
 await h.api.subscribePlayer('b',{sessionId:'b1',tracks:['camera']});
 await h.intervals[0]();a.equal(h.requests.length,2);a.equal(h.subs.length,2);a.equal(h.subs[0].client.closed,false);
});
test('requests and failed subscriptions are bounded, and no camera request after match ends',async()=>{
 const h=harness();await h.api.setupVideo();await h.channel.status('SUBSCRIBED');
 for(let i=0;i<20;i++)await h.intervals[0]();a.equal(h.requests.length,8);
 for(let i=0;i<6;i++)await h.api.subscribePlayer('b',{sessionId:'fail',tracks:['camera']});a.equal(h.subs.length,3);a.ok(h.subs.every(x=>x.client.closed));
 await h.api.subscribePlayer('b',{sessionId:'new',tracks:['camera']});a.equal(h.subs.length,4);
 h.ctx.match.status='finished';await h.channel.status('SUBSCRIBED');a.equal(h.requests.length,8);
});
test('old camera events cannot attach after replacement; audio-only publications ignored',async()=>{
 const h=harness();await h.api.subscribePlayer('a',{sessionId:'old',tracks:['camera']});
 await h.api.subscribePlayer('a',{sessionId:'new',tracks:['camera']});a.equal(h.subs[0].client.closed,true);
 await h.subs[0].cb({track:{kind:'video',id:'old',readyState:'live'}});
 a.equal(h.ctx.$('spectateVideo1').srcObject.getTracks().length,0);
 await h.subs[1].cb({track:{kind:'video',id:'new',readyState:'live'}});
 a.equal(h.ctx.$('spectateVideo1').srcObject.getTracks()[0].id,'new');
 await h.api.subscribePlayer('b',{sessionId:'audio',tracks:['microphone-1']});a.equal(h.subs.length,2);
});
test('shared spectator entry points load versioned runtime and teardown retry timer',()=>{
 a.match(fs.readFileSync('spectate.html','utf8'),/spectate-runtime\.js\?v=20261127-firstframe1/);
 a.match(source,/function stopVideo\(\)\{clearInterval\(mediaRequestTimer\)/);
});

test('a negotiated subscription without a first frame retries only the missing camera',async()=>{
 const h=harness();await h.api.setupVideo();await h.channel.status('SUBSCRIBED');
 await h.api.subscribePlayer('a',{sessionId:'a1',tracks:['camera']});
 await h.api.subscribePlayer('b',{sessionId:'b1',tracks:['camera']});
 const v=h.ctx.$('spectateVideo1');v.readyState=2;v.videoWidth=640;
 await h.subs[0].cb({track:{id:'video',kind:'video',readyState:'live',muted:false}});
 for(const x of h.ctx.mediaAttempts.values())x.startedAt=Date.now()-13000;
 await h.intervals[0]();a.equal(h.subs.length,3);a.equal(h.subs[0].client.closed,false);a.equal(h.subs[1].client.closed,true);
 a.equal(h.ctx.mediaAttempts.get('a').firstFrame,true);
 a.equal(h.ctx.mediaAttempts.get('b').count,2);
 h.ctx.mediaAttempts.get('b').startedAt=Date.now()-13000;await h.intervals[0]();
 a.equal(h.subs.length,4);a.equal(h.ctx.mediaAttempts.get('b').count,3);
 h.ctx.mediaAttempts.get('b').startedAt=Date.now()-13000;await h.intervals[0]();
 a.equal(h.subs.length,4);a.equal(h.subs[0].client.closed,false);
});
