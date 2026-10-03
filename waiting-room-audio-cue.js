(()=>{
  if(window.__DartArenaWaitingRoomAudioCue)return;
  window.__DartArenaWaitingRoomAudioCue=true;

  const remoteVideo=document.getElementById('remoteVideo');
  const audioBtn=document.getElementById('remoteAudioBtn');
  if(!remoteVideo||!audioBtn)return;

  const remoteCard=remoteVideo.closest('.video-card');
  audioBtn.classList.add('waiting-audio-button');

  let ctx=null;
  let pendingChime=false;
  let connected=false;
  let disconnectedSince=0;
  let audioWanted=false;
  window.__DARTARENA_REMOTE_AUDIO_WANTED=false;

  function ensureAudioContext(){
    if(ctx)return ctx;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    try{ctx=new Ctx()}catch{return null}
    return ctx;
  }

  async function unlockAudio(){
    const c=ensureAudioContext();
    if(!c)return;
    try{if(c.state==='suspended')await c.resume()}catch{}
    if(pendingChime&&c.state==='running'){
      pendingChime=false;
      playConnectionChime();
    }
  }

  function playTone(c,frequency,start,duration,peak){
    const osc=c.createOscillator();
    const gain=c.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(peak,start+.018);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(start);
    osc.stop(start+duration+.02);
  }

  function playConnectionChime(){
    const c=ensureAudioContext();
    if(!c)return;
    if(c.state!=='running'){
      pendingChime=true;
      c.resume?.().then(()=>{
        if(pendingChime&&c.state==='running'){
          pendingChime=false;
          playConnectionChime();
        }
      }).catch(()=>{});
      return;
    }
    try{
      const now=c.currentTime+.015;
      playTone(c,620,now,.20,.10);
      playTone(c,880,now+.19,.28,.12);
    }catch{}
  }

  function hasRemoteMedia(){
    const s=remoteVideo.srcObject;
    if(!(s instanceof MediaStream))return false;
    const video=s.getVideoTracks().some(t=>t.readyState==='live');
    const audio=s.getAudioTracks().some(t=>t.readyState==='live');
    return video||audio;
  }

  function buttonAvailable(){
    return !audioBtn.classList.contains('hidden')&&hasRemoteMedia();
  }

  function syncButton(){
    if(audioBtn.classList.contains('hidden'))return;
    const on=audioWanted&&!remoteVideo.muted;
    audioBtn.classList.toggle('audio-on',on);
    audioBtn.textContent=on?'🔊 LYD PÅ':'🔊 SLÅ PÅ LYD';
  }

  async function enforceWantedAudio(){
    if(!audioWanted||!buttonAvailable()||!remoteVideo.muted)return;
    remoteVideo.muted=false;
    try{
      await remoteVideo.play();
    }catch{
      remoteVideo.muted=true;
      audioWanted=false;
      window.__DARTARENA_REMOTE_AUDIO_WANTED=false;
    }
  }

  function markConnected(){
    if(connected)return;
    connected=true;
    disconnectedSince=0;
    playConnectionChime();
    remoteCard?.classList.remove('waiting-connect-flash');
    void remoteCard?.offsetWidth;
    remoteCard?.classList.add('waiting-connect-flash');
  }

  async function poll(){
    const ready=buttonAvailable();
    if(ready){
      markConnected();
      await enforceWantedAudio();
      syncButton();
      return;
    }
    if(connected){
      if(!disconnectedSince)disconnectedSince=Date.now();
      if(Date.now()-disconnectedSince>3000){
        connected=false;
        disconnectedSince=0;
      }
    }
  }

  ['pointerdown','keydown','touchstart'].forEach(type=>window.addEventListener(type,unlockAudio,{once:true,capture:true}));
  audioBtn.addEventListener('click',()=>{
    setTimeout(async()=>{
      audioWanted=!remoteVideo.muted;
      window.__DARTARENA_REMOTE_AUDIO_WANTED=audioWanted;
      await enforceWantedAudio();
      syncButton();
    },0);
  });
  remoteVideo.addEventListener('loadeddata',poll);
  remoteVideo.addEventListener('playing',poll);
  const obs=new MutationObserver(poll);
  obs.observe(audioBtn,{attributes:true,attributeFilter:['class']});
  const timer=setInterval(poll,250);
  window.addEventListener('pagehide',()=>{
    clearInterval(timer);
    obs.disconnect();
    try{ctx?.close()}catch{}
  },{once:true});
})();
