// Waiting-room WebRTC race fixes.
// Keep ANSWER passive until an offer arrives, ignore reconnect timers from stale peers,
// and never dereference a remote stream after that peer has been torn down.
(()=>{
  if(window.__dartArenaRoomWebrtcRaceFix)return;
  window.__dartArenaRoomWebrtcRaceFix=true;
  if(typeof startHandshake!=='function'||typeof scheduleReconnect!=='function'||typeof showRemote!=='function'||typeof restartPeer!=='function')return;

  startHandshake=function(){
    clearInterval(helloTimer);
    helloTimer=setInterval(async()=>{
      if(!localReady||leaving)return;
      await send('ready');
      // Only OFFER creates/recreates the RTCPeerConnection. ANSWER waits for the offer.
      if(isOfferer()&&remoteReady&&(!pc||['failed','closed'].includes(pc.connectionState)))await restartPeer();
    },1500);
  };

  scheduleReconnect=function(ms,expectedPeer=pc){
    if(leaving||reconnectTimer)return;
    reconnectTimer=setTimeout(async()=>{
      reconnectTimer=null;
      // A timer created by an older peer must never tear down a newer connecting peer.
      if(expectedPeer!==pc)return;
      if(pc&&pc.connectionState==='connected')return;
      await restartPeer();
    },ms);
  };

  showRemote=async function(){
    const v=$('remoteVideo');
    const expectedPeer=pc;
    const expectedStream=remoteStream;
    if(!v||!expectedStream||!expectedStream.getTracks().length)return;
    v.srcObject=expectedStream;
    v.muted=true;
    v.playsInline=true;
    try{await v.play()}catch{}
    // destroyPeer() may have run while play() was awaiting.
    if(expectedPeer!==pc||expectedStream!==remoteStream)return;
    const live=expectedStream.getVideoTracks().some(track=>track.readyState==='live');
    if(live){
      $('remotePlaceholder')?.classList.add('hidden');
      $('remoteAudioBtn')?.classList.remove('hidden');
    }
  };

  const baseRestartPeer=restartPeer;
  let restartBusy=false;
  restartPeer=async function(start=true){
    if(restartBusy)return;
    restartBusy=true;
    try{return await baseRestartPeer(start)}
    finally{restartBusy=false}
  };
})();
