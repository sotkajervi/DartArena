/* Isolated Cricket scoring module for same-document handoff. */
(()=>{
'use strict';
const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK',db=window.DartArenaSupabaseClient||(window.DartArenaSupabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY)),$=id=>document.getElementById(id);
let matchId=null;
let profile,m,state,other,names={},channel,stream=null,pc=null,remoteStream=null;
let localReady=false,remoteReady=false,leaving=false,generation=1,lastSignal='START';
let pendingCandidates=[],readyTimer=null,reconnectTimer=null,statsTimer=null,rebuilding=false;
let lastVideoBytes=-1,videoStalls=0,selectedDarts=[],submitting=false;
const TARGETS=['20','19','18','17','16','15','B'];
const ICE={iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']}],iceCandidatePoolSize:10,bundlePolicy:'max-bundle'};
const isOfferer=()=>profile?.id===m?.player1_id;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function debug(extra=''){const e=$('webrtcDebug');if(!e)return;e.textContent=`VIDEO DEBUG • RT:${channel?'ON':'OFF'} | Local:${localReady?'YES':'NO'} | Remote:${remoteReady?'YES':'NO'} | Role:${isOfferer()?'OFFER':'ANSWER'} | Peer:${pc?.connectionState||'none'} | ICE:${pc?.iceConnectionState||'none'} | Signal:${pc?.signalingState||'none'} | Gen:${generation} | Last:${lastSignal}${extra?' | '+extra:''}`}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function markGlyph(n,visits=[],playerId='',target=''){return window.DartArenaCricketMarkHistory?.display(visits,playerId,target,n)??(Number(n)>=3?'◯':Number(n)===2?'×':Number(n)===1?'╱':'–')}
function emptyMarks(){return {'20':0,'19':0,'18':0,'17':0,'16':0,'15':0,'B':0}}
function labelDart(d){if(d.target==='MISS')return'MISS';const prefix=d.mult===1?'S':d.mult===2?'D':'T';return `${prefix}${d.target==='B'?'BULL':d.target}`}
async function loadState(){const{data,error}=await db.from('cricket_match_state').select('*').eq('match_id',matchId).maybeSingle();if(error)throw error;state=data||{match_id:matchId,player1_marks:emptyMarks(),player2_marks:emptyMarks()}}
function renderBoard(){
  if(!state)return;
  const board=$('cricketBoard'),a=state.player1_marks||emptyMarks(),b=state.player2_marks||emptyMarks();
  const visits=(window.DartArenaCricketVisitHistory?.()||[]).filter(v=>Number(v.leg_no)===Number(m?.current_leg));
  const myTurn=!!m&&m.status==='playing'&&m.turn_player_id===profile?.id;
  board.classList.toggle('my-turn-p1',myTurn&&profile?.id===m?.player1_id);
  board.classList.toggle('my-turn-p2',myTurn&&profile?.id===m?.player2_id);
  board.innerHTML=TARGETS.map(t=>{const am=Number(a[t]||0),bm=Number(b[t]||0),closed=am>=3&&bm>=3;return `<div class="cricket-row${closed?' both-closed':''}"><div class="cricket-mark${am>=3?' closed':''}">${markGlyph(am,visits,m.player1_id,t)}</div><div class="cricket-target">${t==='B'?'BULL':t}</div><div class="cricket-mark${bm>=3?' closed':''}">${markGlyph(bm,visits,m.player2_id,t)}</div></div>`}).join('')
}
function buildKeypad(){const host=$('cricketKeypad');const shortKey={20:'0',19:'9',18:'8',17:'7',16:'6',15:'5',B:'B'};host.innerHTML=TARGETS.map(t=>{if(t==='B')return `<div class="cricket-key-row bull"><div class="cricket-key-label">BULL <span class="da-key">${shortKey[t]}</span></div><button class="outline cricket-hit" data-target="B" data-mult="1">S</button><button class="outline cricket-hit" data-target="B" data-mult="2">D</button></div>`;return `<div class="cricket-key-row"><div class="cricket-key-label">${t} <span class="da-key">${shortKey[t]}</span></div><button class="outline cricket-hit" data-target="${t}" data-mult="1">S</button><button class="outline cricket-hit" data-target="${t}" data-mult="2">D</button><button class="outline cricket-hit" data-target="${t}" data-mult="3">T</button></div>`}).join('');host.querySelectorAll('.cricket-hit').forEach(b=>b.onclick=()=>addDart(b.dataset.target,Number(b.dataset.mult)))}
function addDart(target,mult){if(!canThrow()||selectedDarts.length>=3)return;selectedDarts.push({target,mult});renderEntry()}
function canThrow(){return !!m&&m.status==='playing'&&m.turn_player_id===profile?.id&&!submitting}
function renderEntry(){const host=$('cricketDarts');const items=selectedDarts.map(d=>`<span class="cricket-dart">${esc(labelDart(d))}</span>`);while(items.length<3)items.push('<span class="cricket-dart empty">–</span>');host.innerHTML=items.join('');const enabled=canThrow();document.querySelectorAll('.cricket-hit').forEach(b=>b.disabled=!enabled||selectedDarts.length>=3);$('cricketMissBtn').disabled=!enabled||selectedDarts.length>=3;$('cricketUndoBtn').disabled=!enabled||!selectedDarts.length;$('cricketSubmitBtn').disabled=!enabled||!selectedDarts.length}
function render(){if(!m)return;const chicago=String(m.game_config?.chicago??'false').toLowerCase()==='true';$('cricketName1').textContent=names[m.player1_id]||'Spiller 1';$('cricketName2').textContent=names[m.player2_id]||'Spiller 2';$('cricketPoints1').textContent=String(m.player1_score||0);$('cricketPoints2').textContent=String(m.player2_score||0);$('cricketLegs1').textContent=chicago?`${m.player1_legs||0} game${Number(m.player1_legs||0)===1?'':'s'}`:`${m.player1_legs||0} legs`;$('cricketLegs2').textContent=chicago?`${m.player2_legs||0} game${Number(m.player2_legs||0)===1?'':'s'}`:`${m.player2_legs||0} legs`;$('cricketP1').classList.toggle('active',m.turn_player_id===m.player1_id&&m.status==='playing');$('cricketP2').classList.toggle('active',m.turn_player_id===m.player2_id&&m.status==='playing');const mine=m.turn_player_id===profile?.id&&m.status==='playing';$('videoGrid')?.classList.toggle('opponent-throwing',m.status==='playing'&&!mine);$('turnText').textContent=m.status==='cancelled'?'Kampen er avbrutt.':m.status==='finished'?`${names[m.winner_id]||'Vinner'} vant kampen.`:mine?'Din tur':`${names[m.turn_player_id]||'Motstanderen'} kaster`;$('matchStatus').textContent=m.status==='playing'?'Pågår':m.status==='finished'?'Ferdig':'Avbrutt';$('cancelMatchBtn').classList.toggle('hidden',m.status!=='playing');renderBoard();renderEntry()}
async function refreshGame(){const[{data:mm,error:me}]=await Promise.all([db.from('matches').select('*').eq('id',matchId).single(),loadState()]);if(me)throw me;m=mm;render()}
async function submitVisit(){if(!canThrow()||!selectedDarts.length)return;submitting=true;renderEntry();$('matchMessage').textContent='Registrerer…';try{const darts=selectedDarts.map(d=>({...d}));const chicago=String(m.game_config?.chicago??'false').toLowerCase()==='true',rpc=chicago?'submit_chicago_cricket_visit':'submit_cricket_visit';const{data,error}=await db.rpc(rpc,{p_match_id:matchId,p_darts:darts});if(error)throw error;selectedDarts=[];await refreshGame();$('matchMessage').textContent=data?.leg_won?(m.status==='finished'?'Kampen er vunnet!':'Leg vunnet!'):(Number(data?.points_scored||0)>0?`+${data.points_scored} poeng`:'');if(m.status==='finished')await setPlayersUnavailable()}catch(error){$('matchMessage').textContent=String(error?.message||'Kunne ikke registrere kastet.').replace('It is not your turn','Det er ikke din tur.')}finally{submitting=false;renderEntry()}}
$('cricketMissBtn').onclick=()=>addDart('MISS',0);$('cricketUndoBtn').onclick=()=>{selectedDarts.pop();renderEntry()};$('cricketSubmitBtn').onclick=submitVisit;

async function bootCricketSeamless(liveId){matchId=liveId;const{data:{session}}=await db.auth.getSession();if(!session||!matchId)return location.replace('./');({data:profile}=await db.from('profiles').select('*').eq('id',session.user.id).single());const{data,error}=await db.from('matches').select('*').eq('id',matchId).single();m=data;if(error||!m||![m.player1_id,m.player2_id].includes(profile.id))return location.replace('./');if(m.game_variant!=='cricket')return location.replace(`match.html?id=${encodeURIComponent(matchId)}`);other=profile.id===m.player1_id?m.player2_id:m.player1_id;const{data:p}=await db.from('profiles').select('id,username').in('id',[m.player1_id,m.player2_id]);names=Object.fromEntries((p||[]).map(x=>[x.id,x.username]));$('localVideoName').textContent=names[profile.id]||'Spiller';$('remoteVideoName').textContent=names[other]||'Spiller';$('matchTitle').textContent=`${names[m.player1_id]||'Spiller 1'} vs ${names[m.player2_id]||'Spiller 2'}`;$('matchFormat').textContent=String(m.game_config?.chicago??'false').toLowerCase()==='true'?'CHICAGO STYLE • GAME 2/3 • CRICKET':`CRICKET • BEST OF ${m.legs}`;buildKeypad();await loadState();render();setupChannel()}

function setupChannel(){channel=db.channel('match-'+m.id)
.on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${m.id}`},async p=>{const oldLeg=m?.current_leg;m=p.new;if(oldLeg!==m.current_leg)selectedDarts=[];try{await loadState()}catch{}render();if(m.status!=='playing')await setPlayersUnavailable()})
.on('broadcast',{event:'ready'},async({payload})=>{if(payload.from!==other)return;remoteReady=true;lastSignal='READY received';debug();if(isOfferer())await connectIfReady()})
.on('broadcast',{event:'signal'},async({payload})=>{if(payload.from!==other)return;remoteReady=true;await handleSignal(payload)})
.on('broadcast',{event:'reconnect-request'},async({payload})=>{if(payload.from!==other||!isOfferer()||leaving)return;await rebuildAsOfferer('remote-request')})
.subscribe(async s=>{lastSignal=`RT ${s}`;debug();if(s==='SUBSCRIBED'){await startCamera();startReadyHeartbeat()}})}
function startReadyHeartbeat(){clearInterval(readyTimer);readyTimer=setInterval(()=>{if(!leaving&&localReady)send('ready',{generation})},2500)}
function cameraErrorText(e){if(e?.name==='NotAllowedError')return'Kamera/mikrofon er blokkert i nettleseren.';if(e?.name==='NotFoundError')return'Fant ikke kamera eller mikrofon.';if(e?.name==='NotReadableError')return'Kameraet kan være i bruk av et annet program.';return`Kamera kunne ikke startes${e?.name?' ('+e.name+')':''}.`}
let cricketZoomSession=null,cricketPictureSession=null;
function stopCricketZoom(){
  if(!cricketZoomSession)return;
  cricketZoomSession.stop();
  cricketZoomSession.sourceTrack?.stop();
  cricketZoomSession=null;
}
async function startCamera(){if(stream?.active){localReady=true;await send('ready',{generation});if(isOfferer())await connectIfReady();return}try{stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
const Z=window.DartArenaZoomCam;
if(Z?.selected(localStorage)){
  const config=Z.loadConfig(localStorage);
  if(config){try{cricketZoomSession=Z.create(stream,config);stream=cricketZoomSession.stream}
    catch(error){console.warn('Cricket Zoomcam unavailable, using regular camera',error);stopCricketZoom()}}
}
if(!cricketZoomSession){
  try{cricketPictureSession=window.DartArenaCameraPicture?.createStream(stream)||null;
    if(cricketPictureSession)stream=cricketPictureSession.stream;
  }catch(error){console.warn('Cricket-bildejustering ikke tilgjengelig',error)}
}
const v=$('localVideo');v.srcObject=stream;v.muted=true;await v.play().catch(()=>{});$('localPlaceholder').classList.add('hidden');$('cameraBtn').textContent='Stopp kamera';localReady=true;lastSignal='CAMERA ready';debug();await send('ready',{generation});if(isOfferer())await connectIfReady()}catch(e){localReady=false;$('localPlaceholder').classList.remove('hidden');$('localPlaceholder').textContent=cameraErrorText(e);$('matchMessage').textContent=cameraErrorText(e);lastSignal=`CAMERA ${e?.name||'error'}`;debug()}}
function showRemotePlaceholder(text){const p=$('remotePlaceholder');if(p){p.textContent=text;p.classList.remove('hidden')}}
function hideRemotePlaceholder(){$('remotePlaceholder')?.classList.add('hidden')}
function clearPeer(){clearTimeout(reconnectTimer);reconnectTimer=null;clearInterval(statsTimer);statsTimer=null;pendingCandidates=[];lastVideoBytes=-1;videoStalls=0;if(pc){pc.ontrack=pc.onicecandidate=pc.onconnectionstatechange=pc.oniceconnectionstatechange=null;try{pc.close()}catch{}}pc=null;remoteStream=null;const v=$('remoteVideo');if(v){v.pause?.();v.srcObject=null}showRemotePlaceholder('Kobler til video…')}
function attachRemoteTrack(e,myGen,p){if(p!==pc||myGen!==generation)return;if(!remoteStream)remoteStream=new MediaStream();const t=e.track;if(!remoteStream.getTracks().some(x=>x.id===t.id))remoteStream.addTrack(t);const v=$('remoteVideo');v.srcObject=remoteStream;lastSignal=`TRACK ${t.kind}`;if(t.kind==='video'){const play=async()=>{if(p!==pc||myGen!==generation)return;try{v.muted=true;await v.play();hideRemotePlaceholder()}catch{showRemotePlaceholder('Klikk i siden for å starte video')}};t.onunmute=play;t.onended=()=>requestRecovery('remote-track-ended');v.onloadedmetadata=play;v.oncanplay=play;play()}debug()}
function createPeer(){if(pc||!stream?.active)return pc;const myGen=generation,p=new RTCPeerConnection(ICE);pc=p;remoteStream=new MediaStream();$('remoteVideo').srcObject=remoteStream;for(const t of stream.getTracks())p.addTrack(t,stream);p.ontrack=e=>attachRemoteTrack(e,myGen,p);p.onicecandidate=e=>{if(p!==pc||myGen!==generation||!e.candidate)return;send('signal',{candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate,generation:myGen});lastSignal='ICE sent';debug()};p.oniceconnectionstatechange=()=>{if(p!==pc)return;lastSignal=`ICE ${p.iceConnectionState}`;debug();if(p.iceConnectionState==='failed')requestRecovery('ice-failed')};p.onconnectionstatechange=()=>{if(p!==pc)return;lastSignal=`PEER ${p.connectionState}`;debug();if(p.connectionState==='connected'){clearTimeout(reconnectTimer);reconnectTimer=null;startStatsWatch(p,myGen)}else if(p.connectionState==='disconnected')scheduleRecovery(5000,'peer-disconnected');else if(p.connectionState==='failed')requestRecovery('peer-failed')};return p}
async function connectIfReady(){if(leaving||rebuilding||!isOfferer()||!localReady||!remoteReady||!stream?.active)return;const p=createPeer();if(!p||p.signalingState!=='stable'||p.localDescription)return;try{const offer=await p.createOffer();if(p!==pc)return;await p.setLocalDescription(offer);lastSignal='OFFER sent';debug();await send('signal',{description:p.localDescription.toJSON?p.localDescription.toJSON():p.localDescription,generation})}catch(e){lastSignal=`OFFER ${e?.name||'error'}`;debug();scheduleRecovery(1200,'offer-error')}}
async function handleSignal(s){if(leaving||!localReady||!stream?.active)return;const sg=Number(s.generation)||1;if(sg<generation)return;if(s.description?.type==='offer'){if(isOfferer())return;if(sg>generation||pc){generation=sg;clearPeer()}const p=createPeer();if(!p)return;try{await p.setRemoteDescription(s.description);await flushCandidates(p);const answer=await p.createAnswer();if(p!==pc)return;await p.setLocalDescription(answer);lastSignal='ANSWER sent';debug();await send('signal',{description:p.localDescription.toJSON?p.localDescription.toJSON():p.localDescription,generation})}catch(e){lastSignal=`ANSWER ${e?.name||'error'}`;debug();requestRecovery('answer-error')}return}if(sg>generation){generation=sg;clearPeer()}const p=createPeer();if(!p)return;try{if(s.description?.type==='answer'){if(!isOfferer()||p.signalingState!=='have-local-offer')return;await p.setRemoteDescription(s.description);await flushCandidates(p);lastSignal='ANSWER set';debug()}else if(s.candidate){if(p.remoteDescription)await p.addIceCandidate(s.candidate);else pendingCandidates.push(s.candidate);lastSignal=p.remoteDescription?'ICE added':'ICE queued';debug()}}catch(e){lastSignal=`SIGNAL ${e?.name||'error'}`;debug();requestRecovery('signal-error')}}
async function flushCandidates(p){while(pendingCandidates.length&&p===pc&&p.remoteDescription){try{await p.addIceCandidate(pendingCandidates.shift())}catch{}}}
function startStatsWatch(p,myGen){clearInterval(statsTimer);lastVideoBytes=-1;videoStalls=0;statsTimer=setInterval(async()=>{if(leaving||p!==pc||myGen!==generation||p.connectionState!=='connected')return;try{const stats=await p.getStats();let bytes=0,frames=0,found=false;stats.forEach(r=>{if(r.type==='inbound-rtp'&&r.kind==='video'&&!r.isRemote){found=true;bytes+=Number(r.bytesReceived||0);frames+=Number(r.framesDecoded||0)}});if(!found)return;if(bytes>lastVideoBytes){lastVideoBytes=bytes;videoStalls=0;lastSignal=`VIDEO ${Math.round(bytes/1024)}KB/${frames}f`;hideRemotePlaceholder();debug()}else if(lastVideoBytes>=0){videoStalls++;lastSignal=`VIDEO stall ${videoStalls}/8`;debug();if(videoStalls>=8)requestRecovery('video-stalled')}}catch{}},1000)}
function scheduleRecovery(ms,reason){if(leaving||rebuilding||reconnectTimer)return;reconnectTimer=setTimeout(()=>{reconnectTimer=null;requestRecovery(reason)},ms)}
async function requestRecovery(reason){if(leaving||rebuilding)return;if(isOfferer())return rebuildAsOfferer(reason);lastSignal=`RECOVERY request ${reason}`;debug();await send('reconnect-request',{reason,generation});showRemotePlaceholder('Gjenoppretter video…')}
async function rebuildAsOfferer(reason){if(leaving||rebuilding||!isOfferer())return;rebuilding=true;generation+=1;lastSignal=`REBUILD ${reason}`;debug();clearPeer();showRemotePlaceholder('Gjenoppretter video…');await sleep(300);rebuilding=false;await send('ready',{generation});await connectIfReady()}
async function send(event,payload={}){if(channel)await channel.send({type:'broadcast',event,payload:{...payload,from:profile.id}})}
$('cameraBtn').onclick=async()=>{if(!stream)return startCamera();localReady=false;stream.getTracks().forEach(t=>t.stop());stopCricketZoom();cricketPictureSession?.stop();cricketPictureSession?.sourceTrack?.stop();cricketPictureSession=null;stream=null;clearPeer();$('localVideo').srcObject=null;$('localPlaceholder').classList.remove('hidden');showRemotePlaceholder('Venter på motstanderens kamera…');$('cameraBtn').textContent='Start kamera';lastSignal='CAMERA stopped';debug()};
async function setPlayersUnavailable(){if(m)await db.from('profiles').update({status:'unavailable'}).in('id',[m.player1_id,m.player2_id])}
function closeMatchTab(){cleanup();location.replace('./')}
$('cancelMatchBtn').onclick=async()=>{if(!m||m.status!=='playing'||!confirm('Vil du avbryte kampen?'))return;const{error}=await db.from('matches').update({status:'cancelled',finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',m.id);if(error)return $('matchMessage').textContent='Kunne ikke avbryte: '+error.message;await setPlayersUnavailable();window.opener?.postMessage({type:'dartarena-match-ended',id:m.id},location.origin);closeMatchTab()};
$('closeMatchBtn').onclick=()=>{if(m?.status==='playing'&&!confirm('Kampen pågår fortsatt. Gå til hovedlobbyen?'))return;location.replace('./')};
function cleanup(){leaving=true;localReady=false;clearInterval(readyTimer);readyTimer=null;clearInterval(statsTimer);statsTimer=null;clearTimeout(reconnectTimer);reconnectTimer=null;stream?.getTracks().forEach(t=>t.stop());stopCricketZoom();cricketPictureSession?.stop();cricketPictureSession?.sourceTrack?.stop();cricketPictureSession=null;stream=null;clearPeer();if(channel)db.removeChannel(channel)}
window.addEventListener('beforeunload',cleanup);
// DartArena Cricket: keyboard-first mark entry, visit log and last-visit correction.
(()=>{
  let visits=[],editingVisitId=null,logChannel=null,ready=false;
  // The board uses the same logged visits as the correction panel.
  window.DartArenaCricketVisitHistory=()=>visits;
  const isChicago=()=>String(m?.game_config?.chicago??'false').toLowerCase()==='true';
  const TARGETS=['20','19','18','17','16','15','B'];
  const KEY_TARGETS={'0':'20','9':'19','8':'18','7':'17','6':'16','5':'15','b':'B'};
  const baseRender=render;

  const normalizeTarget=t=>{const x=String(t||'').toUpperCase();return x==='BULL'?'B':x};
  function aggregate(items=[]){
    const counts=Object.fromEntries(TARGETS.map(t=>[t,0]));let misses=0;
    for(const d of items){const target=normalizeTarget(d?.target);if(target==='MISS')misses++;else if(target in counts)counts[target]+=Math.max(1,Number(d?.mult)||1)}
    return{counts,misses};
  }
  function pack(items=[]){
    const{counts,misses}=aggregate(items),out=[];
    for(const target of TARGETS){let left=counts[target],max=target==='B'?2:3;while(left>0){const mult=Math.min(max,left);out.push({target,mult});left-=mult}}
    for(let i=0;i<misses;i++)out.push({target:'MISS',mult:0});
    if(out.length>3)throw new Error('Dette krever mer enn tre piler.');
    return out;
  }
  function expand(darts=[]){
    const out=[];
    for(const d of darts||[]){const target=normalizeTarget(d?.target),mult=Number(d?.mult)||0;if(target==='MISS'){out.push({target:'MISS',mult:0});continue}for(let i=0;i<mult;i++)out.push({target,mult:1})}
    return out;
  }
  function summary(items=[]){
    const{counts,misses}=aggregate(items),parts=[];
    for(const t of TARGETS)if(counts[t])parts.push(`${t==='B'?'Bull':t}×${counts[t]}`);
    if(misses)parts.push(`Miss×${misses}`);
    return parts.join(' · ')||'Ingen treff';
  }
  function mprFor(playerId){
    let marks=0,rounds=0;
    for(const visit of visits){
      if(visit.player_id!==playerId)continue;
      rounds++;
      for(const dart of Array.isArray(visit.darts)?visit.darts:[]){
        marks+=Math.max(0,Math.min(3,Number(dart?.mult)||0));
      }
    }
    return rounds?(marks/rounds).toFixed(2):'0.00';
  }
  function renderMpr(){
    if(!m)return;
    const p1=$('cricketMpr1'),p2=$('cricketMpr2');
    if(p1)p1.textContent=mprFor(m.player1_id);
    if(p2)p2.textContent=mprFor(m.player2_id);
  }
  function canInput(){return !submitting&&(editingVisitId!==null?!!m&&m.status==='playing':canThrow())}
  function canAdd(item){if(!canInput())return false;try{pack([...selectedDarts,item]);return true}catch{return false}}
  function addMark(target){
    const item={target:normalizeTarget(target),mult:1};
    if(!canAdd(item)){if(canInput())$('matchMessage').textContent='Dette krever mer enn tre piler.';return}
    selectedDarts.push(item);$('matchMessage').textContent='';renderEntry();
  }
  function addMiss(){
    const item={target:'MISS',mult:0};
    if(!canAdd(item)){if(canInput())$('matchMessage').textContent='Dette krever mer enn tre piler.';return}
    selectedDarts.push(item);$('matchMessage').textContent='';renderEntry();
  }

  renderEntry=function(){
    const host=$('cricketDarts'),enabled=canInput();if(!host)return;
    const bits=[];
    if(editingVisitId!==null)bits.push('<span class="cricket-dart editing">KORRIGERING</span>');
    const{counts,misses}=aggregate(selectedDarts);
    for(const t of TARGETS)if(counts[t])bits.push(`<span class="cricket-dart">${t==='B'?'Bull':t} × ${counts[t]}</span>`);
    if(misses)bits.push(`<span class="cricket-dart">Miss × ${misses}</span>`);
    if(selectedDarts.length){let used=0;try{used=pack(selectedDarts).length}catch{}bits.push(`<span class="cricket-dart buffer-meta">min. ${used} ${used===1?'pil':'piler'}</span>`)}
    else bits.push('<span class="cricket-dart empty">Tast 0, 9, 8, 7, 6, 5 eller B for treff</span>');
    host.innerHTML=bits.join('');
    $('cricketMissBtn').disabled=!enabled||!canAdd({target:'MISS',mult:0});
    $('cricketUndoBtn').disabled=!enabled||!selectedDarts.length;
    $('cricketSubmitBtn').disabled=!enabled||!selectedDarts.length;
    $('cricketSubmitBtn').textContent=editingVisitId!==null?'Lagre korrigering':'Registrer kast';
    $('cricketCancelEditBtn')?.classList.toggle('hidden',editingVisitId===null);
    if($('cricketEntryTitle'))$('cricketEntryTitle').textContent=editingVisitId!==null?'KORRIGER KAST':'DITT KAST';
  };

  async function loadVisits(){
    if(!m?.id)return;
    const{data,error}=await db.from('cricket_visits').select('id,match_id,player_id,leg_no,visit_no,darts,points_scored,created_at,corrected_at').eq('match_id',m.id).order('id',{ascending:true});
    if(error){console.warn('Cricket visit log:',error.message);return}
    visits=data||[];
    // Refresh symbols after the async log query (including corrected visits).
    if(typeof renderBoard==='function')renderBoard();
  }
  function latestActive(){const rows=visits.filter(v=>Number(v.leg_no)===Number(m?.current_leg));return rows.at(-1)||null}
  function renderLog(){
    renderMpr();
    const host=$('cricketVisitLog');if(!host)return;
    if(!visits.length){host.innerHTML='<div class="cricket-history-empty">Ingen kast registrert ennå.</div>';return}
    const latest=latestActive();
    host.innerHTML=[...visits].reverse().map(v=>{
      const editable=!isChicago()&&m?.status==='playing'&&latest?.id===v.id&&v.player_id===profile?.id&&Number(v.leg_no)===Number(m.current_leg);
      const text=summary(expand(v.darts)),points=Number(v.points_scored||0),name=esc(names[v.player_id]||'Spiller');
      return `<div class="cricket-history-row${v.corrected_at?' corrected':''}"><span class="cricket-history-meta">L${v.leg_no} · #${v.visit_no}</span><span class="cricket-history-player">${name}</span><span class="cricket-history-marks">${esc(text)}${v.corrected_at?' · korrigert':''}</span><span class="cricket-history-points">${points?`+${points}`:'—'}</span><span>${editable?`<button class="outline cricket-history-edit" data-edit-visit="${v.id}">Korriger</button>`:''}</span></div>`;
    }).join('');
    host.querySelectorAll('[data-edit-visit]').forEach(b=>b.onclick=()=>startCorrection(Number(b.dataset.editVisit)));
  }
  function startCorrection(id){
    const v=visits.find(x=>Number(x.id)===Number(id)),latest=latestActive();
    if(isChicago()||!v||latest?.id!==v.id||v.player_id!==profile?.id||m?.status!=='playing')return;
    editingVisitId=v.id;selectedDarts=expand(v.darts);
    $('matchMessage').textContent='Korriger siste kast med tastene. Enter lagrer, Esc avbryter.';
    renderEntry();renderLog();
  }
  function cancelCorrection(){editingVisitId=null;selectedDarts=[];$('matchMessage').textContent='Korrigering avbrutt.';renderEntry();renderLog()}

  const baseRefresh=refreshGame;
  refreshGame=async function(){await baseRefresh();await loadVisits();renderLog()};
  render=function(){baseRender();renderLog()};

  submitVisit=async function({emptyAsMisses=false}={}){
    if(!canInput())return;
    if(!selectedDarts.length&&emptyAsMisses){
      selectedDarts=[
        {target:'MISS',mult:0},
        {target:'MISS',mult:0},
        {target:'MISS',mult:0}
      ];
    }
    if(!selectedDarts.length)return;
    let darts;try{darts=pack(selectedDarts)}catch(error){$('matchMessage').textContent=error.message;return}
    submitting=true;renderEntry();$('matchMessage').textContent=editingVisitId!==null?'Lagrer korrigering…':'Registrerer…';
    try{
      let data,error;
      if(editingVisitId!==null)({data,error}=await db.rpc('correct_last_cricket_visit',{p_visit_id:editingVisitId,p_darts:darts}));
      else{const rpc=isChicago()?'submit_chicago_cricket_visit':'submit_cricket_visit';({data,error}=await db.rpc(rpc,{p_match_id:matchId,p_darts:darts}))}
      if(error)throw error;
      const wasEdit=editingVisitId!==null;editingVisitId=null;selectedDarts=[];
      await refreshGame();
      if(wasEdit)$('matchMessage').textContent=data?.leg_won?'Korrigert – leget er vunnet.':'Kastet er korrigert.';
      else $('matchMessage').textContent=data?.leg_won?(m.status==='finished'?'Kampen er vunnet!':'Leg vunnet!'):(Number(data?.points_scored||0)>0?`+${data.points_scored} poeng`:'');
      if(m.status==='finished')await setPlayersUnavailable();
    }catch(error){
      $('matchMessage').textContent=String(error?.message||'Kunne ikke registrere kastet.').replace('It is not your turn','Det er ikke din tur.').replace('Only the latest visit in the active leg can be corrected','Bare siste registrerte kast i aktivt leg kan korrigeres.');
    }finally{submitting=false;renderEntry();renderLog()}
  };

  // Replace the old mouse-oriented handlers with keyboard-first handlers.
  $('cricketMissBtn').onclick=addMiss;
  $('cricketUndoBtn').onclick=()=>{if(!canInput()||!selectedDarts.length)return;selectedDarts.pop();renderEntry()};
  $('cricketCancelEditBtn').onclick=cancelCorrection;
  $('cricketSubmitBtn').onclick=()=>submitVisit();

  document.addEventListener('keydown',e=>{
    const tag=(document.activeElement?.tagName||'').toLowerCase();
    if(['input','textarea','select'].includes(tag)||e.ctrlKey||e.metaKey||e.altKey||e.repeat)return;
    const key=e.key.toLowerCase(),target=KEY_TARGETS[key];
    if(target){e.preventDefault();addMark(target);return}
    if(e.code==='Space'){e.preventDefault();addMiss();return}
    if(e.key==='Backspace'){e.preventDefault();if(canInput()&&selectedDarts.length){selectedDarts.pop();renderEntry()}return}
    if(e.key==='Enter'){e.preventDefault();submitVisit({emptyAsMisses:true});return}
    if(e.key==='Escape'&&editingVisitId!==null){e.preventDefault();cancelCorrection()}
  });

  async function start(){
    if(ready||!m?.id||!profile?.id)return;
    ready=true;await loadVisits();renderLog();renderEntry();
    if(isChicago()){const help=document.querySelector('.cricket-history-head span');if(help)help.textContent='Chicago Style • kastlogg vises, men teller ikke i spillerstatistikk';}
    logChannel=db.channel('cricket-log-'+m.id)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${m.id}`},async()=>{await loadVisits();renderLog();renderEntry()})
      .on('postgres_changes',{event:'*',schema:'public',table:'cricket_visits',filter:`match_id=eq.${m.id}`},async()=>{await loadVisits();renderLog();renderEntry()})
      .subscribe();
  }
  const wait=setInterval(()=>{if(m?.id&&profile?.id){clearInterval(wait);start()}},100);
  window.addEventListener('pagehide',()=>{try{if(logChannel)db.removeChannel(logChannel)}catch{}});
})();
// Make partial Cricket visits explicit: after 1–2 registered darts, the player may send the visit immediately.
(()=>{
  const btn=document.getElementById('cricketSubmitBtn');
  if(!btn)return;

  function sync(){
    try{
      const count=Array.isArray(selectedDarts)?selectedDarts.length:0;
      const editing=typeof editingVisitId!=='undefined'&&editingVisitId!==null;
      const active=typeof canThrow==='function'?canThrow():true;
      if(!editing&&count>0&&active)btn.disabled=false;
      if(editing)return;
      btn.textContent=count>0&&count<3?'Send videre':'Registrer kast';
      btn.title=count>0&&count<3?'Send turen nå – du trenger ikke registrere resten som miss':'';
    }catch{}
  }

  const observer=new MutationObserver(sync);
  const host=document.getElementById('cricketDarts');
  if(host)observer.observe(host,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',()=>setTimeout(sync,0));
  document.addEventListener('keydown',()=>setTimeout(sync,0));
  setInterval(sync,500);
  sync();
})();


window.DartArenaMatchEngineState=Object.freeze({match:()=>m,matchId:()=>matchId,profile:()=>profile,opponentId:()=>other,client:()=>db,channel:()=>channel,stream:()=>stream,peer:()=>null,ready:()=>({local:localReady,remote:remoteReady}),isLeaving:()=>leaving});
setupChannel=function(){
  channel=db.channel('match-'+m.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:'id=eq.'+m.id},async ({new:row})=>{
    const oldLeg=m?.current_leg;m=row;if(oldLeg!==m.current_leg)selectedDarts=[];
    try{await loadState()}catch(error){console.warn('[CRICKET] state',error)}
    render();if(m.status!=='playing')await setPlayersUnavailable();
  }).subscribe();
};
window.DartArenaBootCricketSeamless=async id=>{
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id||''))throw Error('Invalid Cricket match ID');
  stream=window.DartArenaCaptureHandoff?.claim?.();
  if(!stream?.getTracks?.().some(t=>t.readyState==='live'))throw Error('Waiting room capture unavailable');
  localReady=true;
  await bootCricketSeamless(id);
  if(!m?.id)throw Error('Cricket match bootstrap failed');
  document.getElementById('cameraBtn').textContent='Stopp kamera';
  document.getElementById('cameraBtn').onclick=()=>{if(!stream)return;stream.getTracks().forEach(track=>track.stop());stream=null;localReady=false;window.DartArenaMatchMedia?.stop?.();document.getElementById('cameraBtn').textContent='Kamera avsluttet';};
};
})();
