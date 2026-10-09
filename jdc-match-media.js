(()=>{
  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId||!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  const $=id=>document.getElementById(id);

  let session=null;
  let match=null;
  let other=null;
  let names={};
  let channel=null;
  let stream=null;
  let sfu=null;
  let publication=null;
  let remotePublication=null;
  let subscribedPublicationId=null;
  let heartbeat=null;
  let trackWatch=null;
  let publishing=false;
  let subscribing=false;
  let leaving=false;
  let publishedSignature='';
  let lastError='';
  const log=[];

  const setStatus=text=>{if($('cameraStatus'))$('cameraStatus').textContent=text};
  const constraints=()=>{
    const cam=localStorage.getItem('dartarena-preferred-camera')||'';
    const mic=localStorage.getItem('dartarena-preferred-microphone')||'';
    return{
      video:{
        deviceId:cam?{exact:cam}:undefined,
        width:{ideal:1280},
        height:{ideal:720},
        frameRate:{ideal:30,max:30}
      },
      audio:{
        deviceId:mic?{exact:mic}:undefined,
        echoCancellation:true,
        noiseSuppression:true,
        autoGainControl:true
      }
    };
  };

  function note(message,data){
    const suffix=data===undefined?'':` ${typeof data==='string'?data:JSON.stringify(data)}`;
    log.unshift(`${new Date().toLocaleTimeString('nb-NO',{hour12:false})} ${message}${suffix}`);
    if(log.length>50)log.length=50;
    console.debug('[JDC SFU]',message,data??'');
    renderDebug();
  }

  function signature(){
    if(!stream)return'';
    return stream.getTracks().map(t=>`${t.kind}:${t.id}:${t.readyState}:${t.enabled}`).sort().join('|');
  }

  function hasLiveLocal(){
    return !!stream&&stream.getTracks().some(t=>t.readyState==='live');
  }

  function remoteHasVideo(){
    const rs=$('remoteVideo')?.srcObject;
    return rs instanceof MediaStream&&rs.getVideoTracks().some(t=>t.readyState==='live');
  }

  function ensureSfu(){
    if(sfu)return sfu;
    if(!window.DartArenaSFU||!window.DARTARENA_SFU?.workerUrl)return null;
    sfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
    return sfu;
  }

  async function announce(){
    if(!channel||!session?.user?.id)return;
    await channel.send({
      type:'broadcast',
      event:'media-state',
      payload:{from:session.user.id,publication}
    }).catch(()=>{});
  }

  async function publish(force=false){
    if(leaving||publishing||!hasLiveLocal())return;
    const sig=signature();
    if(!force&&publication&&sig===publishedSignature){
      await announce();
      return;
    }

    const client=ensureSfu();
    if(!client){
      lastError='Cloudflare SFU-klienten er ikke lastet.';
      setStatus(lastError);
      return;
    }

    publishing=true;
    lastError='';
    setStatus('Publiserer kamera via Cloudflare…');
    try{
      publication=await client.publish(stream);
      publishedSignature=sig;
      note('PUBLISH ok',{sessionId:publication?.sessionId,tracks:publication?.tracks});
      await announce();
      if(remoteHasVideo())setStatus(`Video tilkoblet ${names[other]||'motstander'} via Cloudflare`);
      else setStatus('Kamera klart – venter på motstander via Cloudflare…');
      if(remotePublication)await subscribe(remotePublication);
    }catch(error){
      publication=null;
      publishedSignature='';
      lastError=error?.message||String(error);
      note('PUBLISH error',lastError);
      setStatus(`Kunne ikke publisere kamera: ${lastError}`);
    }finally{
      publishing=false;
    }
  }

  async function subscribe(pub){
    if(leaving||subscribing||!pub?.sessionId||!Array.isArray(pub.tracks))return;
    if(subscribedPublicationId===pub.sessionId&&remoteHasVideo())return;

    const client=ensureSfu();
    if(!client)return;
    subscribing=true;
    subscribedPublicationId=pub.sessionId;
    lastError='';

    const video=$('remoteVideo');
    const placeholder=$('remotePlaceholder');
    if(video){
      try{video.pause()}catch{}
      video.srcObject=new MediaStream();
      video.muted=true;
      video.playsInline=true;
    }
    if(placeholder){
      placeholder.textContent='Kobler til motstander via Cloudflare…';
      placeholder.classList.remove('hidden');
    }
    setStatus(`Kobler til ${names[other]||'motstander'} via Cloudflare…`);

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
        if(rs.getVideoTracks().some(t=>t.readyState==='live')){
          placeholder?.classList.add('hidden');
          setStatus(`Video tilkoblet ${names[other]||'motstander'} via Cloudflare`);
        }
        if(rs.getAudioTracks().some(t=>t.readyState==='live'))/* remote audio fallback is controlled by remote-audio-autounlock.js */
        renderDebug();
      });
      note('SUBSCRIBE ok',{sessionId:pub.sessionId,tracks:pub.tracks});
    }catch(error){
      subscribedPublicationId=null;
      lastError=error?.message||String(error);
      note('SUBSCRIBE error',lastError);
      setStatus('Kunne ikke koble til motstanderens video via Cloudflare. Prøver igjen…');
    }finally{
      subscribing=false;
    }
  }

  async function startMedia(){
    try{
      stream=await navigator.mediaDevices.getUserMedia(constraints());
      const video=$('localVideo');
      video.srcObject=stream;
      video.muted=true;
      await video.play().catch(()=>{});
      $('localPlaceholder')?.classList.add('hidden');
      await publish(true);
    }catch(error){
      lastError=error?.message||String(error);
      setStatus(error?.name==='NotAllowedError'?'Kamera/mikrofon er blokkert.':'Kamera kunne ikke startes.');
      if($('localPlaceholder'))$('localPlaceholder').textContent='Kamera ikke startet';
      note('CAMERA error',lastError);
    }
  }

  function setupChannel(){
    channel=db.channel(`jdc-sfu-media-${matchId}`)
      .on('broadcast',{event:'media-state'},async({payload})=>{
        if(!payload||payload.from!==other)return;
        remotePublication=payload.publication||null;
        note('REMOTE publication',remotePublication?.sessionId||'none');
        if(remotePublication)await subscribe(remotePublication);
      })
      .subscribe(async status=>{
        note('CHANNEL',status);
        if(status!=='SUBSCRIBED')return;
        await startMedia();
        await announce();
        clearInterval(heartbeat);
        heartbeat=setInterval(async()=>{
          if(leaving)return;
          await publish();
          await announce();
          if(remotePublication&&(!subscribedPublicationId||!remoteHasVideo()))await subscribe(remotePublication);
        },1800);
      });
  }

  async function boot(){
    const {data:{session:s}}=await db.auth.getSession();
    session=s;
    if(!session)return;

    const {data:m}=await db.from('matches')
      .select('player1_id,player2_id,game_variant')
      .eq('id',matchId)
      .maybeSingle();

    if(!m||m.game_variant!=='jdc'||![m.player1_id,m.player2_id].includes(session.user.id))return;
    match=m;
    other=session.user.id===m.player1_id?m.player2_id:m.player1_id;

    const {data:p}=await db.from('profiles').select('id,username').in('id',[session.user.id,other]);
    names=Object.fromEntries((p||[]).map(x=>[x.id,x.username]));
    if($('localVideoName'))$('localVideoName').textContent=names[session.user.id]||'Deg';
    if($('remoteVideoName'))$('remoteVideoName').textContent=names[other]||'Motstander';

    $('remoteAudioBtn').onclick=async()=>{
      const video=$('remoteVideo');
      const button=$('remoteAudioBtn');
      video.muted=!video.muted;
      button.textContent=video.muted?'Slå på lyd':'Slå av lyd';
      await video.play().catch(()=>{});
    };

    setupChannel();

    trackWatch=setInterval(async()=>{
      if(leaving||publishing)return;
      const sig=signature();
      if(hasLiveLocal()&&publication&&publishedSignature&&sig!==publishedSignature){
        note('LOCAL tracks changed – republish');
        await publish(true);
      }
      renderDebug();
    },800);
  }

  function debugText(){
    const remote=$('remoteVideo')?.srcObject;
    return[
      'JDC MEDIA • CLOUDFLARE SFU',
      `CHANNEL: ${channel?.state||'none'}`,
      `PUBLISHER: ${publication?.sessionId||'none'}`,
      `SUBSCRIBER: ${sfu?.subscriberSessionId||'none'}`,
      `REMOTE PUB: ${remotePublication?.sessionId||'none'}`,
      `LOCAL TRACKS: ${stream instanceof MediaStream?stream.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.enabled?'on':'off'}`).join(', '):'none'}`,
      `REMOTE TRACKS: ${remote instanceof MediaStream?remote.getTracks().map(t=>`${t.kind}:${t.readyState}:${t.muted?'muted':'live'}`).join(', '):'none'}`,
      `LAST ERROR: ${lastError||'none'}`,
      '',
      ...log
    ].join('\n');
  }

  function renderDebug(){
    if(new URLSearchParams(location.search).get('mediaDebug')!=='1')return;
    let box=$('jdcMediaDebug');
    if(!box){
      box=document.createElement('pre');
      box.id='jdcMediaDebug';
      box.style.cssText='white-space:pre-wrap;margin:12px 0;padding:12px;border:1px solid rgba(0,234,244,.3);border-radius:12px;background:rgba(0,0,0,.55);font:12px/1.45 monospace;color:#b9f8ff';
      $('cameraStatus')?.insertAdjacentElement('afterend',box);
    }
    box.textContent=debugText();
  }

  window.addEventListener('pagehide',()=>{
    leaving=true;
    clearInterval(heartbeat);
    clearInterval(trackWatch);
    stream?.getTracks().forEach(t=>t.stop());
    try{sfu?.close()}catch{}
    sfu=null;
    if(channel)db.removeChannel(channel).catch(()=>{});
    channel=null;
  },{once:true});

  boot().catch(error=>{
    console.warn('JDC SFU media failed',error);
    lastError=error?.message||String(error);
    setStatus('Video kunne ikke startes.');
    renderDebug();
  });
})();