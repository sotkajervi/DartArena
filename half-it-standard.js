const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK',db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY),$=id=>document.getElementById(id);
const matchId=new URLSearchParams(location.search).get('id');
const STD_ROUNDS=[
  {type:'number',target:13,label:'13',help:'Tre piler på 13. Single, double og treble på 13 teller.'},
  {type:'number',target:14,label:'14',help:'Tre piler på 14. Single, double og treble på 14 teller.'},
  {type:'double',label:'Dobbel',help:'Tre piler. Alle doubler teller sin normale verdi.'},
  {type:'number',target:15,label:'15',help:'Tre piler på 15. Single, double og treble på 15 teller.'},
  {type:'number',target:16,label:'16',help:'Tre piler på 16. Single, double og treble på 16 teller.'},
  {type:'treble',label:'Trippel',help:'Tre piler. Alle tripler teller sin normale verdi.'},
  {type:'number',target:17,label:'17',help:'Tre piler på 17. Single, double og treble på 17 teller.'},
  {type:'number',target:18,label:'18',help:'Tre piler på 18. Single, double og treble på 18 teller.'},
  {type:'exact',target:41,label:'41',help:'Alle tre pilene må være tellende og summen må bli nøyaktig 41.'},
  {type:'number',target:19,label:'19',help:'Tre piler på 19. Single, double og treble på 19 teller.'},
  {type:'number',target:20,label:'20',help:'Tre piler på 20. Single, double og treble på 20 teller.'},
  {type:'bull',label:'Bull',help:'Tre piler på bull. Outer bull gir 25 og bullseye 50.'}
];
let profile,m,other,names={},visits=[],selectedDarts=[],selectedMult=1,submitting=false,leaving=false;
let channel=null,stream=null,publisherSfu=null,subscriberSfu=null,publication=null,publicationTimer=null,remotePublicationId=null,remoteStream=null,localReady=false,readyTimer=null,remoteCameraEnabled=true,localCameraEnabled=true;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currentLegNo=()=>Math.max(1,Number(m?.current_leg||1));
const legVisits=()=>visits.filter(v=>Number(v.leg_no||1)===currentLegNo());
const roundCount=id=>legVisits().filter(v=>v.player_id===id).length;
const currentRoundNo=()=>!m?1:m.status!=='playing'?12:Math.min(12,roundCount(m.turn_player_id)+1);
const currentRound=()=>STD_ROUNDS[currentRoundNo()-1]||STD_ROUNDS[11];
const canThrow=()=>!!m&&m.status==='playing'&&m.turn_player_id===profile?.id&&!submitting;
const isOfferer=()=>profile?.id===m?.player1_id;
const dartValue=d=>d.n===25?25*d.mult:d.n*d.mult;
const dartLabel=d=>!d||d.n===0?'MISS':d.n===25?(d.mult===1?'25':'50'):`${d.mult===1?'S':d.mult===2?'D':'T'}${d.n}`;
function addDart(n,mult){if(!canThrow()||selectedDarts.length>=3)return;if(n===25&&mult===3)return;selectedDarts.push({n:Number(n),mult:Number(mult)});renderEntry()}
function buildPad(){const host=$('halfPad');if(!host)return;const r=currentRound(),enabled=canThrow()&&selectedDarts.length<3;if(!r||m?.status!=='playing'){host.innerHTML='';return}
  if(r.type==='number')host.innerHTML=`<div class="half-quick"><button class="outline half-hit" data-n="${r.target}" data-mult="1">S${r.target}</button><button class="outline half-hit" data-n="${r.target}" data-mult="2">D${r.target}</button><button class="outline half-hit" data-n="${r.target}" data-mult="3">T${r.target}</button></div>`;
  else if(r.type==='bull')host.innerHTML='<div class="half-quick"><button class="outline half-hit" data-n="25" data-mult="1">25</button><button class="outline half-hit" data-n="25" data-mult="2">50</button></div>';
  else if(r.type==='double'||r.type==='treble'){
    const mult=r.type==='double'?2:3,nums=Array.from({length:20},(_,i)=>i+1),bull=r.type==='double'?'<button class="outline half-hit" data-n="25" data-mult="2">DB</button>':'';
    host.innerHTML=`<div class="half-number-grid">${nums.map(n=>`<button class="outline half-hit" data-n="${n}" data-mult="${mult}">${mult===2?'D':'T'}${n}</button>`).join('')}${bull}</div>`;
  }else{
    const nums=Array.from({length:20},(_,i)=>i+1);
    host.innerHTML=`<div class="half-multiplier"><button class="outline half-mult ${selectedMult===1?'active':''}" data-mult="1">SINGLE</button><button class="outline half-mult ${selectedMult===2?'active':''}" data-mult="2">DOBBEL</button><button class="outline half-mult ${selectedMult===3?'active':''}" data-mult="3">TRIPPEL</button></div><div class="half-number-grid">${nums.map(n=>`<button class="outline half-hit" data-n="${n}" data-mult="${selectedMult}">${selectedMult===1?'S':selectedMult===2?'D':'T'}${n}</button>`).join('')}<button class="outline half-hit" data-n="25" data-mult="${selectedMult}" ${selectedMult===3?'disabled':''}>${selectedMult===1?'25':selectedMult===2?'50':'BULL'}</button></div>`;
  }
  host.querySelectorAll('.half-hit').forEach(b=>{b.disabled=b.disabled||!enabled;b.onclick=()=>addDart(Number(b.dataset.n),Number(b.dataset.mult))});
  host.querySelectorAll('.half-mult').forEach(b=>{b.disabled=!enabled;b.onclick=()=>{selectedMult=Number(b.dataset.mult);buildPad()}});
}
function renderEntry(){const items=selectedDarts.map(d=>`<div class="half-dart">${esc(dartLabel(d))}</div>`);while(items.length<3)items.push('<div class="half-dart empty">–</div>');$('halfDarts').innerHTML=items.join('');const enabled=canThrow();$('halfMissBtn').disabled=!enabled||selectedDarts.length>=3;$('halfUndoBtn').disabled=!enabled||!selectedDarts.length;$('halfSubmitBtn').disabled=!enabled||selectedDarts.length!==3;buildPad()}
function renderHistory(){const body=$('halfHistoryBody');if(!body||!m)return;const active=currentRoundNo(),lv=legVisits();body.innerHTML=STD_ROUNDS.map((r,i)=>{const rn=i+1,a=lv.find(v=>v.player_id===m.player1_id&&v.round_no===rn),b=lv.find(v=>v.player_id===m.player2_id&&v.round_no===rn);return`<tr class="${m.status==='playing'&&rn===active?'current':''}"><td>${rn}. ${esc(r.label)}</td><td>${a?Number(a.score_after):'–'}</td><td>${b?Number(b.score_after):'–'}</td></tr>`}).join('')}
function ensureResultScreen(){if(document.getElementById('halfResultOverlay'))return;const el=document.createElement('div');el.id='halfResultOverlay';el.className='half-result-overlay hidden';el.innerHTML=`<section class="half-result-card"><small>KAMP FERDIG</small><h1 id="halfResultWinner">Vinner</h1><div id="halfResultLegs" class="half-result-legs">0 – 0</div><div class="half-result-grid"><article><span id="halfResultName1">Spiller 1</span><strong id="halfResultScore1">0</strong><div id="halfResultStats1" class="half-result-stats"></div></article><article><span id="halfResultName2">Spiller 2</span><strong id="halfResultScore2">0</strong><div id="halfResultStats2" class="half-result-stats"></div></article></div><div class="half-result-actions"><button id="halfResultClose" class="primary">Lukk kampfane</button></div></section>`;document.body.appendChild(el);$('halfResultClose').onclick=()=>$('closeMatchBtn')?.click()}
function playerStats(id){const rows=visits.filter(v=>v.player_id===id),ok=rows.filter(v=>v.success).length;return{rounds:rows.length,ok,fail:rows.length-ok,rate:rows.length?Math.round(ok/rows.length*100):0}}
function syncResultScreen(){ensureResultScreen();const box=$('halfResultOverlay');if(!box||m?.status!=='finished'){box?.classList.add('hidden');return}const s1=playerStats(m.player1_id),s2=playerStats(m.player2_id),winner=m.winner_id?names[m.winner_id]||'Vinner':'Uavgjort';$('halfResultWinner').textContent=m.winner_id?`${winner} vinner`:'Uavgjort';$('halfResultLegs').textContent=`${Number(m.player1_legs||0)} – ${Number(m.player2_legs||0)} i legs`;$('halfResultName1').textContent=names[m.player1_id]||'Spiller 1';$('halfResultName2').textContent=names[m.player2_id]||'Spiller 2';$('halfResultScore1').textContent=String(m.player1_score||0);$('halfResultScore2').textContent=String(m.player2_score||0);$('halfResultStats1').innerHTML=`Treffrunder <b>${s1.ok}</b><br>Halveringer <b>${s1.fail}</b><br>Suksess <b>${s1.rate}%</b>`;$('halfResultStats2').innerHTML=`Treffrunder <b>${s2.ok}</b><br>Halveringer <b>${s2.fail}</b><br>Suksess <b>${s2.rate}%</b>`;box.classList.remove('hidden')}
function render(){if(!m||!profile)return;const c1=roundCount(m.player1_id),c2=roundCount(m.player2_id),mine=m.turn_player_id===profile.id&&m.status==='playing',rn=currentRoundNo(),r=currentRound(),leg=currentLegNo();$('matchFormat').textContent=`HALF-IT (STANDARD) • BEST OF ${m.legs||1} LEGS • 12 RUNDER/LEG`;$('halfName1').textContent=names[m.player1_id]||'Spiller 1';$('halfName2').textContent=names[m.player2_id]||'Spiller 2';$('historyName1').textContent=names[m.player1_id]||'Spiller 1';$('historyName2').textContent=names[m.player2_id]||'Spiller 2';$('halfScore1').textContent=String(m.player1_score||0);$('halfScore2').textContent=String(m.player2_score||0);$('halfRound1').textContent=`${Number(m.player1_legs||0)} legs • ${c1>=12?'12/12 ferdig':`Runde ${c1+1}/12`}`;$('halfRound2').textContent=`${Number(m.player2_legs||0)} legs • ${c2>=12?'12/12 ferdig':`Runde ${c2+1}/12`}`;$('halfP1').classList.toggle('active',m.status==='playing'&&m.turn_player_id===m.player1_id);$('halfP2').classList.toggle('active',m.status==='playing'&&m.turn_player_id===m.player2_id);$('videoGrid')?.classList.toggle('opponent-throwing',m.status==='playing'&&!mine);const formatStrong=document.querySelector('.half-status-list .half-status-row:last-child strong');if(formatStrong)formatStrong.textContent=`Best of ${m.legs||1} legs`;const histBadge=document.querySelector('.half-history-head .status');if(histBadge)histBadge.textContent=`Leg ${leg} • 12 runder`;$('exactStatusRow')?.classList.add('hidden');
  if(m.status==='finished'){$('halfRoundLabel').textContent='FERDIG';$('halfTarget').textContent=m.winner_id?`${names[m.winner_id]||'Vinner'} vant`:'Uavgjort';$('halfHelp').textContent=`Slutt: ${m.player1_legs||0}–${m.player2_legs||0} i legs.`;$('turnText').textContent=m.winner_id?`${names[m.winner_id]||'Vinner'} vant`:'Uavgjort';$('matchStatus').textContent='Ferdig'}
  else if(m.status==='cancelled'){$('halfRoundLabel').textContent='AVBRUTT';$('halfTarget').textContent='Kampen er avbrutt';$('halfHelp').textContent='';$('turnText').textContent='Avbrutt';$('matchStatus').textContent='Avbrutt'}
  else{$('halfRoundLabel').textContent=`LEG ${leg} • RUNDE ${rn} AV 12`;$('halfTarget').textContent=r.label;$('halfHelp').textContent=r.help;$('turnText').textContent=mine?'Din tur':`${names[m.turn_player_id]||'Motstanderen'} kaster`;$('matchStatus').textContent=`Pågår • Leg ${leg}`}
  $('cancelMatchBtn').classList.toggle('hidden',m.status!=='playing');renderEntry();renderHistory();syncResultScreen()}
async function refreshGame(){const[{data:mm,error:me},{data:vv,error:ve}]=await Promise.all([db.from('matches').select('*').eq('id',matchId).single(),db.from('half_it_visits').select('*').eq('match_id',matchId).order('leg_no').order('round_no').order('id')]);if(me)throw me;if(ve)throw ve;m=mm;visits=vv||[];render()}
async function submitRound(){if(!canThrow()||selectedDarts.length!==3)return;submitting=true;renderEntry();$('matchMessage').textContent='Registrerer…';try{const darts=selectedDarts.map(d=>({...d})),{data,error}=await db.rpc('submit_half_it_standard_visit',{p_match_id:matchId,p_darts:darts});if(error)throw error;selectedDarts=[];selectedMult=1;await refreshGame();if(data?.finished)$('matchMessage').textContent=`${names[data.winner_id]||'Vinner'} vant kampen.`;else if(data?.leg_finished&&data?.leg_winner_id)$('matchMessage').textContent=`${names[data.leg_winner_id]||'Spiller'} vant leget. Leg ${m.current_leg} starter.`;else if(data?.leg_finished)$('matchMessage').textContent='Leget endte likt. Nytt leg starter.';else $('matchMessage').textContent=data?.success?`+${Number(data.points_scored||0)} poeng`:`Score halvert til ${Number(data?.score_after||0)}`;if(m.status==='finished')await setPlayersUnavailable()}catch(e){$('matchMessage').textContent=String(e?.message||'Kunne ikke registrere runden.').replace('It is not your turn','Det er ikke din tur.')}finally{submitting=false;renderEntry()}}
$('halfMissBtn').onclick=()=>addDart(0,0);$('halfUndoBtn').onclick=()=>{selectedDarts.pop();renderEntry()};$('halfSubmitBtn').onclick=submitRound;

function mediaConstraints(){const cam=localStorage.getItem('dartarena-preferred-camera')||'',mic=localStorage.getItem('dartarena-preferred-microphone')||'';return{video:{deviceId:cam?{exact:cam}:undefined,width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:{deviceId:mic?{exact:mic}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true}}}
async function send(event,payload={}){if(channel)await channel.send({type:'broadcast',event,payload:{...payload,from:profile.id}})}
function showRemote(text='Kobler til motstanderens kamera via Cloudflare…'){const p=$('remotePlaceholder');if(p){p.textContent=text;p.classList.remove('hidden')}}
function hideRemote(){if(remoteCameraEnabled)$('remotePlaceholder')?.classList.add('hidden')}
function clearRemote(show=true){
  remotePublicationId=null;
  try{subscriberSfu?.close()}catch{}
  subscriberSfu=null;
  remoteStream=null;
  const v=$('remoteVideo');
  if(v){v.pause?.();v.srcObject=null}
  if(show)showRemote();
}
async function subscribeRemote(pub){
  if(!pub?.sessionId||!Array.isArray(pub.tracks)||pub.sessionId===remotePublicationId)return;
  remotePublicationId=pub.sessionId;
  try{
    try{subscriberSfu?.close()}catch{}
    subscriberSfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
    remoteStream=new MediaStream();
    const v=$('remoteVideo');
    v.srcObject=remoteStream;
    v.muted=true;
    v.playsInline=true;
    await subscriberSfu.subscribe(pub,async e=>{
      const tracks=e.streams?.[0]?.getTracks()||[e.track];
      for(const track of tracks){
        if(!remoteStream.getTracks().some(t=>t.id===track.id))remoteStream.addTrack(track);
      }
      v.srcObject=remoteStream;
      await v.play().catch(()=>{});
      if(remoteCameraEnabled&&remoteStream.getVideoTracks().some(t=>t.readyState==='live'))hideRemote();
    });
  }catch(e){
    console.error('Half-It Standard Cloudflare subscribe failed',e);
    remotePublicationId=null;
    showRemote('Kunne ikke koble til motstander via Cloudflare. Prøver igjen…');
  }
}
async function startCamera(){
  if(stream?.active&&publication){
    localReady=true;
    await send('half-it-standard-publication',{publication});
    return;
  }
  try{
    try{stream=await navigator.mediaDevices.getUserMedia(mediaConstraints())}
    catch{stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}})}
    const v=$('localVideo');
    v.srcObject=stream;v.muted=true;await v.play().catch(()=>{});
    localCameraEnabled=true;
    stream.getVideoTracks().forEach(t=>t.enabled=true);
    $('localPlaceholder').classList.add('hidden');
    $('cameraBtn').textContent='Stopp kamera';
    const a=stream.getAudioTracks()[0];
    if($('micBtn'))$('micBtn').textContent=a?.enabled?'Mikrofon på':'Mikrofon av';

    try{publisherSfu?.close()}catch{}
    publisherSfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
    publication=await publisherSfu.publish(stream);
    localReady=true;
    await send('half-it-standard-publication',{publication});
    await send('camera-state',{enabled:true});
    clearInterval(publicationTimer);
    publicationTimer=setInterval(()=>{
      if(!leaving&&publication)send('half-it-standard-publication',{publication});
    },2500);
  }catch(e){
    localReady=false;publication=null;
    try{publisherSfu?.close()}catch{}
    publisherSfu=null;
    showLocalCameraError(e);
    console.error('Half-It Standard Cloudflare publish failed',e);
  }
}
function showLocalCameraError(e){const p=$('localPlaceholder');if(p){p.textContent=e?.name==='NotAllowedError'?'Kamera/mikrofon er blokkert.':'Kamera kunne ikke startes';p.classList.remove('hidden')}$('cameraBtn').textContent='Start kamera'}
function setupChannel(){
  channel=db.channel('half-it-standard-'+matchId,{config:{broadcast:{ack:true}}})
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},async()=>{try{await refreshGame();if(m.status!=='playing')await setPlayersUnavailable()}catch(e){console.error(e)}})
    .on('broadcast',{event:'half-it-standard-publication'},async({payload})=>{
      if(payload.from!==other||!payload.publication)return;
      await subscribeRemote(payload.publication);
    })
    .on('broadcast',{event:'camera-state'},({payload})=>{
      if(payload.from!==other)return;
      remoteCameraEnabled=payload.enabled!==false;
      if(remoteCameraEnabled){
        if(remoteStream?.getVideoTracks().some(t=>t.readyState==='live'))hideRemote();else showRemote();
      }else showRemote('Motstanderens kamera er av');
    })
    .subscribe(async status=>{
      if(status==='SUBSCRIBED'){
        await startCamera();
        clearInterval(readyTimer);
        readyTimer=setInterval(()=>{
          if(!leaving&&publication)send('half-it-standard-publication',{publication});
        },4500);
      }
    });
}
$('cameraBtn').onclick=async()=>{
  if(!stream?.active)return startCamera();
  localCameraEnabled=!localCameraEnabled;
  stream.getVideoTracks().forEach(t=>t.enabled=localCameraEnabled);
  $('localPlaceholder').textContent=localCameraEnabled?'Ditt kamera':'Kamera av';
  $('localPlaceholder').classList.toggle('hidden',localCameraEnabled);
  $('cameraBtn').textContent=localCameraEnabled?'Stopp kamera':'Start kamera';
  await send('camera-state',{enabled:localCameraEnabled});
};
if($('micBtn'))$('micBtn').onclick=()=>{const t=stream?.getAudioTracks?.()[0];if(!t)return;t.enabled=!t.enabled;$('micBtn').textContent=t.enabled?'Mikrofon på':'Mikrofon av'};
async function setPlayersUnavailable(){if(m)await db.from('profiles').update({status:'unavailable'}).in('id',[m.player1_id,m.player2_id])}
function cleanup(){leaving=true;clearInterval(readyTimer);clearInterval(publicationTimer);readyTimer=publicationTimer=null;stream?.getTracks?.().forEach(t=>t.stop());stream=null;publication=null;try{publisherSfu?.close()}catch{};try{subscriberSfu?.close()}catch{};publisherSfu=subscriberSfu=null;clearRemote(false);if(channel)db.removeChannel(channel).catch?.(()=>{});channel=null}
$('cancelMatchBtn').onclick=async()=>{if(!m||m.status!=='playing'||!confirm('Vil du avbryte kampen?'))return;const b=$('cancelMatchBtn');b.disabled=true;b.textContent='Avbryter…';const{error}=await db.from('matches').update({status:'cancelled',finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',m.id);if(error){b.disabled=false;b.textContent='Avbryt kamp';return $('matchMessage').textContent='Kunne ikke avbryte: '+error.message}await setPlayersUnavailable();window.opener?.postMessage({type:'dartarena-match-ended',id:m.id},location.origin);window.close();if(!window.closed)location.href='./'};
$('closeMatchBtn').onclick=()=>{if(m?.status==='playing'&&!confirm('Kampen pågår fortsatt. Du kan åpne den igjen fra lobbyen. Lukk kampfanen?'))return;window.close();if(!window.closed)location.href='./'};
window.addEventListener('beforeunload',cleanup);
(async()=>{const{data:{session}}=await db.auth.getSession();if(!session||!matchId)return location.replace('./');({data:profile}=await db.from('profiles').select('*').eq('id',session.user.id).single());const{data,error}=await db.from('matches').select('*').eq('id',matchId).single();m=data;if(error||!m||![m.player1_id,m.player2_id].includes(profile.id))return location.replace('./');if(m.game_variant!=='half_it'||m.game_config?.half_it_mode!=='standard')return location.replace(`half-it.html?id=${encodeURIComponent(matchId)}`);other=profile.id===m.player1_id?m.player2_id:m.player1_id;const{data:p}=await db.from('profiles').select('id,username').in('id',[m.player1_id,m.player2_id]);names=Object.fromEntries((p||[]).map(x=>[x.id,x.username]));$('localVideoName').textContent=names[profile.id]||'Spiller';$('remoteVideoName').textContent=names[other]||'Spiller';$('matchTitle').textContent=`${names[m.player1_id]||'Spiller 1'} vs ${names[m.player2_id]||'Spiller 2'}`;ensureResultScreen();await refreshGame();setupChannel()})().catch(e=>{$('matchMessage').textContent=e?.message||'Kunne ikke starte Half-It Standard.'});
