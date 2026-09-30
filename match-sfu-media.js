// Cloudflare SFU transport for player-to-player media in a live X01 match.
// Scoring/state continue to use match.js + Supabase Realtime; this file replaces
// the fragile direct browser-to-browser WebRTC media path with Cloudflare SFU.
(()=>{
  if(window.__dartArenaMatchSfuMedia)return;
  window.__dartArenaMatchSfuMedia=true;

  let sfu=null;
  let mediaChannel=null;
  let publication=null;
  let remotePublication=null;
  let subscribedPublicationId=null;
  let publishedSignature='';
  let publishing=false;
  let subscribing=false;
  let heartbeat=null;
  let watcher=null;
  let stopped=false;
  let lastError='';
  const log=[];

  const safeProfile=()=>{try{return profile||null}catch{return null}};
  const safeMatch=()=>{try{return m||null}catch{return null}};
  const safeOther=()=>{try{return other||null}catch{return null}};
  const safeStream=()=>{try{return stream||null}catch{return null}};
  const safeDb=()=>{try{return db||null}catch{return null}};
  const safeMatchId=()=>{try{return matchId||new URLSearchParams(location.search).get('id')}catch{return new URLSearchParams(location.search).get('id')}};
  const el=id=>document.getElementById(id);

  function note(message,data){
    const suffix=data===undefined?'':` ${typeof data==='string'?data:JSON.stringify(data)}`;
    log.unshift(`${new Date().toLocaleTimeString('nb-NO',{hour12:false})} ${message}${suffix}`);
    if(log.length>50)log.length=50;
    console.debug('[MATCH SFU]',message,data??'');
    renderDebug();
  }

  function trackSignature(){
    const s=safeStream();
    if(!s)return'';
    return s.getTracks().map(t=>`${t.kind}:${t.id}:${t.readyState}:${t.enabled}`).sort().join('|');
  }

  function hasPublishableTracks(){
    const s=safeStream();
    return !!s&&s.getTracks().some(t=>t.readyState==='live');
  }

  function remoteHasLiveVideo(){
    const s=el('remoteVideo')?.srcObject;
    return s instanceof MediaStream&&s.getVideoTracks().some(t=>t.readyState==='live');
  }

  function setStatus(text){
    const status=el('headerStatus');
    if(status&&text)status.title=text;
  }

  function ensureClient(){
    if(sfu)return sfu;
    if(!window.DartArenaSFU||!window.DARTARENA_SFU?.workerUrl)return null;
    sfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
    return sfu;
  }

  async function announce(){
    const p=safeProfile();
    if(!mediaChannel||!p?.id)return;
    await mediaChannel.send({
      type:'broadcast',
      event:'media-state',
      payload:{from:p.id,publication}
    }).catch(()=>{});
  }

  async function publish(force=false){
    if(stopped||publishing||!hasPublishableTracks())return;
    let ready=false;
    try{ready=!!localReady}catch{}
    if(!ready)return;

    const signature=trackSignature();
    if(!force&&publication&&signature===publishedSignature){
      await announce();
      return;
    }

    const client=ensureClient();
    if(!client)return;
    publishing=true;
    lastError='';
    try{
      publication=await client.publish(safeStream());
      publishedSignature=signature;
      note('PUBLISH ok',{sessionId:publication?.sessionId,tracks:publication?.tracks});
      await announce();
    }catch(error){
      publication=null;
      publishedSignature='';
      lastError=error?.message||String(error);
      note('PUBLISH error',lastError);
    }finally{
      publishing=false;
    }
  }

  async function subscribe(pub){
    const o=safeOther();
    if(stopped||subscribing||!pub?.sessionId||!Array.isArray(pub.tracks)||!o)return;
    if(subscribedPublicationId===pub.sessionId&&remoteHasLiveVideo())return;
    const client=ensureClient();
    if(!client)return;

    subscribing=true;
    subscribedPublicationId=pub.sessionId;
    lastError='';
    const video=el('remoteVideo');
    const placeholder=el('remotePlaceholder');
    if(video){
      try{video.pause()}catch{}
      video.srcObject=new MediaStream();
      video.muted=true;
      video.playsInline=true;
      video.onplaying=()=>placeholder?.classList.add('hidden');
    }
    if(placeholder){
      placeholder.textContent='Kobler til motstander via Cloudflare…';
      placeholder.classList.remove('hidden');
    }

    try{
      await client.subscribe(pub,async event=>{
        if(!video)return;
        let rs=video.srcObject;
        if(!(rs instanceof MediaStream)){
          rs=new MediaStream();
          video.srcObject=rs;
        }
        const tracks=event.streams?.[0]?.getTracks?.()||[event.track];
        for(const track of tracks){
          if(track&&!rs.getTracks().some(t=>t.id===track.id))rs.addTrack(track);
        }
        video.muted=true;
        video.playsInline=true;
        await video.play().catch(()=>{});
        if(rs.getVideoTracks().some(t=>t.readyState==='live')&&video.readyState>=2){
          placeholder?.classList.add('hidden');
        }
        if(rs.getAudioTracks().some(t=>t.readyState==='live'))el('remoteAudioBtn')?.classList.remove('hidden');
        renderDebug();
      });
      note('SUBSCRIBE ok',{sessionId:pub.sessionId,tracks:pub.tracks});
    }catch(error){
      subscribedPublicationId=null;
      lastError=error?.message||String(error);
      note('SUBSCRIBE error',lastError);
      if(placeholder){
        placeholder.textContent='Kunne ikke koble til video. Prøver igjen…';
        placeholder.classList.remove('hidden');
      }
    }finally{
      subscribing=false;
    }
  }

  function setupChannel(){
    const clientDb=safeDb();
    const id=safeMatchId();
    const p=safeProfile();
    const o=safeOther();
    if(mediaChannel||!clientDb||!id||!p?.id||!o)return false;

    mediaChannel=clientDb.channel(`match-player-sfu-${id}`)
      .on('broadcast',{event:'media-state'},async({payload})=>{
        if(!payload||payload.from!==o)return;
        remotePublication=payload.publication||null;
        note('REMOTE publication',remotePublication?.sessionId||'none');
        if(remotePublication)await subscribe(remotePublication);
      })
      .subscribe(async status=>{
        note('CHANNEL',status);
        if(status!=='SUBSCRIBED')return;
        await publish();
        await announce();
        clearInterval(heartbeat);
        heartbeat=setInterval(async()=>{
          if(stopped)return;
          await publish();
          await announce();
          if(remotePublication&&(!subscribedPublicationId||!remoteHasLiveVideo()))await subscribe(remotePublication);
        },1800);
      });
    return true;
  }

  function disableDirectP2P(){
    // Keep the existing match Realtime channel for scoring/readiness, but prevent it
    // from creating a direct RTCPeerConnection or entering the old reset loop.
    try{ensureOffer=async()=>{}}catch{}
    try{handleSignal=async()=>{}}catch{}
    try{armAnswerWatch=()=>{}}catch{}
    try{requestReset=async()=>{}}catch{}
    try{startOffererRecovery=async()=>{}}catch{}
    try{hardFailure=()=>{}}catch{}
    try{
      startHeartbeat=function(){
        try{clearInterval(readyTimer)}catch{}
        try{readyTimer=setInterval(()=>{if(!leaving&&localReady)send('ready',{generation}).catch(()=>{})},5000)}catch{}
      };
    }catch{}
    try{if(pc)destroyPeer(false)}catch{}
  }

  function debugText(){
    const local=safeStream();
    const remote=el('remoteVideo')?.srcObject;
    return [
      'MEDIA: CLOUDFLARE SFU',
      `LOCAL READY: ${(()=>{try{return !!localReady}catch{return false}})()}`,
      `CHANNEL: ${mediaChannel?.state||'none'}`,
      `PUBLISHER: ${publication?.sessionId||'none'}`,
      `SUBSCRIBER: ${sfu?.subscriberSessionId||'none'}`,
      `REMOTE PUB: ${remotePublication?.sessionId||'none'}`,
      `LOCAL TRACKS: ${local instanceof MediaStream?local.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.enabled?'on':'off'}`).join(', '):'none'}`,
      `REMOTE TRACKS: ${remote instanceof MediaStream?remote.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.muted?'muted':'live'}`).join(', '):'none'}`,
      `LAST ERROR: ${lastError||'none'}`,
      '',
      ...log
    ].join('\n');
  }

  function renderDebug(){
    const debug=el('webrtcDebug');
    if(!debug)return;
    debug.textContent=debugText();
    if(new URLSearchParams(location.search).get('mediaDebug')==='1'){
      debug.hidden=false;
      debug.style.display='block';
    }
  }

  disableDirectP2P();

  const boot=setInterval(async()=>{
    disableDirectP2P();
    if(!setupChannel())return;
    if(hasPublishableTracks())await publish();
  },150);

  watcher=setInterval(async()=>{
    if(stopped)return;
    disableDirectP2P();
    setupChannel();
    const signature=trackSignature();
    if(hasPublishableTracks()&&signature!==publishedSignature)await publish(true);
    if(remotePublication&&(!subscribedPublicationId||!remoteHasLiveVideo()))await subscribe(remotePublication);
    renderDebug();
  },800);

  window.DartArenaMatchMedia={mode:'sfu',republish:()=>publish(true),reconnect:async()=>{
    try{sfu?.close()}catch{}
    sfu=null;
    publication=null;
    remotePublication=null;
    subscribedPublicationId=null;
    publishedSignature='';
    await publish(true);
    await announce();
  },debugText};

  window.addEventListener('pagehide',()=>{
    stopped=true;
    clearInterval(boot);
    clearInterval(watcher);
    clearInterval(heartbeat);
    try{sfu?.close()}catch{}
    sfu=null;
    const clientDb=safeDb();
    if(mediaChannel&&clientDb){try{clientDb.removeChannel(mediaChannel)}catch{}}
    mediaChannel=null;
  },{once:true});
})();
