(()=>{
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