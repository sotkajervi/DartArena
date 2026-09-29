(()=>{
  const button=document.getElementById('cameraTestBtn');
  const modal=document.getElementById('cameraTestModal');
  const backdrop=document.getElementById('cameraTestBackdrop');
  const closeButton=document.getElementById('closeCameraTest');
  const restartButton=document.getElementById('restartCameraTest');
  const video=document.getElementById('cameraTestVideo');
  const previewStatus=document.getElementById('cameraTestPreviewStatus');
  const cameraName=document.getElementById('cameraTestCameraName');
  const micName=document.getElementById('cameraTestMicName');
  const micStatus=document.getElementById('cameraTestMicStatus');
  const levelFill=document.getElementById('cameraTestLevelFill');
  if(!button||!modal||!video)return;

  let stream=null;
  let audioContext=null;
  let source=null;
  let analyser=null;
  let animationFrame=0;

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
    video.pause();video.srcObject=null;
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
    if(error?.name==='NotFoundError')return'Fant ikke kamera eller mikrofon.';
    if(error?.name==='NotReadableError')return'Kamera eller mikrofon kan være i bruk av et annet program.';
    return `Kunne ikke starte kamera/mikrofon${error?.name?' ('+error.name+')':''}.`;
  }

  async function startTest(){
    await stopMedia();
    previewStatus.textContent='Starter kamera…';
    if(cameraName)cameraName.textContent='Laster…';
    if(micName)micName.textContent='Laster…';
    if(micStatus)micStatus.textContent='Starter mikrofon…';
    if(!navigator.mediaDevices?.getUserMedia){
      previewStatus.textContent='Nettleseren støtter ikke kameratest.';
      if(micStatus)micStatus.textContent='Ikke tilgjengelig';
      return;
    }
    try{
      stream=await navigator.mediaDevices.getUserMedia({
        video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
      });
      video.srcObject=stream;
      video.muted=true;
      await video.play().catch(()=>{});
      const videoTrack=stream.getVideoTracks()[0];
      const audioTrack=stream.getAudioTracks()[0];
      if(cameraName)cameraName.textContent=videoTrack?.label||'Kamera aktivt';
      if(micName)micName.textContent=audioTrack?.label||'Mikrofon aktiv';
      previewStatus.textContent=videoTrack?'Kamera OK':'Ingen videostrøm';

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
      if(cameraName)cameraName.textContent='Ikke tilgjengelig';
      if(micName)micName.textContent='Ikke tilgjengelig';
      if(micStatus)micStatus.textContent=text;
      console.error('Camera test failed',error);
    }
  }

  async function openTest(){
    modal.classList.remove('hidden');
    await startTest();
  }

  async function closeTest(){
    modal.classList.add('hidden');
    await stopMedia();
    previewStatus.textContent='Ikke startet';
    if(cameraName)cameraName.textContent='–';
    if(micName)micName.textContent='–';
    if(micStatus)micStatus.textContent='Snakk for å teste mikrofonen';
  }

  button.onclick=openTest;
  closeButton?.addEventListener('click',closeTest);
  backdrop?.addEventListener('click',closeTest);
  restartButton?.addEventListener('click',startTest);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.classList.contains('hidden'))closeTest()});
  window.addEventListener('beforeunload',()=>{if(stream)for(const track of stream.getTracks())track.stop()});
})();