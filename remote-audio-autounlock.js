(()=>{
  if(window.__dartArenaRemoteAudioAutoUnlock)return;
  window.__dartArenaRemoteAudioAutoUnlock=true;

  const video=document.getElementById('remoteVideo');
  const button=document.getElementById('remoteAudioBtn');
  if(!video)return;

  let blocked=false;
  let attempting=false;
  let failedTrustedAttempts=0;
  let fallbackVisible=false;
  let timer=null;

  const hasAudio=()=>{
    const stream=video.srcObject;
    return stream instanceof MediaStream&&stream.getAudioTracks().some(t=>t.readyState==='live'&&t.enabled!==false);
  };

  function hideFallback(){
    fallbackVisible=false;
    button?.classList.add('hidden');
  }

  function showFallback(){
    if(!button)return;
    fallbackVisible=true;
    button.textContent='Slå på lyd';
    button.title='Nettleseren blokkerte automatisk lyd. Klikk for å aktivere.';
    button.classList.remove('hidden');
  }

  async function enableAudio({trusted=false,forceFallback=false}={}){
    if(attempting||!hasAudio())return false;
    attempting=true;
    video.muted=false;
    try{
      await video.play();
      blocked=false;
      failedTrustedAttempts=0;
      hideFallback();
      return true;
    }catch(error){
      video.muted=true;
      blocked=true;
      if(trusted)failedTrustedAttempts+=1;
      if(forceFallback||failedTrustedAttempts>=2)showFallback();
      else hideFallback();
      return false;
    }finally{
      attempting=false;
    }
  }

  function onGesture(){
    if(!hasAudio())return;
    if(video.muted||blocked)enableAudio({trusted:true});
  }

  if(button){
    button.classList.add('hidden');
    button.onclick=async event=>{
      event.preventDefault();
      event.stopPropagation();
      const ok=await enableAudio({trusted:true,forceFallback:true});
      if(!ok)showFallback();
    };
  }

  document.addEventListener('pointerdown',onGesture,{passive:true,capture:true});
  document.addEventListener('keydown',onGesture,{capture:true});

  timer=setInterval(()=>{
    if(!hasAudio()){
      blocked=false;
      failedTrustedAttempts=0;
      hideFallback();
      return;
    }
    // First try is invisible. If autoplay policy blocks it, wait for a normal
    // user gesture instead of showing a button immediately.
    if(video.muted&&!blocked)enableAudio();
  },300);

  window.addEventListener('pagehide',()=>{
    clearInterval(timer);
    document.removeEventListener('pointerdown',onGesture,true);
    document.removeEventListener('keydown',onGesture,true);
  },{once:true});
})();