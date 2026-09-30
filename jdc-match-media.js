(()=>{
  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId||!window.supabase)return;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  const $=id=>document.getElementById(id);
  const ICE={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']}],iceCandidatePoolSize:8,bundlePolicy:'max-bundle'};
  let session=null,match=null,other=null,names={},channel=null,stream=null,pc=null,remoteStream=null,localReady=false,remoteReady=false,pendingCandidates=[],reconnectTimer=null,offerBusy=false,leaving=false;
  const isOfferer=()=>session?.user?.id===match?.player1_id;
  const setStatus=text=>{if($('cameraStatus'))$('cameraStatus').textContent=text};
  const constraints=()=>{const cam=localStorage.getItem('dartarena-preferred-camera')||'',mic=localStorage.getItem('dartarena-preferred-microphone')||'';return{video:{deviceId:cam?{exact:cam}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:{deviceId:mic?{exact:mic}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true}}};
  async function send(event,payload={}){if(channel)await channel.send({type:'broadcast',event,payload:{...payload,from:session.user.id}})}
  async function startMedia(){
    try{
      stream=await navigator.mediaDevices.getUserMedia(constraints());
      const v=$('localVideo');v.srcObject=stream;await v.play().catch(()=>{});$('localPlaceholder')?.classList.add('hidden');localReady=true;setStatus('Kamera klart – kobler til motstander…');await send('ready');connectIfReady();
    }catch(error){setStatus(error?.name==='NotAllowedError'?'Kamera/mikrofon er blokkert.':'Kamera kunne ikke startes.');if($('localPlaceholder'))$('localPlaceholder').textContent='Kamera ikke startet'}
  }
  function destroyPeer(){clearTimeout(reconnectTimer);reconnectTimer=null;pendingCandidates=[];offerBusy=false;if(pc){pc.ontrack=pc.onicecandidate=pc.onconnectionstatechange=null;try{pc.close()}catch{}}pc=null;remoteStream=null;const v=$('remoteVideo');if(v){v.pause();v.srcObject=null}$('remotePlaceholder')?.classList.remove('hidden');$('remoteAudioBtn')?.classList.add('hidden')}
  function createPeer(){
    if(pc)return pc;const p=new RTCPeerConnection(ICE);pc=p;remoteStream=new MediaStream();for(const track of stream.getTracks())p.addTrack(track,stream);
    p.onicecandidate=e=>{if(p===pc&&e.candidate)send('signal',{candidate:e.candidate})};
    p.ontrack=e=>{if(p!==pc)return;const tracks=e.streams?.[0]?.getTracks()||[e.track];for(const track of tracks){if(!remoteStream.getTracks().some(t=>t.id===track.id))remoteStream.addTrack(track)}showRemote()};
    p.onconnectionstatechange=()=>{if(p!==pc)return;if(p.connectionState==='connected'){setStatus(`Video tilkoblet ${names[other]||'motstander'}`);showRemote()}else if(p.connectionState==='failed')scheduleReconnect(600);else if(p.connectionState==='disconnected')scheduleReconnect(5000)};
    return p;
  }
  async function showRemote(){if(!remoteStream?.getTracks().length)return;const v=$('remoteVideo');v.srcObject=remoteStream;v.muted=true;v.playsInline=true;await v.play().catch(()=>{});if(remoteStream.getVideoTracks().some(t=>t.readyState==='live')){$('remotePlaceholder')?.classList.add('hidden');$('remoteAudioBtn')?.classList.remove('hidden')}}
  async function flush(p){while(pendingCandidates.length&&p===pc)await p.addIceCandidate(pendingCandidates.shift()).catch(()=>{})}
  async function connectIfReady(){if(!localReady||!remoteReady||!stream||!isOfferer()||offerBusy)return;const p=createPeer();if(p.signalingState!=='stable')return;offerBusy=true;try{const offer=await p.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});await p.setLocalDescription(offer);await send('signal',{description:p.localDescription})}catch{scheduleReconnect(1000)}finally{offerBusy=false}}
  async function handleSignal(payload){if(!localReady||!stream)return;const p=createPeer();try{if(payload.description?.type==='offer'){if(isOfferer())return;if(p.signalingState!=='stable'){destroyPeer();return handleSignal(payload)}await p.setRemoteDescription(payload.description);await flush(p);const answer=await p.createAnswer();await p.setLocalDescription(answer);await send('signal',{description:p.localDescription})}else if(payload.description?.type==='answer'){if(!isOfferer()||p.signalingState!=='have-local-offer')return;await p.setRemoteDescription(payload.description);await flush(p)}else if(payload.candidate){if(p.remoteDescription)await p.addIceCandidate(payload.candidate).catch(()=>{});else pendingCandidates.push(payload.candidate)}}catch{scheduleReconnect(1000)}}
  function scheduleReconnect(ms){if(leaving||reconnectTimer)return;reconnectTimer=setTimeout(()=>{reconnectTimer=null;if(!pc||pc.connectionState!=='connected'){destroyPeer();connectIfReady()}},ms)}
  async function boot(){
    const {data:{session:s}}=await db.auth.getSession();session=s;if(!session)return;
    const {data:m}=await db.from('matches').select('player1_id,player2_id,game_variant').eq('id',matchId).maybeSingle();if(!m||m.game_variant!=='jdc'||![m.player1_id,m.player2_id].includes(session.user.id))return;match=m;other=session.user.id===m.player1_id?m.player2_id:m.player1_id;
    const {data:p}=await db.from('profiles').select('id,username').in('id',[session.user.id,other]);names=Object.fromEntries((p||[]).map(x=>[x.id,x.username]));if($('localVideoName'))$('localVideoName').textContent=names[session.user.id]||'Deg';if($('remoteVideoName'))$('remoteVideoName').textContent=names[other]||'Motstander';
    channel=db.channel(`jdc-media-${matchId}`).on('broadcast',{event:'ready'},({payload})=>{if(payload.from!==other)return;remoteReady=true;connectIfReady()}).on('broadcast',{event:'signal'},({payload})=>{if(payload.from!==other)return;remoteReady=true;handleSignal(payload)}).subscribe(async status=>{if(status==='SUBSCRIBED')await startMedia()});
    $('remoteAudioBtn').onclick=async()=>{const v=$('remoteVideo'),b=$('remoteAudioBtn');v.muted=!v.muted;b.textContent=v.muted?'Slå på lyd':'Slå av lyd';await v.play().catch(()=>{})};
    setInterval(()=>{if(localReady)send('ready').catch(()=>{})},1800);
  }
  window.addEventListener('pagehide',()=>{leaving=true;stream?.getTracks().forEach(t=>t.stop());destroyPeer();if(channel)db.removeChannel(channel).catch(()=>{})});
  boot().catch(error=>{console.warn('JDC media failed',error);setStatus('Video kunne ikke startes.')});
})();