// Direct P2P media transport for the normal DartArena waiting room.
// Reuses room.js signaling/state, but ensures the peer connection uses both
// Cloudflare and Google STUN and is not replaced by the legacy SFU override.
(()=>{
  if(window.__dartArenaRoomP2PMedia)return;
  window.__dartArenaRoomP2PMedia=true;

  const ROOM_P2P_ICE={
    iceServers:[
      {urls:'stun:stun.cloudflare.com:3478'},
      {urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']}
    ],
    iceCandidatePoolSize:10,
    bundlePolicy:'max-bundle'
  };

  if(typeof createPeer!=='function')return;

  createPeer=function(){
    if(pc)return pc;
    if(!stream?.getTracks?.().length)return null;

    const p=new RTCPeerConnection(ROOM_P2P_ICE);
    pc=p;
    window.DARTARENA_ACTIVE_MEDIA_PC=p;
    window.DARTARENA_ACTIVE_MEDIA_MODE='peer';
    remoteStream=new MediaStream();

    for(const track of stream.getTracks())p.addTrack(track,stream);

    p.onicecandidate=e=>{
      if(p===pc&&e.candidate)send('signal',{candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate});
    };

    p.ontrack=e=>{
      if(p!==pc)return;
      const tracks=e.streams?.[0]?.getTracks?.()||[e.track];
      for(const track of tracks){
        if(track&&!remoteStream.getTracks().some(t=>t.id===track.id))remoteStream.addTrack(track);
        if(track){
          track.onunmute=()=>showRemote();
          track.onended=()=>scheduleReconnect(1000,p);
        }
      }
      showRemote();
    };

    p.onconnectionstatechange=()=>{
      if(p!==pc)return;
      const s=p.connectionState;
      if(s==='connected'){
        clearTimeout(reconnectTimer);
        reconnectTimer=null;
        setStatus(`Tilkoblet ${names[other]||'motstander'} • direkte P2P`);
        showRemote();
      }else if(s==='failed')scheduleReconnect(500,p);
      else if(s==='disconnected')scheduleReconnect(8000,p);
    };

    p.oniceconnectionstatechange=()=>{
      if(p!==pc)return;
      if(['connected','completed'].includes(p.iceConnectionState)){
        clearTimeout(reconnectTimer);
        reconnectTimer=null;
      }else if(p.iceConnectionState==='failed')scheduleReconnect(500,p);
    };

    return p;
  };
})();
