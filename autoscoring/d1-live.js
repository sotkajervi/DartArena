/* D1 live test zone. Local-only experiments: never sends scoring to Supabase.
   Supabase is used only for Owner/Admin authorization. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const e={
  gate:$('dzGate'),app:$('dzApp'),camera:$('dzCamera'),start:$('dzStart'),stop:$('dzStop'),
  stage:$('dzStage'),video:$('dzVideo'),snapshot:$('dzSnapshot'),overlay:$('dzOverlay'),
  hint:$('dzStageHint'),camState:$('dzCameraState'),autoCal:$('dzAutoCal'),
  manualCal:$('dzManualCal'),undo:$('dzUndo'),calState:$('dzCalibrationState'),
  reference:$('dzReference'),analyze:$('dzAnalyze'),next:$('dzNext'),status:$('dzStatus'),
  file:$('dzFile'),load:$('dzLoad'),modelState:$('dzModelState'),threshold:$('dzThreshold'),
  auto:$('dzAuto'),sensitivity:$('dzSensitivity'),modelMessage:$('dzModelMessage'),
  count:$('dzCount'),acc:$('dzAcc'),proposal:$('dzProposal'),error:$('dzError'),
  tipState:$('dzTipState'),diagnostics:$('dzDiagnostics'),confirm:$('dzConfirm'),reject:$('dzReject'),
  export:$('dzExport'),log:$('dzLog')
};
const G=window.DartArenaLabGeometry,D=window.DartArenaLabDeepDarts,
      autoCal=window.DartArenaAutoCalibration;
if(!window.supabase||!G||!D||!autoCal){
  e.gate.textContent='Et nødvendig bibliotek kunne ikke lastes. Oppdater siden.';
  return;
}
const db=window.supabase.createClient(
  'https://jqpxlbhwvskhjbqrbidk.supabase.co',
  'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
);
const ctx=e.overlay.getContext('2d'),shotCtx=e.snapshot.getContext('2d',{alpha:false});
const sampleCanvas=document.createElement('canvas');
sampleCanvas.width=160;sampleCanvas.height=90;
const sampleCtx=sampleCanvas.getContext('2d',{willReadFrequently:true});
let authorized=false,authTicket=0,stream=null,starting=false,loading=false,busy=false;
let epoch=0,timer=0,calibrating=false,calPoints=[],board=null,autoEstimated=false;
let referencePixels=null,lastPixels=null,stableTicks=0,cooldown=0;
let frozen=false,predictions=[],lastDiagnostic=null,selected=null,records=[],shotSource='manual',shotTime=null;
function setStatus(message){e.status.textContent=message}
function setCalState(message){e.calState.textContent=message}
function fmt(n){return Number.isFinite(n)?Math.round(n*10)/10:null}
function updateButtons(){
  const active=authorized&&!!stream;
  e.start.disabled=!authorized||!!stream||starting;
  e.stop.disabled=!stream;
  e.load.disabled=!authorized||loading||D.ready();
  e.autoCal.disabled=!active||frozen||busy||calibrating;
  e.manualCal.disabled=!active||frozen||busy;
  e.undo.disabled=!active||!calibrating||!calPoints.length;
  e.reference.disabled=!active||frozen||busy||calibrating;
  e.analyze.disabled=!active||!D.ready()||frozen||busy||calibrating;
  e.next.disabled=!active||!frozen||busy;
  e.confirm.disabled=!active||!frozen||busy||!selected;
  e.reject.disabled=!active||!frozen||busy;
  e.export.disabled=!records.length;
  e.auto.disabled=!authorized;
}
function showHint(message){e.hint.hidden=!message;if(message)e.hint.textContent=message}
function screenPoint(evt){
  const r=e.overlay.getBoundingClientRect();
  return {x:(evt.clientX-r.left)/r.width*e.overlay.width,
          y:(evt.clientY-r.top)/r.height*e.overlay.height};
}
function cross(x,y,color,size){
  ctx.strokeStyle=color;ctx.lineWidth=2.6;ctx.beginPath();
  ctx.moveTo(x-size,y);ctx.lineTo(x+size,y);
  ctx.moveTo(x,y-size);ctx.lineTo(x,y+size);ctx.stroke();
}
function drawRing(radius,color,width=1){
  ctx.beginPath();
  for(let i=0;i<=120;i++){
    const a=i*2*Math.PI/120;
    const p=G.project(board,{x:Math.sin(a)*radius,y:-Math.cos(a)*radius});
    if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
  }
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function draw(){
  ctx.clearRect(0,0,e.overlay.width,e.overlay.height);
  if(board){
    for(const r of [G.RINGS.doubleOuter,G.RINGS.doubleInner,
      G.RINGS.tripleOuter,G.RINGS.tripleInner,G.RINGS.singleBull,G.RINGS.doubleBull]){
      drawRing(r,'rgba(0,234,244,.7)',1.5);
    }
    for(let i=0;i<20;i++){
      const a=(i+.5)*Math.PI/10;
      const p1=G.project(board,{x:Math.sin(a)*G.RINGS.singleBull,y:-Math.cos(a)*G.RINGS.singleBull});
      const p2=G.project(board,{x:Math.sin(a),y:-Math.cos(a)});
      ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);
      ctx.strokeStyle='rgba(0,234,244,.5)';ctx.lineWidth=1;ctx.stroke();
    }
  }
  if(calibrating)calPoints.forEach((p,i)=>{
    cross(p.x,p.y,'#ffe275',8);
    ctx.font='bold 15px sans-serif';ctx.fillStyle='#ffe275';
    ctx.fillText(String(i+1),p.x+9,p.y-9);
  });
  if(frozen){
    predictions.forEach((p,i)=>{
      cross(p.x,p.y,'#ff45ed',11);
      ctx.fillStyle='#ff45ed';ctx.font='bold 14px sans-serif';
      ctx.fillText(String(i+1)+' • '+Math.round(p.confidence*100)+'%',p.x+12,p.y-12);
    });
    if(selected)cross(selected.x,selected.y,'#00ff9a',13);
  }
}
function resetFrame(){
  frozen=false;selected=null;predictions=[];shotTime=null;stableTicks=0;
  e.snapshot.hidden=true;e.video.hidden=false;e.tipState.textContent='Analyser et kast, og klikk på den faktiske pilspissen i det fryste bildet.';
  e.proposal.textContent='–';e.error.textContent='–';draw();updateButtons();
}
function stopCamera(){
  epoch++;starting=false;
  if(timer){clearInterval(timer);timer=0}
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  e.video.pause();e.video.srcObject=null;
  referencePixels=null;lastPixels=null;calPoints=[];calibrating=false;
  board=null;autoEstimated=false;
  resetFrame();showHint('Kamera stoppet');e.camState.textContent='Kamera av';
  setCalState('Ingen kalibrering. Velg automatisk estimat eller manuell 9-punktskalibrering.');
  updateButtons();
}
function revoke(message){
  authorized=false;stopCamera();e.app.hidden=true;e.gate.hidden=false;
  e.gate.textContent=message;
}
async function checkAccess(){
  const current=++authTicket;
  try{
    const u=await db.auth.getUser();
    if(current!==authTicket)return;
    if(u.error||!u.data?.user){revoke('Logg inn for å bruke testsiden.');return}
    const [a,o]=await Promise.all([db.rpc('is_admin'),db.rpc('is_owner')]);
    if(current!==authTicket)return;
    if(a.error||o.error||!(a.data===true||o.data===true)){
      revoke('Ingen tilgang. D1 Live-testsone er bare for Owner og Admin.');return;
    }
    authorized=true;e.gate.hidden=true;e.app.hidden=false;updateButtons();
  }catch(error){if(current===authTicket)revoke('Kunne ikke kontrollere tilgangen. Oppdater siden.')}
}
async function loadDevices(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  try{
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const current=e.camera.value,preferred=localStorage.getItem('dartarena-preferred-camera');
    e.camera.replaceChildren();
    if(!devices.length){
      const o=document.createElement('option');o.value='';o.textContent='Standardkamera';e.camera.appendChild(o);
    }
    devices.forEach((device,i)=>{
      const o=document.createElement('option');o.value=device.deviceId;
      o.textContent=device.label||'Kamera '+(i+1);e.camera.appendChild(o);
    });
    if(devices.some(d=>d.deviceId===current))e.camera.value=current;
    else if(devices.some(d=>d.deviceId===preferred))e.camera.value=preferred;
  }catch(error){e.camState.textContent='Kameraliste ikke tilgjengelig'}
}
async function startCamera(){
  if(!authorized||stream||starting)return;
  if(!navigator.mediaDevices?.getUserMedia){setStatus('Kamera krever HTTPS/localhost og en kompatibel nettleser.');return}
  starting=true;updateButtons();const ticket=++epoch;
  try{
    const [u,a,o]=await Promise.all([db.auth.getUser(),db.rpc('is_admin'),db.rpc('is_owner')]);
    if(u.error||!u.data?.user||a.error||o.error||!(a.data===true||o.data===true))
      throw new Error('Tilgang ikke bekreftet.');
    const deviceId=e.camera.value;
    const s=await navigator.mediaDevices.getUserMedia({audio:false,video:{
      ...(deviceId?{deviceId:{exact:deviceId}}:{}),
      width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30}
    }});
    if(ticket!==epoch||!authorized){s.getTracks().forEach(t=>t.stop());return}
    stream=s;e.video.srcObject=s;
    await e.video.play();
    if(ticket!==epoch||!authorized){stopCamera();return}
    const w=e.video.videoWidth,h=e.video.videoHeight;
    e.stage.style.aspectRatio=w+' / '+h;
    e.snapshot.width=e.overlay.width=w;
    e.snapshot.height=e.overlay.height=h;
    showHint('');e.camState.textContent=w+' × '+h;
    setStatus('Kamera klart. Forsøk autokalibrering, eller velg ni punkter manuelt.');
    await loadDevices();
    s.getVideoTracks()[0]?.addEventListener('ended',()=>{if(ticket===epoch)stopCamera()},{once:true});
    timer=setInterval(autoTick,350);
  }catch(error){
    if(ticket===epoch){stopCamera();setStatus('Kamera kunne ikke startes: '+(error?.message||String(error)))}
  }finally{if(ticket===epoch){starting=false;updateButtons()}}
}
async function loadModel(){
  if(!authorized||loading||D.ready())return;
  const file=e.file.files?.[0];
  if(!file){e.modelMessage.textContent='Velg model.tflite fra PC-en først.';return}
  loading=true;updateButtons();e.modelState.textContent='Laster …';
  try{
    const result=await D.load(file);
    if(!authorized)return;
    e.modelState.textContent='D1 klar';
    e.modelMessage.textContent=result.name+' er lastet lokalt ('+result.input.join(' × ')+'). Ingen modellvekter er sendt til server.';
  }catch(error){
    e.modelState.textContent='Kunne ikke laste';
    e.modelMessage.textContent='Feil ved D1-innlasting: '+(error?.message||String(error));
  }finally{loading=false;updateButtons()}
}
function startManual(){
  if(!stream||frozen||busy)return;
  board=null;autoEstimated=false;calPoints=[];calibrating=true;referencePixels=null;lastPixels=null;
  setCalState('Klikk 1/9: '+G.CALIBRATION_NAMES[0]);
  setStatus('Manuell kalibrering. Klikk direkte på videobildet.');
  draw();updateButtons();
}
function undoCal(){
  if(!calibrating||!calPoints.length)return;
  calPoints.pop();
  setCalState('Klikk '+(calPoints.length+1)+'/9: '+G.CALIBRATION_NAMES[calPoints.length]);
  draw();updateButtons();
}
function tryAutoCalibration(){
  if(!stream||frozen||busy||calibrating)return;
  const video=e.video,w=video.videoWidth,h=video.videoHeight;
  if(!w||!h)return;
  const scale=Math.min(1,640/w);const cw=Math.round(w*scale),ch=Math.round(h*scale);
  const c=document.createElement('canvas');c.width=cw;c.height=ch;
  const cctx=c.getContext('2d',{willReadFrequently:true});
  cctx.drawImage(video,0,0,cw,ch);
  try{
    const hit=autoCal.detect(cctx.getImageData(0,0,cw,ch));
    if(!hit)throw new Error('Farge-/ringdetektoren fant ikke skiven sikkert.');
    const sx=w/cw,sy=h/ch;
    const x=hit.x*sx,y=hit.y*sy,r=hit.radius*(sx+sy)/2;
    const pts=[{x,y}];
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      pts.push({x:x+r*Math.sin(a),y:y-r*Math.cos(a)});
    }
    const next=G.prepare(pts);
    board=next;calPoints=pts;autoEstimated=true;
    setCalState('AUTO-ESTIMAT ('+Math.round(hit.score*100)+' % ringmatch). 20 er antatt øverst. Se nøye at turkise linjer følger skiven. Ved feil: bruk manuell kalibrering.');
    setStatus('Autokalibrering foreslått – IKKE verifisert. Kontroller skiven visuelt.');
  }catch(error){
    setCalState('Autokalibrering feilet: '+(error?.message||String(error))+' Bruk manuell kalibrering (9 punkter).');
  }
  draw();updateButtons();
}
function onOverlayClick(evt){
  if(!authorized||!stream||busy)return;
  const p=screenPoint(evt);
  if(calibrating){
    calPoints.push(p);
    if(calPoints.length===G.CALIBRATION_NAMES.length){
      try{
        board=G.prepare(calPoints);calibrating=false;autoEstimated=false;
        setCalState('Manuelt kalibrert (9 punkter). Kontroller at de turkise linjene ligger på metalltrådene.');
        setStatus('Kalibrering klar. Ta referansebilde før du kaster.');
      }catch(error){
        calPoints.pop();setCalState('Kalibreringen ble avvist: '+(error?.message||String(error))+' Prøv siste punkt på nytt.');
      }
    }else setCalState('Klikk '+(calPoints.length+1)+'/9: '+G.CALIBRATION_NAMES[calPoints.length]);
    draw();updateButtons();return;
  }
  if(!frozen)return;
  selected=p;
  const nearest=nearestPrediction(p);
  const score=board?G.score(board,p):null;
  e.tipState.textContent='Manuell fasit: '+(score?score.label+' ('+score.points+' poeng) · ':'')+
    'x='+Math.round(p.x)+', y='+Math.round(p.y)+
    (nearest?' · nærmeste AI-forslag '+Math.round(nearest.distance)+' px unna':' · AI fant ingen spiss');
  e.error.textContent=nearest?Math.round(nearest.distance)+' px':'Ingen funnet';
  draw();updateButtons();
}
function sample(source){
  try{
    sampleCtx.drawImage(source,0,0,sampleCanvas.width,sampleCanvas.height);
    return sampleCtx.getImageData(0,0,sampleCanvas.width,sampleCanvas.height).data;
  }catch(error){return null}
}
function diffRatio(a,b){
  if(!a||!b||a.length!==b.length)return 0;
  let changed=0,total=0;
  for(let i=0;i<a.length;i+=4){
    const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
    if(d>55)changed++;
    total++;
  }
  return total?changed/total:0;
}
function captureReference(){
  if(!stream||frozen||busy||calibrating)return;
  referencePixels=sample(e.video);lastPixels=null;stableTicks=0;cooldown=Date.now()+1100;
  if(referencePixels)setStatus('Referanse tatt. Kast en pil. Bruk «Analyser nå» eller huk av Auto-test.');
  else setStatus('Kunne ikke lese referansebildet.');
}
function autoTick(){
  if(!authorized||!stream||!e.auto.checked||busy||frozen||calibrating||!D.ready()||!referencePixels)return;
  if(Date.now()<cooldown)return;
  const current=sample(e.video);
  if(!current)return;
  const delta=diffRatio(referencePixels,current),jitter=diffRatio(lastPixels,current);
  const min={high:.0015,normal:.003,low:.009}[e.sensitivity.value]||.003;
  if(delta>min&&delta<.22&&lastPixels&&jitter<.006)stableTicks++;
  else stableTicks=0;
  lastPixels=current;
  if(stableTicks>=3){stableTicks=0;cooldown=Date.now()+2500;analyze('auto')}
}
async function analyze(source){
  if(!authorized||!stream||!D.ready()||frozen||busy||calibrating)return;
  busy=true;shotSource=source;shotTime=new Date().toISOString();
  predictions=[];lastDiagnostic=null;selected=null;
  const ticket=epoch;
  const w=e.video.videoWidth,h=e.video.videoHeight;
  try{
    shotCtx.drawImage(e.video,0,0,w,h);
    e.snapshot.hidden=false;e.video.hidden=true;frozen=true;
    draw();showHint('');updateButtons();
    e.tipState.textContent='D1 analyserer bildet lokalt …';
    setStatus('AI-analyse pågår. Bildet er fryst.');
    const confidence=Math.max(.05,Math.min(.95,Number(e.threshold.value)||.2));
    const region=board?G.boardBounds(board,w,h,.06):{x:0,y:0,width:w,height:h};
    const result=await D.infer(e.snapshot,region,confidence);
    if(ticket!==epoch||!authorized||!stream)return;
    lastDiagnostic={rawCount:result.rawCount??null,byClass:result.diagnostic?.byClass||null,topByClass:result.diagnostic?.topByClass||null,rawStats:result.diagnostic?.rawStats||null};
    e.diagnostics.textContent=JSON.stringify(lastDiagnostic,null,2);
    predictions=(result.detections||[]).filter(p=>[p.x,p.y,p.confidence].every(Number.isFinite))
      .sort((a,b)=>b.confidence-a.confidence);
    const best=predictions[0];
    e.proposal.textContent=best?(board?G.score(board,best).label+' • ':'')+Math.round(best.confidence*100)+' %':'Ingen spiss funnet';
    e.tipState.textContent=predictions.length+' AI-forslag. Klikk den faktiske pilspissen i bildet for fasit, og bekreft. Magenta viser forslag.';
    setStatus('Fryst '+(source==='auto'?'automatisk etter bildeendring':'manuelt')+'; '+predictions.length+' mulige spisser. Ingen score er lagret.');
  }catch(error){
    if(ticket!==epoch||!authorized||!stream)return;
    predictions=[];lastDiagnostic={error:String(error?.message||error)};e.diagnostics.textContent=JSON.stringify(lastDiagnostic,null,2);e.proposal.textContent='Analysefeil';
    e.tipState.textContent='D1 kunne ikke analysere bildet. Du kan markere den faktiske spissen og logge forsøket, eller gå tilbake til live.';
    setStatus('Modellfeil: '+(error?.message||String(error)));
  }finally{if(ticket===epoch){busy=false;draw();updateButtons()}}
}
function nearestPrediction(point){
  let nearest=null;
  for(const p of predictions){
    const distance=Math.hypot(p.x-point.x,p.y-point.y);
    if(!nearest||distance<nearest.distance)nearest={...p,distance};
  }
  return nearest;
}
function updateStats(){
  e.count.textContent=String(records.length);
  e.acc.textContent=records.length?records.filter(r=>r.correctWithin12Px).length+' / '+records.length:'–';
  e.export.disabled=!records.length;
}
function addLog(entry){
  if(records.length===1)e.log.replaceChildren();
  const row=document.createElement('div');row.className='d1-log-item';
  const label=document.createElement('strong');
  label.textContent='#'+records.length+' • '+(entry.actualScore||'Ukalibrert')+
    ' · '+(entry.correctWithin12Px?'Treff ≤12 px':'Avvik / ikke funnet');
  row.appendChild(label);
  const description=document.createElement('div');
  description.textContent=entry.nearestErrorPx!==null?
    'Nærmeste AI: '+entry.nearestErrorPx+' px · '+entry.proposalCount+' forslag':
    'Ingen AI-spiss funnet';
  row.appendChild(description);e.log.prepend(row);
}
function confirm(){
  if(!authorized||!stream||!frozen||busy||!selected)return;
  const closest=nearestPrediction(selected),actual=board?G.score(board,selected):null;
  const record={
    timestamp:shotTime,source:shotSource,model:D.name(),threshold:Number(e.threshold.value),
    autoCalibrationEstimate:autoEstimated,calibrated:!!board,
    actual:{x:fmt(selected.x),y:fmt(selected.y)},actualScore:actual?.label||null,
    actualPoints:actual?.points??null,proposalCount:predictions.length,
    proposals:predictions.map(p=>({x:fmt(p.x),y:fmt(p.y),confidence:fmt(p.confidence)})),
    nearestErrorPx:closest?fmt(closest.distance):null,
    nearestConfidence:closest?fmt(closest.confidence):null,
    nearestScore:closest&&board?G.score(board,closest).label:null,
    modelDiagnostic:lastDiagnostic,
    correctWithin12Px:!!closest&&closest.distance<=12,
    correctScore:!!closest&&!!board&&G.score(board,closest).label===actual.label
  };
  records.push(record);addLog(record);updateStats();
  resume();
  setStatus('Kast #'+records.length+' logget. Referansen er oppdatert – klar for neste pil.');
}
function resume(){
  if(!stream||!frozen||busy)return;
  // Use exactly the frozen frame as the next baseline, including the dart just thrown.
  referencePixels=sample(e.snapshot);lastPixels=null;cooldown=Date.now()+1400;
  resetFrame();setStatus('Live igjen. Referansen er oppdatert til sist fryste bilde.');
}
function exportJson(){
  if(!records.length)return;
  const payload={application:'DartArena D1 live test zone',version:1,
    exportedAt:new Date().toISOString(),note:'Kun manuelle fasitpunkter og modellforslag, ingen bilder.',
    detectionRadiusPx:12,records};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;
  a.download='dartarena-d1-live-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
e.start.addEventListener('click',startCamera);
e.stop.addEventListener('click',stopCamera);
e.load.addEventListener('click',loadModel);
e.autoCal.addEventListener('click',tryAutoCalibration);
e.manualCal.addEventListener('click',startManual);
e.undo.addEventListener('click',undoCal);
e.overlay.addEventListener('click',onOverlayClick);
e.reference.addEventListener('click',captureReference);
e.analyze.addEventListener('click',()=>analyze('manual'));
e.next.addEventListener('click',resume);
e.confirm.addEventListener('click',confirm);
e.reject.addEventListener('click',()=>{resume();setStatus('Forslaget avvist. Fortsett med neste kast.')});
e.export.addEventListener('click',exportJson);
e.camera.addEventListener('change',()=>{if(e.camera.value)localStorage.setItem('dartarena-preferred-camera',e.camera.value)});
db.auth.onAuthStateChange(()=>setTimeout(checkAccess,0));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else checkAccess()});
window.addEventListener('pagehide',stopCamera);
navigator.mediaDevices?.addEventListener?.('devicechange',()=>{if(!stream&&authorized)loadDevices()});
setInterval(checkAccess,60000);
if(!G.runSanityChecks()){revoke('Intern test av skivegeometrien feilet.');return}
updateStats();updateButtons();checkAccess().then(()=>{if(authorized)loadDevices()});
})();