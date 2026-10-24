/* Owner-only AI Rival camera training capture. Local-only, no scoring changes.
   The orange point is a frame-change estimate, NOT a verified ML tip detection. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const qs=new URLSearchParams(location.search);
if(qs.get('training')!=='1'||qs.has('tournamentAiMatch'))return;
const reviewOnly=qs.get('review')==='1';
const Z=window.DartArenaZoomCam, T=window.DartArenaAutoZoom, Zip=window.DartArenaLabZip, TipBias=window.DartArenaTipBias;
const panel=$('aiTrainingPanel'),view=$('aiTrainVideo'),status=$('aiTrainStatus');
if(!Z||!T||!Zip||!panel||!view)return;
const db=window.supabase?.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
if(!db)return;
const gameFormat=Number(qs.get('format'))||501;
const key=gameFormat===501?'dartarena-ai-rival-501-state-v1':'dartarena-ai-rival-'+gameFormat+'-state-v1';
const MAX=150;
let authorized=false,raw=null,rawVideo=null,zoom=null,config=null,store=null,cameraStarting=false;
let records=[],selected=-1,proposed=null,busy=false,previousVisitCount=null,currentMatch=null;
let currentObjectUrls=[];
const reviewUpdates=new Map();
const reviewKey=(r,n)=>[r.matchId,r.setNo,r.legNo,r.roundIndex,n].join(':');
function reviewOrder(){return records.map((_,i)=>i).sort((x,y)=>Number(!!records[y].scoreCorrected)-Number(!!records[x].scoreCorrected)||Date.parse(records[y].capturedAt)-Date.parse(records[x].capturedAt))}
const say=(s,err=false)=>{status.textContent=s;status.classList.toggle('is-error',err)};
const readState=()=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const request=req=>new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
function openStore(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('dartarena-ai-rival-training-v1',1);
    req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains('captures'))d.createObjectStore('captures',{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function loadAll(){return request(store.transaction('captures').objectStore('captures').getAll())}
async function save(item){await request(store.transaction('captures','readwrite').objectStore('captures').put(item))}
async function removeAll(){await request(store.transaction('captures','readwrite').objectStore('captures').clear())}
function isHumanTurn(s){return authorized&&s?.id===currentMatch&&s.status==='playing'&&s.turn===0}
function humanRound(s){
  const roundIndex=(s.visits||[]).filter(v=>v.player===0&&v.leg===s.leg&&(v.set||1)===(s.currentSet||1)).length;
  return {matchId:s.id,setNo:s.currentSet||1,legNo:s.leg,roundIndex};
}
function belongs(item,round){return item.matchId===round.matchId&&item.setNo===round.setNo&&item.legNo===round.legNo&&item.roundIndex===round.roundIndex}
function countRound(s){if(!s)return 0;const r=humanRound(s);return records.filter(item=>belongs(item,r)).length}
function setCounter(){
  const s=readState(),n=countRound(s);
  $('aiTrainCount').textContent=n+' / 3 piler · '+records.length+' bilder lagret';
  $('aiTrainManual').disabled=!isHumanTurn(s)||n>=3||records.length>=MAX||busy||!rawVideo?.videoWidth;
  $('aiTrainExport').disabled=!records.length;
  $('aiTrainDelete').disabled=!records.length;
}
function makeCanvas(w,h){const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas}
const toBlob=(canvas)=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Kunne ikke lagre bilde.')),'image/jpeg',.88));
async function capture(hit,source,manual=false){
  const s=readState();
  if(!isHumanTurn(s)||!source?.videoWidth||busy||records.length>=MAX||countRound(s)>=3)return;
  busy=true;setCounter();
  const round=humanRound(s),dartNo=countRound(s)+1;
  try{
    const w=source.videoWidth,h=source.videoHeight;
    // Copy the full-resolution live frame synchronously before the video changes.
    const image=makeCanvas(w,h),ctx=image.getContext('2d');
    ctx.drawImage(source,0,0,w,h);
    const rawPoint=hit&&Number.isFinite(hit.x)&&Number.isFinite(hit.y)?
      {x:hit.x,y:hit.y}:null;
    // Learn from verified Owner corrections on the SAME calibrated camera.
    // Never treat an earlier uncorrected guess as ground truth.
    const tipBias=rawPoint&&TipBias?TipBias.estimate(records,config,w,h):null;
    const displayPoint=rawPoint&&TipBias?
      TipBias.adjust(rawPoint,tipBias,w,h):rawPoint;
    const x=displayPoint?.x??config.cx*w;
    const y=displayPoint?.y??config.cy*h;
    const crop=T.zoomCrop(w,h,x,y,config.radius*w,4/3);
    const cropped=makeCanvas(640,480);
    cropped.getContext('2d').drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,640,480);
    const [original,closeup]=await Promise.all([toBlob(image),toBlob(cropped)]);
    const item={
      id:crypto.randomUUID(),capturedAt:new Date().toISOString(),...round,dartNo,
      source:manual?'manual':'zoomcam-change-estimate',manual,
      original,closeup,width:w,height:h,crop,
      // Preserve source centroid separately; future training needs the raw input.
      rawProposal:rawPoint,proposal:displayPoint,
      proposalAdjustment:tipBias,corrected:null,
      status:'pending',score:null,calibration:{...config},scoreCorrected:false
    };
    Object.assign(item,reviewUpdates.get(reviewKey(round,dartNo))||{});
    await save(item);records.push(item);
    say('Pil '+dartNo+' lagret. '+(tipBias?'Forslaget er forskjøvet ut fra '+tipBias.samples+' tidligere godkjente punkter. ': 'Ingen innlært korreksjon ennå. ')+(hit?'Punktet er IKKE bekreftet pilspiss.':'Manuelt bilde uten forslag.')+' Kontroller manuelt.');
    selected=records.length-1;showReview();setCounter();
  }catch(e){say('Kunne ikke lagre pil '+dartNo+': '+(e?.message||String(e)),true)}
  finally{busy=false;setCounter()}
}
window.addEventListener('dartarena:owner-tip-review-update',event=>{
 if(!authorized)return;
 const d=event.detail||{};
 if(typeof d.matchId!=='string'||!Number.isInteger(d.dartNo)||d.dartNo<1||d.dartNo>3)return;
 const k=reviewKey(d,d.dartNo),patch={scoreCorrected:!!d.corrected};
 if(Number.isFinite(d.aiSuggestedScore))patch.aiSuggestedScore=d.aiSuggestedScore;
 if(Number.isFinite(d.finalScore))patch.finalDartScore=d.finalScore;
 if(Number.isFinite(d.tipX)&&Number.isFinite(d.tipY))patch.aiTip={x:d.tipX,y:d.tipY};
 reviewUpdates.set(k,{...reviewUpdates.get(k),...patch});
 const item=records.find(v=>reviewKey(v,v.dartNo)===k);
 if(item){Object.assign(item,patch);void save(item);if(selected>=0)showReview()}
});
function onStableHit(point,source){
  // Owner-only opt-in assist receives a synchronous immutable video snapshot.
  // This event carries no score write; normal training capture stays unchanged.
  if(authorized&&source?.videoWidth&&window.DartArenaOwnerTipAssistActive){
    const c=makeCanvas(source.videoWidth,source.videoHeight);
    c.getContext('2d').drawImage(source,0,0,c.width,c.height);
    window.dispatchEvent(new CustomEvent('dartarena:owner-tip-hit',{detail:{point:{x:point.x,y:point.y},frame:c}}));
  }
  void capture({x:point.x,y:point.y},source,false);
}
async function attachScores(s){
  if(!s||s.id!==currentMatch)return;
  const counts=new Map();
  for(const visit of s.visits||[]){
    if(visit.player!==0)continue;
    const k=(visit.set||1)+':'+visit.leg,n=counts.get(k)||0;
    counts.set(k,n+1);
    for(const item of records){
      if(item.matchId!==s.id||item.setNo!==(visit.set||1)||item.legNo!==visit.leg||item.roundIndex!==n)continue;
      const score=visit.bust?'BUST':visit.score;
      if(item.score!==score){item.score=score;await save(item)}
    }
  }
}
async function syncGame(){
  if(!authorized)return;
  const s=readState();
  if(!s?.id)return;
  if(s.id!==currentMatch){
    currentMatch=s.id;previousVisitCount=s.visits?.length||0;
    // Don't silently overwrite a running capture after starting a different match.
    if(!zoom)await startCamera();
  }else if(previousVisitCount!==null&&(s.visits?.length||0)>previousVisitCount){
    const added=(s.visits||[]).slice(previousVisitCount);
    if(added.some(v=>v.player===0))zoom?.resetToT20();
    previousVisitCount=s.visits.length;
  }
  await attachScores(s);
  setCounter();
}
async function startCamera(){
  if(zoom||cameraStarting)return;
  config=Z.loadConfig(localStorage);
  if(!config){say('Zoom-cam må kalibreres i Cam-test med dette kameraet først.',true);return}
  cameraStarting=true;
  try{
    const candidate=await navigator.mediaDevices.getUserMedia({audio:false,video:{
      deviceId:{exact:config.deviceId},width:{ideal:1920},height:{ideal:1080}}});
    raw=candidate;
    const track=raw.getVideoTracks()[0],settings=track.getSettings();
    if(!Z.compatible(config,track,settings.width||1280,settings.height||720)){
      throw new Error('Zoom-cam-kalibreringen passer ikke kameraets oppløsning. Kalibrer på nytt i Cam-test.');
    }
    rawVideo=document.createElement('video');
    zoom=Z.create(raw,config,{video:rawVideo,picture:false,onStableHit});
    window.dispatchEvent(new CustomEvent('dartarena:owner-tip-camera',{detail:{video:rawVideo,config}}));
    view.srcObject=zoom.stream;await view.play();
    say('Kamera klart. Kast inntil 3 piler, registrer deretter rundescore. Oransje punkt er kun bildeendring.');
  }catch(e){
    zoom?.stop();zoom=null;
    for(const track of raw?.getTracks()||[])track.stop();raw=null;rawVideo=null;
    say('Kamera kunne ikke startes: '+(e?.message||String(e)),true);
  }finally{cameraStarting=false}
  setCounter();
}
function clearUrls(){for(const url of currentObjectUrls)URL.revokeObjectURL(url);currentObjectUrls=[]}
function displayBlob(blob){
  const url=URL.createObjectURL(blob);
  currentObjectUrls.push(url);return url;
}
function renderDot(item,p){
  const dot=$('aiTrainDot');
  if(!p){dot.hidden=true;return}
  dot.hidden=false;
  dot.style.left=(100*(p.x-item.crop.x)/item.crop.width)+'%';
  dot.style.top=(100*(p.y-item.crop.y)/item.crop.height)+'%';
  dot.classList.toggle('corrected',!!item.corrected||!!proposed);
}
function showReview(){
  clearUrls();
  const nav=$('aiTrainReviewNav'),review=$('aiTrainReview');
  if(selected<0||!records[selected]){
    review.hidden=true;nav.textContent='Ingen bilder ennå.';return;
  }
  review.hidden=false;
  const item=records[selected];proposed=null;
  $('aiTrainOriginal').src=displayBlob(item.original);
  $('aiTrainCloseup').src=displayBlob(item.closeup);
  nav.textContent=(item.scoreCorrected?'POENG KORRIGERT · ':'')+'Bilde '+(selected+1)+' / '+records.length+' · Pil '+item.dartNo+
    ' · '+(item.score===null?'score ikke registrert':item.score+' poeng')+' · '+item.status;
  $('aiTrainMark').textContent=item.aiTip?'Lyseblått punkt: AI-spissforslag. Klikk på riktig spiss for finjustering, deretter Godkjenn punkt.':item.proposal?
    (item.proposalAdjustment?
      'Oransje: justert bildeendring fra '+item.proposalAdjustment.samples+' godkjente korrigeringer. Ikke en AI-spissdetektor. ':
      'Oransje: rå bildeendring, ikke AI. ')+
      'Klikk nøyaktig på spissen for å korrigere.':
    'Ingen automatisk forslag. Klikk på riktig spiss i bildet til høyre.';
  renderDot(item,item.corrected||item.aiTip||item.proposal);
}
$('aiTrainZoom').addEventListener('click',event=>{
  const item=records[selected],rect=event.currentTarget.getBoundingClientRect();
  if(!item||rect.width<=0||rect.height<=0)return;
  const x=(event.clientX-rect.left)/rect.width,y=(event.clientY-rect.top)/rect.height;
  if(x<0||x>1||y<0||y>1)return;
  proposed={x:item.crop.x+x*item.crop.width,y:item.crop.y+y*item.crop.height};
  renderDot(item,proposed);
  $('aiTrainMark').textContent='Korrigert punkt valgt. Trykk Godkjenn for å lagre.';
});
$('aiTrainApprove').addEventListener('click',async()=>{
  const item=records[selected];if(!item)return;
  const point=proposed||item.corrected||item.aiTip||item.proposal;
  if(!point){say('Marker spissen i bildet før du godkjenner.',true);return}
  item.corrected={x:point.x,y:point.y};
  item.status='approved';
  try{await save(item);say('Spissen er lagret som godkjent treningsdata.');goReview(1)}
  catch(e){say('Korrigering kunne ikke lagres: '+e.message,true)}
});
$('aiTrainReject').addEventListener('click',async()=>{
  const item=records[selected];if(!item)return;
  item.status='rejected';item.corrected=null;
  try{await save(item);say('Bilde avvist – ekskluderes fra trening.');goReview(1)}
  catch(e){say('Avvisning ble ikke lagret: '+e.message,true)}
});
function goReview(step){const order=reviewOrder();if(!order.length)return;const pos=order.indexOf(selected);selected=order[(Math.max(0,pos)+step+order.length)%order.length];showReview()}
$('aiTrainPriority').addEventListener('click',()=>{selected=reviewOrder()[0]??-1;showReview()});
$('aiTrainPrev').addEventListener('click',()=>goReview(-1));
$('aiTrainNext').addEventListener('click',()=>goReview(1));
$('aiTrainManual').addEventListener('click',()=>{if(rawVideo)void capture(null,rawVideo,true)});
$('aiTrainRearm').addEventListener('click',()=>{
  if(!zoom)return;
  zoom.resetToT20();
  say('Ny referanse valgt. Vent et øyeblikk før neste pil. Bruk bare når pilene er fjernet.');
});
$('aiTrainExport').addEventListener('click',async()=>{
  if(!records.length)return;
  const button=$('aiTrainExport');button.disabled=true;
  try{
    const entries=[],labels=[];
    for(let i=0;i<records.length;i++){
      const item=records[i],name=String(i+1).padStart(4,'0')+'-'+item.id;
      entries.push({name:'images/'+name+'-original.jpg',bytes:new Uint8Array(await item.original.arrayBuffer())});
      entries.push({name:'images/'+name+'-zoom.jpg',bytes:new Uint8Array(await item.closeup.arrayBuffer())});
      const {original,closeup,...meta}=item;
      labels.push({...meta,originalFile:'images/'+name+'-original.jpg',zoomFile:'images/'+name+'-zoom.jpg'});
    }
    entries.unshift({name:'labels.json',bytes:new TextEncoder().encode(JSON.stringify({version:1,note:'Use only status=approved as verified keypoints. The initial proposal is a frame-change centroid, NOT ML inference.',captures:labels},null,2))});
    const zip=Zip.build(entries),url=URL.createObjectURL(zip);
    const link=document.createElement('a');link.href=url;link.download='dartarena-rival-training-'+new Date().toISOString().slice(0,10)+'.zip';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    say('ZIP-eksport startet. Kontroller at filen er lastet ned før du sletter bilder.');
  }catch(e){say('ZIP-eksport feilet: '+e.message,true)}
  finally{button.disabled=false;setCounter()}
});
$('aiTrainDelete').addEventListener('click',async()=>{
  if(!confirm('Slette ALLE lokalt lagrede treningsbilder? Eksporter ZIP først.'))return;
  await removeAll();records=[];selected=-1;showReview();setCounter();say('Lokalt lagrede bilder slettet.');
});
function stop(){
  clearUrls();zoom?.stop();zoom=null;
  for(const track of raw?.getTracks()||[])track.stop();raw=null;
  view.srcObject=null;
}
window.addEventListener('pagehide',stop);
window.addEventListener('dartarena:practice-save',()=>{if(!reviewOnly)void syncGame()});
// A completed local match shows a result overlay. Offer a direct, verified
// Owner-only path to the stored images before the player leaves the page.
function addResultReviewButton(){
  if(reviewOnly||!authorized)return;
  const actions=document.querySelector('#dartArenaResultOverlay .da-result-actions');
  if(!actions||actions.querySelector('#daOwnerTrainReview'))return;
  const button=document.createElement('button');
  button.id='daOwnerTrainReview';
  button.type='button';button.className='primary';
  button.textContent='Se treningsbilder';
  button.addEventListener('click',()=>{
    location.href='./ai-rival-501.html?training=1&review=1';
  });
  actions.prepend(button);
}
const resultObserver=new MutationObserver(addResultReviewButton);
resultObserver.observe(document.body,{childList:true});
window.addEventListener('pagehide',()=>resultObserver.disconnect());
(async()=>{
  try{
    const {data:{session},error}=await db.auth.getSession();
    if(error||!session)throw new Error('Logg inn for å bruke treningsmodus.');
    const {data:isOwner,error:roleError}=await db.rpc('is_owner');
    if(roleError||isOwner!==true)throw new Error('Kun Owner har tilgang til treningsmodus.');
    if(typeof indexedDB==='undefined')throw new Error('Nettleseren støtter ikke lokal bildelagring.');
    store=await openStore();
    records=(await loadAll()).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt));
    selected=reviewOrder()[0]??-1;
    authorized=true;
    window.dispatchEvent(new Event('dartarena:owner-tip-authorized'));
    // The match view is hidden when the completed game was left in the lobby.
    // Place the review panel outside that hidden match, and do not start a camera.
    if(reviewOnly){
      const match=$('localGame');
      if(match)match.after(panel);
      $('localSetup').hidden=true;
      $('aiTrainControls').hidden=true;
      $('aiTrainReviewDetails').open=true;
    }
    panel.hidden=false;
    say(reviewOnly?
      (records.length?records.length+' treningsbilde(r) funnet i denne nettleseren. Kontroller og eksporter nedenfor.':
        'Ingen treningsbilder funnet i denne nettleseren. Kontroller at innsamling var aktivert under kampen.'):
      'Bildene lagres kun lokalt i nettleseren. Eksporter ZIP for sikkerhetskopi.');
    showReview();setCounter();
    if(!reviewOnly){addResultReviewButton();await syncGame()}
  }catch(e){
    // Fail closed. Nobody without a verified Owner RPC response sees camera, controls or saved images.
    authorized=false;panel.hidden=true;
    console.warn('AI Rival training capture unavailable:',e?.message||String(e));
  }
})();
})();
