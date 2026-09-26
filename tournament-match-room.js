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

function setStatus(text){$('cameraStatus').textContent=text;}
function setReadyUi(){
  $('localReadyDot').classList.toggle('on',localReady);
  $('remoteReadyDot').classList.toggle('on',remoteReady);
  $('localReadyText').textContent=localReady?'Klar':'Ikke klar';
  $('remoteReadyText').textContent=remoteReady?'Klar':'Ikke klar';
  $('readyBtn').textContent=localReady?'Ikke klar':'Jeg er klar';
}
function cameraErrorText(e){
  if(e?.name==='NotAllowedError')return'Kamera/mikrofon er blokkert i nettleseren.';
  if(e?.name==='NotFoundError')return'Fant ikke kamera eller mikrofon.';
  if(e?.name==='NotReadableError')return'Kameraet kan være i bruk av et annet program.';
  return e?.message||'Kamera kunne ikke startes.';
}
function matchUrl(liveId){return `match.html?id=${encodeURIComponent(liveId)}&tournamentMatch=${encodeURIComponent(tournamentMatchId)}`;}
function goToMatch(liveId){cleanup();location.href=matchUrl(liveId);}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||!tournamentMatchId){location.replace('./');return;}
  me=session.user.id;

  const {data,error}=await db.from('tournament_matches').select('*').eq('id',tournamentMatchId).single();
  if(error||!data){location.replace('./');return;}
  tm=data;

  if(![tm.player1_id,tm.player2_id].includes(me)){
    location.replace(`tournament-match-viewer.html?id=${encodeURIComponent(tournamentMatchId)}`);
    return;
  }

  if(tm.status==='live'&&tm.live_match_id){goToMatch(tm.live_match_id);return;}
  if(['finished','wo'].includes(tm.status)){
    location.replace(`tournament-match-viewer.html?id=${encodeURIComponent(tournamentMatchId)}`);
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

  $('backBtn').onclick=()=>history.length>1?history.back():location.href='./';
  $('readyBtn').onclick=toggleReady;
  $('retryCameraBtn').onclick=startCamera;
  $('remoteAudioBtn').onclick=toggleRemoteAudio;

  setupChannel();
}

function setupChannel(){
  channel=db.channel(`tournament-room-${tournamentMatchId}`)
    .on('broadcast',{event:'state'},async({payload})=>{
      if(payload.from!==other)return;
      remoteReady=!!payload.ready;
      setReadyUi();
      if(payload.publication?.sessionId){
        remotePublication=payload.publication;
        await subscribeRemote(remotePublication);
      }
      await maybeStart();
    })
    .on('broadcast',{event:'match-start'},({payload})=>{
      if(payload.liveMatchId)goToMatch(payload.liveMatchId);
    })
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'tournament_matches',filter:`id=eq.${tournamentMatchId}`},payload=>{
      tm=payload.new;
      if(tm.status==='live'&&tm.live_match_id)goToMatch(tm.live_match_id);
    })
    .subscribe(async status=>{
      if(status!=='SUBSCRIBED')return;
      await startCamera();
      clearInterval(heartbeat);
      heartbeat=setInterval(sendState,1800);
      await sendState();
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
    sfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
    publication=await sfu.publish(stream);
    $('readyBtn').disabled=false;
    setStatus('Kamera klart – venter på motstander');
    await sendState();
    if(remotePublication)await subscribeRemote(remotePublication);
  }catch(e){
    console.error('Tournament room camera error',e);
    publication=null;
    $('readyBtn').disabled=true;
    $('localPlaceholder').classList.remove('hidden');
    $('localPlaceholder').textContent='Kamera ikke startet';
    setStatus(cameraErrorText(e));
    $('retryCameraBtn').classList.remove('hidden');
  }
}

async function subscribeRemote(pub){
  if(!pub?.sessionId||!Array.isArray(pub.tracks)||!sfu)return;
  if(subscribedPublicationId===pub.sessionId)return;
  subscribedPublicationId=pub.sessionId;
  setStatus(`Kobler til ${names[other]||'motstander'}…`);
  try{
    await sfu.subscribe(pub,async e=>{
      const v=$('remoteVideo');
      let rs=v.srcObject;
      if(!(rs instanceof MediaStream)){rs=new MediaStream();v.srcObject=rs;}
      const tracks=e.streams?.[0]?.getTracks()||[e.track];
      for(const track of tracks){
        if(!rs.getTracks().some(t=>t.id===track.id))rs.addTrack(track);
      }
      v.muted=true;
      v.playsInline=true;
      await v.play().catch(()=>{});
      if(rs.getVideoTracks().some(t=>t.readyState==='live')){
        $('remotePlaceholder').classList.add('hidden');
        $('remoteAudioBtn').classList.remove('hidden');
        setStatus(`Tilkoblet ${names[other]||'motstander'} via Cloudflare`);
      }
    });
  }catch(e){
    console.error('Tournament room subscribe error',e);
    subscribedPublicationId=null;
    setStatus('Kunne ikke koble til motstanderens video. Prøver igjen…');
  }
}

async function sendState(){
  if(!channel)return;
  await channel.send({
    type:'broadcast',
    event:'state',
    payload:{from:me,ready:localReady,publication}
  });
}

async function toggleReady(){
  if(!publication)return;
  localReady=!localReady;
  setReadyUi();
  $('roomMessage').textContent=localReady?'Du er klar. Venter på motstanderen.':'';
  await sendState();
  await maybeStart();
}

async function maybeStart(){
  if(starting||!localReady||!remoteReady||!tm||tm.status!=='pending')return;
  if(me!==tm.player1_id)return;
  starting=true;
  $('readyBtn').disabled=true;
  $('roomMessage').textContent='Begge er klare. Starter kampen…';
  const {data,error}=await db.rpc('start_tournament_match',{p_tournament_match_id:tournamentMatchId});
  if(error){
    console.error(error);
    starting=false;
    $('readyBtn').disabled=false;
    $('roomMessage').textContent=`Kunne ikke starte kampen: ${error.message}`;
    return;
  }
  const liveMatchId=data;
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
  clearInterval(heartbeat);
  heartbeat=null;
  try{sfu?.close();}catch{}
  sfu=null;
  stream?.getTracks().forEach(t=>t.stop());
  stream=null;
  if(channel){try{db.removeChannel(channel);}catch{}}
  channel=null;
}
window.addEventListener('pagehide',cleanup);
boot().catch(e=>{console.error(e);$('roomMessage').textContent=e.message||'Kunne ikke åpne venterommet.';});
