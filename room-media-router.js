(()=>{
  if(window.__dartArenaRoomMediaRouter)return;
  window.__dartArenaRoomMediaRouter=true;

  let fallbackLoaded=false;
  let timer=null;
  let readySince=0;
  let outageSince=0;
  let connectedOnce=false;
  let currentMode='peer';

  const safePeer=()=>{try{return typeof pc!=='undefined'?pc:null}catch{return null}};
  const bothReady=()=>{try{return !!localReady&&!!remoteReady}catch{return false}};
  const hasRemoteVideo=()=>{
    const video=document.getElementById('remoteVideo');
    const media=video?.srcObject;
    return media instanceof MediaStream&&media.getVideoTracks().some(track=>track.readyState==='live'&&!track.muted);
  };

  function setMode(mode){
    if(currentMode===mode)return;
    currentMode=mode;
    window.DARTARENA_ACTIVE_MEDIA_MODE=mode;
    console.debug('[ROOM MEDIA ROUTER]',mode);
    try{window.dispatchEvent(new CustomEvent('dartarena:media-mode',{detail:{mode}}))}catch{}
  }

  function loadFallback(){
    if(fallbackLoaded)return;
    fallbackLoaded=true;
    clearInterval(timer);
    timer=null;
    setMode('sfu-fallback');
    try{setStatus('Direkte video kunne ikke kobles til – bytter til Cloudflare…')}catch{}
    const script=document.createElement('script');
    script.src='room-sfu-media.js?v=20261003-fallback1';
    script.async=false;
    script.onerror=()=>{
      console.error('[ROOM MEDIA ROUTER] Could not load SFU fallback');
      try{setStatus('Kunne ikke starte video-fallback. Last siden på nytt.')}catch{}
    };
    document.head.appendChild(script);
  }

  setMode('peer');
  window.DARTARENA_ACTIVE_MEDIA_MODE='peer';

  timer=setInterval(()=>{
    const peer=safePeer();
    if(peer)window.DARTARENA_ACTIVE_MEDIA_PC=peer;
    const state=peer?.connectionState||'none';
    const now=Date.now();

    if(state==='connected'&&hasRemoteVideo()){
      connectedOnce=true;
      readySince=0;
      outageSince=0;
      setMode('peer');
      return;
    }

    if(!bothReady()){
      readySince=0;
      outageSince=0;
      return;
    }

    if(!connectedOnce){
      if(!readySince)readySince=now;
      if(now-readySince>=8000)loadFallback();
      return;
    }

    if(!outageSince)outageSince=now;
    if(now-outageSince>=12000)loadFallback();
  },400);

  window.addEventListener('pagehide',()=>{
    clearInterval(timer);
    timer=null;
  },{once:true});
})();
