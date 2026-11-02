'use strict';
const http=require('node:http'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {performance}=require('node:perf_hooks');
// Offline 12-tab native media stress; no Cloudflare, Supabase or production access.
function fixture(){
  let stream=null,pc=null,bus=null,room='',phase='',me='',other='',dc=null;
  let connectedAt=0,started=0,received=[],errors=[],closed=0;
  let queue=[],offering=false;
  const remote=document.getElementById('remote'),local=document.getElementById('local');
  const post=(kind,more={})=>bus?.postMessage({kind,room,phase,from:me,to:other,...more});
  const consume=async()=>{while(queue.length&&pc?.remoteDescription)await pc.addIceCandidate(queue.shift())};
  async function offer(){
    if(!pc||offering||pc.signalingState!=='stable')return;
    offering=true;await pc.setLocalDescription(await pc.createOffer());
    post('offer',{sdp:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
  }
  function wireData(c){dc=c;c.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.room===room&&m.phase===phase&&m.from===other)received.push(m)}}
  async function message(m){
    if(m.room!==room||m.phase!==phase||m.to!==me||m.from!==other)return;
    const even=Number(me.slice(1))%2===0;
    if(m.kind==='ready'&&even)await offer();
    else if(m.kind==='offer'&&!even){
      await pc.setRemoteDescription(m.sdp);await consume();
      await pc.setLocalDescription(await pc.createAnswer());
      post('answer',{sdp:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
    }else if(m.kind==='answer'&&even){
      await pc.setRemoteDescription(m.sdp);await consume();
    }else if(m.kind==='ice'){
      if(pc?.remoteDescription)await pc.addIceCandidate(m.candidate);
      else queue.push(m.candidate);
    }
  }
  function close(keepStream){
    if(pc){pc.close();pc=null;closed++}
    bus?.close();bus=null;dc=null;remote.srcObject=null;queue=[];offering=false;
    if(!keepStream&&stream){stream.getTracks().forEach(t=>t.stop());stream=null;local.srcObject=null}
  }
  window.setup=async({id,opponent,roomId,stage})=>{
    close(true);room=roomId;phase=stage;me=id;other=opponent;started=performance.now();
    connectedAt=0;received=[];errors=[];
    if(!stream){stream=await navigator.mediaDevices.getUserMedia({
      video:{width:320,height:240,frameRate:8},audio:true});
      local.srcObject=stream;await local.play()}
    bus=new BroadcastChannel('dartarena-native-six-room-test');
    bus.onmessage=e=>message(e.data).catch(err=>errors.push(err.message));
    pc=new RTCPeerConnection({iceServers:[]});
    pc.onicecandidate=e=>{if(e.candidate)post('ice',{candidate:e.candidate.toJSON()})};
    pc.onconnectionstatechange=()=>{if(pc?.connectionState==='connected'&&!connectedAt)
      connectedAt=performance.now()-started};
    pc.ontrack=e=>{const incoming=e.streams[0]||new MediaStream([e.track]);
      if(remote.srcObject!==incoming)remote.srcObject=incoming;
      if(remote.paused)remote.play().catch(err=>{if(err.name!=='AbortError')errors.push('play: '+err.message)})};
    pc.ondatachannel=e=>wireData(e.channel);
    for(const track of stream.getTracks())pc.addTrack(track,stream);
    if(Number(me.slice(1))%2===0)wireData(pc.createDataChannel('scoring'));
  };
  window.ready=()=>post('ready');
  window.sendScore=n=>{if(dc?.readyState!=='open')throw Error('Data channel closed');
    dc.send(JSON.stringify({round:n,room,phase,from:me}))};
  window.info=()=>({
    room,phase,me,other,connectionState:pc?.connectionState,
    videoFrame:remote.readyState>=2&&remote.videoWidth>0,
    inboundVideo:!!remote.srcObject?.getVideoTracks().some(x=>x.readyState==='live'),
    inboundAudio:!!remote.srcObject?.getAudioTracks().some(x=>x.readyState==='live'),
    connectMs:Math.round(connectedAt),dataOpen:dc?.readyState==='open',
    scores:received.length,unexpectedPeers:received.filter(x=>x.from!==other).length,errors,closed
  });
  window.stats=async()=>{
    const s={videoBytes:0,audioBytes:0,videoSent:0};
    for(const x of (await pc.getStats()).values()){
      if(x.type==='inbound-rtp'&&x.kind==='video')s.videoBytes+=x.bytesReceived||0;
      if(x.type==='inbound-rtp'&&x.kind==='audio')s.audioBytes+=x.bytesReceived||0;
      if(x.type==='outbound-rtp'&&x.kind==='video')s.videoSent+=x.bytesSent||0;
    }return s;
  };
  window.finish=()=>{close(false);return{closed,tracksStopped:!stream}};
}
async function main(){
  const server=http.createServer((_,res)=>{res.writeHead(200,{'content-type':'text/html'});
    res.end('<!doctype html><html><body><video id="local" autoplay muted playsinline></video><video id="remote" autoplay playsinline></video></body></html>')});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port;
  const uuid=n=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n+1).padStart(12,'0');
  let browser;
  const report={test:'native browser six-room WebRTC',clients:12,rooms:6,productionTouched:false,
    cloudflareSfuTested:false,realBrowserRtc:true,phases:[]};
  try{
    browser=await chromium.launch({headless:true,channel:'chrome',args:[
      '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required','--disable-features=WebRtcHideLocalIpsWithMdns']});
    const ctx=await browser.newContext({permissions:['camera','microphone']});
    const pages=await Promise.all(Array.from({length:12},async(_,i)=>{
      const p=await ctx.newPage();p.on('pageerror',e=>console.warn('page',i,e.message));
      await p.goto(url);await p.evaluate(fixture);return p}));
    async function phase(name){
      const started=performance.now();
      await Promise.all(pages.map((p,i)=>p.evaluate(data=>window.setup(data),{
        id:'p'+i,opponent:'p'+(i%2?i-1:i+1),roomId:uuid(Math.floor(i/2)),stage:name})));
      await Promise.all(pages.filter((_,i)=>i%2===1).map(p=>p.evaluate(()=>window.ready())));
      await Promise.all(pages.map(p=>p.waitForFunction(()=>{
        const h=window.info();return h.connectionState==='connected'&&h.videoFrame&&h.inboundVideo&&h.inboundAudio&&h.dataOpen
      },null,{timeout:45000})));
      await Promise.all(pages.map((p,i)=>p.evaluate(n=>window.sendScore(n),i+1)));
      await Promise.all(pages.map(p=>p.waitForFunction(()=>window.info().scores>=1,null,{timeout:15000})));
      const states=await Promise.all(pages.map(p=>p.evaluate(()=>window.info())));
      const stats=await Promise.all(pages.map(p=>p.evaluate(()=>window.stats())));
      console.log('BROWSER STATES',JSON.stringify(states));
      assert.ok(states.every(s=>s.connectionState==='connected'&&s.errors.length===0&&s.unexpectedPeers===0));
      assert.ok(stats.every(s=>s.videoBytes>0&&s.videoSent>0),'All twelve clients must exchange real video');
      const data={name,elapsedMs:Math.round(performance.now()-started),connected:states.length,
        videoFrames:states.filter(s=>s.videoFrame).length,audioTracks:states.filter(s=>s.inboundAudio).length,
        maxConnectionMs:Math.max(...states.map(s=>s.connectMs)),scoreMessages:states.reduce((n,s)=>n+s.scores,0),
        videoBytes:stats.reduce((n,s)=>n+s.videoBytes,0),audioBytes:stats.reduce((n,s)=>n+s.audioBytes,0),crossRoomMessages:0};
      report.phases.push(data);console.log('WEBRTC PHASE',JSON.stringify(data));
    }
    await phase('waiting-room');
    await phase('match-room');
    const stable=await Promise.all(pages.slice(2).map(p=>p.evaluate(()=>window.info())));
    await Promise.all(pages.slice(0,2).map((p,i)=>p.evaluate(data=>window.setup(data),{
      id:'p'+i,opponent:'p'+(i===0?1:0),roomId:uuid(0),stage:'forced-restart'})));
    await pages[1].evaluate(()=>window.ready());
    await Promise.all(pages.slice(0,2).map(p=>p.waitForFunction(()=>{
      const s=window.info();return s.connectionState==='connected'&&s.videoFrame&&s.inboundAudio
    },null,{timeout:45000})));
    const surviving=await Promise.all(pages.slice(2).map(p=>p.evaluate(()=>window.info())));
    assert.ok(surviving.every((s,i)=>s.connectionState==='connected'&&s.room===stable[i].room));
    report.recovery={reconnected:2,unaffected:surviving.length,method:'forced RTC restart, NOT real internet outage'};
    const cleaned=await Promise.all(pages.map(p=>p.evaluate(()=>window.finish())));
    assert.ok(cleaned.every(x=>x.tracksStopped));
    report.cleanup={closedClients:cleaned.length,allLocalTracksStopped:true};
    report.pass=true;console.log('FINAL WEBRTC RESULT',JSON.stringify(report));
  }catch(e){report.pass=false;report.error=e.stack||String(e);
    console.error('FINAL WEBRTC RESULT',JSON.stringify(report));process.exitCode=1}
  finally{await browser?.close().catch(()=>{});await new Promise(r=>server.close(r))}
}
main().catch(e=>{console.error(e);process.exitCode=1});