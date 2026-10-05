// Camera/microphone selection for the tournament waiting room.
// The selected device IDs are persisted and are authoritative for the match room.
(()=>{
  if(window.__dartArenaTournamentPreferredMedia)return;
  window.__dartArenaTournamentPreferredMedia=true;

  const CAMERA_KEY='dartarena-preferred-camera';
  const MIC_KEY='dartarena-preferred-microphone';
  const cameraSelect=document.getElementById('cameraDeviceSelect');
  const micSelect=document.getElementById('micDeviceSelect');
  const micLevelFill=document.getElementById('micLevelFill');
  const micLevelText=document.getElementById('micLevelText');
  let switching=false;
  let meterContext=null,meterSource=null,meterAnalyser=null,meterFrame=0;

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

  function currentDeviceId(kind){
    const track=stream?.getTracks?.().find(t=>t.kind===kind&&t.readyState==='live');
    return track?.getSettings?.().deviceId||'';
  }

  function setMeter(value){
    if(micLevelFill)micLevelFill.style.width=`${Math.max(0,Math.min(100,Math.round(value)))}%`;
  }

  async function stopMeter(){
    if(meterFrame)cancelAnimationFrame(meterFrame);
    meterFrame=0;
    if(meterSource){try{meterSource.disconnect()}catch{}meterSource=null}
    meterAnalyser=null;
    if(meterContext){try{await meterContext.close()}catch{}meterContext=null}
    setMeter(0);
  }

  async function startMeter(track){
    await stopMeter();
    if(!track||track.readyState!=='live'){
      if(micLevelText)micLevelText.textContent='Ingen mikrofon';
      return;
    }
    const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextCtor){
      if(micLevelText)micLevelText.textContent='Mikrofon aktiv';
      return;
    }
    try{
      meterContext=new AudioContextCtor();
      await meterContext.resume().catch(()=>{});
      meterSource=meterContext.createMediaStreamSource(new MediaStream([track]));
      meterAnalyser=meterContext.createAnalyser();
      meterAnalyser.fftSize=512;
      meterAnalyser.smoothingTimeConstant=.72;
      meterSource.connect(meterAnalyser);
      const data=new Uint8Array(meterAnalyser.fftSize);
      const tick=()=>{
        if(!meterAnalyser)return;
        meterAnalyser.getByteTimeDomainData(data);
        let sum=0;
        for(const sample of data){const v=(sample-128)/128;sum+=v*v}
        const level=Math.min(100,Math.sqrt(sum/data.length)*330);
        setMeter(level);
        if(micLevelText)micLevelText.textContent=level>6?'Mikrofon registrerer lyd':'Snakk for å teste mikrofonen';
        meterFrame=requestAnimationFrame(tick);
      };
      tick();
    }catch{
      if(micLevelText)micLevelText.textContent='Mikrofon aktiv';
    }
  }

  function fillSelect(select,devices,preferredId,activeId,label){
    if(!select)return;
    const ids=new Set(devices.map(d=>d.deviceId));
    const wanted=ids.has(preferredId)?preferredId:ids.has(activeId)?activeId:devices[0]?.deviceId||'';
    select.innerHTML='';
    if(!devices.length){
      const option=document.createElement('option');
      option.value='';
      option.textContent=`Ingen ${label.toLowerCase()} funnet`;
      select.appendChild(option);
      select.disabled=true;
      return;
    }
    devices.forEach((device,index)=>{
      const option=document.createElement('option');
      option.value=device.deviceId;
      option.textContent=device.label||`${label} ${index+1}`;
      select.appendChild(option);
    });
    if(wanted)select.value=wanted;
    select.disabled=switching;
  }

  async function refreshDevices(){
    if(!navigator.mediaDevices?.enumerateDevices)return;
    try{
      const devices=await navigator.mediaDevices.enumerateDevices();
      fillSelect(cameraSelect,devices.filter(d=>d.kind==='videoinput'),localStorage.getItem(CAMERA_KEY)||'',currentDeviceId('video'),'Kamera');
      fillSelect(micSelect,devices.filter(d=>d.kind==='audioinput'),localStorage.getItem(MIC_KEY)||'',currentDeviceId('audio'),'Mikrofon');
    }catch(error){
      console.warn('Kunne ikke hente kamera/mikrofonliste',error);
    }
  }

  async function getPreferredStream(cameraId,micId){
    try{
      return await navigator.mediaDevices.getUserMedia(preferredConstraints(cameraId,micId));
    }catch(error){
      if(!['NotFoundError','OverconstrainedError'].includes(error?.name))throw error;

      if(cameraId&&micId){
        try{
          const keptCamera=await navigator.mediaDevices.getUserMedia(preferredConstraints(cameraId,''));
          localStorage.removeItem(MIC_KEY);
          return keptCamera;
        }catch(cameraError){
          if(!['NotFoundError','OverconstrainedError'].includes(cameraError?.name))throw cameraError;
        }
        try{
          const keptMic=await navigator.mediaDevices.getUserMedia(preferredConstraints('',micId));
          localStorage.removeItem(CAMERA_KEY);
          return keptMic;
        }catch(micError){
          if(!['NotFoundError','OverconstrainedError'].includes(micError?.name))throw micError;
        }
      }else if(cameraId){
        try{return await navigator.mediaDevices.getUserMedia(preferredConstraints(cameraId,''))}
        catch(cameraError){
          if(!['NotFoundError','OverconstrainedError'].includes(cameraError?.name))throw cameraError;
          localStorage.removeItem(CAMERA_KEY);
        }
      }else if(micId){
        try{return await navigator.mediaDevices.getUserMedia(preferredConstraints('',micId))}
        catch(micError){
          if(!['NotFoundError','OverconstrainedError'].includes(micError?.name))throw micError;
          localStorage.removeItem(MIC_KEY);
        }
      }
      return navigator.mediaDevices.getUserMedia(preferredConstraints('',''));
    }
  }

  async function tearDownLocalPublication(){
    await stopMeter();
    if(stream){
      try{stream.getTracks().forEach(track=>track.stop())}catch{}
      stream=null;
    }
    try{sfu?.close()}catch{}
    sfu=null;
    publication=null;
    subscribedPublicationId=null;
    const video=$('localVideo');
    if(video){video.pause?.();video.srcObject=null}
  }

  async function startPreferredCamera(){
    if(switching)return;
    switching=true;
    const retry=$('retryCameraBtn');
    retry?.classList.add('hidden');
    if(cameraSelect)cameraSelect.disabled=true;
    if(micSelect)micSelect.disabled=true;
    $('readyBtn').disabled=true;
    setStatus('Starter valgt kamera…');

    try{
      const wantedCamera=cameraSelect?.value||localStorage.getItem(CAMERA_KEY)||'';
      const wantedMic=micSelect?.value||localStorage.getItem(MIC_KEY)||'';
      const activeCamera=currentDeviceId('video');
      const activeMic=currentDeviceId('audio');
      const wrongCamera=!!wantedCamera&&activeCamera!==wantedCamera;
      const wrongMic=!!wantedMic&&activeMic!==wantedMic;

      if(stream&&(wrongCamera||wrongMic))await tearDownLocalPublication();
      if(!stream)stream=await getPreferredStream(wantedCamera,wantedMic);

      const videoTrack=stream.getVideoTracks()[0];
      const audioTrack=stream.getAudioTracks()[0];
      const actualCamera=videoTrack?.getSettings?.().deviceId||'';
      const actualMic=audioTrack?.getSettings?.().deviceId||'';

      if(actualCamera)localStorage.setItem(CAMERA_KEY,actualCamera);
      if(actualMic)localStorage.setItem(MIC_KEY,actualMic);

      const v=$('localVideo');
      v.srcObject=stream;
      v.muted=true;
      v.playsInline=true;
      await v.play().catch(()=>{});
      $('localPlaceholder')?.classList.add('hidden');
      await startMeter(audioTrack);
      await refreshDevices();

      setStatus('Publiserer valgt kamera via Cloudflare…');
      try{sfu?.close()}catch{}
      sfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
      publication=null;
      subscribedPublicationId=null;
      publication=await sfu.publish(stream);

      $('readyBtn').disabled=false;
      setStatus('Valgt kamera klart – dette brukes i kampen');
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
      await refreshDevices();
    }finally{
      switching=false;
      if(cameraSelect)cameraSelect.disabled=!cameraSelect.options.length;
      if(micSelect)micSelect.disabled=!micSelect.options.length;
    }
  }

  async function changeDevice(kind){
    if(switching)return;
    const select=kind==='video'?cameraSelect:micSelect;
    const value=select?.value||'';
    if(!value)return;
    localStorage.setItem(kind==='video'?CAMERA_KEY:MIC_KEY,value);

    if(typeof localReady!=='undefined'&&localReady){
      localReady=false;
      try{setReadyUi()}catch{}
      const msg=$('roomMessage');
      if(msg)msg.textContent='Kamera/mikrofon endret. Marker deg klar igjen.';
      try{await sendState()}catch{}
    }

    await tearDownLocalPublication();
    await startPreferredCamera();
  }

  cameraSelect?.addEventListener('change',()=>changeDevice('video'));
  micSelect?.addEventListener('change',()=>changeDevice('audio'));
  navigator.mediaDevices?.addEventListener?.('devicechange',refreshDevices);
  document.addEventListener('pointerdown',()=>meterContext?.resume?.().catch(()=>{}),{passive:true});

  // Replace the tournament waiting-room camera starter before the realtime channel subscribes.
  if(typeof startCamera==='function')startCamera=startPreferredCamera;

  refreshDevices();

  // Safety: if an older/default stream won the startup race, enforce the saved choice.
  let checks=0;
  const timer=setInterval(()=>{
    checks++;
    if(checks>40){clearInterval(timer);return}
    if(typeof me==='undefined'||!me||typeof stream==='undefined'||!stream)return;
    const wanted=localStorage.getItem(CAMERA_KEY)||'';
    const active=currentDeviceId('video');
    if(wanted&&active&&wanted!==active){
      clearInterval(timer);
      tearDownLocalPublication().then(startPreferredCamera);
    }else if(active){
      clearInterval(timer);
      refreshDevices();
      startMeter(stream.getAudioTracks?.()[0]);
    }
  },250);

  window.addEventListener('pagehide',()=>{
    clearInterval(timer);
    stopMeter();
  },{once:true});
})();