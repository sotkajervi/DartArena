(()=>{
  if(window.__dartArenaMediaRouter)return;
  window.__dartArenaMediaRouter=true;

  const params=new URLSearchParams(location.search);
  const isTournamentMatch=!!params.get('tournamentMatch');
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

  function loadSfu(mode='sfu'){
    if(sfuLoaded)return;
    sfuLoaded=true;
    clearInterval(timer);
    timer=null;
    setMode(mode);
    const script=document.createElement('script');
    script.src='match-sfu-media.js?v=20261002-peer1';
    script.async=false;
    script.onerror=()=>console.error('[MEDIA ROUTER] Could not load SFU fallback');
    document.head.appendChild(script);
  }

  // Ordinary X01 matches keep the existing SFU transport.
  if(!isTournamentMatch){
    loadSfu('sfu');
    return;
  }

  // Tournament test: use the direct WebRTC path already built into match.js.
  setMode('peer');

  timer=setInterval(()=>{
    const peer=safePeer();
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

    // If Peer never establishes once both players are ready, fall back safely.
    if(!connectedOnce){
      if(!readySince)readySince=now;
      if(now-readySince>=12000)loadSfu('sfu-fallback');
      return;
    }

    // After a successful Peer connection, let match.js try its own recovery first.
    // Only abandon Peer if it stays unavailable for a longer period.
    if(!outageSince)outageSince=now;
    if(now-outageSince>=20000)loadSfu('sfu-fallback');
  },500);

  window.addEventListener('pagehide',()=>{clearInterval(timer);timer=null},{once:true});
})();
