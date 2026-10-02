(()=>{
  if(window.__dartArenaOneToOneMedia)return;
  window.__dartArenaOneToOneMedia=true;

  const params=new URLSearchParams(location.search);
  const matchId=params.get('id');
  if(!matchId||!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  const $=id=>document.getElementById(id);
  const ICE={
    iceServers:[
      {urls:'stun:stun.cloudflare.com:3478'},
      {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}
    ],
    iceCandidatePoolSize:10,
    bundlePolicy:'max-bundle'
  };

  let me=null,match=null,other=null;
  let mediaStream=null,channel=null,pc=null,remoteStream=null;
  let remoteReady=false,localReady=false,generation=1,pendingCandidates=[];
  let heartbeat=null,monitor=null,disconnectTimer=null,legacyGuard=null;
  let readySince=0,outageSince=0,connectedOnce=false,recoveryBusy=false,stopped=false;
  let mode='peer';
  let fallbackSfu=null,fallbackPublication=null,remoteFallbackPublication=null;
  let fallbackHeartbeat=null,fallbackSubscribedId=null,fallbackPublishing=false,fallbackSubscribing=false;

  const constraints=()=>{
    const cam=localStorage.getItem('dartarena-preferred-camera')||'';
    const mic=localStorage.getItem('dartarena-preferred-microphone')||'';
    return{
      video:{deviceId:cam?{exact:cam}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
      audio:{deviceId:mic?{exact:mic}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true}
    };
  };

  function setStatus(text){
    const status=$('cameraStatus');
    if(status&&text)status.textContent=text;
    const header=$('headerStatus')||document.querySelector('header .live');
    if(header)header.title=`Media: ${mode==='peer'?'direkte Peer':'SFU fallback'}${text?` • ${text}`:''}`;
  }

  function setMode(next,reason=''){
    if(mode===next&&window.DARTARENA_ACTIVE_MEDIA_MODE===next)return;
    mode=next;
    window.DARTARENA_ACTIVE_MEDIA_MODE=next;
    console.debug('[1V1 MEDIA]',next,reason);
    try{window.dispatchEvent(new CustomEvent('dartarena:media-mode',{detail:{mode:next,reason}}))}catch{}
  }

  function existingStream(){
    const fromVideo=$('localVideo')?.srcObject;
    if(fromVideo instanceof MediaStream&&fromVideo.getTracks().some(t=>t.readyState==='live'))return fromVideo;
    try{
      if(typeof stream!=='undefined'&&stream instanceof MediaStream&&stream.getTracks().some(t=>t.readyState==='live'))return stream;
    }catch{}
    return null;
  }

  function exposeStream(s){
    mediaStream=s;
    try{stream=s}catch{window.stream=s}
    const v=$('localVideo');
    if(v){v.srcObject=s;v.muted=true;v.playsInline=true;v.play().catch(()=>{})}
    $('localPlaceholder')?.classList.add('hidden');
  }

  async function ensureCamera(){
    let s=existingStream();
    if(!s){
      s=await navigator.mediaDevices.getUserMedia(constraints());
      exposeStream(s);
    }else exposeStream(s);
    localReady=!!s.getTracks().some(t=>t.readyState==='live');
    if(channel&&localReady)await send('peer-ready',{generation});
    return s;
  }

  function shutdownLegacySfu(){
    try{if(typeof publicationTimer!=='undefined'&&publicationTimer){clearInterval(publicationTimer);publicationTimer=null}}catch{}
    try{if(typeof publisherSfu!=='undefined'&&publisherSfu){publisherSfu.close();publisherSfu=null}}catch{}
    try{if(typeof subscriberSfu!=='undefined'&&subscriberSfu){subscriberSfu.close();subscriberSfu=null}}catch{}
    try{if(typeof publication!=='undefined')publication=null}catch{}
    try{if(typeof remotePublicationId!=='undefined')remotePublicationId=null}catch{}
    try{if(typeof subscribeRemote==='function')subscribeRemote=async()=>{}}catch{}
  }

  async function peerStartCamera(){
    const previous=mediaStream;
    const s=await ensureCamera();
    shutdownLegacySfu();
    if(mode==='peer'&&previous!==s){
      closePeer(false);
      connectedOnce=false;readySince=0;outageSince=0;
      if(remoteReady&&isOfferer())await ensureOffer();
    }else if(mode==='sfu-fallback'&&previous!==s){
      await republishFallback();
    }
    return s;
  }

  function installLegacyOverrides(){
    shutdownLegacySfu();
    try{startCamera=peerStartCamera}catch{window.DartArenaStartCamera=peerStartCamera}
    legacyGuard=setInterval(shutdownLegacySfu,500);
    setTimeout(()=>{clearInterval(legacyGuard);legacyGuard=null},7000);
  }

  const isOfferer=()=>me===match?.player1_id;
  async function send(event,payload={}){
    if(!channel||!me)return;
    await channel.send({type:'broadcast',event,payload:{...payload,from:me}}).catch(()=>{});
  }

  function showRemote(text='Kobler direkte til motstander…'){
    const p=$('remotePlaceholder');
    if(p){p.textContent=text;p.classList.remove('hidden')}
  }
  function hideRemote(){$('remotePlaceholder')?.classList.add('hidden')}

  function closePeer(show=true){
    clearTimeout(disconnectTimer);disconnectTimer=null;
    pendingCandidates=[];
    if(pc){
      pc.ontrack=pc.onicecandidate=pc.onconnectionstatechange=pc.oniceconnectionstatechange=null;
      try{pc.close()}catch{}
    }
    pc=null;
    window.DARTARENA_ACTIVE_MEDIA_PC=null;
    remoteStream=null;
    const v=$('remoteVideo');
    if(v){try{v.pause()}catch{};v.srcObject=null}
    if(show&&mode==='peer')showRemote();
  }

  function attachTrack(event,p,myGen){
    if(p!==pc||myGen!==generation||mode!=='peer')return;
    if(!remoteStream)remoteStream=new MediaStream();
    const tracks=event.streams?.[0]?.getTracks?.()||[event.track];
    for(const track of tracks){
      if(track&&!remoteStream.getTracks().some(t=>t.id===track.id))remoteStream.addTrack(track);
    }
    const v=$('remoteVideo');
    if(!v)return;
    v.srcObject=remoteStream;
    v.playsInline=true;
    v.muted=true;
    v.play().catch(()=>{});
    if(remoteStream.getVideoTracks().some(t=>t.readyState==='live'))hideRemote();
    if(remoteStream.getAudioTracks().some(t=>t.readyState==='live'))$('remoteAudioBtn')?.classList.remove('hidden');
  }

  function createPeer(){
    if(pc||!mediaStream?.active||mode!=='peer')return pc;
    const myGen=generation;
    const p=new RTCPeerConnection(ICE);
    pc=p;
    window.DARTARENA_ACTIVE_MEDIA_PC=p;
    remoteStream=new MediaStream();
    const rv=$('remoteVideo');if(rv)rv.srcObject=remoteStream;
    mediaStream.getTracks().forEach(t=>p.addTrack(t,mediaStream));
    p.ontrack=e=>attachTrack(e,p,myGen);
    p.onicecandidate=e=>{
      if(p!==pc||myGen!==generation||!e.candidate)return;
      send('peer-signal',{candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate,generation:myGen});
    };
    p.onconnectionstatechange=()=>{
      if(p!==pc)return;
      if(p.connectionState==='connected')markConnected();
      else if(p.connectionState==='disconnected')armRecovery('peer-disconnected');
      else if(p.connectionState==='failed')startRecovery('peer-failed');
    };
    p.oniceconnectionstatechange=()=>{
      if(p!==pc)return;
      if(['connected','completed'].includes(p.iceConnectionState))markConnected();
      else if(p.iceConnectionState==='disconnected')armRecovery('ice-disconnected');
      else if(p.iceConnectionState==='failed')startRecovery('ice-failed');
    };
    return p;
  }

  function markConnected(){
    clearTimeout(disconnectTimer);disconnectTimer=null;
    connectedOnce=true;readySince=0;outageSince=0;recoveryBusy=false;
    setMode('peer','connected');
    setStatus('Direkte Peer tilkoblet');
    hideRemote();
  }

  function armRecovery(reason){
    if(disconnectTimer||mode!=='peer')return;
    disconnectTimer=setTimeout(()=>{disconnectTimer=null;startRecovery(reason)},5000);
  }

  async function startRecovery(reason){
    if(stopped||mode!=='peer'||recoveryBusy)return;
    recoveryBusy=true;
    if(!outageSince)outageSince=Date.now();
    if(isOfferer()){
      generation+=1;
      closePeer();
      await send('peer-reset',{generation,reason});
      recoveryBusy=false;
      setTimeout(()=>ensureOffer().catch(()=>{}),500);
    }else{
      closePeer();
      await send('peer-reset-request',{generation,reason});
      recoveryBusy=false;
    }
  }

  async function ensureOffer(){
    if(stopped||mode!=='peer'||!isOfferer()||!localReady||!remoteReady||pc||!mediaStream?.active)return;
    const p=createPeer();if(!p)return;
    try{
      const offer=await p.createOffer();
      if(p!==pc)return;
      await p.setLocalDescription(offer);
      await send('peer-signal',{description:p.localDescription.toJSON?p.localDescription.toJSON():p.localDescription,generation});
    }catch(error){
      console.warn('[1V1 MEDIA] offer failed',error);
      closePeer();
    }
  }

  async function handleSignal(payload){
    if(stopped||mode!=='peer'||payload.from!==other)return;
    remoteReady=true;
    const sg=Number(payload.generation)||1;
    if(payload.description?.type==='offer'){
      if(isOfferer()||sg<generation)return;
      if(sg>generation)generation=sg;
      closePeer(false);
      const p=createPeer();if(!p)return;
      try{
        await p.setRemoteDescription(payload.description);
        await flushCandidates(p,sg);
        const answer=await p.createAnswer();
        if(p!==pc)return;
        await p.setLocalDescription(answer);
        await send('peer-signal',{description:p.localDescription.toJSON?p.localDescription.toJSON():p.localDescription,generation});
      }catch(error){
        console.warn('[1V1 MEDIA] answer failed',error);
        closePeer();
      }
      return;
    }
    if(payload.description?.type==='answer'){
      if(!isOfferer()||!pc||sg!==generation||pc.signalingState!=='have-local-offer')return;
      try{await pc.setRemoteDescription(payload.description);await flushCandidates(pc,sg)}catch{}
      return;
    }
    if(payload.candidate){
      if(sg<generation)return;
      if(!pc||sg>generation||!pc.remoteDescription){pendingCandidates.push({candidate:payload.candidate,generation:sg});return}
      try{await pc.addIceCandidate(payload.candidate)}catch{}
    }
  }

  async function flushCandidates(p,gen){
    const keep=[];
    for(const item of pendingCandidates){
      if(item.generation!==gen){if(item.generation>gen)keep.push(item);continue}
      try{await p.addIceCandidate(item.candidate)}catch{}
    }
    pendingCandidates=keep;
  }

  function ensureFallbackClient(){
    if(fallbackSfu)return fallbackSfu;
    if(!window.DartArenaSFU||!window.DARTARENA_SFU?.workerUrl)return null;
    fallbackSfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
    return fallbackSfu;
  }

  async function announceFallback(){
    if(fallbackPublication)await send('peer-sfu-state',{publication:fallbackPublication});
  }

  async function republishFallback(){
    if(mode!=='sfu-fallback'||fallbackPublishing||!mediaStream?.active)return;
    const client=ensureFallbackClient();if(!client)return;
    fallbackPublishing=true;
    try{
      fallbackPublication=await client.publish(mediaStream);
      await announceFallback();
      if(remoteFallbackPublication)await subscribeFallback(remoteFallbackPublication);
    }catch(error){console.warn('[1V1 MEDIA] fallback publish failed',error)}
    finally{fallbackPublishing=false}
  }

  async function subscribeFallback(pub){
    if(mode!=='sfu-fallback'||fallbackSubscribing||!pub?.sessionId||fallbackSubscribedId===pub.sessionId)return;
    const client=ensureFallbackClient();if(!client)return;
    fallbackSubscribing=true;fallbackSubscribedId=pub.sessionId;
    const v=$('remoteVideo');
    if(v){try{v.pause()}catch{};v.srcObject=new MediaStream();v.muted=true;v.playsInline=true}
    showRemote('Kobler til motstander via SFU fallback…');
    try{
      await client.subscribe(pub,event=>{
        if(!v)return;
        let rs=v.srcObject;if(!(rs instanceof MediaStream)){rs=new MediaStream();v.srcObject=rs}
        const tracks=event.streams?.[0]?.getTracks?.()||[event.track];
        for(const track of tracks)if(track&&!rs.getTracks().some(t=>t.id===track.id))rs.addTrack(track);
        v.muted=true;v.playsInline=true;v.play().catch(()=>{});
        if(rs.getVideoTracks().some(t=>t.readyState==='live'))hideRemote();
        if(rs.getAudioTracks().some(t=>t.readyState==='live'))$('remoteAudioBtn')?.classList.remove('hidden');
      });
    }catch(error){fallbackSubscribedId=null;console.warn('[1V1 MEDIA] fallback subscribe failed',error)}
    finally{fallbackSubscribing=false}
  }

  async function activateFallback(reason='peer-unavailable',broadcast=true){
    if(stopped||mode==='sfu-fallback')return;
    setMode('sfu-fallback',reason);
    setStatus('SFU fallback');
    closePeer(false);
    if(broadcast)await send('peer-force-sfu',{reason});
    await republishFallback();
    clearInterval(fallbackHeartbeat);
    fallbackHeartbeat=setInterval(async()=>{
      if(stopped||mode!=='sfu-fallback')return;
      if(!fallbackPublication)await republishFallback();
      await announceFallback();
      if(remoteFallbackPublication&&!fallbackSubscribedId)await subscribeFallback(remoteFallbackPublication);
    },2000);
  }

  function setupChannel(){
    channel=db.channel(`one-to-one-media-${matchId}`,{config:{broadcast:{ack:true}}})
      .on('broadcast',{event:'peer-ready'},async({payload})=>{
        if(!payload||payload.from!==other)return;
        remoteReady=true;
        if(mode==='peer'&&isOfferer())await ensureOffer();
      })
      .on('broadcast',{event:'peer-signal'},async({payload})=>handleSignal(payload||{}))
      .on('broadcast',{event:'peer-reset'},async({payload})=>{
        if(!payload||payload.from!==other||isOfferer()||mode!=='peer')return;
        generation=Math.max(generation,Number(payload.generation)||generation);
        closePeer();recoveryBusy=false;
      })
      .on('broadcast',{event:'peer-reset-request'},async({payload})=>{
        if(!payload||payload.from!==other||!isOfferer()||mode!=='peer')return;
        await startRecovery(payload.reason||'remote-request');
      })
      .on('broadcast',{event:'peer-force-sfu'},async({payload})=>{
        if(!payload||payload.from!==other)return;
        await activateFallback(payload.reason||'remote-fallback',false);
      })
      .on('broadcast',{event:'peer-sfu-state'},async({payload})=>{
        if(!payload||payload.from!==other||!payload.publication)return;
        remoteFallbackPublication=payload.publication;
        if(mode!=='sfu-fallback')await activateFallback('remote-sfu',false);
        await subscribeFallback(remoteFallbackPublication);
      })
      .subscribe(async status=>{
        if(status!=='SUBSCRIBED')return;
        localReady=!!mediaStream?.active;
        if(localReady)await send('peer-ready',{generation});
        clearInterval(heartbeat);
        heartbeat=setInterval(()=>{if(!stopped&&localReady&&mode==='peer')send('peer-ready',{generation})},3000);
      });
  }

  function setupAudioButton(){
    const button=$('remoteAudioBtn'),video=$('remoteVideo');
    if(!button||!video)return;
    button.onclick=async()=>{
      video.muted=!video.muted;
      button.textContent=video.muted?'Slå på lyd':'Slå av lyd';
      await video.play().catch(()=>{});
    };
  }

  function startMonitor(){
    monitor=setInterval(()=>{
      if(stopped||mode!=='peer')return;
      const state=pc?.connectionState||'none';
      const now=Date.now();
      if(state==='connected'){
        connectedOnce=true;readySince=0;outageSince=0;
        return;
      }
      if(!localReady||!remoteReady){readySince=0;return}
      if(!connectedOnce){
        if(!readySince)readySince=now;
        if(now-readySince>=12000)activateFallback('peer-connect-timeout').catch(()=>{});
        return;
      }
      if(!outageSince)outageSince=now;
      if(now-outageSince>=20000)activateFallback('peer-recovery-timeout').catch(()=>{});
    },500);
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user?.id)return;
    me=session.user.id;
    const {data,error}=await db.from('matches').select('id,player1_id,player2_id,status').eq('id',matchId).maybeSingle();
    if(error||!data||![data.player1_id,data.player2_id].includes(me))return;
    match=data;other=me===match.player1_id?match.player2_id:match.player1_id;

    installLegacyOverrides();
    setupAudioButton();
    await ensureCamera();
    shutdownLegacySfu();
    setMode('peer','boot');
    setStatus('Direkte Peer – kobler til…');
    setupChannel();
    startMonitor();
  }

  async function stop(){
    if(stopped)return;stopped=true;
    clearInterval(heartbeat);clearInterval(monitor);clearInterval(fallbackHeartbeat);clearInterval(legacyGuard);clearTimeout(disconnectTimer);
    closePeer(false);
    try{fallbackSfu?.close()}catch{};fallbackSfu=null;
    if(channel)try{await db.removeChannel(channel)}catch{};channel=null;
  }

  window.DartArenaOneToOneMedia={
    ensureCamera:peerStartCamera,
    stop,
    getPeer:()=>pc,
    getMode:()=>mode,
    getStream:()=>mediaStream
  };
  window.addEventListener('pagehide',()=>{stop().catch(()=>{})},{once:true});
  boot().catch(error=>{console.warn('[1V1 MEDIA] startup failed',error);setStatus('Video kunne ikke startes')});
})();
