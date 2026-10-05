(()=>{
  const button=document.getElementById('cameraTestBtn');
  const modal=document.getElementById('cameraTestModal');
  const backdrop=document.getElementById('cameraTestBackdrop');
  const closeButton=document.getElementById('closeCameraTest');
  const restartButton=document.getElementById('restartCameraTest');
  const video=document.getElementById('cameraTestVideo');
  const previewStatus=document.getElementById('cameraTestPreviewStatus');
  const cameraSelect=document.getElementById('cameraTestCameraSelect');
  const micSelect=document.getElementById('cameraTestMicSelect');
  const micStatus=document.getElementById('cameraTestMicStatus');
  const levelFill=document.getElementById('cameraTestLevelFill');
  if(!button||!modal||!video||!cameraSelect||!micSelect)return;

  const CAMERA_KEY='dartarena-preferred-camera';
  const MIC_KEY='dartarena-preferred-microphone';
  let stream=null;
  let audioContext=null;
  let source=null;
  let analyser=null;
  let animationFrame=0;
  let starting=false;

  function setMeter(value){
    const pct=Math.max(0,Math.min(100,Math.round(value)));
    if(levelFill)levelFill.style.width=`${pct}%`;
  }

  async function stopMedia(){
    if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=0}
    if(source){try{source.disconnect()}catch{}source=null}
    if(audioContext){try{await audioContext.close()}catch{}audioContext=null}
    analyser=null;
    if(stream){for(const track of stream.getTracks())track.stop();stream=null}
    video.pause();
    video.srcObject=null;
    setMeter(0);
  }

  function watchMic(){
    if(!analyser)return;
    const data=new Uint8Array(analyser.fftSize);
    const tick=()=>{
      if(!analyser)return;
      analyser.getByteTimeDomainData(data);
      let sum=0;
      for(const sample of data){const v=(sample-128)/128;sum+=v*v}
      const rms=Math.sqrt(sum/data.length);
      const level=Math.min(100,rms*330);
      setMeter(level);
      if(micStatus)micStatus.textContent=level>6?'Mikrofon registrerer lyd':'Mikrofon aktiv – snakk for å teste';
      animationFrame=requestAnimationFrame(tick);
    };
    tick();
  }

  function errorText(error){
    if(error?.name==='NotAllowedError')return'Kamera eller mikrofon er blokkert i nettleseren.';
    if(error?.name==='NotFoundError'||error?.name==='OverconstrainedError')return'Fant ikke valgt kamera eller mikrofon.';
    if(error?.name==='NotReadableError')return'Kamera eller mikrofon kan være i bruk av et annet program.';
    return `Kunne ikke starte kamera/mikrofon${error?.name?' ('+error.name+')':''}.`;
  }

  function constraints(cameraId,micId){
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

  function fillSelect(select,devices,activeId,label){
    const remembered=localStorage.getItem(label==='Kamera'?CAMERA_KEY:MIC_KEY)||'';
    const wanted=devices.some(d=>d.deviceId===activeId)?activeId:devices.some(d=>d.deviceId===remembered)?remembered:devices[0]?.deviceId||'';
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
    select.disabled=false;
  }

  async function refreshDeviceLists(){
    if(!navigator.mediaDevices?.enumerateDevices)return;
    try{
      const devices=await navigator.mediaDevices.enumerateDevices();
      const videoTrack=stream?.getVideoTracks?.()[0];
      const audioTrack=stream?.getAudioTracks?.()[0];
      fillSelect(cameraSelect,devices.filter(d=>d.kind==='videoinput'),videoTrack?.getSettings?.().deviceId||'','Kamera');
      fillSelect(micSelect,devices.filter(d=>d.kind==='audioinput'),audioTrack?.getSettings?.().deviceId||'','Mikrofon');
    }catch(error){
      console.warn('Kunne ikke hente kamera/mikrofonliste',error);
    }
  }

  async function getPreferredStream(cameraId,micId){
    try{
      return await navigator.mediaDevices.getUserMedia(constraints(cameraId,micId));
    }catch(error){
      if(!['NotFoundError','OverconstrainedError'].includes(error?.name))throw error;

      if(cameraId&&micId){
        try{
          const keptCamera=await navigator.mediaDevices.getUserMedia(constraints(cameraId,''));
          localStorage.removeItem(MIC_KEY);
          return keptCamera;
        }catch(cameraError){
          if(!['NotFoundError','OverconstrainedError'].includes(cameraError?.name))throw cameraError;
        }

        try{
          const keptMic=await navigator.mediaDevices.getUserMedia(constraints('',micId));
          localStorage.removeItem(CAMERA_KEY);
          return keptMic;
        }catch(micError){
          if(!['NotFoundError','OverconstrainedError'].includes(micError?.name))throw micError;
        }
      }else if(cameraId){
        try{
          return await navigator.mediaDevices.getUserMedia(constraints(cameraId,''));
        }catch(cameraError){
          if(!['NotFoundError','OverconstrainedError'].includes(cameraError?.name))throw cameraError;
        }
      }else if(micId){
        try{
          return await navigator.mediaDevices.getUserMedia(constraints('',micId));
        }catch(micError){
          if(!['NotFoundError','OverconstrainedError'].includes(micError?.name))throw micError;
        }
      }

      if(cameraId)localStorage.removeItem(CAMERA_KEY);
      if(micId)localStorage.removeItem(MIC_KEY);
      return navigator.mediaDevices.getUserMedia(constraints('',''));
    }
  }

  async function startTest(){
    if(starting)return;
    starting=true;
    cameraSelect.disabled=true;
    micSelect.disabled=true;
    await stopMedia();
    previewStatus.textContent='Starter kamera…';
    if(micStatus)micStatus.textContent='Starter mikrofon…';

    if(!navigator.mediaDevices?.getUserMedia){
      previewStatus.textContent='Nettleseren støtter ikke kameratest.';
      if(micStatus)micStatus.textContent='Ikke tilgjengelig';
      starting=false;
      return;
    }

    const selectedCamera=cameraSelect.value&&!cameraSelect.value.startsWith('Laster')?cameraSelect.value:'';
    const selectedMic=micSelect.value&&!micSelect.value.startsWith('Laster')?micSelect.value:'';
    const cameraId=selectedCamera||localStorage.getItem(CAMERA_KEY)||'';
    const micId=selectedMic||localStorage.getItem(MIC_KEY)||'';

    try{
      stream=await getPreferredStream(cameraId,micId);
      video.srcObject=stream;
      video.muted=true;
      await video.play().catch(()=>{});
      const videoTrack=stream.getVideoTracks()[0];
      const audioTrack=stream.getAudioTracks()[0];
      const activeCamera=videoTrack?.getSettings?.().deviceId||'';
      const activeMic=audioTrack?.getSettings?.().deviceId||'';
      if(activeCamera)localStorage.setItem(CAMERA_KEY,activeCamera);
      if(activeMic)localStorage.setItem(MIC_KEY,activeMic);
      previewStatus.textContent=videoTrack?'Kamera OK':'Ingen videostrøm';

      await refreshDeviceLists();

      if(audioTrack){
        const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
        if(AudioContextCtor){
          audioContext=new AudioContextCtor();
          await audioContext.resume().catch(()=>{});
          source=audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
          analyser=audioContext.createAnalyser();
          analyser.fftSize=512;
          analyser.smoothingTimeConstant=.72;
          source.connect(analyser);
          watchMic();
        }else if(micStatus){
          micStatus.textContent='Mikrofon aktiv, men nivåmåler støttes ikke.';
        }
      }else if(micStatus){
        micStatus.textContent='Ingen mikrofon registrert.';
      }
    }catch(error){
      const text=errorText(error);
      previewStatus.textContent=text;
      if(micStatus)micStatus.textContent=text;
      console.error('Camera test failed',error);
      await refreshDeviceLists();
    }finally{
      starting=false;
      cameraSelect.disabled=!cameraSelect.options.length;
      micSelect.disabled=!micSelect.options.length;
    }
  }

  async function chooseCamera(){
    if(!cameraSelect.value)return;
    localStorage.setItem(CAMERA_KEY,cameraSelect.value);
    await startTest();
  }

  async function chooseMic(){
    if(!micSelect.value)return;
    localStorage.setItem(MIC_KEY,micSelect.value);
    await startTest();
  }

  async function openTest(){
    modal.classList.remove('hidden');
    await refreshDeviceLists();
    await startTest();
  }

  async function closeTest(){
    modal.classList.add('hidden');
    await stopMedia();
    previewStatus.textContent='Ikke startet';
    if(micStatus)micStatus.textContent='Snakk for å teste mikrofonen';
  }

  button.onclick=openTest;
  cameraSelect.addEventListener('change',chooseCamera);
  micSelect.addEventListener('change',chooseMic);
  navigator.mediaDevices?.addEventListener?.('devicechange',refreshDeviceLists);
  closeButton?.addEventListener('click',closeTest);
  backdrop?.addEventListener('click',closeTest);
  restartButton?.addEventListener('click',startTest);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.classList.contains('hidden'))closeTest()});
  window.addEventListener('beforeunload',()=>{if(stream)for(const track of stream.getTracks())track.stop()});
})();