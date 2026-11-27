class DartArenaSecureSFU {
  constructor(workerUrl,room,authClient=null){this.authClient=authClient;this.workerUrl=workerUrl.replace(/\/$/,'');this.room=room||null;this.publisher=null;this.subscriber=null;this.publisherSessionId=null;this.subscriberSessionId=null;this.closeToken=null;window.__DartArenaLastSFU=this;}
  async request(path,body,method='POST',intent='publish',{keepalive=false,cachedToken=null}={}){
    const authClient=this.authClient||(typeof db!=='undefined'?db:window.db);
    if(!authClient?.auth?.getSession)throw new Error('Supabase auth client unavailable');
    const send=async(token)=>{const r=await fetch(this.workerUrl+path,{
      method,...(keepalive?{keepalive:true}:{}),headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,
        'X-DartArena-Room-Kind':this.room?.kind||'','X-DartArena-Room-Id':this.room?.id||'','X-DartArena-SFU-Intent':intent},
      body:body===undefined?undefined:JSON.stringify(body)});
      const d=await r.json().catch(()=>({}));
      return{r,d};
    };
    let token=cachedToken;
    if(!token){
      const {data,error}=await authClient.auth.getSession();
      token=data?.session?.access_token;
      if(error||!token)throw new Error('Sign in required for video');
    }
    if(path!=='/api/sfu/close')this.closeToken=token;
    let result=await send(token);
    // A saved session may be stale on a separate preview origin. Refresh once
    // on an explicit authentication failure; never retry a room-access denial.
    if(result.r.status===401&&authClient.auth.refreshSession){
      const refreshed=await authClient.auth.refreshSession();
      token=refreshed.data?.session?.access_token;
      if(!refreshed.error&&token){if(path!=='/api/sfu/close')this.closeToken=token;result=await send(token);}
    }
    const {r,d}=result;
    if(!r.ok||d.ok===false)throw new Error(`${path}: ${d?.sfu?.errorDescription||d?.sfu?.error||d?.error||`HTTP ${r.status}`} (HTTP ${r.status})`);
    return d.sfu??d;
  }
  async waitForIce(pc,timeout=5000){if(pc.iceGatheringState==='complete')return;await new Promise(resolve=>{const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve()};const check=()=>pc.iceGatheringState==='complete'&&done();const timer=setTimeout(done,timeout);pc.addEventListener('icegatheringstatechange',check)});}
  newPeer(){return new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});}
  async publish(stream){
    this.closePublisher();
    const pc=this.newPeer();
    this.publisher=pc;
    const current=()=>this.publisher===pc&&pc.signalingState!=='closed';
    const assertCurrent=()=>{if(!current())throw new Error('SFU publication superseded');};
    try{
      const entries=stream.getTracks().map((track,i)=>({track,transceiver:pc.addTransceiver(track,{direction:'sendonly'}),trackName:track.kind==='video'?'camera':`microphone-${i}`}));
      await pc.setLocalDescription(await pc.createOffer());assertCurrent();
      await this.waitForIce(pc);assertCurrent();
      const session=await this.request('/api/sfu/session');
      const sessionId=session.sessionId;
      if(!current()){this.releaseSession(sessionId,'publish');assertCurrent();}
      this.publisherSessionId=sessionId;
      const tracks=entries.map(x=>({location:'local',mid:x.transceiver.mid,trackName:x.trackName}));
      const result=await this.request('/api/sfu/publish',{sessionId,sessionDescription:pc.localDescription,tracks});assertCurrent();
      if(!result.sessionDescription)throw new Error('SFU publish returned no sessionDescription');
      await pc.setRemoteDescription(result.sessionDescription);assertCurrent();
      return {sessionId,tracks:tracks.map(x=>x.trackName)};
    }catch(error){if(this.publisher===pc)this.closePublisher();throw error;}
  }
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
    try{
    const session=await this.request('/api/sfu/session',undefined,'POST','subscribe');
    const sessionId=session.sessionId;
    if(this.subscriber!==pc||pc.signalingState==='closed'){this.releaseSession(sessionId,'subscribe');assertCurrent();}
    this.subscriberSessionId=sessionId;
    const tracks=(publication.tracks||[]).map(trackName=>({
      location:'remote',sessionId:publication.sessionId,trackName
    }));
    const result=await this.request('/api/sfu/subscribe',{sessionId,tracks},'POST','subscribe');
    assertCurrent();
    if(!result.sessionDescription)throw new Error('SFU subscribe returned no sessionDescription');
    await pc.setRemoteDescription(result.sessionDescription);
    assertCurrent();
    await pc.setLocalDescription(await pc.createAnswer());
    assertCurrent();
    await this.waitForIce(pc);
    assertCurrent();
    await this.request('/api/sfu/renegotiate',{sessionId,sessionDescription:pc.localDescription},'PUT','subscribe');
    assertCurrent();
    return sessionId;
    }catch(error){if(this.subscriber===pc)this.closeSubscriber();throw error;}
  }
  releaseSession(sessionId,intent){
    if(typeof sessionId!=='string'||!sessionId)return;
    // Use the last successful request's token to initiate keepalive immediately
    // during pagehide. The normal 401 refresh path is best effort.
    // Server failures cannot interrupt the local peer teardown.
    void this.request('/api/sfu/close',{sessionId},'POST',intent,{keepalive:true,cachedToken:this.closeToken})
      .catch(()=>{});
  }
  closePublisher(){
    const pc=this.publisher,sessionId=this.publisherSessionId;
    this.publisher=null;this.publisherSessionId=null;
    if(pc){try{pc.close()}catch{}}
    this.releaseSession(sessionId,'publish');
  }
  closeSubscriber(){
    const pc=this.subscriber,sessionId=this.subscriberSessionId;
    this.subscriber=null;this.subscriberSessionId=null;
    if(pc){try{pc.close()}catch{}}
    this.releaseSession(sessionId,'subscribe');
  }
  close(){this.closePublisher();this.closeSubscriber();}
}
window.DartArenaSecureSFU=DartArenaSecureSFU;
