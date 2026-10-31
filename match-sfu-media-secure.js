// Cloudflare SFU transport for player-to-player media in a live X01 match.
// Scoring/state continue to use match.js + Supabase Realtime; this file replaces
// the fragile direct browser-to-browser WebRTC media path with Cloudflare SFU.
(()=>{
  if(window.__dartArenaMatchSfuMedia||window.DARTARENA_POSTMATCH_MEDIA_STOPPED)return;
  window.__dartArenaMatchSfuMedia=true;

  let sfu=null;
  let mediaChannel=null;
  let publication=null;
  let remotePublication=null;
  let subscribedPublicationId=null;
  let subscribedAt=0;
  let subscriptionEpoch=0;
  let lastRemoteTrackAt=0;
  let publishedSignature='';
  let publishing=false;
  let subscribing=false;
  let heartbeat=null;
  let watcher=null;
  let stopped=false;
  let lastError='';
  let publisherDisconnectedAt=0;
  let lastPublisherRepairAt=0;
  let offlineObserved=false;
  let subscriberRecoveryPending=false;
  let subscriberDisconnectedAt=0;
  let lastSubscriberRepairAt=0;
  let reconnectTimer=null;
  const PUBLISHER_DISCONNECT_GRACE_MS=7000;
  const PUBLISHER_REPAIR_COOLDOWN_MS=12000;
  const SUBSCRIBER_DISCONNECT_GRACE_MS=7000;
  const SUBSCRIBER_REPAIR_COOLDOWN_MS=12000;
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

  // Track.enabled is a local mute flag, NOT a new media source.
  // Toggling microphone/camera must not destroy the Cloudflare publisher.
  // Track identity and readyState still detect real device changes.
  function trackSignature(){
    const s=safeStream();
    if(!s)return'';
    return s.getTracks().map(t=>`${t.kind}:${t.id}:${t.readyState}`).sort().join('|');
  }

  function hasPublishableTracks(){
    const s=safeStream();
    return !!s&&s.getTracks().some(t=>t.readyState==='live');
  }

  function remoteMedia(){return el('remoteVideo')?.srcObject}
  function remoteHasLiveVideo(){
    const s=remoteMedia();
    return s instanceof MediaStream&&s.getVideoTracks().some(t=>t.readyState==='live');
  }
  function remoteHasLiveAudio(){
    const s=remoteMedia();
    return s instanceof MediaStream&&s.getAudioTracks().some(t=>t.readyState==='live');
  }

  function setStatus(text){
    const status=el('headerStatus');
    if(status&&text)status.title=text;
  }

  function ensureClient(){
    if(sfu)return sfu;
    if(!window.DartArenaSecureSFU||!window.DARTARENA_SFU?.workerUrl)return null;
    const id=safeMatchId();
    // The security-test Worker authorizes each SFU operation against an
    // authenticated, active match. The waiting-room SFU context must NOT be reused.
    if(!id)return null;
    sfu=new window.DartArenaSecureSFU(window.DARTARENA_SFU.secureWorkerUrl,{kind:'match',id});
    return sfu;
  }

  function publisherNeedsRepair(now=Date.now()){
    if(!publication)return false;
    const pc=sfu?.publisher;
    if(!pc)return true;
    const state=pc.connectionState||'';
    const ice=pc.iceConnectionState||'';
    if(['failed','closed'].includes(state)||['failed','closed'].includes(ice))return true;
    if(state==='disconnected'||ice==='disconnected'){
      if(!publisherDisconnectedAt)publisherDisconnectedAt=now;
      return now-publisherDisconnectedAt>=PUBLISHER_DISCONNECT_GRACE_MS;
    }
    publisherDisconnectedAt=0;
    return false;
  }

  async function recoverPublisher(reason){
    if(stopped||window.DARTARENA_POSTMATCH_MEDIA_STOPPED||publishing||!hasPublishableTracks())return;
    if(window.navigator?.onLine===false)return;
    if(!(()=>{try{return !!localReady}catch{return false}})())return;
    const now=Date.now();
    if(now-lastPublisherRepairAt<PUBLISHER_REPAIR_COOLDOWN_MS)return;
    lastPublisherRepairAt=now;
    note('PUBLISH reconnect',{reason,previous:publication?.sessionId||'none'});
    // A working camera track can still have a failed WebRTC uplink.
    // Replace only the publisher; leave the incoming subscriber intact.
    publication=null;
    publishedSignature='';
    publisherDisconnectedAt=0;
    await publish(true);
  }

  function subscriberNeedsRepair(now=Date.now()){
    if(!remotePublication?.sessionId)return false;
    const pc=sfu?.subscriber;
    if(!pc)return !!subscribedPublicationId;
    const state=pc.connectionState||'';
    const ice=pc.iceConnectionState||'';
    if(['failed','closed'].includes(state)||['failed','closed'].includes(ice))return true;
    if(state==='disconnected'||ice==='disconnected'){
      if(!subscriberDisconnectedAt)subscriberDisconnectedAt=now;
      return now-subscriberDisconnectedAt>=SUBSCRIBER_DISCONNECT_GRACE_MS;
    }
    subscriberDisconnectedAt=0;
    // A video track can stay live while audio never arrives after network loss.
    // Only treat missing audio as a failure if the opponent publishes an audio track.
    const expectsAudio=remotePublication.tracks?.some(t=>t.startsWith('microphone')||t==='audio');
    if(expectsAudio&&subscribedAt&&now-subscribedAt>=8000&&!remoteHasLiveAudio())return true;
    return false;
  }

  async function recoverSubscriber(reason){
    if(stopped||window.DARTARENA_POSTMATCH_MEDIA_STOPPED||!remotePublication?.sessionId)return;
    if(window.navigator?.onLine===false)return;
    const now=Date.now();
    if(now-lastSubscriberRepairAt<SUBSCRIBER_REPAIR_COOLDOWN_MS)return;
    lastSubscriberRepairAt=now;
    subscriberRecoveryPending=false;
    subscriberDisconnectedAt=0;
    note('SUBSCRIBE reconnect',{reason,publication:remotePublication.sessionId});
    // Preserve the publisher. Replace the dead inbound session even if its
    // old video track still appears "live" in the browser.
    await subscribe(remotePublication,true);
  }

  function onOffline(){
    if(stopped)return;
    offlineObserved=true;
    subscriberRecoveryPending=true;
    publisherDisconnectedAt=Date.now();
    note('NETWORK offline');
  }

  function onOnline(){
    if(stopped)return;
    note('NETWORK online');
    clearTimeout(reconnectTimer);
    reconnectTimer=setTimeout(async()=>{
      reconnectTimer=null;
      if(stopped||window.navigator?.onLine===false)return;
      const wasOffline=offlineObserved||subscriberRecoveryPending;
      if(offlineObserved||publisherNeedsRepair())await recoverPublisher('browser-online');
      if(wasOffline||subscriberNeedsRepair())await recoverSubscriber('browser-online');
    },1500);
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
      if(stopped||window.DARTARENA_POSTMATCH_MEDIA_STOPPED){client.close();publication=null;return;}
      publishedSignature=signature;
      offlineObserved=false;
      publisherDisconnectedAt=0;
      note('PUBLISH ok',{sessionId:publication?.sessionId,tracks:publication?.tracks});
      await announce();
    }catch(error){
      publication=null;
      publishedSignature='';
      lastError=error?.message||String(error);
      note('PUBLISH error',lastError);
      const placeholder=el('remotePlaceholder');
      if(placeholder&&!remoteHasLiveVideo()){
        placeholder.textContent='Cloudflare-video kunne ikke starte. Kontroller videotilkoblingen og åpne mediedebug.';
        placeholder.classList.remove('hidden');
      }
    }finally{
      publishing=false;
    }
  }

  async function subscribe(pub,force=false){
    const o=safeOther();
    if(stopped||!pub?.sessionId||!Array.isArray(pub.tracks)||!o)return;
    const changed=subscribedPublicationId!==pub.sessionId;
    if(subscribing&&!changed)return;
    // New publication must preempt pending subscribe; unchanged publication
    // retains the first-frame grace period to avoid reconnect thrashing.
    const samePublication=!changed;
    const age=Date.now()-subscribedAt;
    // Do not tear down a fresh SFU subscriber just because audio arrived before the
    // first video frames. This was causing an audio-only reconnect loop.
    if(!force&&samePublication){
      if(remoteHasLiveVideo())return;
      if(age<8000)return;
    }

    const client=ensureClient();
    if(!client)return;

    const epoch=++subscriptionEpoch;
    subscribing=true;
    subscribedPublicationId=pub.sessionId;
    subscribedAt=Date.now();
    lastRemoteTrackAt=0;
    lastError='';
    const video=el('remoteVideo');
    const placeholder=el('remotePlaceholder');
    if(video){
      try{video.pause()}catch{}
      video.srcObject=new MediaStream();
      video.muted=true;
      video.playsInline=true;
      video.onplaying=()=>{if(epoch===subscriptionEpoch)placeholder?.classList.add('hidden')};
    }
    if(placeholder){
      placeholder.textContent='Kobler til motstander via Cloudflare…';
      placeholder.classList.remove('hidden');
    }

    try{
      await client.subscribe(pub,async event=>{
        if(stopped||epoch!==subscriptionEpoch||remotePublication?.sessionId!==pub.sessionId||window.DARTARENA_POSTMATCH_MEDIA_STOPPED||!video)return;
        let rs=video.srcObject;
        if(!(rs instanceof MediaStream)){
          rs=new MediaStream();
          video.srcObject=rs;
        }
        const tracks=event.streams?.[0]?.getTracks?.()||[event.track];
        for(const track of tracks){
          if(track&&!rs.getTracks().some(t=>t.id===track.id)){
            rs.addTrack(track);
            lastRemoteTrackAt=Date.now();
            note(`REMOTE ${track.kind} track`,{id:track.id,state:track.readyState,muted:track.muted});
          }
          if(track?.kind==='video'){
            track.onunmute=async()=>{
              if(epoch!==subscriptionEpoch||stopped)return;
              lastRemoteTrackAt=Date.now();
              try{await video.play()}catch{}
              if(epoch===subscriptionEpoch&&track.readyState==='live')placeholder?.classList.add('hidden');
            };
          }
        }
        video.muted=true;
        video.playsInline=true;
        await video.play().catch(()=>{});
        if(rs.getVideoTracks().some(t=>t.readyState==='live')){
          placeholder?.classList.add('hidden');
        }
        // Opponent audio is auto-unlocked by remote-audio-autounlock.js.
        // Keep the fallback button hidden unless the browser repeatedly blocks audio.
        renderDebug();
      });
      if(stopped||window.DARTARENA_POSTMATCH_MEDIA_STOPPED){client.close();return;}
      if(epoch!==subscriptionEpoch)return;
      note('SUBSCRIBE ok',{sessionId:pub.sessionId,tracks:pub.tracks});
    }catch(error){
      if(epoch!==subscriptionEpoch)return;
      subscribedPublicationId=null;
      subscribedAt=0;
      lastError=error?.message||String(error);
      note('SUBSCRIBE error',lastError);
      if(placeholder){
        placeholder.textContent='Kunne ikke koble til video. Prøver igjen…';
        placeholder.classList.remove('hidden');
      }
    }finally{
      if(epoch===subscriptionEpoch)subscribing=false;
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
        const incoming=payload.publication;
        if(!incoming?.sessionId||!Array.isArray(incoming.tracks))return;
        const changed=incoming.sessionId!==remotePublication?.sessionId;
        remotePublication=incoming;
        if(changed)note('REMOTE publication',incoming.sessionId);
        await subscribe(remotePublication,changed);
      })
      .subscribe(async status=>{
        note('CHANNEL',status);
        if(status!=='SUBSCRIBED')return;
        const wasOffline=offlineObserved||subscriberRecoveryPending;
        if(offlineObserved||publisherNeedsRepair())await recoverPublisher('channel-rejoined');
        else await publish();
        if(wasOffline&&window.navigator?.onLine!==false)await recoverSubscriber('channel-rejoined');
        await announce();
        clearInterval(heartbeat);
        heartbeat=setInterval(async()=>{
          if(stopped)return;
          if((offlineObserved||publisherNeedsRepair())&&window.navigator?.onLine!==false){
            await recoverPublisher('heartbeat-publisher-unhealthy');
          }else{
            await publish();
          }
          await announce();
          if(remotePublication&&!subscribedPublicationId)await subscribe(remotePublication);
          else if((subscriberRecoveryPending||subscriberNeedsRepair())&&window.navigator?.onLine!==false){
            await recoverSubscriber('heartbeat-subscriber-unhealthy');
          }
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
    const remote=remoteMedia();
    return [
      'MEDIA: CLOUDFLARE SFU',
      `LOCAL READY: ${(()=>{try{return !!localReady}catch{return false}})()}`,
      `CHANNEL: ${mediaChannel?.state||'none'}`,
      `PUBLISHER: ${publication?.sessionId||'none'}`,
      `SUBSCRIBER: ${sfu?.subscriberSessionId||'none'}`,
      `REMOTE PUB: ${remotePublication?.sessionId||'none'}`,
      `SUB AGE: ${subscribedAt?Math.round((Date.now()-subscribedAt)/1000)+'s':'none'}`,
      `LOCAL TRACKS: ${local instanceof MediaStream?local.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.enabled?'on':'off'}`).join(', '):'none'}`,
      `REMOTE TRACKS: ${remote instanceof MediaStream?remote.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.muted?'muted':'live'}`).join(', '):'none'}`,
      `REMOTE AUDIO: ${remoteHasLiveAudio()?'yes':'no'}`,
      `REMOTE VIDEO: ${remoteHasLiveVideo()?'yes':'no'}`,
      `LAST TRACK: ${lastRemoteTrackAt?Math.round((Date.now()-lastRemoteTrackAt)/1000)+'s ago':'none'}`,
      `PUBLISHER STATE: ${sfu?.publisher?.connectionState||'none'}/${sfu?.publisher?.iceConnectionState||'none'}`,
      `NETWORK OFFLINE OBSERVED: ${offlineObserved}`,
      `SUBSCRIBER STATE: ${sfu?.subscriber?.connectionState||'none'}/${sfu?.subscriber?.iceConnectionState||'none'}`,
      `SUBSCRIBER RECOVERY PENDING: ${subscriberRecoveryPending}`,
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

  // Bootstrap only until the media channel exists. The channel callback and
  // one-second watcher handle publication and later camera changes; keeping this
  // 150 ms timer running forever duplicated that work.
  const boot=setInterval(()=>{
    if(stopped){clearInterval(boot);return;}
    disableDirectP2P();
    if(!setupChannel())return;
    clearInterval(boot);
  },150);

  window.addEventListener('offline',onOffline);
  window.addEventListener('online',onOnline);

  watcher=setInterval(async()=>{
    if(stopped)return;
    disableDirectP2P();
    setupChannel();
    const signature=trackSignature();
    if((offlineObserved||publisherNeedsRepair())&&window.navigator?.onLine!==false){
      await recoverPublisher('publisher-state');
    }else if(hasPublishableTracks()&&signature!==publishedSignature){
      await publish(true);
    }

    if(remotePublication){
      if(subscriberRecoveryPending||subscriberNeedsRepair()){
        if(window.navigator?.onLine!==false)await recoverSubscriber('subscriber-state');
      }else if(!subscribedPublicationId){
        await subscribe(remotePublication);
      }else if(!remoteHasLiveVideo()&&Date.now()-subscribedAt>=8000){
        note('VIDEO timeout – resubscribe',{audio:remoteHasLiveAudio(),age:Date.now()-subscribedAt});
        await recoverSubscriber('video-timeout');
      }
    }
    renderDebug();
  },1000);

  window.DartArenaMatchMedia={mode:'sfu',publicationInfo:()=>!stopped&&publication?{sessionId:publication.sessionId,tracks:[...publication.tracks]}:null,stop:stopMedia,republish:()=>publish(true),reconnect:async()=>{
    if(stopped||window.DARTARENA_POSTMATCH_MEDIA_STOPPED)return;
    try{sfu?.close()}catch{}
    subscriptionEpoch++;
    subscribing=false;
    offlineObserved=false;
    subscriberRecoveryPending=false;
    publisherDisconnectedAt=0;
    subscriberDisconnectedAt=0;
    sfu=null;
    publication=null;
    remotePublication=null;
    subscribedPublicationId=null;
    subscribedAt=0;
    publishedSignature='';
    await publish(true);
    await announce();
  },debugText};

  function stopMedia(){
    if(stopped)return;
    stopped=true;
    clearInterval(boot);
    clearInterval(watcher);
    clearInterval(heartbeat);
    clearTimeout(reconnectTimer);
    window.removeEventListener('offline',onOffline);
    window.removeEventListener('online',onOnline);
    subscriptionEpoch++;
    subscriberRecoveryPending=false;
    try{sfu?.close()}catch{}
    sfu=null;
    publication=null;
    remotePublication=null;
    subscribedPublicationId=null;
    const clientDb=safeDb();
    if(mediaChannel&&clientDb){try{clientDb.removeChannel(mediaChannel)}catch{}}
    mediaChannel=null;
  }
  window.addEventListener('pagehide',stopMedia,{once:true});
})();