class DartArenaSFU {
  constructor(workerUrl,room){this.workerUrl=workerUrl.replace(/\/$/,'');this.room=room||null;this.publisher=null;this.subscriber=null;this.publisherSessionId=null;this.subscriberSessionId=null;window.__DartArenaLastSFU=this;}
  async request(path,body,method='POST'){
    const authClient=typeof db!=='undefined'?db:window.db;
    if(!authClient?.auth?.getSession)throw new Error('Supabase auth client unavailable');
    const send=async(token)=>{const r=await fetch(this.workerUrl+path,{
      method,headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,
        'X-DartArena-Room-Kind':this.room?.kind||'','X-DartArena-Room-Id':this.room?.id||''},
      body:body===undefined?undefined:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      return{r,d};
    };
    const {data,error}=await authClient.auth.getSession();
    let token=data?.session?.access_token;
    if(error||!token)throw new Error('Sign in required for video');
    let result=await send(token);
    // A saved session may be stale on a separate preview origin. Refresh once
    // on an explicit authentication failure; never retry a room-access denial.
    if(result.r.status===401&&authClient.auth.refreshSession){
      const refreshed=await authClient.auth.refreshSession();
      token=refreshed.data?.session?.access_token;
      if(!refreshed.error&&token)result=await send(token);
    }
    const {r,d}=result;
    if(!r.ok||d.ok===false)throw new Error(`${path}: ${d?.sfu?.errorDescription||d?.sfu?.error||d?.error||`HTTP ${r.status}`} (HTTP ${r.status})`);
    return d.sfu??d;
  }
  async waitForIce(pc,timeout=5000){if(pc.iceGatheringState==='complete')return;await new Promise(resolve=>{const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve()};const check=()=>pc.iceGatheringState==='complete'&&done();const timer=setTimeout(done,timeout);pc.addEventListener('icegatheringstatechange',check)});}
  newPeer(){return new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});}
  async publish(stream){this.closePublisher();const pc=this.newPeer();this.publisher=pc;const entries=stream.getTracks().map((track,i)=>({track,transceiver:pc.addTransceiver(track,{direction:'sendonly'}),trackName:track.kind==='video'?'camera':`microphone-${i}`}));await pc.setLocalDescription(await pc.createOffer());await this.waitForIce(pc);const session=await this.request('/api/sfu/session');this.publisherSessionId=session.sessionId;const tracks=entries.map(x=>({location:'local',mid:x.transceiver.mid,trackName:x.trackName}));const result=await this.request('/api/sfu/publish',{sessionId:this.publisherSessionId,sessionDescription:pc.localDescription,tracks});if(!result.sessionDescription)throw new Error('SFU publish returned no sessionDescription');await pc.setRemoteDescription(result.sessionDescription);return{sessionId:this.publisherSessionId,tracks:tracks.map(x=>x.trackName)};}
  async subscribe(publication,onTrack){
    // Superseded subscriptions must not finish against the next publication's
    // session or attach stale tracks after a fast camera switch.
    this.closeSubscriber();
    const pc=this.newPeer();
    this.subscriber=pc;
    const assertCurrent=()=>{
      if(this.subscriber!==pc||pc.signalingState==='closed')throw new Error('SFU subscription superseded');
    };
    pc.ontrack=event=>{
      if(this.subscriber===pc&&pc.signalingState!=='closed')onTrack(event);
    };
    const session=await this.request('/api/sfu/session');
    assertCurrent();
    const sessionId=session.sessionId;
    this.subscriberSessionId=sessionId;
    const tracks=(publication.tracks||[]).map(trackName=>({
      location:'remote',sessionId:publication.sessionId,trackName
    }));
    const result=await this.request('/api/sfu/subscribe',{sessionId,tracks});
    assertCurrent();
    if(!result.sessionDescription)throw new Error('SFU subscribe returned no sessionDescription');
    await pc.setRemoteDescription(result.sessionDescription);
    assertCurrent();
    await pc.setLocalDescription(await pc.createAnswer());
    assertCurrent();
    await this.waitForIce(pc);
    assertCurrent();
    await this.request('/api/sfu/renegotiate',{sessionId,sessionDescription:pc.localDescription},'PUT');
    assertCurrent();
    return sessionId;
  }
  closePublisher(){if(this.publisher){try{this.publisher.close()}catch{}}this.publisher=null;this.publisherSessionId=null;}
  closeSubscriber(){if(this.subscriber){try{this.subscriber.close()}catch{}}this.subscriber=null;this.subscriberSessionId=null;}
  close(){this.closePublisher();this.closeSubscriber();}
}
window.DartArenaSFU=DartArenaSFU;
