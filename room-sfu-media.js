// Cloudflare SFU media transport for the normal DartArena waiting room.
// Game proposals/challenge state still use room.js + Supabase Realtime; only audio/video
// is routed through the same Cloudflare SFU already used by tournament waiting rooms.
(()=>{
  if(window.__dartArenaRoomSfuMedia)return;
  window.__dartArenaRoomSfuMedia=true;

  let sfu=null;
  let sfuChannel=null;
  let publication=null;
  let remotePublication=null;
  let subscribedPublicationId=null;
  let heartbeat=null;
  let trackWatch=null;
  let publishing=false;
  let subscribing=false;
  let publishedTrackSignature='';
  let lastError='';
  const debugLog=[];

  const log=(message,data)=>{
    const line=`${new Date().toLocaleTimeString('nb-NO',{hour12:false})}  ${message}${data!==undefined?'  '+(typeof data==='string'?data:JSON.stringify(data)):''}`;
    debugLog.unshift(line);
    if(debugLog.length>60)debugLog.length=60;
    console.debug('[ROOM SFU]',message,data??'');
    renderDebug();
  };

  const currentTrackSignature=()=>{
    try{return (stream?.getTracks?.()||[]).map(t=>`${t.kind}:${t.id}:${t.readyState}:${t.enabled}`).sort().join('|')}
    catch{return''}
  };

  const remoteHasLiveVideo=()=>{
    const media=$('remoteVideo')?.srcObject;
    return media instanceof MediaStream&&media.getVideoTracks().some(t=>t.readyState==='live');
  };

  function ensureSfu(){
    if(sfu)return sfu;
    if(!window.DartArenaSFU||!window.DARTARENA_SFU?.workerUrl)return null;
    sfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
    return sfu;
  }

  async function broadcastPublication(){
    if(!sfuChannel||!profile?.id)return;
    await sfuChannel.send({
      type:'broadcast',
      event:'media-state',
      payload:{from:profile.id,publication}
    });
  }

  async function ensurePublished(force=false){
    if(publishing||leaving||!localReady||!stream?.getTracks?.().length)return;
    const signature=currentTrackSignature();
    if(!force&&publication&&signature&&signature===publishedTrackSignature)return;
    const client=ensureSfu();
    if(!client)return;

    publishing=true;
    lastError='';
    setStatus('Publiserer kamera via Cloudflare…');
    try{
      publication=await client.publish(stream);
      publishedTrackSignature=signature;
      log('PUBLISH ok',{sessionId:publication?.sessionId,tracks:publication?.tracks});
      await broadcastPublication();
      if(remoteHasLiveVideo())setStatus(`Tilkoblet ${names?.[other]||'motstander'} via Cloudflare`);
      else setStatus('Kamera klart – venter på motstander via Cloudflare…');
      if(remotePublication)await subscribeRemote(remotePublication);
    }catch(error){
      publication=null;
      publishedTrackSignature='';
      lastError=error?.message||String(error);
      log('PUBLISH error',lastError);
      setStatus(`Kunne ikke publisere kamera: ${lastError}`);
    }finally{
      publishing=false;
    }
  }

  async function subscribeRemote(pub){
    if(!pub?.sessionId||!Array.isArray(pub.tracks)||subscribing)return;
    if(subscribedPublicationId===pub.sessionId&&remoteHasLiveVideo())return;
    const client=ensureSfu();
    if(!client)return;

    subscribing=true;
    subscribedPublicationId=pub.sessionId;
    lastError='';
    setStatus(`Kobler til ${names?.[other]||'motstander'} via Cloudflare…`);
    const video=$('remoteVideo');
    if(video){
      try{video.pause()}catch{}
      video.srcObject=new MediaStream();
      video.muted=true;
      video.playsInline=true;
    }

    try{
      await client.subscribe(pub,async event=>{
        if(!video)return;
        let remote=video.srcObject;
        if(!(remote instanceof MediaStream)){
          remote=new MediaStream();
          video.srcObject=remote;
        }
        const tracks=event.streams?.[0]?.getTracks?.()||[event.track];
        for(const track of tracks){
          if(track&&!remote.getTracks().some(t=>t.id===track.id))remote.addTrack(track);
        }
        video.muted=true;
        video.playsInline=true;
        await video.play().catch(()=>{});
        if(remote.getVideoTracks().some(t=>t.readyState==='live')){
          $('remotePlaceholder')?.classList.add('hidden');
          $('remoteAudioBtn')?.classList.remove('hidden');
          setStatus(`Tilkoblet ${names?.[other]||'motstander'} via Cloudflare`);
        }
        renderDebug();
      });
      log('SUBSCRIBE ok',{sessionId:pub.sessionId,tracks:pub.tracks});
    }catch(error){
      subscribedPublicationId=null;
      lastError=error?.message||String(error);
      log('SUBSCRIBE error',lastError);
      setStatus('Kunne ikke koble til motstanderens video via Cloudflare. Prøver igjen…');
    }finally{
      subscribing=false;
    }
  }

  function setupSfuChannel(){
    if(sfuChannel||typeof db==='undefined'||typeof challengeId==='undefined'||!challengeId||!profile?.id||!other)return false;
    sfuChannel=db.channel(`room-sfu-${challengeId}`)
      .on('broadcast',{event:'media-state'},async({payload})=>{
        if(!payload||payload.from!==other)return;
        remotePublication=payload.publication||null;
        log('REMOTE publication',remotePublication?.sessionId||'none');
        if(remotePublication)await subscribeRemote(remotePublication);
      })
      .subscribe(async status=>{
        log('CHANNEL',status);
        if(status!=='SUBSCRIBED')return;
        await ensurePublished();
        await broadcastPublication();
        clearInterval(heartbeat);
        heartbeat=setInterval(async()=>{
          if(leaving)return;
          await ensurePublished();
          await broadcastPublication().catch(()=>{});
          if(remotePublication&&(!subscribedPublicationId||!remoteHasLiveVideo()))await subscribeRemote(remotePublication);
        },1800);
      });
    return true;
  }

  // Disable direct browser-to-browser negotiation. Signaling broadcasts can still arrive
  // from a stale tab, but this room intentionally ignores them when SFU transport is active.
  connectIfReady=async function(){
    setupSfuChannel();
    await ensurePublished();
    if(remotePublication)await subscribeRemote(remotePublication);
  };
  handleSignal=async function(){};
  restartPeer=async function(){
    try{sfu?.close()}catch{}
    sfu=null;
    publication=null;
    subscribedPublicationId=null;
    publishedTrackSignature='';
    $('remotePlaceholder')?.classList.remove('hidden');
    const video=$('remoteVideo');
    if(video){try{video.pause()}catch{};video.srcObject=null}
    setStatus('Kobler media til på nytt via Cloudflare…');
    await ensurePublished(true);
    if(remotePublication)await subscribeRemote(remotePublication);
  };
  startHandshake=function(){
    clearInterval(helloTimer);
    helloTimer=setInterval(async()=>{
      if(!localReady||leaving)return;
      await send('ready').catch(()=>{});
      setupSfuChannel();
      await ensurePublished();
    },1500);
  };

  function buildDebug(){
    if(document.getElementById('roomSfuDebug'))return;
    const card=document.createElement('details');
    card.id='roomSfuDebug';
    card.className='card';
    card.style.cssText='margin-top:16px;border-color:rgba(35,226,209,.28)';
    card.innerHTML='<summary style="cursor:pointer;font-weight:900">MEDIA DEBUG • CLOUDFLARE SFU</summary><div id="roomSfuDebugState" style="margin-top:10px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap"></div><div class="top-actions" style="margin-top:10px"><button id="roomSfuCopy" class="outline small-btn" type="button">Kopier debug</button><button id="roomSfuReconnect" class="outline small-btn" type="button">Tving reconnect</button></div>';
    const anchor=document.querySelector('.room-options');
    anchor?.insertAdjacentElement('beforebegin',card);
    document.getElementById('roomSfuCopy')?.addEventListener('click',copyDebug);
    document.getElementById('roomSfuReconnect')?.addEventListener('click',()=>restartPeer());
  }

  function debugText(){
    const remote=$('remoteVideo')?.srcObject;
    const remoteTracks=remote instanceof MediaStream?remote.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.muted?'muted':'live'}`).join(', '):'none';
    const localTracks=stream?.getTracks?.().map(t=>`${t.kind}:${t.readyState}`).join(', ')||'none';
    return [
      `LOCAL READY: ${!!localReady}`,
      `REMOTE READY: ${!!remoteReady}`,
      `SFU CHANNEL: ${sfuChannel?.state||'none'}`,
      `PUBLISHER SESSION: ${publication?.sessionId||'none'}`,
      `SUBSCRIBER SESSION: ${sfu?.subscriberSessionId||'none'}`,
      `REMOTE PUBLICATION: ${remotePublication?.sessionId||'none'}`,
      `LOCAL TRACKS: ${localTracks}`,
      `REMOTE TRACKS: ${remoteTracks}`,
      `PUBLISHING: ${publishing}`,
      `SUBSCRIBING: ${subscribing}`,
      `LAST ERROR: ${lastError||'none'}`,
      '',
      'LOG:',
      ...debugLog
    ].join('\n');
  }

  function renderDebug(){
    buildDebug();
    const el=document.getElementById('roomSfuDebugState');
    if(el)el.textContent=debugText();
  }

  async function copyDebug(){
    const text=`DartArena room SFU debug\nURL: ${location.href}\nTime: ${new Date().toISOString()}\n\n${debugText()}`;
    try{
      await navigator.clipboard.writeText(text);
      const button=document.getElementById('roomSfuCopy');
      if(button){const old=button.textContent;button.textContent='Kopiert';setTimeout(()=>button.textContent=old,1200)}
    }catch{prompt('Kopier debug:',text)}
  }

  const bootTimer=setInterval(()=>{
    if(!profile?.id||!other)return;
    setupSfuChannel();
    if(localReady&&stream?.getTracks?.().length)ensurePublished();
  },150);
  setTimeout(()=>clearInterval(bootTimer),15000);

  trackWatch=setInterval(()=>{
    if(!localReady||!stream?.getTracks?.().length||publishing)return;
    const signature=currentTrackSignature();
    if(publication&&publishedTrackSignature&&signature!==publishedTrackSignature){
      log('LOCAL tracks changed – republish');
      ensurePublished(true);
    }
    renderDebug();
  },700);

  window.DartArenaRoomMedia={
    mode:'sfu',
    republish:()=>ensurePublished(true),
    reconnect:()=>restartPeer(),
    debugText
  };

  buildDebug();
  window.addEventListener('pagehide',()=>{
    clearInterval(heartbeat);
    clearInterval(trackWatch);
    clearInterval(bootTimer);
    try{sfu?.close()}catch{}
    if(sfuChannel){try{db.removeChannel(sfuChannel)}catch{}}
    sfuChannel=null;
  },{once:true});
})();
