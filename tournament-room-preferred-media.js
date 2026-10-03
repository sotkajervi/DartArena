// Make tournament waiting room use the same camera/microphone selected in Cam-test.
(()=>{
  if(window.__dartArenaTournamentPreferredMedia)return;
  window.__dartArenaTournamentPreferredMedia=true;

  const CAMERA_KEY='dartarena-preferred-camera';
  const MIC_KEY='dartarena-preferred-microphone';

  function preferredConstraints(cameraId,micId){
    return{
      video:{
        ...(cameraId?{deviceId:{exact:cameraId}}:{}),
        width:{ideal:1280},
        height:{ideal:720},
        frameRate:{ideal:30,max:30}
      },
      audio:{
        ...(micId?{deviceId:{exact:micId}}:{}),
        echoCancellation:true,
        noiseSuppression:true,
        autoGainControl:true
      }
    };
  }

  async function getPreferredStream(){
    let cameraId='';
    let micId='';
    try{
      cameraId=localStorage.getItem(CAMERA_KEY)||'';
      micId=localStorage.getItem(MIC_KEY)||'';
    }catch{}

    try{
      return await navigator.mediaDevices.getUserMedia(preferredConstraints(cameraId,micId));
    }catch(error){
      if((cameraId||micId)&&['NotFoundError','OverconstrainedError'].includes(error?.name)){
        try{
          if(cameraId)localStorage.removeItem(CAMERA_KEY);
          if(micId)localStorage.removeItem(MIC_KEY);
        }catch{}
        return navigator.mediaDevices.getUserMedia(preferredConstraints('',''));
      }
      throw error;
    }
  }

  async function startPreferredCamera(){
    const retry=$('retryCameraBtn');
    retry?.classList.add('hidden');
    setStatus('Starter valgt kamera…');

    try{
      let wantedCamera='';
      let wantedMic='';
      try{
        wantedCamera=localStorage.getItem(CAMERA_KEY)||'';
        wantedMic=localStorage.getItem(MIC_KEY)||'';
      }catch{}

      const currentVideo=stream?.getVideoTracks?.()[0];
      const currentAudio=stream?.getAudioTracks?.()[0];
      const currentCamera=currentVideo?.getSettings?.().deviceId||'';
      const currentMic=currentAudio?.getSettings?.().deviceId||'';
      const wrongCamera=!!wantedCamera&&currentCamera&&currentCamera!==wantedCamera;
      const wrongMic=!!wantedMic&&currentMic&&currentMic!==wantedMic;

      if(stream&&(wrongCamera||wrongMic)){
        stream.getTracks().forEach(track=>track.stop());
        stream=null;
        try{sfu?.close()}catch{}
        sfu=null;
        publication=null;
        subscribedPublicationId=null;
      }

      if(!stream)stream=await getPreferredStream();

      const videoTrack=stream.getVideoTracks()[0];
      const audioTrack=stream.getAudioTracks()[0];
      const activeCamera=videoTrack?.getSettings?.().deviceId||'';
      const activeMic=audioTrack?.getSettings?.().deviceId||'';
      try{
        if(activeCamera)localStorage.setItem(CAMERA_KEY,activeCamera);
        if(activeMic)localStorage.setItem(MIC_KEY,activeMic);
      }catch{}

      const v=$('localVideo');
      v.srcObject=stream;
      v.muted=true;
      v.playsInline=true;
      await v.play().catch(()=>{});
      $('localPlaceholder')?.classList.add('hidden');

      setStatus('Publiserer valgt kamera via Cloudflare…');
      try{sfu?.close()}catch{}
      sfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
      publication=null;
      subscribedPublicationId=null;
      publication=await sfu.publish(stream);

      $('readyBtn').disabled=false;
      setStatus('Kamera klart – venter på motstander');
      await sendState();
      if(remotePublication)await subscribeRemote(remotePublication);
    }catch(error){
      console.error('Tournament preferred camera error',error);
      publication=null;
      $('readyBtn').disabled=true;
      $('localPlaceholder')?.classList.remove('hidden');
      if($('localPlaceholder'))$('localPlaceholder').textContent='Kamera ikke startet';
      setStatus(cameraErrorText(error));
      retry?.classList.remove('hidden');
    }
  }

  // Replace the tournament waiting-room camera starter before the realtime channel subscribes.
  if(typeof startCamera==='function')startCamera=startPreferredCamera;

  // Safety: if the old default stream won the startup race, switch it to the Cam-test choice.
  let checks=0;
  const timer=setInterval(()=>{
    checks++;
    if(checks>30){clearInterval(timer);return}
    if(typeof me==='undefined'||!me||typeof stream==='undefined'||!stream)return;
    let wanted='';
    try{wanted=localStorage.getItem(CAMERA_KEY)||''}catch{}
    const active=stream.getVideoTracks?.()[0]?.getSettings?.().deviceId||'';
    if(wanted&&active&&wanted!==active){
      clearInterval(timer);
      startPreferredCamera();
    }
  },250);
})();
