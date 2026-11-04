const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK',db=window.DartArenaSupabaseClient||(window.DartArenaSupabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)),$=id=>document.getElementById(id);
const challengeId=new URLSearchParams(location.search).get('id');
let profile,c,other,names={},channel,stream,pc,pendingProposal=null,leaving=false,localReady=false,remoteReady=false,matchMode='legs';
let pendingCandidates=[],reconnectTimer=null,remoteStream=null,helloTimer=null,offerBusy=false;
let roomPictureSession=null;
const ICE={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']}]};
window.DartArenaChallengeRoomState=Object.freeze({
  client:()=>db,
  user:()=>profile?.id||null,
  challengeId:()=>challengeId,
  stream:()=>stream,
  pictureSession:()=>roomPictureSession,
  remoteStream:()=>remoteStream,
  isConnected:()=>!!(pc?.connectionState==='connected'),
  takeMediaOwnership:()=>{
    const zoomSession=window.DartArenaRoomZoomSession||null;
    const ownership={pictureSession:zoomSession?null:(window.DartArenaRoomPictureSession||roomPictureSession||null),zoomSession};
    roomPictureSession=null;
    window.DartArenaRoomPictureSession=null;
    window.DartArenaRoomZoomSession=null;
    return ownership;
  },
  releaseForHandoff:()=>{
    clearInterval(helloTimer);
    helloTimer=null;
    clearTimeout(reconnectTimer);
    reconnectTimer=null;
    localReady=false;
    // Close the old RTCPeerConnection without resetting the video nodes
    // and without stopping tracks, now owned by match.js.
    if(pc){
      pc.ontrack=pc.onicecandidate=pc.onconnectionstatechange=pc.oniceconnectionstatechange=null;
      try{pc.close()}catch{}
      pc=null;
    }
    try{window.DartArenaRoomMedia?.stop?.()}catch(error){console.warn(error)}
    if(channel){try{db.removeChannel(channel)}catch{}channel=null}
    stream=null;
  }
});
const isOfferer=()=>profile?.id===c?.challenger_id;
const setStatus=t=>{$('cameraStatus').textContent=t};
const selectedGame=()=>$('roomGame')?.value||'501';
const isSpecialGame=()=>['chicago','cricket','half_it','half_it_standard','sixty_one','jdc'].includes(selectedGame());
// X01 game values share one engine and one eventual seamless media handoff.
const SEAMLESS_X01_GAMES=Object.freeze(['170','301','501','1001']);
const isSeamlessX01=(raw,variant)=>SEAMLESS_X01_GAMES.includes(String(raw||''))&&(!variant||variant==='x01');
window.DartArenaChallengeX01=Object.freeze({games:SEAMLESS_X01_GAMES,isSupported:isSeamlessX01});
const pageForVariant=v=>v==='cricket'?'cricket.html':v==='half_it'?'half-it.html':v==='sixty_one'?'61-match.html':v==='jdc'?'jdc-match.html':'match.html';
// Reloading room.html during a running match must reopen that match directly.
// Challenge rows become 'accepted' at start; never treat that as an invalid room.
async function resumeAcceptedChallenge(challenge){
  if(challenge.status!=='accepted')return false;
  const key='dartarena-challenge-match:'+challengeId;
  const players=[challenge.challenger_id,challenge.challenged_id];
  const validMatch=m=>m&&['playing','live'].includes(m.status)&&
    players.includes(m.player1_id)&&players.includes(m.player2_id)&&
    m.player1_id!==m.player2_id;
  let active=null;
  try{
    const savedId=sessionStorage.getItem(key);
    if(savedId&&/^[0-9a-f-]{36}$/i.test(savedId)){
      const {data,error}=await db.from('matches')
        .select('id,player1_id,player2_id,status,game_variant,created_at')
        .eq('id',savedId).maybeSingle();
      if(!error&&validMatch(data)&&Date.parse(data.created_at)>=Date.parse(challenge.created_at))active=data;
    }
  }catch(error){console.debug('[room resume] Stored match unavailable',error)}
  // Compatibility with matches already under way before the mapping was saved.
  // Only resume an unambiguously identified active match for these two players,
  // created shortly after this challenge (never guess among multiple matches).
  if(!active){
    const start=Date.parse(challenge.created_at);
    if(Number.isFinite(start)){
      const {data,error}=await db.from('matches')
        .select('id,player1_id,player2_id,status,game_variant,created_at')
        .in('player1_id',players).in('player2_id',players)
        .in('status',['playing','live'])
        .gte('created_at',new Date(start).toISOString())
        .lte('created_at',new Date(start+24*60*60*1000).toISOString())
        .order('created_at',{ascending:false}).limit(20);
      if(error)console.warn('[room resume] Match lookup failed',error);
      const possible=(data||[]).filter(validMatch);
      if(possible.length===1)active=possible[0];
      else if(possible.length>1)console.warn('[room resume] Ambiguous active matches: not redirecting');
    }
  }
  if(!active)return false;
  try{sessionStorage.setItem(key,active.id)}catch{}
  window.DartArenaMediaTrace?.mark('ROOM_RELOAD_REJOIN',{matchId:active.id.slice(0,8)});
  location.replace(pageForVariant(active.game_variant)+'?id='+encodeURIComponent(active.id));
  return true;
}

function setMatchMode(mode){const special=isSpecialGame();matchMode=special?'legs':mode==='sets'?'sets':'legs';$('legsModeBtn').classList.toggle('active',matchMode==='legs');$('setsModeBtn').classList.toggle('active',matchMode==='sets');$('setsField').classList.toggle('hidden',matchMode!=='sets')}
function syncGameMode(){const g=selectedGame(),special=isSpecialGame(),chicago=g==='chicago',half=g==='half_it'||g==='half_it_standard',sixty=g==='sixty_one',jdc=g==='jdc';$('setsModeBtn').disabled=special;$('legsModeBtn').disabled=half||jdc||chicago;$('legsField').classList.toggle('hidden',half||jdc||chicago);$('sixtyOneTimeField').classList.toggle('hidden',!sixty);if(half||jdc)$('roomLegs').value='1';if(chicago)$('roomLegs').value='3';if(special)setMatchMode('legs')}
$('legsModeBtn').onclick=()=>setMatchMode('legs');$('setsModeBtn').onclick=()=>setMatchMode('sets');$('roomGame').onchange=syncGameMode;setMatchMode('legs');syncGameMode();
(async()=>{const{data:{session}}=await db.auth.getSession();if(!session||!challengeId)return location.replace('./');({data:profile}=await db.from('profiles').select('*').eq('id',session.user.id).single());const{data,error}=await db.from('challenges').select('*').eq('id',challengeId).single();c=data;if(error||!c||![c.challenger_id,c.challenged_id].includes(profile.id))return location.replace('./');if(c.status==='accepted'){if(await resumeAcceptedChallenge(c))return;return location.replace('./')}if(c.status!=='room')return location.replace('./');other=profile.id===c.challenger_id?c.challenged_id:c.challenger_id;const{data:p}=await db.from('profiles').select('id,username').in('id',[profile.id,other]);names=Object.fromEntries((p||[]).map(x=>[x.id,x.username]));$('roomTitle').textContent=`${names[profile.id]||'Spiller'} vs ${names[other]||'Spiller'}`;$('localVideoName').textContent=names[profile.id]||'Spiller';$('remoteVideoName').textContent=names[other]||'Spiller';setupChannel()})();
function setupChannel(){channel=db.channel('room-'+challengeId).on('broadcast',{event:'ready'},async({payload})=>{if(payload.from!==other)return;remoteReady=true;await connectIfReady()}).on('broadcast',{event:'signal'},async({payload})=>{if(payload.from!==other)return;remoteReady=true;await handleSignal(payload)}).on('broadcast',{event:'proposal'},({payload})=>{if(payload.from!==profile.id)showProposal(payload)}).on('broadcast',{event:'proposal-rejected'},({payload})=>{if(payload.from!==profile.id)$('roomMessage').textContent='Motstanderen avslo kampforslaget.'}).on('broadcast',{event:'room-cancelled'},({payload})=>{if(payload.from!==profile.id)closeRoomTab('Motstanderen avsluttet venterommet.')}).on('broadcast',{event:'match-start'},({payload})=>{if(!payload.matchId)return;try{sessionStorage.setItem('dartarena-challenge-match:'+challengeId,payload.matchId)}catch{}window.DartArenaChallengeStart?.open?.(payload.matchId,payload.gameVariant,{startAt:payload.startAt})|| (location.href=`${pageForVariant(payload.gameVariant)}?id=${encodeURIComponent(payload.matchId)}`)}).subscribe(async s=>{if(s==='SUBSCRIBED'){await startCamera();startHandshake()}})}
function startHandshake(){clearInterval(helloTimer);helloTimer=setInterval(async()=>{if(!localReady||leaving)return;await send('ready');if(remoteReady&&(!pc||['failed','closed'].includes(pc.connectionState)))await restartPeer()},1500)}
function cameraErrorText(e){if(e?.name==='NotAllowedError')return'Kamera/mikrofon er blokkert i nettleseren.';if(e?.name==='NotFoundError')return'Fant ikke kamera eller mikrofon.';if(e?.name==='NotReadableError')return'Kameraet kan være i bruk av et annet program.';return'Kamera kunne ikke startes.'}
async function startCamera(){const retry=$('retryCameraBtn');retry.classList.add('hidden');if(stream){await send('ready');return connectIfReady()}setStatus('Starter kamera…');try{stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});try{roomPictureSession=window.DartArenaCameraPicture?.createStream(stream)||null;
window.DartArenaRoomPictureSession=roomPictureSession;
if(roomPictureSession)stream=roomPictureSession.stream;
}catch(error){console.warn('Bildejustering ikke tilgjengelig, sender originalvideo',error)}
const v=$('localVideo');v.srcObject=stream;await v.play().catch(()=>{});$('localPlaceholder').classList.add('hidden');localReady=true;setStatus('Kamera klart – venter på motstander…');await send('ready');await connectIfReady()}catch(e){localReady=false;$('localPlaceholder').classList.remove('hidden');$('localPlaceholder').textContent='Kamera ikke startet';setStatus(cameraErrorText(e));retry.classList.remove('hidden')}}$('retryCameraBtn').onclick=startCamera;
function destroyPeer(){clearTimeout(reconnectTimer);reconnectTimer=null;pendingCandidates=[];offerBusy=false;if(pc){pc.ontrack=pc.onicecandidate=pc.onconnectionstatechange=pc.oniceconnectionstatechange=null;try{pc.close()}catch{}}pc=null;remoteStream=null;const v=$('remoteVideo');if(v){v.pause();v.srcObject=null}$('remotePlaceholder').classList.remove('hidden');$('remoteAudioBtn').classList.add('hidden')}
function createPeer(){if(pc)return pc;const p=new RTCPeerConnection(ICE);pc=p;remoteStream=new MediaStream();for(const track of stream.getTracks())p.addTrack(track,stream);p.onicecandidate=e=>{if(p===pc&&e.candidate)send('signal',{candidate:e.candidate})};p.ontrack=e=>{if(p!==pc)return;const tracks=e.streams?.[0]?.getTracks()||[e.track];for(const track of tracks){if(!remoteStream.getTracks().some(t=>t.id===track.id))remoteStream.addTrack(track);track.onunmute=()=>showRemote();track.onended=()=>scheduleReconnect(1000)}showRemote()};p.onconnectionstatechange=()=>{if(p!==pc)return;const s=p.connectionState;if(s==='connected'){clearTimeout(reconnectTimer);setStatus(`Tilkoblet ${names[other]||'motstander'}`);showRemote()}else if(s==='failed')scheduleReconnect(500);else if(s==='disconnected')scheduleReconnect(8000)};p.oniceconnectionstatechange=()=>{if(p!==pc)return;if(p.iceConnectionState==='failed')scheduleReconnect(500)};return p}
async function showRemote(){const v=$('remoteVideo');if(!remoteStream||!remoteStream.getTracks().length)return;v.srcObject=remoteStream;v.muted=true;v.playsInline=true;try{await v.play()}catch{}const live=remoteStream.getVideoTracks().some(t=>t.readyState==='live');if(live){$('remotePlaceholder').classList.add('hidden');$('remoteAudioBtn').classList.remove('hidden')}}
function waitForIce(p,timeout=3000){if(p.iceGatheringState==='complete')return Promise.resolve();return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;p.removeEventListener('icegatheringstatechange',check);resolve()};const check=()=>{if(p.iceGatheringState==='complete')finish()};p.addEventListener('icegatheringstatechange',check);setTimeout(finish,timeout)})}
async function connectIfReady(){if(!localReady||!remoteReady||!stream||!isOfferer()||offerBusy)return;const p=createPeer();if(p.connectionState==='connected'||p.signalingState!=='stable')return;offerBusy=true;try{const offer=await p.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:true});await p.setLocalDescription(offer);await waitForIce(p);await send('signal',{description:p.localDescription})}catch{scheduleReconnect(1200)}finally{offerBusy=false}}
async function handleSignal(s){if(!localReady||!stream)return;const p=createPeer();try{if(s.description?.type==='offer'){if(isOfferer())return;if(p.signalingState!=='stable'){await restartPeer(false);return handleSignal(s)}await p.setRemoteDescription(s.description);await flushCandidates(p);const answer=await p.createAnswer();await p.setLocalDescription(answer);await waitForIce(p);await send('signal',{description:p.localDescription})}else if(s.description?.type==='answer'){if(!isOfferer()||p.signalingState!=='have-local-offer')return;await p.setRemoteDescription(s.description);await flushCandidates(p)}else if(s.candidate){if(p.remoteDescription)await p.addIceCandidate(s.candidate).catch(()=>{});else pendingCandidates.push(s.candidate)}}catch{scheduleReconnect(1200)}}
async function flushCandidates(p){while(pendingCandidates.length&&p===pc){await p.addIceCandidate(pendingCandidates.shift()).catch(()=>{})}}
function scheduleReconnect(ms){if(leaving||reconnectTimer)return;reconnectTimer=setTimeout(async()=>{reconnectTimer=null;if(!pc||pc.connectionState!=='connected')await restartPeer()},ms)}async function restartPeer(start=true){destroyPeer();setStatus('Kobler video til på nytt…');await new Promise(r=>setTimeout(r,300));if(start&&localReady&&remoteReady)await connectIfReady()}
$('remoteAudioBtn').onclick=async()=>{const v=$('remoteVideo'),b=$('remoteAudioBtn');v.muted=!v.muted;b.textContent=v.muted?'Slå på lyd':'Slå av lyd';try{await v.play()}catch{v.muted=true;b.textContent='Slå på lyd'}};async function send(event,payload={}){if(channel)await channel.send({type:'broadcast',event,payload:{...payload,from:profile.id}})}
function showProposal(p){
  const raw=String(p.game||''),chicago=!!p.isChicago||raw==='chicago'||String(p.gameConfig?.chicago??'false').toLowerCase()==='true',
    variant=chicago?'x01':p.gameVariant==='jdc'||raw==='jdc'?'jdc':p.gameVariant==='sixty_one'||raw==='sixty_one'?'sixty_one':p.gameVariant==='half_it'||raw==='half_it'||raw==='half_it_standard'?'half_it':p.gameVariant==='cricket'||raw==='cricket'?'cricket':'x01',
    special=variant!=='x01'||chicago,half=variant==='half_it',sixty=variant==='sixty_one',jdc=variant==='jdc',
    durationMinutes=sixty&&[10,20,30,45,60].includes(Number(p.durationMinutes))?Number(p.durationMinutes):10;
  pendingProposal={...p,isChicago:chicago,gameVariant:variant,mode:special?'legs':p.mode||'legs',sets:special?1:Number(p.sets)||1,legs:chicago?3:jdc?1:half?1:Number(p.legs)||1,durationMinutes,isWarmup:!!p.isWarmup};
  const who=p.starter==='random'?'Tilfeldig':p.starter===profile.id?'Du starter':`${names[other]} starter`;
  const label=chicago?'Chicago Style':jdc?'JDC Challenge':sixty?'61':half?'Half-It':variant==='cricket'?'Cricket':p.game;
  const format=chicago?`${label} • 301 DI/DO → Cricket → 501 DO`:jdc?`${label} • 57 piler hver`:half?`${label} • 12 runder`:sixty?`${label} • Best of ${pendingProposal.legs} legs • ${durationMinutes} min/leg`:pendingProposal.mode==='sets'?`${label} • Best of ${pendingProposal.sets} sets • Best of ${pendingProposal.legs} legs`:`${label} • Best of ${pendingProposal.legs} legs`;
  $('proposalTitle').textContent=(pendingProposal.isWarmup?'OPPVARMING • ':'')+format;
  $('proposalText').textContent=pendingProposal.isWarmup?`${who}. Oppvarmingskampen teller ikke på AVG, form, historikk, Top 10 eller ranking. Godta for å starte.`:`${who}. Godta for å starte kampen.`;
  $('proposalActions').classList.remove('hidden')
}
function cleanup(){clearInterval(helloTimer);helloTimer=null;localReady=false;stream?.getTracks().forEach(t=>t.stop());roomPictureSession?.stop();roomPictureSession?.sourceTrack?.stop();roomPictureSession=null;window.DartArenaRoomPictureSession=null;stream=null;destroyPeer()}
function closeRoomTab(message=''){cleanup();let hasOpener=false;try{hasOpener=!!window.opener&&!window.opener.closed;if(hasOpener)window.opener.postMessage({type:'dartarena-room-cancelled',id:challengeId,message},location.origin)}catch{}location.replace('./')}
$('leaveRoomBtn').onclick=async()=>{if(leaving)return;leaving=true;const b=$('leaveRoomBtn');b.disabled=true;b.textContent='Avslutter…';await send('room-cancelled').catch(()=>{});const{error}=await db.from('challenges').update({status:'cancelled'}).eq('id',challengeId).eq('status','room');if(error){b.disabled=false;b.textContent='Avbryt venterom';leaving=false;$('roomMessage').textContent='Kunne ikke avslutte venterommet: '+error.message;return}closeRoomTab()};window.addEventListener('beforeunload',cleanup);
