const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const tournamentMatchId=new URLSearchParams(location.search).get('id');

let me=null;
let tm=null;
let other=null;
let names={};
let channel=null;
let stream=null;
let sfu=null;
let publication=null;
let remotePublication=null;
let subscribedPublicationId=null;
let heartbeat=null;
let localReady=false;
let remoteReady=false;
let starting=false;
let starterChoice='random';
let coinFlipRunning=false;
let coinFlipFinished=false;
let coinFlipFallback=null;
let roomConnected=false;
let remoteTransportMismatch=false;
let roomRetryTimer=null;
const roomInstanceId=crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
let remoteInstanceId=null;
let remoteSubscribeBusy=false;
let remoteSubscribeGeneration=0;
let remoteVideoWatchdog=null;
let remoteLastFrames=0;
let remoteLastTime=0;
let remoteLastProgress=Date.now();
let remoteRetryAfter=0;
let queuedRemotePublication=null;

function setStatus(text){$('cameraStatus').textContent=text;}
function starterValueForLocal(){
  if(starterChoice==='random')return'random';
  return starterChoice===me?'me':'opponent';
}
function starterText(){
  if(starterChoice==='random')return'Myntkast';
  return names[starterChoice]||'Spiller';
}
function setStarterUi(){
  const select=$('starterChoice');
  if(select)select.value=starterValueForLocal();
}
function setReadyUi(){
  $('localReadyDot').classList.toggle('on',localReady);
  $('remoteReadyDot').classList.toggle('on',remoteReady);
  $('localReadyText').textContent=localReady?'Klar':'Ikke klar';
  $('remoteReadyText').textContent=remoteReady?'Klar':'Ikke klar';
  $('readyBtn').textContent=localReady?'Ikke klar':'Jeg er klar';
  $('readyBtn').disabled=!roomConnected||starting||remoteTransportMismatch;
}
function resetReadyForStarterChange(message=''){
  localReady=false;
  remoteReady=false;
  setReadyUi();
  if(message)$('roomMessage').textContent=message;
}
function isValidStarterChoice(choice){
  return choice==='random'||choice===tm?.player1_id||choice===tm?.player2_id;
}
function cameraErrorText(e){
  if(e?.name==='NotAllowedError')return'Kamera/mikrofon er blokkert i nettleseren.';
  if(e?.name==='NotFoundError')return'Fant ikke kamera eller mikrofon.';
  if(e?.name==='NotReadableError')return'Kameraet kan være i bruk av et annet program.';
  return e?.message||'Kamera kunne ikke startes.';
}
function matchUrl(liveId){return `match.html?id=${encodeURIComponent(liveId)}&tournamentMatch=${encodeURIComponent(tournamentMatchId)}`;}
function goToMatch(liveId){cleanup();location.href=matchUrl(liveId);}

async function loadLiveMatch(liveId){
  const {data,error}=await db.from('matches')
    .select('id,player1_id,player2_id,match_starter_id,turn_player_id')
    .eq('id',liveId)
    .single();
  if(error)throw error;
  return data;
}

async function playTournamentCoinFlip(payload){
  if(coinFlipRunning||coinFlipFinished||!payload?.liveMatchId||!payload?.starterId)return;
  clearTimeout(coinFlipFallback);
  coinFlipFallback=null;
  coinFlipRunning=true;
  starting=true;
  $('readyBtn').disabled=true;
  $('starterChoice').disabled=true;
  $('roomMessage').textContent='Kaster mynt…';
  try{
    await window.DartArenaCoinFlip?.play({
      player1Id:payload.player1Id,
      player2Id:payload.player2Id,
      player1Name:names[payload.player1Id]||payload.player1Name||'Spiller 1',
      player2Name:names[payload.player2Id]||payload.player2Name||'Spiller 2',
      winnerId:payload.starterId,
      duration:3300
    });
  }finally{
    coinFlipRunning=false;
    coinFlipFinished=true;
    goToMatch(payload.liveMatchId);
  }
}

async function recoverCoinFlip(liveId){
  if(coinFlipRunning||coinFlipFinished||!liveId)return;
  try{
    const match=await loadLiveMatch(liveId);
    const starterId=match.match_starter_id||match.turn_player_id;
    if(!starterId)return goToMatch(liveId);
    await playTournamentCoinFlip({
      liveMatchId:liveId,
      player1Id:match.player1_id,
      player2Id:match.player2_id,
      starterId
    });
  }catch(e){
    console.warn('Coin flip recovery failed',e);
    goToMatch(liveId);
  }
}

function armCoinFlipFallback(liveId){
  if(coinFlipRunning||coinFlipFinished||coinFlipFallback)return;
  coinFlipFallback=setTimeout(()=>{
    coinFlipFallback=null;
    recoverCoinFlip(liveId);
  },1400);
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||!tournamentMatchId){$('roomMessage').textContent='Du er ikke logget inn, eller kampadressen mangler. Åpne turneringen etter innlogging.';return;}
  me=session.user.id;

  const {data,error}=await db.from('tournament_matches').select('*').eq('id',tournamentMatchId).single();
  if(error||!data){$('roomMessage').textContent='Kunne ikke hente turneringskampen: '+(error?.message||'Kampen ble ikke funnet')+'. Oppdater siden eller logg inn på nytt.';return;}
  tm=data;

  if(![tm.player1_id,tm.player2_id].includes(me)){
    $('roomMessage').textContent='Denne kontoen er ikke registrert som spiller i kampen. Kontroller at du er logget inn med riktig konto.';
    return;
  }

  if(tm.status==='live'&&tm.live_match_id){goToMatch(tm.live_match_id);return;}
  if(['finished','wo'].includes(tm.status)){
    location.replace(`tournament-match-stats.html?id=${encodeURIComponent(tournamentMatchId)}`);
    return;
  }
  if(tm.status!=='pending'){
    $('roomMessage').textContent='Denne kampen kan ikke startes akkurat nå.';
    return;
  }

  other=me===tm.player1_id?tm.player2_id:tm.player1_id;
  const {data:profiles}=await db.from('profiles').select('id,username').in('id',[tm.player1_id,tm.player2_id]);
  names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));

  $('roomTitle').textContent=`${names[tm.player1_id]||'Spiller 1'} vs ${names[tm.player2_id]||'Spiller 2'}`;
  $('roomMeta').textContent=`501 • Best av ${tm.best_of} legs`;
  $('localVideoName').textContent=names[me]||'Deg';
  $('remoteVideoName').textContent=names[other]||'Motstander';
  $('localReadyName').textContent=names[me]||'Deg';
  $('remoteReadyName').textContent=names[other]||'Motstander';
  setReadyUi();
  setStarterUi();

  $('backBtn').onclick=()=>history.length>1?history.back():location.href='./';
  $('readyBtn').onclick=toggleReady;
  $('retryCameraBtn').onclick=startCamera;
  $('remoteAudioBtn').onclick=toggleRemoteAudio;
  $('starterChoice').onchange=changeStarterChoice;

  setupChannel();
}

function resetRemoteVideo(message='Venter på motstanderens kamera…'){
  remoteSubscribeGeneration++;
  remoteSubscribeBusy=false;
  subscribedPublicationId=null;
  try{sfu?.closeSubscriber?.()}catch{}
  const v=$('remoteVideo');
  if(v){try{v.pause()}catch{};v.srcObject=null;}
  const placeholder=$('remotePlaceholder');
  if(placeholder){placeholder.textContent=message;placeholder.classList.remove('hidden');}
}
function monitorRemoteVideo(){
  const video=$('remoteVideo');
  if(!video||!remotePublication||!sfu||!roomConnected||remoteSubscribeBusy)return;
  const frames=video.getVideoPlaybackQuality?.().totalVideoFrames||0;
  const playbackTime=video.currentTime||0;
  const valid=video.videoWidth>0&&video.videoHeight>0&&video.readyState>=2;
  if(valid&&(frames>remoteLastFrames||(!frames&&playbackTime>remoteLastTime+0.1))){
    remoteLastFrames=frames;
    remoteLastTime=playbackTime;
    remoteLastProgress=Date.now();
    return;
  }
  if(Date.now()-remoteLastProgress<7000||Date.now()<remoteRetryAfter)return;
  remoteRetryAfter=Date.now()+6500;
  remoteLastProgress=Date.now();
  subscribedPublicationId=null;
  subscribeRemote(remotePublication).catch(error=>console.warn('Remote video watchdog retry failed',error));
}
function setupChannel(){
  channel=db.channel(`tournament-room-${tournamentMatchId}`)
    .on('broadcast',{event:'state'},async({payload})=>{
      if(payload.from!==other)return;
      const selected=await window.DartArenaMediaMode?.getMode?.()||'legacy';
      if(payload.mediaMode!==selected){
        const wasReady=localReady;
        remoteTransportMismatch=true;
        localReady=false;
        remoteReady=false;
        setReadyUi();
        $('roomMessage').textContent='Forskjellige video-versjoner i samme venterom. Begge må åpne kamprommet på nytt fra hovedsiden etter at Owner har valgt videosystem.';
        if(wasReady)await sendState();
        return;
      }
      if(remoteTransportMismatch){
        remoteTransportMismatch=false;
        localReady=false;
        remoteReady=false;
        setReadyUi();
        $('roomMessage').textContent='Begge bruker nå samme videosystem. Kontroller lyd og bilde før dere blir klare.';
      }
      if(payload.instanceId&&remoteInstanceId&&payload.instanceId!==remoteInstanceId){
        remoteReady=false;
        remotePublication=null;
        resetRemoteVideo('Motstanderen kobler til kamera på nytt…');
      }
      remoteInstanceId=payload.instanceId||remoteInstanceId;
      remoteReady=!!payload.ready;
      setReadyUi();
      if(payload.publication?.sessionId){
        remotePublication=payload.publication;
        await subscribeRemote(remotePublication);
      }
      await maybeStart();
    })
    .on('broadcast',{event:'room-leave'},({payload})=>{
      if(payload?.from!==other)return;
      if(payload.instanceId&&remoteInstanceId&&payload.instanceId!==remoteInstanceId)return;
      remoteReady=false;
      remotePublication=null;
      resetRemoteVideo('Motstanderen forlot venterommet.');
      setReadyUi();
      $('roomMessage').textContent='Motstanderen forlot venterommet. Venter på at spilleren kommer tilbake…';
    })
    .on('broadcast',{event:'starter-request'},async({payload})=>{
      if(me!==tm.player1_id||payload.from!==other||!isValidStarterChoice(payload.choice))return;
      await applyStarterChoice(payload.choice,true);
    })
    .on('broadcast',{event:'starter-choice'},async({payload})=>{
      if(payload.from!==tm.player1_id||!isValidStarterChoice(payload.choice))return;
      if(payload.choice===starterChoice){setStarterUi();return;}
      starterChoice=payload.choice;
      setStarterUi();
      resetReadyForStarterChange(`Hvem som begynner er endret til ${starterText()}. Klarstatus er nullstilt.`);
      await sendState();
    })
    .on('broadcast',{event:'coin-flip-start'},async({payload})=>{
      if(!payload?.liveMatchId||!payload?.starterId)return;
      await playTournamentCoinFlip(payload);
    })
    .on('broadcast',{event:'match-start'},({payload})=>{
      if(payload.liveMatchId)goToMatch(payload.liveMatchId);
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournament_matches',filter:`id=eq.${tournamentMatchId}`},payload=>{
      tm=payload.new;
      if(tm.status==='live'&&tm.live_match_id){
        if(starterChoice==='random'&&!coinFlipFinished){armCoinFlipFallback(tm.live_match_id);return;}
        goToMatch(tm.live_match_id);
      }
    })
    .subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        roomConnected=true;
        clearTimeout(roomRetryTimer);
        setReadyUi();
        clearInterval(remoteVideoWatchdog);
        remoteLastProgress=Date.now();
        remoteVideoWatchdog=setInterval(monitorRemoteVideo,2000);
        clearInterval(heartbeat);
        heartbeat=setInterval(()=>sendState().catch(error=>console.warn('Room heartbeat failed',error)),1800);
        await sendState();
        if(me===tm.player1_id)await broadcastStarterChoice();
        startCamera().catch(error=>console.warn('Camera startup failed',error));
        return;
      }
      if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
        roomConnected=false;
        clearInterval(remoteVideoWatchdog);
        remoteVideoWatchdog=null;
        remoteReady=false;
        remoteInstanceId=null;
        setReadyUi();
        $('roomMessage').textContent='Forbindelsen til venterommet ble brutt. Prøver å koble til igjen…';
        clearTimeout(roomRetryTimer);
        roomRetryTimer=setTimeout(()=>{
          if(!channel||roomConnected)return;
          const old=channel;
          channel=null;
          try{db.removeChannel(old)}catch{}
          setupChannel();
        },2500);
      }
    });
}

async function startCamera(){
  $('retryCameraBtn').classList.add('hidden');
  setStatus('Starter kamera…');
  try{
    if(!stream){
      stream=await navigator.mediaDevices.getUserMedia({
        video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
      });
    }
    const v=$('localVideo');
    v.srcObject=stream;
    v.muted=true;
    await v.play().catch(()=>{});
    $('localPlaceholder').classList.add('hidden');

    setStatus('Publiserer kamera via Cloudflare…');
    sfu?.close();
    const selected=await window.DartArenaMediaMode?.getMode?.()||'legacy';
    const secure=selected==='sfu';
    const SfuClient=secure?window.DartArenaSecureSFU:window.DartArenaSFU;
    if(!SfuClient)throw Error('Valgt videosystem er ikke tilgjengelig');
    sfu=new SfuClient(secure?window.DARTARENA_SFU.secureWorkerUrl:window.DARTARENA_SFU.workerUrl,
      {kind:'tournament_match',id:tournamentMatchId});
    publication=await sfu.publish(stream);
    setReadyUi();
    setStatus('Kamera klart – venter på motstander');
    await sendState();
    if(remotePublication)await subscribeRemote(remotePublication);
  }catch(e){
    console.error('Tournament room camera error',e);
    publication=null;
    setReadyUi();
    $('localPlaceholder').classList.remove('hidden');
    $('localPlaceholder').textContent='Kamera ikke startet';
    setStatus(cameraErrorText(e));
    $('retryCameraBtn').classList.remove('hidden');
  }
}

async function subscribeRemote(pub){
  if(!pub?.sessionId||!Array.isArray(pub.tracks)||!sfu)return;
  if(remoteSubscribeBusy){
    if(pub.sessionId!==subscribedPublicationId)queuedRemotePublication=pub;
    return;
  }
  // Broadcast heartbeats must not replace an active (or still starting)
  // subscription. Only a new publication ID or the watchdog may reset it.
  if(subscribedPublicationId===pub.sessionId)return;
  resetRemoteVideo('Kobler til motstanderens kamerabilde…');
  const generation=remoteSubscribeGeneration;
  remoteSubscribeBusy=true;
  subscribedPublicationId=pub.sessionId;
  remoteLastFrames=0;
  remoteLastTime=0;
  remoteLastProgress=Date.now();
  setStatus(`Kobler til ${names[other]||'motstander'}…`);
  try{
    await sfu.subscribe(pub,async event=>{
      if(generation!==remoteSubscribeGeneration)return;
      const v=$('remoteVideo');
      let rs=v.srcObject;
      if(!(rs instanceof MediaStream)){rs=new MediaStream();v.srcObject=rs;}
      const tracks=event.streams?.[0]?.getTracks()||[event.track];
      for(const track of tracks){
        if(track&&!rs.getTracks().some(t=>t.id===track.id))rs.addTrack(track);
      }
      v.muted=true;
      v.playsInline=true;
      const reveal=()=>{
        if(generation!==remoteSubscribeGeneration)return;
        if(v.videoWidth>0&&v.readyState>=2){
          $('remotePlaceholder').classList.add('hidden');
          remoteLastProgress=Date.now();
          setStatus(`Tilkoblet ${names[other]||'motstander'} via Cloudflare`);
        }
      };
      v.addEventListener('loadeddata',reveal,{once:true});
      v.addEventListener('playing',reveal,{once:true});
      await v.play().catch(()=>{});
      reveal();
      // A live track alone does not prove that actual video frames arrive.
      if(v.videoWidth&&v.readyState>=2){
        $('remotePlaceholder').classList.add('hidden');
        remoteLastProgress=Date.now();
        setStatus(`Tilkoblet ${names[other]||'motstander'} via Cloudflare`);
      }
    });
  }catch(error){
    if(generation===remoteSubscribeGeneration){
      console.error('Tournament room subscribe error',error);
      resetRemoteVideo('Video ikke tilgjengelig. Prøver å koble til igjen…');
      setStatus('Kunne ikke koble til motstanderens video. Prøver igjen…');
    }
  }finally{
    if(generation===remoteSubscribeGeneration)remoteSubscribeBusy=false;
    else remoteSubscribeBusy=false;
    const next=queuedRemotePublication;
    queuedRemotePublication=null;
    if(next&&roomConnected&&next.sessionId===remotePublication?.sessionId){
      subscribeRemote(next).catch(error=>console.warn('Queued remote video failed',error));
    }
  }
}

async function sendState(){
  if(!channel)return;
  await channel.send({
    type:'broadcast',
    event:'state',
    payload:{from:me,ready:localReady,publication,instanceId:roomInstanceId,
      mediaMode:await window.DartArenaMediaMode?.getMode?.()||'legacy'}
  });
}

async function broadcastStarterChoice(){
  if(!channel||me!==tm.player1_id)return;
  await channel.send({type:'broadcast',event:'starter-choice',payload:{from:me,choice:starterChoice}});
}

function selectedStarterActual(){
  const value=$('starterChoice').value;
  if(value==='random')return'random';
  return value==='me'?me:other;
}

async function changeStarterChoice(){
  if(starting){setStarterUi();return;}
  const choice=selectedStarterActual();
  if(!isValidStarterChoice(choice)){setStarterUi();return;}

  if(me===tm.player1_id){
    await applyStarterChoice(choice,true);
    return;
  }

  $('starterChoice').disabled=true;
  $('roomMessage').textContent='Oppdaterer hvem som begynner…';
  try{
    await channel.send({type:'broadcast',event:'starter-request',payload:{from:me,choice}});
  }finally{
    setTimeout(()=>{$('starterChoice').disabled=false;},350);
  }
}

async function applyStarterChoice(choice,broadcast=false){
  if(!isValidStarterChoice(choice))return;
  const changed=choice!==starterChoice;
  starterChoice=choice;
  setStarterUi();
  if(changed){
    resetReadyForStarterChange(`Hvem som begynner: ${starterText()}. Klarstatus er nullstilt.`);
    await sendState();
  }
  if(broadcast)await broadcastStarterChoice();
}

async function toggleReady(){
  if(!roomConnected||remoteTransportMismatch)return;
  localReady=!localReady;
  setReadyUi();
  $('roomMessage').textContent=localReady?`Du er klar. Starter: ${starterText()}. Venter på motstanderen.`:'';
  await sendState();
  await maybeStart();
}

async function maybeStart(){
  if(starting||remoteTransportMismatch||!localReady||!remoteReady||!tm||tm.status!=='pending')return;
  if(me!==tm.player1_id)return;
  starting=true;
  $('readyBtn').disabled=true;
  $('starterChoice').disabled=true;
  $('roomMessage').textContent=starterChoice==='random'?'Begge er klare. Gjør klart myntkast…':`Begge er klare. Starter kampen – ${starterText()} begynner…`;
  const useCoinFlip=starterChoice==='random';
  const {data,error}=await db.rpc('start_tournament_match',{
    p_tournament_match_id:tournamentMatchId,
    p_starter_id:useCoinFlip?null:starterChoice
  });
  if(error){
    console.error(error);
    starting=false;
    setReadyUi();
    $('starterChoice').disabled=false;
    $('roomMessage').textContent=`Kunne ikke starte kampen: ${error.message}`;
    return;
  }
  const liveMatchId=data;

  if(useCoinFlip){
    try{
      const match=await loadLiveMatch(liveMatchId);
      const starterId=match.match_starter_id||match.turn_player_id;
      if(!starterId)throw new Error('Fant ikke vinner av myntkastet.');
      const payload={
        from:me,
        liveMatchId,
        player1Id:match.player1_id,
        player2Id:match.player2_id,
        player1Name:names[match.player1_id]||'Spiller 1',
        player2Name:names[match.player2_id]||'Spiller 2',
        starterId
      };
      await channel.send({type:'broadcast',event:'coin-flip-start',payload});
      await playTournamentCoinFlip(payload);
      return;
    }catch(e){
      console.error('Tournament coin flip failed',e);
      goToMatch(liveMatchId);
      return;
    }
  }

  await channel.send({type:'broadcast',event:'match-start',payload:{from:me,liveMatchId}});
  goToMatch(liveMatchId);
}

async function toggleRemoteAudio(){
  const v=$('remoteVideo'),b=$('remoteAudioBtn');
  v.muted=!v.muted;
  b.textContent=v.muted?'Slå på lyd':'Slå av lyd';
  try{await v.play();}catch{v.muted=true;b.textContent='Slå på lyd';}
}

function cleanup(){
  if(channel&&me&&!starting){
    try{channel.send({type:'broadcast',event:'room-leave',payload:{from:me,instanceId:roomInstanceId}}).catch?.(()=>{})}catch{}
  }
  localReady=false;
  remoteReady=false;
  clearInterval(heartbeat);
  heartbeat=null;
  clearInterval(remoteVideoWatchdog);
  remoteVideoWatchdog=null;
  clearTimeout(roomRetryTimer);
  roomRetryTimer=null;
  roomConnected=false;
  clearTimeout(coinFlipFallback);
  coinFlipFallback=null;
  try{sfu?.close();}catch{}
  sfu=null;
  stream?.getTracks().forEach(t=>t.stop());
  stream=null;
  if(channel){try{db.removeChannel(channel);}catch{}}
  channel=null;
}
window.addEventListener('pagehide',cleanup);
boot().catch(e=>{console.error(e);$('roomMessage').textContent=e.message||'Kunne ikke åpne venterommet.';});
