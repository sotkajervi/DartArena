(()=>{
  if(window.__dartArenaRemoteAudioAutoUnlock)return;
  window.__dartArenaRemoteAudioAutoUnlock=true;

  const video=document.getElementById('remoteVideo');
  const button=document.getElementById('remoteAudioBtn');
  const overlay=document.getElementById('remoteAudioOverlay');
  if(!video||!button)return; // The match room has no fullscreen audio overlay.

  let attempting=false;
  let blocked=false;
  let observedStream=null;
  let observedTrack=null;
  let retryAfter=0;

  function liveAudioTrack(){
    const stream=video.srcObject;
    if(!(stream instanceof MediaStream))return null;
    return stream.getAudioTracks().find(track=>track.readyState==='live'&&track.enabled!==false&&!track.muted)||null;
  }

  function hideFallback(){
    overlay?.classList.add('hidden');
    button.classList.add('hidden');
  }

  function showFallback(){
    button.textContent='🔊 SLÅ PÅ LYD';
    button.title='Trykk for å høre motstanderen';
    button.classList.remove('hidden');
    overlay?.classList.remove('hidden');
  }

  async function enableAudio({trusted=false}={}){
    if(attempting||!liveAudioTrack())return false;
    if(blocked&&!trusted){showFallback();return false;}
    if(!trusted&&Date.now()<retryAfter)return false;
    attempting=true;
    video.muted=false;
    try{
      await video.play();
      // Other media handlers may replace the stream or mute the video while play() is pending.
      if(video.muted||!liveAudioTrack()){
        retryAfter=Date.now()+300;
        return false;
      }
      blocked=false;
      retryAfter=0;
      hideFallback();
      return true;
    }catch(error){
      video.muted=true; // Keep the camera visible even if audible autoplay is blocked.
      if(error?.name==='NotAllowedError'||error?.name==='SecurityError'){
        blocked=true;
        showFallback();
      }else{
        retryAfter=Date.now()+700; // Stream attachment can interrupt play().
      }
      return false;
    }finally{
      attempting=false;
    }
  }

  function poll(){
    const track=liveAudioTrack();
    const stream=video.srcObject;
    if(!track){
      observedStream=null;
      observedTrack=null;
      blocked=false;
      retryAfter=0;
      hideFallback();
      return;
    }
    if(stream!==observedStream||track!==observedTrack){
      observedStream=stream;
      observedTrack=track;
      blocked=false;
      retryAfter=0;
    }
    // A reattached SFU stream can be unmuted but still paused after an outage.
    // Audio must be restarted rather than trusting the old playback state.
    if(video.muted||video.paused){
      if(blocked)showFallback();
      else void enableAudio();
    }else{
      hideFallback();
    }
  }

  function onGesture(event){
    if(event.target?.closest?.('#remoteAudioOverlay'))return;
    if(video.muted&&liveAudioTrack())void enableAudio({trusted:true});
  }

  hideFallback();
  // Capture the click before legacy room onclick handlers can toggle audio back off.
  button.addEventListener('click',event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    void enableAudio({trusted:true});
  },true);
  document.addEventListener('pointerdown',onGesture,{capture:true,passive:true});
  document.addEventListener('keydown',onGesture,{capture:true});
  video.addEventListener('loadedmetadata',poll);
  video.addEventListener('playing',poll);
  video.addEventListener('volumechange',poll);
  const timer=setInterval(poll,250);
  poll();

  window.addEventListener('pagehide',()=>{
    clearInterval(timer);
    document.removeEventListener('pointerdown',onGesture,true);
    document.removeEventListener('keydown',onGesture,true);
  },{once:true});
})();
