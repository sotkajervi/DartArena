/* AutoZoom isolated webcam experiment. Never touches match/media/scoring state. */
(()=>{
'use strict';
const G=window.DartArenaAutoZoom;
const TipMap=window.DartArenaAutoZoomTipMap;
const $=id=>document.getElementById(id);
const els={
  stage:$('azStage'),video:$('azVideo'),overlay:$('azOverlay'),zoom:$('azZoom'),camera:$('azCamera'),
  start:$('azStart'),stop:$('azStop'),calibrate:$('azCalibrate'),
  reference:$('azReference'),auto:$('azAuto'),sensitivity:$('azSensitivity'),speed:$('azSpeed'),status:$('azStatus'),
  target:$('azTarget'),last:$('azLast'),count:$('azCount')
};
if(!G||Object.values(els).some(el=>!el))return;

const ctx=els.overlay.getContext('2d');
const zoomCtx=els.zoom.getContext('2d');
const analysis=document.createElement('canvas');
const analysisCtx=analysis.getContext('2d',{willReadFrequently:true});
let stream=null,board=null,calibrationStep=0,calibrationBull=null;
let base=null,previous=null,quiet=0;
let changeGate=G.createChangeGate({stableFrames:5,motionWindowMs:4000,cooldownMs:1800});
let accepted=0,analysisTimer=null,animationFrame=null,current=null,target=null,lastLabel='T20';
let autoEnabled=true,starting=false;
let pendingMotion=null, rejected=0;
let visibleZoomCrop=null,zoomTip=null,heatmapHitReady=false;
async function refreshDevices(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  const selected=els.camera.value;
  try{
    const list=(await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==='videoinput');
    els.camera.replaceChildren();
    const option=document.createElement('option');
    option.value='';option.textContent='Standardkamera';els.camera.appendChild(option);
    list.forEach((device,index)=>{
      if(!device.deviceId)return;
      const opt=document.createElement('option');
      opt.value=device.deviceId;opt.textContent=device.label||('Kamera '+(index+1));
      els.camera.appendChild(opt);
    });
    if([...els.camera.options].some(opt=>opt.value===selected))els.camera.value=selected;
  }catch{}
}
function status(message){els.status.textContent=message}
function updateButtons(){
  const live=!!stream;
  els.start.disabled=live||starting;
  els.stop.disabled=!live;
  els.calibrate.disabled=!live;
  els.reference.disabled=!live||!board;
  els.auto.disabled=!live||!board;
  els.auto.textContent=autoEnabled?'AutoZoom: PÅ':'AutoZoom: AV';
  els.auto.setAttribute('aria-pressed',String(autoEnabled));
}
function overlay(){
  const w=els.overlay.width,h=els.overlay.height;
  ctx.clearRect(0,0,w,h);
  if(!board&&!calibrationBull)return;
  const dot=(x,y,text)=>{
    ctx.strokeStyle='#00eaf4';ctx.lineWidth=Math.max(2,w/450);
    ctx.beginPath();ctx.arc(x,y,Math.max(7,w/110),0,Math.PI*2);ctx.stroke();
    ctx.font=`bold ${Math.max(15,w/70)}px sans-serif`;
    ctx.fillStyle='#00eaf4';ctx.fillText(text,x+Math.max(13,w/90),y-10);
  };
  if(calibrationStep){
    if(calibrationBull)dot(calibrationBull.x,calibrationBull.y,'BULL');
    return;
  }
  // Calibration outline is shown only while setting up, not over the live board.
}
function aim(x,y,label){
  target={x,y};lastLabel=label;
  els.target.textContent=label;
}
function aimLabel(label){
  if(!board)return;
  const p=G.targetPoint(board.x,board.y,board.radius,label,board.rotation);
  if(p)aim(p.x,p.y,label);
}
function clearDetection(){
  base=null;previous=null;quiet=0;pendingMotion=null;rejected=0;changeGate.reset();
  visibleZoomCrop=null;zoomTip=null;heatmapHitReady=false;
}
function cropFrame(){
  if(!stream||!els.video.videoWidth||!board)return;
  if(!target)aimLabel('T20');
  if(!target)return;
  if(!current)current={...target};
  const ease=G.speedPreset(els.speed.value).ease;
  current.x+=(target.x-current.x)*ease;
  current.y+=(target.y-current.y)*ease;
  const z=els.zoom;
  const crop=G.zoomCrop(els.video.videoWidth,els.video.videoHeight,
    current.x,current.y,board.radius,z.width/z.height);
  zoomCtx.clearRect(0,0,z.width,z.height);
  try{
    zoomCtx.drawImage(els.video,crop.x,crop.y,crop.width,crop.height,0,0,z.width,z.height);
    visibleZoomCrop={...crop};
    const marker=zoomTip&&TipMap?.pointOnZoom(zoomTip,crop,z.width,z.height);
    if(marker){
      const confirmed=zoomTip.confirmed;
      zoomCtx.save();
      zoomCtx.beginPath();zoomCtx.arc(marker.x,marker.y,8,0,Math.PI*2);
      zoomCtx.strokeStyle=confirmed?'#eaffff':zoomTip.tipDetected?'#24d6d0':'#ffb547';
      zoomCtx.lineWidth=2.5;zoomCtx.shadowColor=zoomCtx.strokeStyle;zoomCtx.shadowBlur=9;zoomCtx.stroke();
      zoomCtx.beginPath();zoomCtx.moveTo(marker.x-3,marker.y);zoomCtx.lineTo(marker.x+3,marker.y);
      zoomCtx.moveTo(marker.x,marker.y-3);zoomCtx.lineTo(marker.x,marker.y+3);zoomCtx.stroke();
      zoomCtx.shadowBlur=0;zoomCtx.font='bold 12px sans-serif';
      zoomCtx.fillStyle=zoomCtx.strokeStyle;
      zoomCtx.fillText(confirmed?'BEKREFTET SPISS':zoomTip.tipDetected?'SPISSFORSLAG':'USIKKERT ESTIMAT',
        Math.min(z.width-130,Math.max(7,marker.x+12)),Math.max(16,marker.y-12));
      zoomCtx.restore();
    }
  }catch{visibleZoomCrop=null}
}
function animate(){
  cropFrame();
  if(stream)animationFrame=requestAnimationFrame(animate);
}
function chooseReference(){
  if(!stream||!board||!analysis.width)return;
  analysisCtx.drawImage(els.video,0,0,analysis.width,analysis.height);
  base=new Uint8ClampedArray(analysisCtx.getImageData(0,0,analysis.width,analysis.height).data);
  previous=null;quiet=0;pendingMotion=null;rejected=0;changeGate.reset();
  accepted=0;els.count.textContent='0';
  window.dispatchEvent(new Event('dartarena:autozoom-test-reset'));
  els.last.textContent='Ingen registrert';
  aimLabel('T20');
  status('Referanse tatt. Zoom flyttes bare etter et nytt kast som er stabilt i flere bilder.');
}
function applySpeed(){
  const speed=G.speedPreset(els.speed.value);
  if(analysisTimer){clearInterval(analysisTimer);analysisTimer=null}
  changeGate=G.createChangeGate({stableFrames:speed.stableFrames,motionWindowMs:4000,cooldownMs:speed.cooldownMs});
  previous=null;quiet=0;pendingMotion=null;
  if(stream)analysisTimer=setInterval(analyse,speed.intervalMs);
}
function analyse(){
  if(!stream||!board||!base||!autoEnabled||calibrationStep||!els.video.videoWidth)return;
  const w=analysis.width,h=analysis.height;
  analysisCtx.drawImage(els.video,0,0,w,h);
  const frame=analysisCtx.getImageData(0,0,w,h).data;
  const boardSmall={x:board.x*w/els.video.videoWidth,
    y:board.y*h/els.video.videoHeight,radius:board.radius*w/els.video.videoWidth};
  const now=performance.now();
  const searchRadius=1.55; // Include visible surround beyond the outer double ring.
  const motion=previous?G.motionRatio(previous,frame,w,h,boardSmall,{searchRadius}):0;
  // Same stable detector settings for Normal and Low until live-camera
  // testing establishes a safe distinction between these two modes.
  const preset=G.sensitivityPreset(els.sensitivity.value);
  // Only react to a newly appearing change, not to noise continuously present
  // in the saved reference image. Movement arms a brief validation window.
  const motionHit=previous&&motion<=.008?G.findChange(previous,frame,w,h,boardSmall,
    {...preset,searchRadius,maxRatio:.045}):null;
  // Only admit an entirely new, localized change associated with recent
  // motion. Repeated lighting noise elsewhere must not create a dart.
  if(motionHit&&motionHit.changedSamples>=preset.minSamples&&
     motionHit.localSamples/Math.max(1,motionHit.changedSamples)>=.50){
    pendingMotion={x:motionHit.x,y:motionHit.y,at:now};
  }
  if(pendingMotion&&now-pendingMotion.at>3000)pendingMotion=null;
  previous=new Uint8ClampedArray(frame);
  if(motion>.008)quiet=0;
  else quiet++;
  const candidate=quiet>=G.speedPreset(els.speed.value).quietFrames?
    G.findChange(base,frame,w,h,boardSmall,{...preset,searchRadius}):null;
  const hit=changeGate.observe(candidate,{movement:motion>.008||!!motionHit,now,radius:boardSmall.radius});
  if(!hit)return;
  // Gate acceptance on spatial agreement with motion evidence. A stable
  // difference alone (e.g. glare at D1) is not a confirmed new object.
  const maxGap=Math.max(9,boardSmall.radius*.22);
  const confirmed=!!pendingMotion&&now-pendingMotion.at<=3000&&
    Math.hypot(hit.x-pendingMotion.x,hit.y-pendingMotion.y)<=maxGap&&
    hit.changedSamples>=Math.max(12,preset.minSamples)&&
    hit.localSamples/hit.changedSamples>=.50;
  if(!confirmed){
    rejected++;
    status('Usikkert treff avvist ('+rejected+'). Krever lokal bevegelse og stabil endring samme sted.');
    return;
  }
  pendingMotion=null;
  // A new stable image region is an estimated dart location, NOT a detected tip.
  const x=hit.x*els.video.videoWidth/w,y=hit.y*els.video.videoHeight/h;
  window.dispatchEvent(new CustomEvent('dartarena:autozoom-test-hit',{detail:{
    base,frame:new Uint8ClampedArray(frame),width:w,height:h,hit,
    sourceWidth:els.video.videoWidth,sourceHeight:els.video.videoHeight,
    board:boardSmall
  }}));
  aim(x,y,'Siste endring');
  els.last.textContent='Område ved '+Math.round(x)+', '+Math.round(y)+' (estimat)';
  accepted++;els.count.textContent=String(accepted);
  base=new Uint8ClampedArray(frame);
  quiet=0;
  status('Ny stabil endring funnet. Zoom flyttet (ikke bekreftet pilspiss).');
}
function stopCamera(){
  if(analysisTimer){clearInterval(analysisTimer);analysisTimer=null}
  if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=null}
  if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}
  els.video.pause();els.video.srcObject=null;
  board=null;calibrationBull=null;calibrationStep=0;current=null;target=null;
  zoomTip=null;heatmapHitReady=false;visibleZoomCrop=null;
  clearDetection();
  ctx.clearRect(0,0,els.overlay.width,els.overlay.height);
  zoomCtx.clearRect(0,0,els.zoom.width,els.zoom.height);
  status('Kamera stoppet. Ingen opptak lagres.');
  updateButtons();
}
async function startCamera(){
  if(stream||starting)return;
  starting=true;updateButtons();
  status('Ber om kameratilgang…');
  try{
    const chosen=els.camera.value;
    const media=await navigator.mediaDevices.getUserMedia({
      video:{...(chosen?{deviceId:{exact:chosen}}:{}),
        width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30}},audio:false
    });
    stream=media;
    els.video.srcObject=stream;
    await els.video.play();
    const w=els.video.videoWidth,h=els.video.videoHeight;
    if(!w||!h)throw new Error('Kameraet har ingen videobilder.');
    els.stage.style.aspectRatio=`${w}/${h}`;
    els.overlay.width=w;els.overlay.height=h;
    analysis.width=480;analysis.height=Math.round(480*h/w);
    await refreshDevices();
    board=null;calibrationStep=0;current=null;target=null;
    clearDetection();
    animationFrame=requestAnimationFrame(animate);
    applySpeed();
    status('Kamera klart. Trykk «Kalibrer skive» og klikk Bull, deretter D20.');
  }catch(error){
    const message='Kameratilgang feilet: '+(error?.message||String(error))+'. Kontroller tillatelse og valgt kamera (HTTPS).';
    stopCamera();
    status(message);
  }finally{starting=false;updateButtons()}
}
function startCalibration(){
  if(!stream)return;
  calibrationStep=1;calibrationBull=null;board=null;current=null;target=null;
  clearDetection();updateButtons();
  status('Klikk midt i Bull på hovedbildet.');
  overlay();
}
window.addEventListener('dartarena:autozoom-tip-estimate',event=>{
  const detail=event.detail||{};
  if(!stream||!board||![detail.x,detail.y].every(Number.isFinite))return;
  zoomTip={x:detail.x,y:detail.y,tipDetected:detail.tipDetected===true,confirmed:false};
  heatmapHitReady=true;
});
window.addEventListener('dartarena:autozoom-test-reset',()=>{zoomTip=null;heatmapHitReady=false;visibleZoomCrop=null});
window.addEventListener('dartarena:autozoom-tip-clear',()=>{zoomTip=null;heatmapHitReady=false});
els.zoom.addEventListener('click',event=>{
  if(!TipMap||!stream||!board||!heatmapHitReady||!visibleZoomCrop)return;
  const point=TipMap.pointFromZoom(event,els.zoom.getBoundingClientRect(),visibleZoomCrop,els.zoom.width,els.zoom.height);
  if(!point||Math.hypot(point.x-board.x,point.y-board.y)>board.radius*1.55){
    status('Klikk der pilspissen går inn i skiva, innenfor det synlige skiveområdet.');return;
  }
  window.dispatchEvent(new CustomEvent('dartarena:autozoom-tip-confirmed',{detail:{x:point.x,y:point.y,board:{...board}}}));
  zoomTip={...point,tipDetected:true,confirmed:true};
  status('Pilspiss bekreftet i ZoomCam. Heatmap er oppdatert – ingen poeng er registrert.');
});
els.overlay.addEventListener('click',event=>{
  if(!stream)return;
  const rect=els.overlay.getBoundingClientRect();
  const x=(event.clientX-rect.left)*els.overlay.width/rect.width;
  const y=(event.clientY-rect.top)*els.overlay.height/rect.height;
  if(calibrationStep===1){
    calibrationBull={x,y};calibrationStep=2;
    status('Klikk midt i D20-feltet øverst på dobbelringen.');
    overlay();
    return;
  }
  if(calibrationStep===2){
    const radius=Math.hypot(x-calibrationBull.x,y-calibrationBull.y)/.976;
    if(radius<Math.min(els.video.videoWidth,els.video.videoHeight)*.08){
      status('For kort avstand. Klikk D20 på dobbelringen, ikke nær Bull.');return;
    }
    board={x:calibrationBull.x,y:calibrationBull.y,radius,
      rotation:Math.atan2(x-calibrationBull.x,calibrationBull.y-y)};
    calibrationStep=0;current=null;
    clearDetection();overlay();aimLabel('T20');
    status('Skive kalibrert. Fjern pilene og trykk «Tom skive / referanse».');
    updateButtons();
    return;
  }
  // Manual fallback also lets the tester compare estimated position to actual dart tip.
  aim(x,y,'Manuelt valgt');
  status('Zoom satt manuelt. AutoZoom følger neste stabile bildeendring.');
});
els.start.addEventListener('click',startCamera);
els.camera.addEventListener('change',()=>{if(stream){stopCamera();void startCamera()}});
navigator.mediaDevices?.addEventListener?.('devicechange',refreshDevices);
void refreshDevices();
els.stop.addEventListener('click',stopCamera);
els.calibrate.addEventListener('click',startCalibration);
els.reference.addEventListener('click',chooseReference);
els.speed.addEventListener('change',()=>{
  applySpeed();
  status('Hastighet: '+els.speed.selectedOptions[0].textContent+'. Nye treff bekreftes med valgt respons.');
});
els.sensitivity.addEventListener('change',()=>{
  changeGate.reset();previous=null;quiet=0;
  status('Følsomhet: '+els.sensitivity.selectedOptions[0].textContent+'. Zoom flytter seg først etter ny bevegelse og flere rolige bilder.');
});
els.auto.addEventListener('click',()=>{
  autoEnabled=!autoEnabled;
  changeGate.reset();previous=null;quiet=0;
  updateButtons();
  status(autoEnabled?'AutoZoom på.':'AutoZoom av. Hovedbildet er uendret.');
});
document.querySelectorAll('[data-az-target]').forEach(button=>{
  button.addEventListener('click',()=>{
    if(!board)return;
    aimLabel(button.dataset.azTarget);
    status('Testutsnitt: '+button.dataset.azTarget+'. AutoZoom kan fortsatt flytte det ved neste pil.');
  });
});
window.addEventListener('pagehide',stopCamera);
updateButtons();
})();
