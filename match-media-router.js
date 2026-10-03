(()=>{
  if(window.__dartArenaMediaRouter)return;
  window.__dartArenaMediaRouter=true;

  let sfuLoaded=false;
  let timer=null;
  let readySince=0;
  let outageSince=0;
  let connectedOnce=false;
  let currentMode='';
  let missingVideoSince=0;
  let fallbackChannel=null;
  let fallbackChannelTimer=null;
  let fallbackRequested=false;

  const safePeer=()=>{try{return typeof pc!=='undefined'?pc:null}catch{return null}};
  const bothReady=()=>{try{return !!localReady&&!!remoteReady}catch{return false}};
  const safeDb=()=>{try{return typeof db!=='undefined'?db:null}catch{return null}};
  const safeMatchId=()=>{try{return typeof matchId!=='undefined'?matchId:new URLSearchParams(location.search).get('id')}catch{return new URLSearchParams(location.search).get('id')}};

  function remoteCameraExplicitlyOff(){
    const text=(document.getElementById('remotePlaceholder')?.textContent||'').toLowerCase();
    return text.includes('kamera er av');
  }

  function remoteHasAudio(){
    const s=document.getElementById('remoteVideo')?.srcObject;
    return s instanceof MediaStream&&s.getAudioTracks().some(t=>t.readyState==='live');
  }

  function remoteHasUsableVideo(){
    const video=document.getElementById('remoteVideo');
    const s=video?.srcObject;
    if(!(s instanceof MediaStream))return false;
    const live=s.getVideoTracks().some(t=>t.readyState==='live'&&!t.muted);
    return !!live&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0;
  }

  function setMode(mode){
    if(currentMode===mode)return;
    currentMode=mode;
    window.DARTARENA_ACTIVE_MEDIA_MODE=mode;
    const status=document.getElementById('headerStatus');
    if(status)status.title=`Media: ${mode==='peer'?'direkte Peer':mode==='sfu-fallback'?'SFU fallback':'Cloudflare SFU'}`;
    console.debug('[MEDIA ROUTER]',mode);
    try{window.dispatchEvent(new CustomEvent('dartarena:media-mode',{detail:{mode}}))}catch{}
  }

  function setupFallbackChannel(){
    if(fallbackChannel)return true;
    const client=safeDb();
    const id=safeMatchId();
    if(!client||!id)return false;
    fallbackChannel=client.channel(`match-media-fallback-${id}`)
      .on('broadcast',{event:'fallback'},({payload})=>{
        console.debug('[MEDIA ROUTER] remote fallback request',payload?.reason||'unknown');
        loadSfu('sfu-fallback');
      })
      .subscribe();
    return true;
  }

  function loadSfu(mode='sfu-fallback'){
    if(sfuLoaded)return;
    sfuLoaded=true;
    clearInterval(timer);
    timer=null;
    window.DARTARENA_ACTIVE_MEDIA_PC=null;
    setMode(mode);
    const placeholder=document.getElementById('remotePlaceholder');
    if(placeholder){
      placeholder.textContent='Bytter til Cloudflare-video…';
      placeholder.classList.remove('hidden');
    }
    const script=document.createElement('script');
    script.src='match-sfu-media.js?v=20261003-novideo1';
    script.async=false;
    script.onerror=()=>console.error('[MEDIA ROUTER] Could not load SFU fallback');
    document.head.appendChild(script);
  }

  async function requestFallback(reason){
    if(sfuLoaded||fallbackRequested)return;
    fallbackRequested=true;
    setupFallbackChannel();
    try{
      if(fallbackChannel){
        await fallbackChannel.send({type:'broadcast',event:'fallback',payload:{reason,at:Date.now()}});
      }
    }catch(error){
      console.warn('[MEDIA ROUTER] fallback broadcast failed',error);
    }
    loadSfu('sfu-fallback');
  }

  // All online X01 matches use the direct WebRTC path first.
  // Cloudflare SFU is the synchronized safety fallback if peer setup fails,
  // the peer cannot recover, or audio connects without usable video.
  setMode('peer');
  setupFallbackChannel();
  fallbackChannelTimer=setInterval(()=>{
    if(setupFallbackChannel()){
      clearInterval(fallbackChannelTimer);
      fallbackChannelTimer=null;
    }
  },250);

  timer=setInterval(()=>{
    const peer=safePeer();
    if(peer)window.DARTARENA_ACTIVE_MEDIA_PC=peer;
    const state=peer?.connectionState||'none';
    const now=Date.now();

    if(state==='connected'){
      connectedOnce=true;
      readySince=0;
      outageSince=0;
      setMode('peer');

      if(bothReady()&&!remoteCameraExplicitlyOff()&&!remoteHasUsableVideo()){
        if(!missingVideoSince)missingVideoSince=now;
        // A working audio path with no rendered video is the exact failure mode
        // we want to escape quickly. Allow a little more time if even audio has
        // not arrived yet, because the first video frames can take longer.
        const limit=remoteHasAudio()?5000:8000;
        if(now-missingVideoSince>=limit)requestFallback(remoteHasAudio()?'peer-audio-no-video':'peer-no-video');
      }else{
        missingVideoSince=0;
      }
      return;
    }

    missingVideoSince=0;

    if(!bothReady()){
      readySince=0;
      outageSince=0;
      return;
    }

    if(!connectedOnce){
      if(!readySince)readySince=now;
      if(now-readySince>=12000)requestFallback('peer-connect-timeout');
      return;
    }

    // Let the existing Peer recovery logic try first. If it cannot recover,
    // switch both players back to the proven SFU transport.
    if(!outageSince)outageSince=now;
    if(now-outageSince>=20000)requestFallback('peer-recovery-timeout');
  },500);

  window.addEventListener('pagehide',()=>{
    clearInterval(timer);
    clearInterval(fallbackChannelTimer);
    timer=null;
    fallbackChannelTimer=null;
    window.DARTARENA_ACTIVE_MEDIA_PC=null;
    const client=safeDb();
    if(fallbackChannel&&client){try{client.removeChannel(fallbackChannel)}catch{}}
    fallbackChannel=null;
  },{once:true});
})();
