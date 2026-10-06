(()=>{
  const video=document.getElementById('remoteVideo'),button=document.getElementById('remoteAudioBtn');
  if(!video||!button)return;

  let userMuted=false;
  let autoplayBlocked=false;

  function syncButton(){
    const hasAudio=!!video.srcObject?.getAudioTracks?.().some(t=>t.readyState==='live');
    button.classList.toggle('hidden',!hasAudio);
    if(!hasAudio)return;
    button.textContent=video.muted?'Slå på lyd':'Slå av lyd';
  }

  async function tryEnableAudio(){
    const hasAudio=!!video.srcObject?.getAudioTracks?.().some(t=>t.readyState==='live');
    if(!hasAudio||userMuted)return;

    video.muted=false;
    try{
      await video.play();
      autoplayBlocked=false;
    }catch{
      autoplayBlocked=true;
      video.muted=true;
    }
    syncButton();
  }

  button.onclick=async()=>{
    const shouldMute=!video.muted;
    userMuted=shouldMute;
    video.muted=shouldMute;
    if(!shouldMute){
      try{
        await video.play();
        autoplayBlocked=false;
      }catch{
        video.muted=true;
        autoplayBlocked=true;
      }
    }
    syncButton();
  };

  const timer=setInterval(()=>{
    const hasAudio=!!video.srcObject?.getAudioTracks?.().some(t=>t.readyState==='live');
    if(hasAudio&&!userMuted&&video.muted&&!autoplayBlocked)tryEnableAudio();
    syncButton();
  },400);

  const resume=()=>{
    if(userMuted)return;
    autoplayBlocked=false;
    tryEnableAudio();
  };
  document.addEventListener('pointerdown',resume,{passive:true});
  document.addEventListener('keydown',resume);

  window.addEventListener('beforeunload',()=>{
    clearInterval(timer);
    document.removeEventListener('pointerdown',resume);
    document.removeEventListener('keydown',resume);
  },{once:true});
})();
