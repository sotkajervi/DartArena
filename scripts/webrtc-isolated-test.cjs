'use strict';
// Isolated browser benchmark: no production services, no secrets, no remote ICE.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');

const pairs = Number(process.argv[2] || 1);
if (!Number.isInteger(pairs) || pairs < 1 || pairs > 5) throw Error('Maximum five pairs per run');
const durationMs = 15000;
const delay = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer((req,res)=>{
  res.writeHead(200,{'content-type':'text/html','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'"});
  res.end('<!doctype html><title>Isolated WebRTC test</title><body>Local synthetic media only</body>');
});
async function main(){
 let browser, report;
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const context=await browser.newContext({offline:false});
  // Block HTTP traffic anywhere but our ephemeral local server.
  await context.route('**/*',route=>route.request().url().startsWith(url+'/')?route.continue():route.abort());
  const page=await context.newPage();
  await page.goto(url+'/');
  report=await page.evaluate(async ({pairs,durationMs})=>{
   const active=[], resources=[];
   const sleep=ms=>new Promise(r=>setTimeout(r,ms));
   const started=performance.now();
   const audio=new AudioContext();
   await audio.resume();
   function media(i){
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;document.body.append(canvas);
    const c=canvas.getContext('2d');
    let tick=0;
    const draw=()=>{
     tick++;
     c.fillStyle='#102537';c.fillRect(0,0,640,360);
     c.fillStyle='#21bbc0';c.fillRect((tick*9+i*31)%570,100,70,110);
     c.fillStyle='#fff';c.font='22px sans-serif';c.fillText('Synthetic player '+i+' / '+tick,25,40);
    };
    draw();
    const timer=setInterval(draw,1000/15);
    const video=canvas.captureStream(15);
    const osc=audio.createOscillator(), gain=audio.createGain(), dest=audio.createMediaStreamDestination();
    osc.frequency.value=220+i*15;gain.gain.value=.015;
    osc.connect(gain);gain.connect(dest);osc.start();
    const stream=new MediaStream([...video.getVideoTracks(),...dest.stream.getAudioTracks()]);
    resources.push(()=>{clearInterval(timer);osc.stop();osc.disconnect();gain.disconnect();stream.getTracks().forEach(t=>t.stop());canvas.remove()});
    return stream;
   }
   async function connect(a,b){
    const pendingA=[],pendingB=[];
    a.onicecandidate=e=>{if(e.candidate)pendingB.push(e.candidate)};
    b.onicecandidate=e=>{if(e.candidate)pendingA.push(e.candidate)};
    await a.setLocalDescription(await a.createOffer());
    await b.setRemoteDescription(a.localDescription);
    await b.setLocalDescription(await b.createAnswer());
    await a.setRemoteDescription(b.localDescription);
    // Gather both sides, then pass candidates after remote descriptions.
    const deadline=performance.now()+12000;
    while((a.iceGatheringState!=='complete'||b.iceGatheringState!=='complete')&&performance.now()<deadline)await sleep(100);
    await Promise.all(pendingA.map(c=>a.addIceCandidate(c)).concat(pendingB.map(c=>b.addIceCandidate(c))));
    const limit=performance.now()+15000;
    while(performance.now()<limit){
     if(a.connectionState==='connected'&&b.connectionState==='connected')return;
     if([a.connectionState,b.connectionState].includes('failed'))break;
     await sleep(100);
    }
    throw Error('ICE/DTLS did not connect: '+a.connectionState+' / '+b.connectionState+'; candidates '+pendingA.length+'/'+pendingB.length);
   }
   async function stats(pc){
    let vb=0,ab=0,frames=0,lost=0,received=0,rtt=null;
    for(const r of (await pc.getStats()).values()){
     if(r.type==='inbound-rtp'){
      if(r.kind==='video'){vb+=r.bytesReceived||0;frames+=r.framesDecoded||0}
      if(r.kind==='audio')ab+=r.bytesReceived||0;
      lost+=r.packetsLost||0;received+=r.packetsReceived||0;
     }
     if(r.type==='candidate-pair'&&r.nominated&&r.state==='succeeded'&&typeof r.currentRoundTripTime==='number')rtt=r.currentRoundTripTime*1000;
    }
    return {videoBytes:vb,audioBytes:ab,framesDecoded:frames,packetsLost:lost,packetsReceived:received,rttMs:rtt,state:pc.connectionState};
   }
   try{
    for(let i=0;i<pairs;i++){
     const a=new RTCPeerConnection({iceServers:[]}),b=new RTCPeerConnection({iceServers:[]});
     active.push({a,b});
     for(const [pc,j] of [[a,2*i],[b,2*i+1]]){
      const stream=media(j);
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      const v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;
      v.width=160;v.height=90;document.body.append(v);
      pc.ontrack=e=>{v.srcObject=e.streams[0];v.play().catch(()=>{})};
      resources.push(()=>{v.pause();v.srcObject=null;v.remove()});
     }
    }
    await Promise.all(active.map(({a,b})=>connect(a,b)));
    const setupMs=Math.round(performance.now()-started);
    const before=await Promise.all(active.flatMap(({a,b})=>[stats(a),stats(b)]));
    await sleep(durationMs);
    const after=await Promise.all(active.flatMap(({a,b})=>[stats(a),stats(b)]));
    const peers=after.map((p,i)=>({...p,player:i+1,videoBytes:p.videoBytes-before[i].videoBytes,audioBytes:p.audioBytes-before[i].audioBytes,framesDecoded:p.framesDecoded-before[i].framesDecoded,packetsLost:p.packetsLost-before[i].packetsLost,packetsReceived:p.packetsReceived-before[i].packetsReceived}));
    return {test:'isolated-local-browser-p2p',pairs,players:pairs*2,setupMs,durationMs,peers,pass:peers.every(p=>p.state==='connected'&&p.videoBytes>0&&p.audioBytes>0&&p.framesDecoded>=30)};
   }finally{
    for(const {a,b} of active){a.close();b.close()}
    for(const close of resources){try{close()}catch{}}
    await audio.close();
   }
  },{pairs,durationMs});
  console.log(JSON.stringify(report,null,2));
  await fs.writeFile('webrtc-report-'+pairs+'.json',JSON.stringify(report,null,2));
  assert.equal(report.pass,true,'Media flow or frame threshold not met');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1});
