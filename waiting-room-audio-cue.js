(()=>{
  if(window.__DartArenaWaitingRoomAudioCue)return;
  window.__DartArenaWaitingRoomAudioCue=true;

  const localVideo=document.getElementById('localVideo');
  const remoteVideo=document.getElementById('remoteVideo');
  const audioBtn=document.getElementById('remoteAudioBtn');
  if(!localVideo||!remoteVideo||!audioBtn)return;

  const localCard=localVideo.closest('.video-card');
  const remoteCard=remoteVideo.closest('.video-card');
  if(localCard){
    localCard.classList.add('waiting-local-audio-card');
    localCard.appendChild(audioBtn);
    audioBtn.classList.add('waiting-audio-overlay');
  }

  let ctx=null;
  let pendingDing=false;
  let pendingVoice=false;
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

  function speakSoundPrompt(){
    if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){
      playDing();
      return;
    }
    try{
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance('Opponent connected. Please turn on sound.');
      u.lang='en-GB';
      u.rate=.92;
      u.pitch=1;
      u.volume=.95;
      const voices=window.speechSynthesis.getVoices?.()||[];
      const preferred=voices.find(v=>/^en-GB/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang));
      if(preferred)u.voice=preferred;
      pendingVoice=false;
      window.speechSynthesis.speak(u);
    }catch{
      pendingVoice=true;
      playDing();
    }
  }

  async function unlockAudio(){
    const c=ensureAudioContext();
    if(c){
      try{if(c.state==='suspended')await c.resume()}catch{}
      if(pendingDing&&c.state==='running'){
        pendingDing=false;
        playDing();
      }
    }
    if(pendingVoice){
      pendingVoice=false;
      speakSoundPrompt();
    }
  }

  function playDing(){
    const c=ensureAudioContext();
    if(!c)return;
    if(c.state!=='running'){
      pendingDing=true;
      c.resume?.().then(()=>{if(pendingDing&&c.state==='running'){pendingDing=false;playDing()}}).catch(()=>{});
      return;
    }
    try{
      const now=c.currentTime;
      const gain=c.createGain();
      const o1=c.createOscillator();
      const o2=c.createOscillator();
      o1.type='sine';o2.type='sine';
      o1.frequency.setValueAtTime(660,now);
      o2.frequency.setValueAtTime(880,now+.09);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.exponentialRampToValueAtTime(.12,now+.015);
      gain.gain.exponentialRampToValueAtTime(.0001,now+.34);
      o1.connect(gain);o2.connect(gain);gain.connect(c.destination);
      o1.start(now);o1.stop(now+.18);
      o2.start(now+.09);o2.stop(now+.34);
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
    speakSoundPrompt();
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
  window.addEventListener('pagehide',()=>{clearInterval(timer);obs.disconnect();try{ctx?.close()}catch{};try{window.speechSynthesis?.cancel()}catch{}},{once:true});
})();
