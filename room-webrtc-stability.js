(()=>{
  if(window.__dartArenaRoomWebrtcStability)return;
  window.__dartArenaRoomWebrtcStability=true;
  if(typeof connectIfReady!=='function'||typeof createPeer!=='function'||typeof waitForIce!=='function'||typeof send!=='function')return;

  // OFFER must negotiate only once per live RTCPeerConnection. The old waiting-room
  // loop could create a new offer every time another "ready" broadcast arrived after
  // an answer had returned signalingState to stable, causing an offer/reconnect storm.
  connectIfReady=async function(){
    if(!localReady||!remoteReady||!stream||!isOfferer()||offerBusy||leaving)return;

    if(pc){
      if(pc.connectionState==='connected')return;
      if(pc.localDescription||pc.remoteDescription)return;
      if(pc.signalingState!=='stable')return;
      if(['connecting','disconnected'].includes(pc.connectionState))return;
    }

    const p=createPeer();
    if(!p||p!==pc)return;
    if(p.localDescription||p.remoteDescription||p.signalingState!=='stable'||['connecting','connected'].includes(p.connectionState))return;

    offerBusy=true;
    try{
      const offer=await p.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});
      if(p!==pc)return;
      await p.setLocalDescription(offer);
      await waitForIce(p);
      if(p!==pc||!p.localDescription)return;
      await send('signal',{description:p.localDescription});
    }catch(error){
      console.warn('WebRTC offer failed',error);
      if(p===pc)scheduleReconnect(1800);
    }finally{
      if(p===pc)offerBusy=false;
    }
  };

  // showRemote previously read the mutable global remoteStream again after awaiting
  // video.play(). A simultaneous reconnect could set remoteStream=null in that gap.
  showRemote=async function(){
    const activeStream=remoteStream;
    const activePeer=pc;
    const video=$('remoteVideo');
    if(!activeStream||!activeStream.getTracks().length||!video)return;

    video.srcObject=activeStream;
    video.muted=true;
    video.playsInline=true;
    try{await video.play()}catch{}

    if(activeStream!==remoteStream||activePeer!==pc)return;
    const live=activeStream.getVideoTracks().some(track=>track.readyState==='live'&&!track.muted);
    if(live){
      $('remotePlaceholder').classList.add('hidden');
      $('remoteAudioBtn').classList.remove('hidden');
    }
  };
})();
