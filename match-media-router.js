(()=>{
  if(window.__dartArenaMediaRouter)return;
  window.__dartArenaMediaRouter=true;

  let sfuLoaded=false;
  let timer=null;
  let readySince=0;
  let outageSince=0;
  let connectedOnce=false;
  let currentMode='';

  const safePeer=()=>{try{return typeof pc!=='undefined'?pc:null}catch{return null}};
  const bothReady=()=>{try{return !!localReady&&!!remoteReady}catch{return false}};

  function setMode(mode){
    if(currentMode===mode)return;
    currentMode=mode;
    window.DARTARENA_ACTIVE_MEDIA_MODE=mode;
    const status=document.getElementById('headerStatus');
    if(status)status.title=`Media: ${mode==='peer'?'direkte Peer':mode==='sfu-fallback'?'SFU fallback':'Cloudflare SFU'}`;
    console.debug('[MEDIA ROUTER]',mode);
    try{window.dispatchEvent(new CustomEvent('dartarena:media-mode',{detail:{mode}}))}catch{}
  }

  function loadSfu(mode='sfu-fallback'){
    if(sfuLoaded)return;
    sfuLoaded=true;
    clearInterval(timer);
    timer=null;
    window.DARTARENA_ACTIVE_MEDIA_PC=null;
    setMode(mode);
    const script=document.createElement('script');
    script.src='match-sfu-media.js?v=20261002-peer2';
    script.async=false;
    script.onerror=()=>console.error('[MEDIA ROUTER] Could not load SFU fallback');
    document.head.appendChild(script);
  }

  // All online X01 matches use the direct WebRTC path in match.js first.
  // Cloudflare SFU is now a safety fallback, not the normal player-to-player path.
  setMode('peer');

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
      return;
    }

    if(!bothReady()){
      readySince=0;
      outageSince=0;
      return;
    }

    if(!connectedOnce){
      if(!readySince)readySince=now;
      if(now-readySince>=12000)loadSfu('sfu-fallback');
      return;
    }

    // Let the existing Peer recovery logic try first. If it cannot recover,
    // switch both players back to the proven SFU transport.
    if(!outageSince)outageSince=now;
    if(now-outageSince>=20000)loadSfu('sfu-fallback');
  },500);

  window.addEventListener('pagehide',()=>{clearInterval(timer);timer=null;window.DARTARENA_ACTIVE_MEDIA_PC=null},{once:true});
})();
