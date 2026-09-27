(()=>{
  if(!document.querySelector('script[data-dartarena-role-visuals]')){
    const roleScript=document.createElement('script');
    roleScript.src='role-visuals.js?v=20260928-roles1';
    roleScript.dataset.dartarenaRoleVisuals='1';
    document.head.appendChild(roleScript);
  }

  if(!document.querySelector('link[data-dartarena-opponent-focus]')){
    const focusStyle=document.createElement('link');
    focusStyle.rel='stylesheet';
    focusStyle.href='opponent-focus.css?v=20260928-1';
    focusStyle.dataset.dartarenaOpponentFocus='1';
    document.head.appendChild(focusStyle);
  }
  if(!document.querySelector('script[data-dartarena-opponent-focus]')){
    const focusScript=document.createElement('script');
    focusScript.src='opponent-focus.js?v=20260928-1';
    focusScript.dataset.dartarenaOpponentFocus='1';
    document.head.appendChild(focusScript);
  }

  const mic=document.getElementById('micBtn');
  const remoteAudio=document.getElementById('remoteAudioBtn');
  const remoteVideo=document.getElementById('remoteVideo');
  let micOn=true;
  let audioWanted=true;
  let audioUnlocked=false;

  function syncMic(){
    try{
      const tracks=stream?.getAudioTracks?.()||[];
      tracks.forEach(t=>t.enabled=micOn);
      if(mic){
        mic.disabled=!tracks.length;
        mic.textContent=micOn?'Mikrofon på':'Mikrofon av';
        mic.classList.toggle('danger',!micOn);
      }
    }catch{if(mic)mic.disabled=true}
  }

  if(mic){
    mic.onclick=()=>{micOn=!micOn;syncMic()};
    mic.disabled=true;
  }

  async function syncRemoteAudio(){
    try{
      const hasAudio=!!remoteVideo?.srcObject?.getAudioTracks?.().length;
      if(!hasAudio){remoteAudio?.classList.add('hidden');return}
      remoteAudio?.classList.remove('hidden');
      remoteVideo.muted=!audioWanted;
      if(remoteAudio)remoteAudio.textContent=audioWanted?'Slå av lyd':'Slå på lyd';
      if(audioWanted){
        try{
          await remoteVideo.play();
          audioUnlocked=true;
          remoteVideo.muted=false;
        }catch{
          audioUnlocked=false;
          remoteVideo.muted=true;
          if(remoteAudio)remoteAudio.textContent='Slå på lyd';
        }
      }
    }catch{}
  }

  if(remoteAudio&&remoteVideo){
    remoteAudio.onclick=async()=>{
      audioWanted=remoteVideo.muted||!audioWanted;
      if(audioWanted){
        remoteVideo.muted=false;
        try{await remoteVideo.play();audioUnlocked=true}catch{audioUnlocked=false;remoteVideo.muted=true}
      }else{
        remoteVideo.muted=true;
        audioUnlocked=true;
      }
      remoteAudio.textContent=audioWanted&&!remoteVideo.muted?'Slå av lyd':'Slå på lyd';
    };
  }

  setInterval(()=>{
    syncMic();
    if(audioUnlocked&&audioWanted&&remoteVideo)remoteVideo.muted=false;
    else syncRemoteAudio();
  },500);
})();