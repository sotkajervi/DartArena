/* DartArena Autoscoring Lab – browser-only experimental image difference.
   This is NOT an ML dart-tip detector and never submits gameplay scores. */
(function(){
  'use strict';
  const G=window.DartArenaLabGeometry;
  const AI=window.DartArenaLabAI;
  const ZIP=window.DartArenaLabZip;
  const $=id=>document.getElementById(id);
  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase?.createClient(SUPABASE_URL,KEY);
  const els={
    gate:$('labGate'),app:$('labApp'),camera:$('labCamera'),start:$('labStart'),
    stop:$('labStop'),video:$('labVideo'),overlay:$('labOverlay'),stage:$('labStage'),
    stageMessage:$('labStageMessage'),cameraState:$('labCameraState'),calibrate:$('labCalibrate'),undo:$('labUndo'),adjust:$('labAdjust'),
    baseline:$('labBaseline'),reset:$('labReset'),step:$('labStep'),coords:$('labCoords'),
    analysisState:$('labAnalysisState'),motion:$('labMotion'),count:$('labCount'),
    accuracy:$('labAccuracy'),proposal:$('labProposal'),proposalDetail:$('labProposalDetail'),
    confirm:$('labConfirm'),reject:$('labReject'),log:$('labLog'),export:$('labExport'),
    newRound:$('labNewRound'),aiState:$('labAiState'),aiFile:$('labAiFile'),
    aiMode:$('labAiMode'),aiKeypoint:$('labAiKeypoint'),aiThreshold:$('labAiThreshold'),
    aiLoad:$('labAiLoad'),aiTest:$('labAiTest'),aiMessage:$('labAiMessage'),
    datasetOptIn:$('labDatasetOptIn'),datasetCount:$('labDatasetCount'),
    datasetExport:$('labDatasetExport'),datasetClear:$('labDatasetClear'),
    datasetState:$('labDatasetState')
  };
  if(!db||!G||!els.app)return;

  let authorized=false,stream=null,starting=false,epoch=0,calibrating=false,adjusting=false,dragging=null;
  let calibrationPoints=[],board=null,baseline=null,previous=null,samples=[];
  let pending=null,selected=null,stableFrames=0,records=[],tickTimer=0,lastAnalysis=null;
  let aiLoading=false,aiInferring=false,aiSerial=0;
  const MAX_DATASET=150;
  let dataset=[];
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
    els.undo.disabled=!calibrating||!calibrationPoints.length;
    els.adjust.disabled=!ready||calibrating;
    els.adjust.textContent=adjusting?'Ferdig med justering':'Finjuster punkter';
    els.baseline.disabled=!ready||adjusting||calibrating;
    els.reset.disabled=!live;
    els.confirm.disabled=!active||!selected||adjusting;
    els.reject.disabled=!active||!pending;
    els.newRound.disabled=!ready;
    els.export.disabled=!records.length;
    els.camera.disabled=!authorized||live||starting;
    els.aiLoad.disabled=!authorized||aiLoading;
    els.aiTest.disabled=!authorized||!ready||adjusting||!AI?.ready()||aiInferring;
    els.aiFile.disabled=!authorized||aiLoading;
    els.datasetOptIn.disabled=!authorized;
    els.datasetExport.disabled=!authorized||!dataset.length;
    els.datasetClear.disabled=!authorized||!dataset.length;
  }
  function updateDatasetState(message){
    els.datasetCount.textContent=dataset.length+' / '+MAX_DATASET+' kast';
    els.datasetState.textContent=message||(dataset.length>=MAX_DATASET?'Maksantall nådd – eksporter ZIP og slett bildene for å starte på nytt.':(els.datasetOptIn.checked?'Lokal innsamling aktiv: bilder lagres bare når du bekrefter treff.':'Av. Bilder fra kameraet lagres ikke.'));
    updateButtons();
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
    resetAnalysis(false);calibrating=false;adjusting=false;dragging=null;calibrationPoints=[];board=null;
    ctx.clearRect(0,0,els.overlay.width,els.overlay.height);
    showStage('Kamera stoppet');cameraStatus('Kamera av');status('Ikke startet');
    updateButtons();
  }
  function revokeAccess(message){
    authorized=false;stopCamera();
    dataset=[];els.datasetOptIn.checked=false;updateDatasetState();
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
    if(!board||!stream||calibrating||adjusting)return;
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
    if(!authorized||!baseline||!board||!stream||calibrating||adjusting)return;
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
  function undoCalibrationPoint(){
    if(!calibrating||!calibrationPoints.length)return;
    calibrationPoints.pop();
    els.step.textContent='Klikk '+(calibrationPoints.length+1)+'/'+G.CALIBRATION_NAMES.length+': '+G.CALIBRATION_NAMES[calibrationPoints.length];
    status('Forrige punkt angret');updateButtons();drawOverlay();
  }
  function toggleAdjustment(){
    if(!authorized||!board||!stream||calibrating)return;
    if(adjusting){
      adjusting=false;dragging=null;els.overlay.classList.remove('calibration-edit');
      status('Kalibrering ferdig · avvik '+board.errorPx.toFixed(1)+' px. Kontroller linjene før referansebilde.');
      els.step.textContent='Er alle ringene på trådene? Ta referansebilde. Ellers finjuster på nytt.';
    }else{
      resetAnalysis(true);
      adjusting=true;els.overlay.classList.add('calibration-edit');
      status('Juster kalibreringen: dra de gule merkene til midten av dobbelringen.');
      els.step.textContent='Dra gule kontrollpunkter; 1 = Bull, 2–9 = doble felter rundt skiven.';
    }
    updateButtons();drawOverlay();
  }
  function pointerDown(event){
    if(!adjusting||!authorized||!board||!stream)return;
    const p=eventToCanvasPoint(event);
    const rect=els.overlay.getBoundingClientRect();
    const radius=24*els.overlay.width/Math.max(1,rect.width);
    let best=-1,distance=Infinity;
    calibrationPoints.forEach((q,i)=>{
      const d=Math.hypot(q.x-p.x,q.y-p.y);
      if(d<distance){distance=d;best=i}
    });
    if(best<0||distance>radius)return;
    dragging={index:best,original:{...calibrationPoints[best]},originalBoard:board,pointerId:event.pointerId};
    els.overlay.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    drawOverlay();
  }
  function pointerMove(event){
    if(!adjusting||!dragging||event.pointerId!==dragging.pointerId)return;
    const p=eventToCanvasPoint(event);
    calibrationPoints[dragging.index]={
      x:Math.min(els.overlay.width,Math.max(0,p.x)),
      y:Math.min(els.overlay.height,Math.max(0,p.y))
    };
    try{
      const trial=G.prepare(calibrationPoints);
      board=trial;
      status('Finjustering · gjennomsnittlig avvik '+trial.errorPx.toFixed(1)+' px');
    }catch(e){
      board=dragging.originalBoard;
      status('Flytt tilbake mot dobbelringen: '+e.message);
    }
    drawOverlay();event.preventDefault();
  }
  function pointerUp(event){
    if(!dragging||event.pointerId!==dragging.pointerId)return;
    try{
      const trial=G.prepare(calibrationPoints);
      board=trial;
      status('Punkt justert · avvik '+trial.errorPx.toFixed(1)+' px. Kontroller linjene.');
    }catch(e){
      calibrationPoints[dragging.index]=dragging.original;
      board=dragging.originalBoard;
      status('Punktet ble ikke godtatt og er satt tilbake. '+e.message);
    }
    dragging=null;updateButtons();drawOverlay();
    if(els.overlay.hasPointerCapture?.(event.pointerId))els.overlay.releasePointerCapture(event.pointerId);
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
      // Projective geometry maps circles to perspective curves; affine ctx.transform did not.
      function drawRing(radius,color,lineWidth){
        ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.beginPath();
        for(let i=0;i<=160;i++){
          const a=2*Math.PI*i/160;
          const p=G.project(board,{x:Math.sin(a)*radius,y:-Math.cos(a)*radius});
          if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
        }
        ctx.stroke();
      }
      for(const r of [G.RINGS.doubleBull,G.RINGS.singleBull,G.RINGS.tripleInner,G.RINGS.tripleOuter,G.RINGS.doubleInner,G.RINGS.doubleOuter])drawRing(r,'rgba(0,234,244,.83)',2);
      ctx.strokeStyle='rgba(255,255,255,.70)';ctx.lineWidth=1.2;
      for(let i=0;i<20;i++){
        const a=(i-.5)*Math.PI/10;
        const inner=G.project(board,{x:Math.sin(a)*G.RINGS.singleBull,y:-Math.cos(a)*G.RINGS.singleBull});
        const outer=G.project(board,{x:Math.sin(a),y:-Math.cos(a)});
        ctx.beginPath();ctx.moveTo(inner.x,inner.y);ctx.lineTo(outer.x,outer.y);ctx.stroke();
      }
      // Highlight 20 and the isolated board-analysis crop.
      const twenty=G.project(board,{x:0,y:-.81});
      ctx.fillStyle='#00eaf4';ctx.font='bold 16px system-ui';
      ctx.fillText('20',twenty.x-10,twenty.y);
      const bounds=G.boardBounds(board,els.overlay.width,els.overlay.height,.045);
      ctx.save();ctx.setLineDash([10,6]);ctx.lineWidth=2;ctx.strokeStyle='rgba(255,193,76,.95)';
      ctx.strokeRect(bounds.x,bounds.y,bounds.width,bounds.height);ctx.restore();
      drawCross(board.bull,'#00eaf4',5);
      ctx.restore();
    }
    if(calibrating||adjusting){
      const scale=els.overlay.width/Math.max(1,els.overlay.getBoundingClientRect().width);
      calibrationPoints.forEach((p,i)=>{
        drawCross(p,adjusting&&dragging?.index===i?'#fff':'#ffbf54',(adjusting?9:7)*scale);
        ctx.fillStyle='#fff';ctx.font='bold '+Math.round(13*scale)+'px system-ui';
        ctx.fillText(String(i+1),p.x+13*scale,p.y-10*scale);
      });
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
    resetAnalysis(true);board=null;calibrationPoints=[];adjusting=false;dragging=null;calibrating=true;
    els.overlay.classList.remove('calibration-edit');
    els.step.textContent='Klikk 1/'+G.CALIBRATION_NAMES.length+': '+G.CALIBRATION_NAMES[0];
    status('Kalibrering pågår');updateButtons();drawOverlay();
  }
  function eventToCanvasPoint(event){
    const rect=els.overlay.getBoundingClientRect();
    return {x:(event.clientX-rect.left)/rect.width*els.overlay.width,
      y:(event.clientY-rect.top)/rect.height*els.overlay.height};
  }
  function overlayClick(event){
    if(!authorized||!stream||adjusting)return;
    const point=eventToCanvasPoint(event);
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.x<0||point.x>els.overlay.width||point.y<0||point.y>els.overlay.height)return;
    els.coords.textContent=Math.round(point.x)+', '+Math.round(point.y);
    if(calibrating){
      calibrationPoints.push(point);
      if(calibrationPoints.length===G.CALIBRATION_NAMES.length){
        try{
          board=G.prepare(calibrationPoints);calibrating=false;
          status('Kalibrering registrert · avvik '+board.errorPx.toFixed(1)+' px. Kontroller alle ringene.');
          els.step.textContent='Ligger linjene feil? Trykk Finjuster punkter og dra de gule punktene på dobbelringen.';
          els.proposalDetail.textContent='Ikke ta referansebilde før både dobbel- og trippelring følger trådene. Gult område viser AI-utsnitt.';
        }catch(e){
          board=null;calibrationPoints.pop();
          status('Punktet ble ikke godkjent: '+e.message);
          els.step.textContent='Korriger punkt '+G.CALIBRATION_NAMES.length+'/'+G.CALIBRATION_NAMES.length+' eller bruk Angre for å rette tidligere punkter.';
        }
      }else{
        els.step.textContent='Klikk '+(calibrationPoints.length+1)+'/'+G.CALIBRATION_NAMES.length+': '+G.CALIBRATION_NAMES[calibrationPoints.length]+' (Angre kan brukes)';
      }
      updateButtons();drawOverlay();return;
    }
    if(!board||!baseline)return;
    const actual=G.score(board,point);
    selected={point,label:actual.label,points:actual.points};
    els.proposal.textContent='Valgt treff: '+actual.label+' · '+actual.points+' poeng';
    els.proposalDetail.textContent=pending?.ai?'AI foreslo '+pending.ai.label+' ('+Math.round(pending.ai.confidence*100)+' %). Bekreft grønn markering som fasit.':pending?'Grovt forslag: '+pending.suggested+'. Bekreft grønn markering som fasit.':'Manuelt treff valgt. Bekreft for å loggføre.';
    updateButtons();drawOverlay();
  }
  function captureAnnotatedSample(){
    if(!authorized||!els.datasetOptIn.checked||!board||!baseline||!selected)return;
    if(dataset.length>=MAX_DATASET){updateDatasetState('Maks '+MAX_DATASET+' kast. Eksporter og tøm samlingen.');return}
    try{
      const aw=analysisCanvas.width,ah=analysisCanvas.height;
      if(!aw||!ah||baseline.length!==aw*ah*4)throw new Error('Referansebilde mangler.');
      if(!readFrame())throw new Error('Kamerabildet er ikke tilgjengelig.');
      const after=analysisCanvas.toDataURL('image/jpeg',.84);
      const beforePixels=new Uint8ClampedArray(baseline);
      analysisContext.putImageData(new ImageData(beforePixels,aw,ah),0,0);
      const before=analysisCanvas.toDataURL('image/jpeg',.84);
      const x=selected.point.x*aw/els.overlay.width;
      const y=selected.point.y*ah/els.overlay.height;
      const row={number:dataset.length+1,createdAt:new Date().toISOString(),
        actual:selected.label,points:selected.points,
        tip:{x:Number(x.toFixed(2)),y:Number(y.toFixed(2)),xNorm:Number((x/aw).toFixed(6)),yNorm:Number((y/ah).toFixed(6))},
        resolution:{width:aw,height:ah},
        boardCalibration:board.points.map(p=>({x:Number((p.x*aw/els.overlay.width).toFixed(2)),y:Number((p.y*ah/els.overlay.height).toFixed(2))})),
        aiSuggestion:pending?.ai?.label||null,aiConfidence:pending?.ai?.confidence??null,
        before,after};
      if(!before.startsWith('data:image/jpeg;base64,')||!after.startsWith('data:image/jpeg;base64,'))throw new Error('Kamerabilder kunne ikke komprimeres.');
      dataset.push(row);updateDatasetState();
    }catch(e){updateDatasetState('Bildeinnsamling feilet: '+(e?.message||String(e)))}
  }
  function confirmSelection(){
    if(!authorized||!board||!selected||!baseline)return;
    captureAnnotatedSample();
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
  function bytesFromDataUrl(src){
    const prefix='data:image/jpeg;base64,';
    if(typeof src!=='string'||!src.startsWith(prefix))throw new Error('Ugyldig lokalt JPEG-bilde.');
    const decoded=atob(src.slice(prefix.length));
    const bytes=new Uint8Array(decoded.length);
    for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
    return bytes;
  }
  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function exportDataset(){
    if(!authorized||!dataset.length||!ZIP?.build)return;
    els.datasetExport.disabled=true;
    els.datasetState.textContent='Pakker '+dataset.length+' merkede kast i ZIP på PC-en…';
    try{
      const enc=new TextEncoder();
      const files=[],labels=[];
      for(const entry of dataset){
        const id=String(entry.number).padStart(4,'0');
        const base='images/'+id;
        files.push({name:base+'-before.jpg',bytes:bytesFromDataUrl(entry.before)});
        files.push({name:base+'-after.jpg',bytes:bytesFromDataUrl(entry.after)});
        const {before,after,...meta}=entry;
        labels.push({...meta,beforeImage:base+'-before.jpg',afterImage:base+'-after.jpg'});
      }
      const note='DartArena Autoscoring Lab – locally captured, manually verified darts dataset.\\n'
        +'These paired images show a reference frame and a frame after a throw; tip coordinates are pixel positions in AFTER image.\\n'
        +'Every label describes only the most recently confirmed tip – other visible darts in AFTER may be unlabeled.\\n'
        +'Do not assume that all dart tips in an image have labels.\\n'
        +'No automatic training, image upload or consent to third-party distribution occurs.\\n';
      const manifest={format:'dartarena-lab-paired-frames-v1',source:'owner-admin-opt-in',createdAt:new Date().toISOString(),
        note:'Only newest tip labeled per pair; verify image quality and remove failed frames before training.',
        samples:labels};
      files.push({name:'labels.json',bytes:enc.encode(JSON.stringify(manifest,null,2))});
      files.push({name:'README.txt',bytes:enc.encode(note)});
      const zip=ZIP.build(files);
      downloadBlob(zip,'dartarena-merkede-kast-'+new Date().toISOString().slice(0,10)+'.zip');
      updateDatasetState('ZIP med '+dataset.length+' merkede kast lastet ned. Bildene ligger også i minnet til du sletter dem eller lukker fanen.');
    }catch(e){updateDatasetState('ZIP-eksport feilet: '+(e?.message||String(e)));}
    finally{updateButtons()}
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
    if(!authorized||!AI?.ready()||!board||!stream||adjusting||aiInferring)return;
    aiInferring=true;
    const ticket=++aiSerial;
    els.aiState.textContent='Analyserer…';
    updateButtons();
    try{
      AI.setOptions({mode:els.aiMode.value,keypointIndex:els.aiKeypoint.value,threshold:els.aiThreshold.value});
      // Only analyze the calibrated dartboard, never OBS's duplicated zoom panel.
      const region=G.boardBounds(board,els.video.videoWidth,els.video.videoHeight,.045);
      const result=await AI.infer(els.video,region);
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
  els.undo.addEventListener('click',undoCalibrationPoint);
  els.adjust.addEventListener('click',toggleAdjustment);
  els.overlay.addEventListener('pointerdown',pointerDown);
  els.overlay.addEventListener('pointermove',pointerMove);
  els.overlay.addEventListener('pointerup',pointerUp);
  els.overlay.addEventListener('pointercancel',pointerUp);
  els.baseline.addEventListener('click',()=>captureReference());
  els.reset.addEventListener('click',()=>{resetAnalysis(true);calibrationPoints=[];board=null;calibrating=false;adjusting=false;dragging=null;els.overlay.classList.remove('calibration-edit');status('Nullstilt');els.step.textContent='Kalibrer skiven på nytt';drawOverlay();updateButtons()});
  els.newRound.addEventListener('click',()=>{if(!authorized||!board)return;captureReference();status('Ny runde: referanse oppdatert')});
  els.confirm.addEventListener('click',confirmSelection);
  els.reject.addEventListener('click',()=>{captureReference();status('Forslag avvist – ny referanse tatt')});
  els.export.addEventListener('click',exportResults);
  els.datasetExport.addEventListener('click',exportDataset);
  els.datasetOptIn.addEventListener('change',()=>updateDatasetState());
  els.datasetClear.addEventListener('click',()=>{
    if(!authorized||!dataset.length)return;
    if(!confirm('Slette '+dataset.length+' merkede kast og alle tilhørende bilder fra denne fanen?'))return;
    dataset=[];updateDatasetState('Alle merkede bilder er slettet fra fanens minne.');
  });
  els.overlay.addEventListener('click',overlayClick);
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{if(!stream&&authorized)loadDevices()});
  db.auth.onAuthStateChange(()=>setTimeout(checkAccess,0));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCamera();else checkAccess()});
  window.addEventListener('pagehide',stopCamera);
  setInterval(checkAccess,60000);
  if(!G.runSanityChecks()){revokeAccess('Intern geometritest feilet. Kameraet er deaktivert.');return}
  updateButtons();updateStats();updateDatasetState();checkAccess().then(()=>{if(authorized)loadDevices()});
})();