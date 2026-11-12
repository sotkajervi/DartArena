/* Post-match media lifecycle: preserve post-game chat, free all media once alone. */
(function(root){
  'use strict';
  function shouldClose(status,synced,otherPresent){
    return status==='finished'&&!!synced&&!otherPresent;
  }
  const POSTMATCH_MAX_MS=60*60*1000;
  function timeRemaining(status,finishedAtMs,now=Date.now()){
    if(status!=='finished'||!Number.isFinite(finishedAtMs))return null;
    return Math.max(0,finishedAtMs+POSTMATCH_MAX_MS-now);
  }
  if(typeof module==='object'&&module.exports)module.exports={shouldClose,timeRemaining,POSTMATCH_MAX_MS};
  if(!root||!root.document||!root.supabase||root.__DartArenaPostMatchLifecycle)return;
  const doc=root.document;
  const matchId=(root.DartArenaMatchEngineState?.matchId?.()||new URLSearchParams(root.location.search).get('id'));
  if(!matchId)return;
  root.__DartArenaPostMatchLifecycle=true;
  const GRACE_MS=15000;
  const db=(root.DartArenaSupabaseClient||root.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  ));
  let channel=null,me=null,other=null,status='playing';
  let synced=false,otherPresent=false,closed=false,navigating=false,checking=false;
  let absenceTimer=null,refreshTimer=null,deadlineTimer=null,finishedAtMs=null;
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function stopVideo(id){
    const video=doc.getElementById(id);
    if(!video)return;
    try{video.srcObject?.getTracks?.().forEach(t=>t.stop())}catch{}
    try{video.pause()}catch{}
    try{video.srcObject=null}catch{}
  }
  function showClosed(timedOut=false){
    const grid=doc.getElementById('videoGrid');
    if(!grid||doc.getElementById('postMatchMediaNotice'))return;
    const note=doc.createElement('div');
    note.id='postMatchMediaNotice';
    note.setAttribute('role','status');
    note.style.cssText='padding:10px 14px;margin:10px 0;border:1px solid rgba(0,234,244,.32);border-radius:10px;color:#bfe9ea;background:rgba(0,234,244,.04);font-size:13px';
    note.textContent=timedOut
      ?'Etterpraten er avsluttet etter 60 minutter. Video og mikrofon er koblet fra. Resultat og statistikk er beholdt.'
      :'Motstanderen har forlatt kamprommet. Video og mikrofon er avsluttet. Resultat og statistikk er beholdt.';
    grid.insertAdjacentElement('afterend',note);
  }
  async function stopMedia(reason){
    if(closed||status!=='finished')return false;
    closed=true;
    root.DARTARENA_POSTMATCH_MEDIA_STOPPED=true;
    clearTimeout(absenceTimer);
    clearTimeout(deadlineTimer);
    clearInterval(refreshTimer);
    // All ordinary match modes expose a global cleanup() function. JDC uses
    // the dedicated one-to-one media controller instead.
    try{if(typeof cleanup==='function')cleanup()}catch(e){console.warn('[POSTMATCH] game cleanup',e)}
    try{await root.DartArenaMatchMedia?.stop?.()}catch(e){console.warn('[POSTMATCH] SFU cleanup',e)}
    try{await root.DartArenaOneToOneMedia?.stop?.()}catch(e){console.warn('[POSTMATCH] peer cleanup',e)}
    try{await root.DartArenaMediaTelemetry?.stop?.()}catch(e){console.warn('[POSTMATCH] telemetry cleanup',e)}
    stopVideo('localVideo');
    stopVideo('remoteVideo');
    const camera=doc.getElementById('cameraBtn');
    if(camera){camera.disabled=true;camera.textContent='Kamera avsluttet'}
    const mic=doc.getElementById('micBtn');
    if(mic)mic.disabled=true;
    const placeholder=doc.getElementById('remotePlaceholder');
    if(placeholder){placeholder.textContent=reason==='postmatch-timeout'?'Etterprat avsluttet etter 60 minutter':'Motstanderen har forlatt kamprommet';placeholder.classList.remove('hidden')}
    showClosed(reason==='postmatch-timeout');
    try{if(channel)await db.removeChannel(channel)}catch{}
    channel=null;
    console.debug('[POSTMATCH] Released finished room media:',reason);
    return true;
  }
  function checkDeadline(){
    clearTimeout(deadlineTimer);
    deadlineTimer=null;
    if(closed)return;
    const remaining=timeRemaining(status,finishedAtMs);
    if(remaining===null)return;
    if(remaining===0){
      stopMedia('postmatch-timeout').catch(()=>{});
      return;
    }
    deadlineTimer=setTimeout(()=>{
      deadlineTimer=null;
      if(timeRemaining(status,finishedAtMs)===0)stopMedia('postmatch-timeout').catch(()=>{});
      else checkDeadline();
    },remaining);
  }
  function checkPresence(){
    clearTimeout(absenceTimer);
    absenceTimer=null;
    if(closed||!shouldClose(status,synced,otherPresent))return;
    absenceTimer=setTimeout(()=>{
      absenceTimer=null;
      if(shouldClose(status,synced,otherPresent))stopMedia('opponent absent for 15 seconds').catch(()=>{});
    },GRACE_MS);
  }
  function syncPresence(){
    if(!channel||closed)return;
    const presence=channel.presenceState();
    otherPresent=!!presence[other]?.length;
    checkPresence();
  }
  function setStatus(next,finishedAt){
    if(!next||closed)return;
    const previous=status;
    status=next;
    if(status==='finished'){
      const serverFinishedAt=Date.parse(finishedAt);
      if(Number.isFinite(serverFinishedAt))finishedAtMs=serverFinishedAt;
      else if(previous!=='finished'||!Number.isFinite(finishedAtMs))finishedAtMs=Date.now();
      checkDeadline();
      checkPresence();
    }else{
      finishedAtMs=null;
      clearTimeout(deadlineTimer);deadlineTimer=null;
      clearTimeout(absenceTimer);absenceTimer=null;
    }
  }
  async function refreshStatus(){
    if(checking||closed)return;
    checking=true;
    try{
      const{data,error}=await db.from('matches').select('id,player1_id,player2_id,status,finished_at').eq('id',matchId).maybeSingle();
      if(error||!data||![data.player1_id,data.player2_id].includes(me))return;
      other=me===data.player1_id?data.player2_id:data.player1_id;
      setStatus(data.status,data.finished_at);
    }catch(e){console.warn('[POSTMATCH] match status',e)}
    finally{checking=false}
  }
  async function announceDeparture(){
    if(status!=='finished'||closed||!channel||!me)return;
    try{await channel.send({type:'broadcast',event:'postmatch-left',payload:{from:me}})}catch{}
  }
  function interceptFinishedExit(){
    const button=doc.getElementById('closeMatchBtn');
    if(!button)return;
    button.addEventListener('click',async event=>{
      if(status!=='finished'||closed||navigating)return;
      const handler=button.onclick;
      if(typeof handler!=='function')return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigating=true;
      await Promise.race([announceDeparture(),wait(450)]);
      try{handler.call(button,event)}catch(e){console.warn('[POSTMATCH] exit handler',e)}
      navigating=false;
    },true);
  }
  async function boot(){
    const{data:{session},error}=await db.auth.getSession();
    if(error||!session?.user?.id)return;
    me=session.user.id;
    await refreshStatus();
    if(closed||!other)return; // Expired, not a player, or match no longer readable.
    channel=db.channel('postmatch-media-'+matchId,{
      config:{presence:{key:me},broadcast:{ack:true}}
    })
      .on('presence',{event:'sync'},syncPresence)
      .on('broadcast',{event:'postmatch-left'},async({payload})=>{
        if(payload?.from!==other||closed)return;
        // Never trust a broadcast alone: verify the match is actually finished.
        await refreshStatus();
        if(status==='finished')await stopMedia('opponent chose to leave');
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:'id=eq.'+matchId},
        ({new:row})=>setStatus(row?.status,row?.finished_at))
      .subscribe(async state=>{
        if(state==='SUBSCRIBED'){
          try{
            await channel?.track({player_id:me,at:new Date().toISOString()});
            synced=true;
            syncPresence();
          }catch(e){console.warn('[POSTMATCH] presence track',e)}
        }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(state)){
          synced=false;
          clearTimeout(absenceTimer);
          absenceTimer=null;
        }
      });
    interceptFinishedExit();
    refreshTimer=setInterval(refreshStatus,20000);
    root.addEventListener('focus',refreshStatus);
    doc.addEventListener('visibilitychange',()=>{
      if(doc.visibilityState==='visible')refreshStatus();
    });
    root.addEventListener('pagehide',()=>{
      if(status==='finished')announceDeparture().catch(()=>{});
      clearTimeout(absenceTimer);
      clearTimeout(deadlineTimer);
      clearInterval(refreshTimer);
      try{channel?.untrack()}catch{}
    },{once:true});
  }
  boot().catch(e=>console.warn('[POSTMATCH] startup',e));
})(typeof window==='undefined'?null:window);
