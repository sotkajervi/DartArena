(()=>{
  if(window.__dartArenaReconnectStatus)return;
  window.__dartArenaReconnectStatus=true;

  const STYLE_ID='dartarena-reconnect-status-style';
  const ID='dartarenaReconnectStatus';
  let hideTimer=null;
  let lastState='';

  function ensureUi(){
    if(!document.getElementById(STYLE_ID)){
      const style=document.createElement('style');
      style.id=STYLE_ID;
      style.textContent=`#${ID}{position:fixed;left:50%;top:66px;z-index:80;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:min(92vw,560px);padding:8px 12px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(5,14,16,.94);box-shadow:0 10px 36px rgba(0,0,0,.35);color:var(--muted,#88a1a5);font-size:12px;font-weight:850;letter-spacing:.01em;backdrop-filter:blur(10px);transition:opacity .18s ease,transform .18s ease}#${ID}.hidden{display:none!important}#${ID} .da-rs-dot{width:8px;height:8px;border-radius:50%;background:#f4c45d;box-shadow:0 0 10px rgba(244,196,93,.65);flex:0 0 auto}#${ID}.ok{color:#bdebd8;border-color:rgba(83,227,157,.28)}#${ID}.ok .da-rs-dot{background:#53e39d;box-shadow:0 0 10px rgba(83,227,157,.7)}#${ID}.bad{color:#ffb2b7;border-color:rgba(255,111,120,.34)}#${ID}.bad .da-rs-dot{background:#ff6f78;box-shadow:0 0 10px rgba(255,111,120,.7)}@media(max-width:650px){#${ID}{top:58px;font-size:11px;padding:7px 10px}}`;
      document.head.appendChild(style);
    }
    let el=document.getElementById(ID);
    if(!el){
      el=document.createElement('div');
      el.id=ID;el.className='hidden';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
      el.innerHTML='<span class="da-rs-dot"></span><span class="da-rs-text"></span>';
      document.body.appendChild(el);
    }
    return el;
  }

  function show(state,text,autoHide=0){
    if(lastState===state&&document.getElementById(ID)?.querySelector('.da-rs-text')?.textContent===text)return;
    lastState=state;
    clearTimeout(hideTimer);
    const el=ensureUi();
    el.className=state==='ok'?'ok':state==='bad'?'bad':'';
    el.querySelector('.da-rs-text').textContent=text;
    if(autoHide>0)hideTimer=setTimeout(()=>el.classList.add('hidden'),autoHide);
  }

  function hide(){clearTimeout(hideTimer);ensureUi().classList.add('hidden')}

  function networkDown(){show('bad','Ingen nettforbindelse. Kampen beholdes – prøver igjen automatisk.')}
  function networkUp(){show('','Nett tilbake. Kobler til kamp og video…');setTimeout(checkMedia,1200)}

  function remoteVideo(){return document.getElementById('remoteVideo')||document.getElementById('spectateVideo2')}
  function checkMedia(){
    if(!navigator.onLine){networkDown();return}
    const video=remoteVideo();
    if(!video){hide();return}
    const stream=video.srcObject;
    const live=!!stream&&stream.getVideoTracks().some(t=>t.readyState==='live')&&video.readyState>=2;
    if(live)show('ok','Tilkoblet',1800);
    else show('','Kobler til motstanderens video…');
  }

  window.addEventListener('offline',networkDown);
  window.addEventListener('online',networkUp);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(checkMedia,250)});
  window.addEventListener('focus',()=>setTimeout(checkMedia,250));

  function bindVideo(){
    const video=remoteVideo();
    if(!video)return false;
    ['playing','canplay'].forEach(ev=>video.addEventListener(ev,()=>show('ok','Tilkoblet',1800)));
    ['waiting','stalled','emptied','suspend'].forEach(ev=>video.addEventListener(ev,()=>{
      if(navigator.onLine)show('','Videostrøm avbrutt. Prøver å koble til igjen…');
    }));
    video.addEventListener('error',()=>show('bad','Videofeil. Prøver å koble til igjen…'));
    if(video.srcObject instanceof MediaStream){
      video.srcObject.getTracks().forEach(track=>track.addEventListener('ended',()=>show('','Motstanderens video ble borte. Prøver igjen…')));
    }
    return true;
  }

  ensureUi();
  if(!navigator.onLine)networkDown();
  else show('','Kobler til kamp…');
  if(!bindVideo()){
    const timer=setInterval(()=>{if(bindVideo())clearInterval(timer)},250);
    setTimeout(()=>clearInterval(timer),10000);
  }
  setTimeout(checkMedia,1800);
})();
