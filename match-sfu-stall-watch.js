(()=>{
  if(window.__dartArenaSfuStallWatch)return;
  window.__dartArenaSfuStallWatch=true;

  const CHECK_MS=750;
  const STALL_MS=3000;
  const RECOVERY_COOLDOWN_MS=12000;

  let lastTime=-1;
  let lastFrames=-1;
  let stalledFor=0;
  let recoveryBusy=false;
  let lastRecoveryAt=0;

  const video=()=>document.getElementById('remoteVideo');
  const placeholder=()=>document.getElementById('remotePlaceholder');

  function liveRemoteVideo(){
    const v=video();
    const s=v?.srcObject;
    return v&&s instanceof MediaStream&&s.getVideoTracks().some(t=>t.readyState==='live');
  }

  function resetBaseline(){
    const v=video();
    lastTime=Number(v?.currentTime||0);
    const q=v?.getVideoPlaybackQuality?.();
    lastFrames=Number.isFinite(q?.totalVideoFrames)?q.totalVideoFrames:-1;
    stalledFor=0;
  }

  function hasProgressed(v){
    const nowTime=Number(v.currentTime||0);
    const q=v.getVideoPlaybackQuality?.();
    const frames=Number.isFinite(q?.totalVideoFrames)?q.totalVideoFrames:-1;
    const frameProgress=frames>=0&&lastFrames>=0&&frames>lastFrames;
    const timeProgress=lastTime>=0&&nowTime>lastTime+.01;
    const progressed=frameProgress||timeProgress;
    lastTime=nowTime;
    if(frames>=0)lastFrames=frames;
    return progressed;
  }

  async function recover(){
    const now=Date.now();
    if(recoveryBusy||now-lastRecoveryAt<RECOVERY_COOLDOWN_MS)return;
    const media=window.DartArenaMatchMedia;
    if(!media?.reconnect)return;

    recoveryBusy=true;
    lastRecoveryAt=now;
    const p=placeholder();
    if(p){
      p.textContent='Video frøs – kobler til på nytt…';
      p.classList.remove('hidden');
    }
    try{
      await media.reconnect();
      await new Promise(r=>setTimeout(r,700));
      const v=video();
      if(v){v.muted=true;v.playsInline=true;await v.play().catch(()=>{})}
    }catch(error){
      console.warn('[DartArena] SFU video recovery failed',error);
    }finally{
      resetBaseline();
      recoveryBusy=false;
    }
  }

  setInterval(async()=>{
    if(document.visibilityState!=='visible'||recoveryBusy){resetBaseline();return}
    const v=video();
    if(!v||!liveRemoteVideo()||v.readyState<2){resetBaseline();return}

    if(hasProgressed(v)){
      stalledFor=0;
      return;
    }

    stalledFor+=CHECK_MS;
    if(stalledFor>=STALL_MS)await recover();
  },CHECK_MS);

  window.addEventListener('pageshow',resetBaseline);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')resetBaseline()});
})();
