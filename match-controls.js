(()=>{
  if(!document.querySelector('script[data-dartarena-role-visuals]')){
    const roleScript=document.createElement('script');
    roleScript.src='role-visuals.js?v=20260928-roles1';
    roleScript.dataset.dartarenaRoleVisuals='1';
    document.head.appendChild(roleScript);
  }

  const mic=document.getElementById('micBtn');
  const camera=document.getElementById('cameraBtn');
  const remoteAudio=document.getElementById('remoteAudioBtn');
  const remoteVideo=document.getElementById('remoteVideo');
  const localVideo=document.getElementById('localVideo');
  const localPlaceholder=document.getElementById('localPlaceholder');
  const remotePlaceholder=document.getElementById('remotePlaceholder');
  let micOn=true;
  let audioWanted=true;
  let audioUnlocked=false;
  let cameraBusy=false;
  let cameraControlChannel=null;

  function getStream(){
    try{return typeof stream!=='undefined'?stream:null}catch{return null}
  }
  function liveVideoTracks(){return getStream()?.getVideoTracks?.().filter(t=>t.readyState==='live')||[]}
  function cameraOn(){const tracks=liveVideoTracks();return tracks.length>0&&tracks.some(t=>t.enabled)}

  function syncMic(){
    try{
      const tracks=getStream()?.getAudioTracks?.()||[];
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

  async function broadcastCamera(enabled){
    try{
      if(!cameraControlChannel||typeof profile==='undefined'||!profile?.id)return;
      await cameraControlChannel.send({type:'broadcast',event:'camera-visibility',payload:{from:profile.id,enabled:!!enabled}});
    }catch{}
  }

  function showLocalCameraOff(){
    if(localPlaceholder){localPlaceholder.textContent='Kamera av';localPlaceholder.classList.remove('hidden')}
    if(camera){camera.textContent='Start kamera';camera.classList.add('danger')}
  }
  function showLocalCameraOn(){
    if(localPlaceholder&&liveVideoTracks().length)localPlaceholder.classList.add('hidden');
    if(camera){camera.textContent='Stopp kamera';camera.classList.remove('danger')}
  }
  function syncCameraButton(){
    if(!camera||cameraBusy)return;
    if(cameraOn())showLocalCameraOn();else showLocalCameraOff();
  }

  async function startCameraUnified(){
    let s=getStream();
    const live=liveVideoTracks();
    if(live.length){
      live.forEach(t=>t.enabled=true);
      if(localVideo){localVideo.srcObject=s;localVideo.muted=true;await localVideo.play().catch(()=>{})}
      showLocalCameraOn();
      await broadcastCamera(true);
      return;
    }

    // A stream can remain "active" because the microphone is alive even after the
    // video track has ended. Clear that stale stream so each game's startCamera()
    // actually requests a fresh camera instead of returning early.
    if(s){
      try{s.getTracks().forEach(t=>t.stop())}catch{}
      try{stream=null}catch{}
      try{if(typeof publicationTimer!=='undefined'){clearInterval(publicationTimer);publicationTimer=null}}catch{}
      try{if(typeof publication!=='undefined')publication=null}catch{}
      try{if(typeof publisherSfu!=='undefined'&&publisherSfu){publisherSfu.close();publisherSfu=null}}catch{}
    }

    if(typeof startCamera==='function')await startCamera();
    const fresh=liveVideoTracks();
    fresh.forEach(t=>t.enabled=true);
    if(fresh.length){showLocalCameraOn();await broadcastCamera(true)}else showLocalCameraOff();
  }

  async function stopCameraUnified(){
    const tracks=liveVideoTracks();
    // Disable only video. Audio and the WebRTC/SFU session stay alive, so starting
    // the camera again is instant and does not tear down the opponent video.
    tracks.forEach(t=>t.enabled=false);
    showLocalCameraOff();
    await broadcastCamera(false);
  }

  if(camera){
    // All game modes load this file after their own camera handler. Replace those
    // mode-specific tear-down handlers with one stable toggle for X01, Cricket,
    // Half-It and 61.
    camera.onclick=async()=>{
      if(cameraBusy)return;
      cameraBusy=true;
      camera.disabled=true;
      try{
        if(cameraOn())await stopCameraUnified();
        else await startCameraUnified();
      }catch(e){
        const msg=document.getElementById('matchMessage');
        if(msg)msg.textContent=e?.message||'Kunne ikke endre kamera.';
      }finally{
        cameraBusy=false;
        camera.disabled=false;
        syncCameraButton();
        syncMic();
      }
    };
  }

  function setupCameraControlChannel(){
    try{
      if(typeof db==='undefined'||typeof matchId==='undefined'||!matchId||typeof profile==='undefined'||!profile?.id||typeof other==='undefined'||!other)return false;
      if(cameraControlChannel)return true;
      cameraControlChannel=db.channel('camera-visibility-'+matchId)
        .on('broadcast',{event:'camera-visibility'},({payload})=>{
          if(!payload||payload.from!==other)return;
          if(!payload.enabled){
            if(remotePlaceholder){remotePlaceholder.textContent='Motstanderens kamera er av';remotePlaceholder.classList.remove('hidden')}
          }else{
            if(remotePlaceholder){remotePlaceholder.textContent='Kobler til motstanderens kamera…';remotePlaceholder.classList.remove('hidden')}
            setTimeout(()=>{
              try{
                const hasLive=remoteVideo?.srcObject?.getVideoTracks?.().some(t=>t.readyState==='live');
                if(hasLive)remotePlaceholder?.classList.add('hidden');
              }catch{}
            },500);
          }
        }).subscribe();
      return true;
    }catch{return false}
  }

  let channelAttempts=0;
  const channelWait=setInterval(()=>{
    channelAttempts++;
    if(setupCameraControlChannel()||channelAttempts>120)clearInterval(channelWait);
  },250);

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
    syncCameraButton();
    if(audioUnlocked&&audioWanted&&remoteVideo)remoteVideo.muted=false;
    else syncRemoteAudio();
  },500);

  window.addEventListener('beforeunload',()=>{
    clearInterval(channelWait);
    try{if(cameraControlChannel&&typeof db!=='undefined')db.removeChannel(cameraControlChannel)}catch{}
  },{once:true});
})();