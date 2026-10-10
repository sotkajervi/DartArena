/* DartArena Autoscoring Lab – browser-only experimental image difference.
   This is NOT an ML dart-tip detector and never submits gameplay scores. */
(function(){
  'use strict';
  const G=window.DartArenaLabGeometry;
  const AI=window.DartArenaLabAI;
  const $=id=>document.getElementById(id);
  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase?.createClient(SUPABASE_URL,KEY);
  const els={
    gate:$('labGate'),app:$('labApp'),camera:$('labCamera'),start:$('labStart'),
    stop:$('labStop'),video:$('labVideo'),overlay:$('labOverlay'),stage:$('labStage'),
    stageMessage:$('labStageMessage'),cameraState:$('labCameraState'),calibrate:$('labCalibrate'),
    baseline:$('labBaseline'),reset:$('labReset'),step:$('labStep'),coords:$('labCoords'),
    analysisState:$('labAnalysisState'),motion:$('labMotion'),count:$('labCount'),
    accuracy:$('labAccuracy'),proposal:$('labProposal'),proposalDetail:$('labProposalDetail'),
    confirm:$('labConfirm'),reject:$('labReject'),log:$('labLog'),export:$('labExport'),
    newRound:$('labNewRound'),aiState:$('labAiState'),aiFile:$('labAiFile'),
    aiMode:$('labAiMode'),aiKeypoint:$('labAiKeypoint'),aiThreshold:$('labAiThreshold'),
    aiLoad:$('labAiLoad'),aiTest:$('labAiTest'),aiMessage:$('labAiMessage')
  };
  if(!db||!G||!els.app)return;

  let authorized=false,stream=null,starting=false,epoch=0,calibrating=false;
  let calibrationPoints=[],board=null,baseline=null,previous=null,samples=[];
  let pending=null,selected=null,stableFrames=0,records=[],tickTimer=0,lastAnalysis=null;
  let aiLoading=false,aiInferring=false,aiSerial=0;
  const analysisCanvas=document.createElement('canvas');
  const analysisContext=analysisCanvas.getContext('2d',{willReadFrequently:true});
  const ctx=els.overlay.getContext('2d');
  const ANALYSIS_INTERVAL=240;
  const MIN_CHANGED_RATIO=.003;
  const DIFF_THRESHOLD=87;
  let authRequest=0;

  function status(message){els.analysisState.textContent=message}
  function showStage(message){els.stageMessage.textContent=message;els.stageMessage.hidden=!message}
  function cameraStatus(message){els.cameraState.textContent=message}
  function updateButtons(){
    const live=!!stream,ready=live&&!!board,active=ready&&!!baseline;
    els.start.disabled=!authorized||live||starting;
    els.stop.disabled=!live;
    els.calibrate.disabled=!live;
    els.baseline.disabled=!ready;
    els.reset.disabled=!live;
    els.confirm.disabled=!active||!selected;
    els.reject.disabled=!active||!pending;
    els.newRound.disabled=!ready;
    els.export.disabled=!records.length;
    els.camera.disabled=!authorized||live||starting;
    els.aiLoad.disabled=!authorized||aiLoading;
    els.aiTest.disabled=!authorized||!ready||!AI?.ready()||aiInferring;
    els.aiFile.disabled=!authorized||aiLoading;
  }
  function updateStats(){
    els.count.textContent=String(records.length);
    const measurable=records.filter(r=>r.suggested!==null);
    const correct=measurable.filter(r=>r.suggested===r.actual).length;
    els.accuracy.textContent=measurable.length?((correct/measurable.length)*100).toFixed(1)+' %':'–';
    els.log.replaceChildren();
    if(!records.length){const p=document.createElement('p');p.className='muted compact';p.textContent='Ingen registrerte testkast.';els.log.appendChild(p);return}
    for(const r of [...records].reverse().slice(0,60)){
      const div=document.createElement('div');
      div.className='lab-log-row';
      const l=document.createElement('div'),text=document.createElement('span'),b=document.createElement('strong');
      text.textContent='#'+r.number+' · '+new Date(r.timestamp).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' · ';
      b.textContent=r.actual+' ('+r.points+' poeng)';
      l.append(text,b);
      const side=document.createElement('span');
      side.textContent=r.suggested?('AI: '+r.suggested+(r.suggested===r.actual?' ✓':' ✕')):'Manuell / grovt forslag';
      div.append(l,side);els.log.appendChild(div);
    }
  }
  function clearProposal(message='Ingen forslag'){
    aiSerial++;pending=null;selected=null;stableFrames=0;
    els.proposal.textContent=message;
    els.proposalDetail.textContent='Klikk på pilspissen i kamerabildet for å angi fasit ved registrert kast.';
    updateButtons();drawOverlay();
  }
  function resetAnalysis(clearRecords){
    aiSerial++;baseline=null;previous=null;lastAnalysis=null;samples=[];pending=null;selected=null;stableFrames=0;
    if(clearRecords){records=[];updateStats()}
    els.motion.textContent='–';clearProposal();
  }
  function stopCamera(){
    epoch++;starting=false;
    if(tickTimer){clearInterval(tickTimer);tickTimer=0}
    if(stream){for(const track of stream.getTracks())track.stop();stream=null}
    els.video.pause();els.video.srcObject=null;
    resetAnalysis(false);calibrating=false;calibrationPoints=[];board=null;
    ctx.clearRect(0,0,els.overlay.width,els.overlay.height);
    showStage('Kamera stoppet');cameraStatus('Kamera av');status('Ikke startet');
    updateButtons();
  }
  function revokeAccess(message){
    authorized=false;stopCamera();
    els.app.hidden=true;els.gate.hidden=false;els.gate.textContent=message;
  }
  async function checkAccess(){
    const request=++authRequest;
    try{
      const {data:userData,error:userError}=await db.auth.getUser();
      if(request!==authRequest)return;
      if(userError||!userData?.user){revokeAccess('Du må logge inn for å bruke denne testsiden.');return}
      const [a,o]=await Promise.all([db.rpc('is_admin'),db.rpc('is_owner')]);
      if(request!==authRequest)return;
      if(a.error||o.error||!(a.data===true||o.data===true)){revokeAccess('Ingen tilgang. Autoscoring Lab er reservert for Owner og Admin.');return}
      authorized=true;els.gate.hidden=true;els.app.hidden=false;updateButtons();
    }catch(e){
      if(request===authRequest)revokeAccess('Kunne ikke bekrefte tilgang. Prøv igjen senere.');
    }
  }
  function readFrame(){
    const w=analysisCanvas.width,h=analysisCanvas.height;
    if(!analysisContext||!stream||!els.video.videoWidth||!w||!h)return null;
    try{analysisContext.drawImage(els.video,0,0,w,h);return analysisContext.getImageData(0,0,w,h).data}
    catch(e){return null}
  }
  function rebuildSamples(){
    if(!board||!analysisCanvas.width)return;
    const sx=els.overlay.width/analysisCanvas.width,sy=els.overlay.height/analysisCanvas.height;
    const arr=[];
    for(let y=2;y<analysisCanvas.height-2;y+=2){
      for(let x=2;x<analysisCanvas.width-2;x+=2){
        const q=G.normalize(board,{x:x*sx,y:y*sy});
        if(q.x*q.x+q.y*q.y<=1.05*1.05)arr.push([((y*analysisCanvas.width)+x)*4,x,y]);
      }
    }
    samples=arr;
  }
  function captureReference(clearPending=true){
    if(!board||!stream)return;
    const pixels=readFrame();
    if(!pixels){status('Venter på videobilde');return}
    baseline=new Uint8ClampedArray(pixels);
    previous=new Uint8ClampedArray(pixels);
    lastAnalysis=null;stableFrames=0;
    rebuildSamples();
    if(clearPending)clearProposal();
    status('Venter på kast');els.motion.textContent='0';
    els.step.textContent='Kast en pil. Ved varsel: klikk pilspissen.';
    updateButtons();
  }
  function detectionTick(){
    if(!authorized||!baseline||!board||!stream||calibrating)return;
    const pixels=readFrame();if(!pixels)return;
    let changed=0,moving=0,sumx=0,sumy=0;
    for(const [i,x,y] of samples){
      const d=Math.abs(pixels[i]-baseline[i])+Math.abs(pixels[i+1]-baseline[i+1])+Math.abs(pixels[i+2]-baseline[i+2]);
      const d2=Math.abs(pixels[i]-previous[i])+Math.abs(pixels[i+1]-previous[i+1])+Math.abs(pixels[i+2]-previous[i+2]);
      if(d>DIFF_THRESHOLD){changed++;sumx+=x;sumy+=y}
      if(d2>DIFF_THRESHOLD)moving++;
    }
    previous=new Uint8ClampedArray(pixels);lastAnalysis=pixels;
    els.motion.textContent=String(changed);
    if(pending||selected)return;
    const minChanged=Math.max(20,Math.floor(samples.length*MIN_CHANGED_RATIO));
    const maxChanged=samples.length*.23;
    if(changed>maxChanged){stableFrames=0;status('Stor bildeendring – sjekk lys eller kamera');return}
    if(changed<minChanged){stableFrames=0;status('Venter på kast');return}
    if(moving<Math.max(7,Math.round(changed*.08)))stableFrames++;else stableFrames=0;
    status(stableFrames>=3?'Mulig kast registrert':('Kontrollerer endring · '+stableFrames+'/3'));
    if(stableFrames<3)return;
    // Diff centroid is only a rough candidate; not a trained dart-tip detector.
    const candidate={x:sumx/changed*(els.overlay.width/analysisCanvas.width),
                     y:sumy/changed*(els.overlay.height/analysisCanvas.height)};
    const guess=G.score(board,candidate);
    pending={candidate,suggested:guess.label,changed};
    els.proposal.textContent='Grovt forslag: '+guess.label;
    els.proposalDetail.textContent='Bildeendring oppdaget. Dette er IKKE presis AI-gjenkjenning: klikk pilspissen på videoen for å sette fasit før bekreftelse.';
    els.step.textContent='Klikk pilspissen – kontroller treffet.';
    updateButtons();drawOverlay();
    if(AI?.ready())void analyseAIFrame(pending,false);
  }
  function drawCross(point,color,radius=9){
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(point.x-radius-6,point.y);ctx.lineTo(point.x+radius+6,point.y);
    ctx.moveTo(point.x,point.y-radius-6);ctx.lineTo(point.x,point.y+radius+6);ctx.stroke();ctx.restore();
  }
  function drawOverlay(){
    const w=els.overlay.width,h=els.overlay.height;
    ctx.clearRect(0,0,w,h);
    if(board){
      ctx.save();
      ctx.translate(board.bull.x,board.bull.y);
      ctx.transform(board.vx.x,board.vx.y,board.vy.x,board.vy.y,0,0);
      ctx.lineWidth=.006;
      ctx.strokeStyle='rgba(0,234,244,.72)';
      for(const r of [G.RINGS.singleBull,G.RINGS.tripleInner,G.RINGS.tripleOuter,G.RINGS.doubleInner,1]){
        ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();
      }
      ctx.lineWidth=.003;ctx.strokeStyle='rgba(255,255,255,.28)';
      for(let i=0;i<20;i++){
        const a=(i-.5)*Math.PI/10;
        const x=Math.sin(a),y=-Math.cos(a);
        ctx.beginPath();ctx.moveTo(x*.1,y*.1);ctx.lineTo(x,y);ctx.stroke();
      }
      ctx.restore();
      drawCross(board.bull,'#00eaf4',5);
    }
    if(calibrating){
      calibrationPoints.forEach((p,i)=>{drawCross(p,'#ffbf54',7);ctx.fillStyle='#fff';ctx.font='bold 16px system-ui';ctx.fillText(String(i+1),p.x+13,p.y-10)});
    }
    if(pending?.candidate)drawCross(pending.candidate,'#ffbf54',13);
    if(pending?.ai?.point)drawCross(pending.ai.point,'#ff4fda',12);
    if(selected)drawCross(selected.point,'#00ff9a',11);
  }
  async function loadDevices(){
    if(!navigator.mediaDevices?.enumerateDevices)return;
    try{
      const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
      const current=els.camera.value;
      els.camera.replaceChildren();
      if(!devices.length){const o=document.createElement('option');o.value='';o.textContent='Standardkamera';els.camera.appendChild(o);return}
      for(let i=0;i<devices.length;i++){
        const o=document.createElement('option');o.value=devices[i].deviceId;
        o.textContent=devices[i].label||'Kamera '+(i+1);
        els.camera.appendChild(o);
      }
      const pref=localStorage.getItem('dartarena-preferred-camera');
      if(devices.some(d=>d.deviceId===current))els.camera.value=current;
      else if(devices.some(d=>d.deviceId===pref))els.camera.value=pref;
    }catch(e){cameraStatus('Kunne ikke hente kameravalget')}
  }
  async function startCamera(){
    if(!authorized||starting||stream)return;
    if(!navigator.mediaDevices?.getUserMedia){status('Kamera krever HTTPS/localhost og en støttet nettleser');return}
    starting=true;updateButtons();
    const ticket=++epoch;
    try{
      // Authorize again before asking for camera access.
      const [user,a,o]=await Promise.all([db.auth.getUser(),db.rpc('is_admin'),db.rpc('is_owner')]);
      if(!user.data?.user||user.error||a.error||o.error||!(a.data===true||o.data===true))throw new Error('Tilgang er ikke godkjent.');
      const deviceId=els.camera.value;
      const s=await navigator.mediaDevices.getUserMedia({audio:false,video:{
        ...(deviceId?{deviceId:{exact:deviceId}}:{}),width:{ideal:1280},
        height:{ideal:720},frameRate:{ideal:30,max:30}}});
      if(ticket!==epoch||!authorized){s.getTracks().forEach(t=>t.stop());return}
      stream=s;
      els.video.srcObject=s;
      await els.video.play();
      if(ticket!==epoch||!authorized){stopCamera();return}
      const w=els.video.videoWidth,h=els.video.videoHeight;
      els.stage.style.aspectRatio=w+' / '+h;
      els.overlay.width=w;els.overlay.height=h;
      const factor=Math.min(1,720/w);
      analysisCanvas.width=Math.round(w*factor);
      analysisCanvas.height=Math.round(h*factor);
      calibrationPoints=[];board=null;resetAnalysis(true);
      showStage('');cameraStatus(w+'×'+h+' • lokal videostrøm');
      status('Kamera klart');els.step.textContent='Steg 2: Kalibrer skiven med fem klikk';
      await loadDevices();
      const track=s.getVideoTracks()[0];
      track?.addEventListener('ended',()=>{if(ticket===epoch)stopCamera()},{once:true});
      if(ticket===epoch)tickTimer=setInterval(detectionTick,ANALYSIS_INTERVAL);
    }catch(e){
      if(ticket===epoch){stopCamera();status('Kunne ikke starte kamera: '+(e?.name==='NotAllowedError'?'tilgang blokkert':e?.message||e?.name||'ukjent feil'))}
    }finally{if(ticket===epoch){starting=false;updateButtons()}}
  }
  function startCalibration(){
    if(!stream||!authorized)return;
    resetAnalysis(true);board=null;calibrationPoints=[];calibrating=true;
    els.step.textContent='Klikk 1/5: '+G.CALIBRATION_NAMES[0];
    status('Kalibrering pågår');updateButtons();drawOverlay();
  }
  function overlayClick(event){
    if(!authorized||!stream)return;
    const rect=els.overlay.getBoundingClientRect();
    const point={x:(event.clientX-rect.left)/rect.width*els.overlay.width,
      y:(event.clientY-rect.top)/rect.height*els.overlay.height};
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>els.overlay.width||point.y<0||point.y>els.overlay.height)return;
    els.coords.textContent=Math.round(point.x)+', '+Math.round(point.y);
    if(calibrating){
      calibrationPoints.push(point);
      if(calibrationPoints.length===5){
        try{
          board=G.prepare(calibrationPoints);calibrating=false;status('Kalibrering OK');
          els.step.textContent='Steg 3: Fjern pilene og ta referansebilde';
          els.proposalDetail.textContent='Skiveringer vises som turkise hjelpelinjer. Kalibrer på nytt ved feil plassering.';
        }catch(e){
          board=null;calibrationPoints=[];calibrating=false;status(e.message);
          els.step.textContent='Ugyldig kalibrering – trykk Kalibrer skive på nytt';
        }
      }else{els.step.textContent='Klikk '+(calibrationPoints.length+1)+'/5: '+G.CALIBRATION_NAMES[calibrationPoints.length]}
      updateButtons();drawOverlay();return;
    }
    if(!board||!baseline)return;
    const actual=G.score(board,point);
    selected={point,label:actual.label,points:actual.points};
    els.proposal.textContent='Valgt treff: '+actual.label+' · '+actual.points+' poeng';
    els.proposalDetail.textContent=pending?.ai?'AI foreslo '+pending.ai.label+' ('+Math.round(pending.ai.confidence*100)+' %). Bekreft grønn markering som fasit.':pending?'Grovt forslag: '+pending.suggested+'. Bekreft grønn markering som fasit.':'Manuelt treff valgt. Bekreft for å loggføre.';
    updateButtons();drawOverlay();
  }
  function confirmSelection(){
    if(!authorized||!board||!selected||!baseline)return;
    records.push({number:records.length+1,timestamp:new Date().toISOString(),
      actual:selected.label,points:selected.points,suggested:pending?.ai?.label||null,
      heuristic:pending?.suggested||null,modelConfidence:pending?.ai?.confidence??null,
      modelName:pending?.ai?.label?AI?.name():null,
      x:Number(selected.point.x.toFixed(1)),y:Number(selected.point.y.toFixed(1)),
      method:'manual-verified',analysis:pending?.ai?'onnx-model':'frame-difference-centroid'});
    updateStats();captureReference();
    status('Treff bekreftet, referanse oppdatert');els.step.textContent='Kast neste pil, eller velg Ny runde når skiven er tom';
  }
  function exportResults(){
    if(!authorized||!records.length)return;
    const data={version:1,source:'DartArena Autoscoring Lab',
      warning:'Modellforslag er bare forsøksdata og bekreftes manuelt. Fasit er valgt av brukeren.',
      exportedAt:new Date().toISOString(),videoIncluded:false,photosIncluded:false,
      calibration:board?{resolution:[els.overlay.width,els.overlay.height],points:board.points}:null,
      records:records.map(r=>({...r}))};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const href=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=href;a.download='dartarena-autoscoring-test-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  async function loadAIModel(){
    if(!authorized||aiLoading||!AI)return;
    const file=els.aiFile.files?.[0];
    if(!file){els.aiMessage.textContent='Velg en .onnx-modell først. DartArena inneholder foreløpig ikke ferdigtrente modellvekter.';return}
    aiLoading=true;els.aiState.textContent='Laster modell…';updateButtons();
    try{
      const meta=await AI.load(file);
      if(!authorized){els.aiState.textContent='Ingen tilgang';return}
      AI.setOptions({mode:els.aiMode.value,keypointIndex:els.aiKeypoint.value,threshold:els.aiThreshold.value});
      els.aiState.textContent='AI klar';
      els.aiMessage.textContent='ONNX-modell '+meta.name+' lastet lokalt ('+meta.width+'×'+meta.height+'). '+(els.aiMode.value==='keypoint'?'Tolker nøkkelpunktet som pilspiss.':'Tolker bokssentrum som et grovt treffpunkt.')+' Trykk Analyser kamerabilde eller kast etter kalibrering.';
    }catch(e){
      els.aiState.textContent=AI.ready()?'Tidligere modell klar':'Ingen modell';
      els.aiMessage.textContent='Modellfeil: '+(e?.message||String(e));
    }finally{aiLoading=false;updateButtons()}
  }
  async function analyseAIFrame(proposal,manual){
    if(!authorized||!AI?.ready()||!board||!stream||aiInferring)return;
    aiInferring=true;
    const ticket=++aiSerial;
    els.aiState.textContent='Analyserer…';
    updateButtons();
    try{
      AI.setOptions({mode:els.aiMode.value,keypointIndex:els.aiKeypoint.value,threshold:els.aiThreshold.value});
      const result=await AI.infer(els.video);
      if(ticket!==aiSerial||!authorized||!board||!stream)return;
      if(proposal&&pending!==proposal)return;
      // Ignore detections outside the scored area; no AI result is stored as a match score.
      const found=result.detections.filter(d=>{
        const p=G.normalize(board,{x:d.x,y:d.y});
        return p.x*p.x+p.y*p.y<=1.05*1.05;
      });
      const near=proposal?.candidate;
      if(near)found.sort((a,b)=>{
        const da=Math.hypot(a.x-near.x,a.y-near.y)-a.confidence*30;
        const db=Math.hypot(b.x-near.x,b.y-near.y)-b.confidence*30;
        return da-db;
      });
      if(!found.length){
        els.aiState.textContent='AI: ingen pil funnet';
        els.aiMessage.textContent='Modellen fant ikke en pilspiss over valgt konfidens. Prøv bedre lys, lavere terskel eller en modell som er trent for ditt kamera.';
        return;
      }
      const d=found[0];
      const scored=G.score(board,{x:d.x,y:d.y});
      if(!pending){
        pending={candidate:{x:d.x,y:d.y},suggested:null,changed:0};
      }
      pending.ai={label:scored.label,point:{x:d.x,y:d.y},confidence:d.confidence};
      els.aiState.textContent='AI: '+scored.label;
      els.aiMessage.textContent='AI fant '+found.length+' kandidat(er). Beste forslag: '+scored.label+', '+Math.round(d.confidence*100)+' % konfidens ('+(result.method==='keypoint'?'pilspiss-nøkkelpunkt':'bokssentrum')+'). Klikk faktisk treffpunkt for å kontrollere.';
      if(!selected){
        els.proposal.textContent='AI-forslag: '+scored.label+' · '+scored.points+' poeng';
        els.proposalDetail.textContent='Magenta markering = modellens forslag. Klikk pilspissen for grønn fasit, deretter Bekreft valgt treff.';
      }
      drawOverlay();
    }catch(e){
      if(ticket===aiSerial){els.aiState.textContent='AI-feil';els.aiMessage.textContent='Analysefeil: '+(e?.message||String(e))}
    }finally{
      aiInferring=false;
      updateButtons();
    }
  }
  els.aiLoad.addEventListener('click',loadAIModel);
  els.aiTest.addEventListener('click',()=>analyseAIFrame(pending,true));
  for(const el of [els.aiMode,els.aiKeypoint,els.aiThreshold]){
    el.addEventListener('change',()=>{if(AI?.ready()){
      AI.setOptions({mode:els.aiMode.value,keypointIndex:els.aiKeypoint.value,threshold:els.aiThreshold.value});
      els.aiMessage.textContent='Modellinnstillinger oppdatert. Test på nytt for å se nye resultater.';
    }});
  }
  els.start.addEventListener('click',startCamera);
  els.stop.addEventListener('click',stopCamera);
  els.calibrate.addEventListener('click',startCalibration);
  els.baseline.addEventListener('click',()=>captureReference());
  els.reset.addEventListener('click',()=>{resetAnalysis(true);calibrationPoints=[];board=null;calibrating=false;status('Nullstilt');els.step.textContent='Kalibrer skiven på nytt';drawOverlay();updateButtons()});
  els.newRound.addEventListener('click',()=>{if(!authorized||!board)return;captureReference();status('Ny runde: referanse oppdatert')});
  els.confirm.addEventListener('click',confirmSelection);
  els.reject.addEventListener('click',()=>{captureReference();status('Forslag avvist – ny referanse tatt')});
  els.export.addEventListener('click',exportResults);
  els.overlay.addEventListener('click',overlayClick);
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{if(!stream&&authorized)loadDevices()});
  db.auth.onAuthStateChange(()=>setTimeout(checkAccess,0));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else checkAccess()});
  window.addEventListener('pagehide',stopCamera);
  setInterval(checkAccess,60000);
  if(!G.runSanityChecks()){revokeAccess('Intern geometritest feilet. Kameraet er deaktivert.');return}
  updateButtons();updateStats();checkAccess().then(()=>{if(authorized)loadDevices()});
})();