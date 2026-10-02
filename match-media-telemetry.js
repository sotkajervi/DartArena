(()=>{
  if(window.__dartArenaMatchMediaTelemetry)return;
  const params=new URLSearchParams(location.search);
  const matchId=params.get('id');
  const tournamentMatchId=params.get('tournamentMatch');
  if(!matchId||!tournamentMatchId||!window.supabase)return;
  window.__dartArenaMatchMediaTelemetry=true;

  const telemetryDb=(()=>{
    try{if(typeof db!=='undefined'&&db)return db}catch{}
    return window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  })();

  let playerId=null;
  let stopped=false;
  let sampleTimer=null;
  let flushTimer=null;
  let flushing=false;
  let buffer=[];
  const previous=new Map();

  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null};
  const ms=v=>{const x=n(v);return x===null?null:x*1000};

  function candidatePair(report){
    let best=null;
    report.forEach(s=>{
      if(s.type!=='candidate-pair'||s.state!=='succeeded')return;
      if(s.nominated){best=s;return}
      if(!best)best=s;
    });
    return best;
  }

  function bitrate(direction,bytes){
    if(bytes===null)return null;
    const now=performance.now();
    const prev=previous.get(direction);
    previous.set(direction,{bytes,time:now});
    if(!prev||bytes<prev.bytes||now<=prev.time)return null;
    return (bytes-prev.bytes)*8/(now-prev.time);
  }

  async function snapshot(pc,direction){
    if(!pc||typeof pc.getStats!=='function'||pc.connectionState==='closed')return null;
    let report;
    try{report=await pc.getStats()}catch{return null}

    let rtp=null;
    let remoteInbound=null;
    const pair=candidatePair(report);
    report.forEach(s=>{
      const kind=s.kind||s.mediaType;
      if(kind!=='video')return;
      if(direction==='publisher'&&s.type==='outbound-rtp'&&!s.isRemote)rtp=s;
      if(direction==='publisher'&&s.type==='remote-inbound-rtp')remoteInbound=s;
      if(direction==='subscriber'&&s.type==='inbound-rtp'&&!s.isRemote)rtp=s;
    });

    const bytes=direction==='publisher'?n(rtp?.bytesSent):n(rtp?.bytesReceived);
    const emitted=n(rtp?.jitterBufferEmittedCount);
    const delay=n(rtp?.jitterBufferDelay);
    const jitterBufferMs=direction==='subscriber'&&emitted&&delay!==null?delay/emitted*1000:null;
    const rtt=direction==='publisher'
      ?ms(remoteInbound?.roundTripTime??pair?.currentRoundTripTime)
      :ms(pair?.currentRoundTripTime);
    const jitter=direction==='publisher'?ms(remoteInbound?.jitter):ms(rtp?.jitter);

    return{
      match_id:matchId,
      tournament_match_id:tournamentMatchId,
      player_id:playerId,
      captured_at:new Date().toISOString(),
      direction,
      connection_state:pc.connectionState||null,
      ice_state:pc.iceConnectionState||null,
      rtt_ms:rtt,
      jitter_ms:jitter,
      packets_lost:direction==='publisher'?n(remoteInbound?.packetsLost):n(rtp?.packetsLost),
      packets_received:direction==='publisher'?n(remoteInbound?.packetsReceived):n(rtp?.packetsReceived),
      packets_sent:direction==='publisher'?n(rtp?.packetsSent):null,
      bitrate_kbps:bitrate(direction,bytes),
      available_outgoing_bitrate_kbps:n(pair?.availableOutgoingBitrate)!==null?n(pair.availableOutgoingBitrate)/1000:null,
      frames_per_second:n(rtp?.framesPerSecond),
      frames_decoded:direction==='subscriber'?n(rtp?.framesDecoded):null,
      frames_encoded:direction==='publisher'?n(rtp?.framesEncoded):null,
      frames_dropped:direction==='subscriber'?n(rtp?.framesDropped):null,
      freeze_count:direction==='subscriber'?n(rtp?.freezeCount):null,
      total_freezes_seconds:direction==='subscriber'?n(rtp?.totalFreezesDuration):null,
      jitter_buffer_ms:jitterBufferMs,
      nack_count:n(rtp?.nackCount),
      pli_count:n(rtp?.pliCount),
      quality_limitation_reason:direction==='publisher'?(rtp?.qualityLimitationReason||null):null,
      visibility_state:document.visibilityState||'visible'
    };
  }

  async function sample(){
    if(stopped||!playerId)return;
    const client=window.__DartArenaLastSFU;
    if(!client)return;
    const rows=await Promise.all([
      snapshot(client.publisher,'publisher'),
      snapshot(client.subscriber,'subscriber')
    ]);
    rows.filter(Boolean).forEach(row=>buffer.push(row));
    if(buffer.length>600)buffer=buffer.slice(-600);
  }

  async function flush(){
    if(stopped&&buffer.length===0||flushing||!buffer.length)return;
    flushing=true;
    const batch=buffer.splice(0,buffer.length);
    try{
      const{error}=await telemetryDb.from('match_media_telemetry').insert(batch);
      if(error)throw error;
    }catch(error){
      console.warn('[MEDIA TELEMETRY] flush failed',error);
      buffer=[...batch,...buffer].slice(-600);
    }finally{
      flushing=false;
    }
  }

  async function boot(){
    const{data:{session},error}=await telemetryDb.auth.getSession();
    if(error||!session?.user?.id)return;
    playerId=session.user.id;
    await sample();
    sampleTimer=setInterval(sample,2000);
    flushTimer=setInterval(flush,10000);
    console.debug('[MEDIA TELEMETRY] recording',matchId,tournamentMatchId);
  }

  async function stop(){
    if(stopped)return;
    stopped=true;
    clearInterval(sampleTimer);
    clearInterval(flushTimer);
    await flush();
  }

  window.DartArenaMediaTelemetry={flush,bufferSize:()=>buffer.length};
  window.addEventListener('pagehide',()=>{stop().catch(()=>{})},{once:true});
  boot().catch(error=>console.warn('[MEDIA TELEMETRY] startup failed',error));
})();
