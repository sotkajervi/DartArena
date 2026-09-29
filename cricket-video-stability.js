/* Cricket video stability layer.
   Mirrors the proven X01 recovery model without touching Cricket scoring. */
let cricketAnswerWatchTimer=null,cricketHandshakeTimer=null,cricketDisconnectTimer=null;
let cricketRecoveryState='idle',cricketLastRecoveryRequestAt=0,cricketLastVideoFrames=-1,cricketRtpStalls=0;

function setupChannel(){
  channel=db.channel('match-'+m.id,{config:{broadcast:{ack:true}}})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${m.id}`},async p=>{const oldLeg=m?.current_leg;m=p.new;if(oldLeg!==m.current_leg)selectedDarts=[];try{await loadState()}catch{}render();if(m.status!=='playing')await setPlayersUnavailable()})
    .on('broadcast',{event:'ready'},async({payload})=>{if(payload.from!==other)return;remoteReady=true;lastSignal=`READY g${payload.generation||1}`;debug();if(isOfferer()&&cricketRecoveryState==='idle')await connectIfReady();else if(!isOfferer()&&!pc)cricketArmAnswerWatch()})
    .on('broadcast',{event:'signal'},async({payload})=>{if(payload.from!==other)return;remoteReady=true;await handleSignal(payload)})
    .on('broadcast',{event:'reset-request'},async({payload})=>{if(payload.from!==other||!isOfferer()||leaving||cricketRecoveryState!=='idle')return;await rebuildAsOfferer(payload.reason||'remote')})
    .on('broadcast',{event:'reconnect-request'},async({payload})=>{if(payload.from!==other||!isOfferer()||leaving||cricketRecoveryState!=='idle')return;await rebuildAsOfferer(payload.reason||'remote')})
    .subscribe(async s=>{lastSignal=`RT ${s}`;debug();if(s==='SUBSCRIBED'){await startCamera();startReadyHeartbeat()}})
}

function startReadyHeartbeat(){clearInterval(readyTimer);readyTimer=setInterval(()=>{if(!leaving&&localReady)send('ready',{generation});if(!isOfferer()&&localReady&&remoteReady&&!pc&&cricketRecoveryState==='idle')cricketArmAnswerWatch()},5000)}

function cricketArmAnswerWatch(){
  if(isOfferer()||leaving||!localReady||!remoteReady||pc||cricketAnswerWatchTimer||cricketRecoveryState!=='idle')return;
  cricketAnswerWatchTimer=setTimeout(async()=>{cricketAnswerWatchTimer=null;if(!pc&&cricketRecoveryState==='idle')await requestRecovery('answer-no-peer')},5000)
}

function clearPeer(){
  clearTimeout(reconnectTimer);reconnectTimer=null;clearTimeout(cricketAnswerWatchTimer);cricketAnswerWatchTimer=null;clearTimeout(cricketHandshakeTimer);cricketHandshakeTimer=null;clearTimeout(cricketDisconnectTimer);cricketDisconnectTimer=null;clearInterval(statsTimer);statsTimer=null;
  pendingCandidates=[];lastVideoBytes=-1;cricketLastVideoFrames=-1;videoStalls=0;cricketRtpStalls=0;
  if(pc){pc.ontrack=pc.onicecandidate=pc.onconnectionstatechange=pc.oniceconnectionstatechange=null;try{pc.close()}catch{}}
  pc=null;remoteStream=null;const v=$('remoteVideo');if(v){v.onloadedmetadata=null;v.oncanplay=null;v.pause?.();v.srcObject=null}showRemotePlaceholder('Kobler til video…')
}

function attachRemoteTrack(e,myGen,p){
  if(p!==pc||myGen!==generation)return;if(!remoteStream)remoteStream=new MediaStream();const t=e.track;if(!remoteStream.getTracks().some(x=>x.id===t.id))remoteStream.addTrack(t);const v=$('remoteVideo');v.srcObject=remoteStream;lastSignal=`TRACK ${t.kind}`;
  if(t.kind==='video'){const play=async()=>{if(p!==pc||myGen!==generation)return;try{v.muted=true;await v.play();hideRemotePlaceholder()}catch(err){lastSignal=`PLAY blocked ${err?.name||''}`;debug();showRemotePlaceholder('Klikk i siden for å starte video')}};t.onended=()=>{if(p===pc&&p.connectionState!=='connected')requestRecovery('track-ended')};v.onloadedmetadata=play;v.oncanplay=play;play()}debug()
}

function createPeer(){
  if(pc||!stream?.active)return pc;clearTimeout(cricketAnswerWatchTimer);cricketAnswerWatchTimer=null;const myGen=generation,p=new RTCPeerConnection(ICE);pc=p;remoteStream=new MediaStream();$('remoteVideo').srcObject=remoteStream;for(const t of stream.getTracks())p.addTrack(t,stream);p.ontrack=e=>attachRemoteTrack(e,myGen,p);
  p.onicecandidate=e=>{if(p!==pc||myGen!==generation||!e.candidate)return;send('signal',{candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate,generation:myGen})};
  p.oniceconnectionstatechange=()=>{if(p!==pc)return;lastSignal=`ICE ${p.iceConnectionState}`;debug();if(p.iceConnectionState==='connected'||p.iceConnectionState==='completed')cricketMarkConnected(p,myGen);else if(p.iceConnectionState==='disconnected')cricketArmDisconnectGrace(p,'ice-disconnected');else if(p.iceConnectionState==='failed')cricketHardFailure(p,'ice-failed')};
  p.onconnectionstatechange=()=>{if(p!==pc)return;lastSignal=`PEER ${p.connectionState}`;debug();if(p.connectionState==='connected')cricketMarkConnected(p,myGen);else if(p.connectionState==='disconnected')cricketArmDisconnectGrace(p,'peer-disconnected');else if(p.connectionState==='failed')cricketHardFailure(p,'peer-failed')};return p
}

function cricketMarkConnected(p,myGen){if(p!==pc)return;clearTimeout(cricketHandshakeTimer);cricketHandshakeTimer=null;clearTimeout(cricketDisconnectTimer);cricketDisconnectTimer=null;cricketRecoveryState='idle';rebuilding=false;lastSignal='CONNECTED';debug();startStatsWatch(p,myGen)}
function cricketArmDisconnectGrace(p,reason){if(p!==pc||cricketDisconnectTimer)return;cricketDisconnectTimer=setTimeout(()=>{cricketDisconnectTimer=null;if(p===pc&&(p.connectionState==='disconnected'||p.iceConnectionState==='disconnected'))cricketHardFailure(p,reason)},8000)}
function cricketHardFailure(p,reason){if(p!==pc)return;clearTimeout(cricketDisconnectTimer);cricketDisconnectTimer=null;lastSignal=`HARD FAIL ${reason}`;debug();if(isOfferer())rebuildAsOfferer(reason);else requestRecovery(reason)}

async function connectIfReady(){
  if(leaving||!isOfferer()||!localReady||!remoteReady||!stream?.active||cricketRecoveryState!=='idle')return;if(pc)return;const p=createPeer();if(!p)return;
  try{cricketRecoveryState='handshake';const offer=await p.createOffer();if(p!==pc)return;await p.setLocalDescription(offer);lastSignal=`OFFER sent g${generation}`;debug();await send('signal',{description:p.localDescription.toJSON?p.localDescription.toJSON():p.localDescription,generation});clearTimeout(cricketHandshakeTimer);cricketHandshakeTimer=setTimeout(()=>{if(p===pc&&p.connectionState!=='connected'){cricketRecoveryState='idle';if(isOfferer())rebuildAsOfferer('handshake-timeout');else requestRecovery('handshake-timeout')}},15000)}catch(e){lastSignal=`OFFER error ${e?.name||''}`;debug();cricketRecoveryState='idle';if(p===pc)clearPeer()}
}

async function handleSignal(s){
  if(leaving||!localReady||!stream?.active)return;const sg=Number(s.generation)||1;
  if(s.description?.type==='offer'){
    if(isOfferer()||sg<generation)return;if(sg>generation){generation=sg;clearPeer()}else if(pc)clearPeer();cricketRecoveryState='handshake';const p=createPeer();
    try{await p.setRemoteDescription(s.description);await cricketFlushCandidates(p,sg);const answer=await p.createAnswer();if(p!==pc)return;await p.setLocalDescription(answer);lastSignal=`ANSWER sent g${generation}`;debug();await send('signal',{description:p.localDescription.toJSON?p.localDescription.toJSON():p.localDescription,generation})}catch(e){lastSignal=`ANSWER error ${e?.name||''}`;debug();cricketRecoveryState='idle';requestRecovery('answer-error')}return
  }
  if(s.description?.type==='answer'){
    if(!isOfferer()||!pc||sg!==generation||pc.signalingState!=='have-local-offer')return;try{await pc.setRemoteDescription(s.description);await cricketFlushCandidates(pc,sg);lastSignal=`ANSWER set g${generation}`;debug()}catch(e){lastSignal=`ANSWER SET error ${e?.name||''}`;debug()}return
  }
  if(s.candidate){if(sg<generation)return;if(!pc||sg>generation||!pc.remoteDescription){pendingCandidates.push({candidate:s.candidate,generation:sg});return}try{await pc.addIceCandidate(s.candidate)}catch{}}
}

async function cricketFlushCandidates(p,gen){const keep=[];for(const item of pendingCandidates){const g=item?.generation??gen,c=item?.candidate??item;if(g!==gen){if(g>gen)keep.push(item);continue}try{await p.addIceCandidate(c)}catch{}}pendingCandidates=keep}

function startStatsWatch(p,myGen){
  clearInterval(statsTimer);lastVideoBytes=-1;cricketLastVideoFrames=-1;cricketRtpStalls=0;
  statsTimer=setInterval(async()=>{if(leaving||p!==pc||myGen!==generation||p.connectionState!=='connected')return;try{const stats=await p.getStats();let bytes=0,frames=0,found=false;stats.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='video'&&!r.isRemote){found=true;bytes+=Number(r.bytesReceived||0);frames+=Number(r.framesDecoded||0)}});if(!found)return;const moving=bytes>lastVideoBytes||frames>cricketLastVideoFrames;if(moving){lastVideoBytes=bytes;cricketLastVideoFrames=frames;cricketRtpStalls=0;hideRemotePlaceholder()}else if(lastVideoBytes>=0){cricketRtpStalls++;lastSignal=`VIDEO stall ${cricketRtpStalls}/8`;debug();if(cricketRtpStalls>=8)cricketHardFailure(p,'video-stalled')}}catch{}},1000)
}

async function requestRecovery(reason){
  if(leaving||isOfferer())return;const now=Date.now();if(cricketRecoveryState!=='idle'||now-cricketLastRecoveryRequestAt<12000)return;cricketLastRecoveryRequestAt=now;cricketRecoveryState='waiting-reset';lastSignal=`REQUEST RESET ${reason}`;debug();clearPeer();cricketRecoveryState='waiting-reset';showRemotePlaceholder('Gjenoppretter video…');await send('reset-request',{reason,generation});await send('reconnect-request',{reason,generation});clearTimeout(cricketHandshakeTimer);cricketHandshakeTimer=setTimeout(()=>{if(cricketRecoveryState==='waiting-reset'){cricketRecoveryState='idle';lastSignal='RESET request timeout';debug();cricketArmAnswerWatch()}},15000)
}

async function rebuildAsOfferer(reason){
  if(leaving||!isOfferer()||cricketRecoveryState!=='idle')return;cricketRecoveryState='resetting';rebuilding=true;generation+=1;lastSignal=`RESET g${generation} ${reason}`;debug();clearPeer();cricketRecoveryState='resetting';showRemotePlaceholder('Gjenoppretter video…');await send('ready',{generation});setTimeout(async()=>{if(leaving||cricketRecoveryState!=='resetting')return;rebuilding=false;cricketRecoveryState='idle';await connectIfReady()},700)
}

/* Keep recovery timers from surviving a closed match tab. */
window.addEventListener('beforeunload',()=>{clearTimeout(cricketAnswerWatchTimer);clearTimeout(cricketHandshakeTimer);clearTimeout(cricketDisconnectTimer)});
