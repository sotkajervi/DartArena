/* AutoZoom isolated webcam experiment. Never touches match/media/scoring state. */
(()=>{
'use strict';
const G=window.DartArenaAutoZoom;
const $=id=>document.getElementById(id);
const els={
  stage:$('azStage'),video:$('azVideo'),overlay:$('azOverlay'),zoom:$('azZoom'),
  start:$('azStart'),stop:$('azStop'),calibrate:$('azCalibrate'),
  reference:$('azReference'),auto:$('azAuto'),status:$('azStatus'),
  target:$('azTarget'),last:$('azLast'),count:$('azCount')
};
if(!G||Object.values(els).some(el=>!el))return;

const ctx=els.overlay.getContext('2d');
const zoomCtx=els.zoom.getContext('2d');
const analysis=document.createElement('canvas');
const analysisCtx=analysis.getContext('2d',{willReadFrequently:true});
let stream=null,board=null,calibrationStep=0,calibrationBull=null;
let base=null,previous=null,quiet=0,streak=0,lastCandidate=null,lastAccept=0;
let accepted=0,analysisTimer=null,animationFrame=null,current=null,target=null,lastLabel='T20';
let autoEnabled=true,starting=false;
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
  base=null;previous=null;quiet=0;streak=0;lastCandidate=null;lastAccept=0;
}
function cropFrame(){
  if(!stream||!els.video.videoWidth||!board)return;
  if(!target)aimLabel('T20');
  if(!target)return;
  if(!current)current={...target};
  const ease=.14;
  current.x+=(target.x-current.x)*ease;
  current.y+=(target.y-current.y)*ease;
  const z=els.zoom;
  const crop=G.zoomCrop(els.video.videoWidth,els.video.videoHeight,
    current.x,current.y,board.radius,z.width/z.height);
  zoomCtx.clearRect(0,0,z.width,z.height);
  try{
    zoomCtx.drawImage(els.video,crop.x,crop.y,crop.width,crop.height,0,0,z.width,z.height);
  }catch{}
}
function animate(){
  cropFrame();
  if(stream)animationFrame=requestAnimationFrame(animate);
}
function chooseReference(){
  if(!stream||!board||!analysis.width)return;
  analysisCtx.drawImage(els.video,0,0,analysis.width,analysis.height);
  base=new Uint8ClampedArray(analysisCtx.getImageData(0,0,analysis.width,analysis.height).data);
  previous=null;quiet=0;streak=0;lastCandidate=null;lastAccept=performance.now();
  accepted=0;els.count.textContent='0';
  els.last.textContent='Ingen registrert';
  aimLabel('T20');
  status('Referanse tatt. Kast én pil av gangen og vent til bildet er rolig.');
}
function analyse(){
  if(!stream||!board||!base||!autoEnabled||calibrationStep||!els.video.videoWidth)return;
  const w=analysis.width,h=analysis.height;
  analysisCtx.drawImage(els.video,0,0,w,h);
  const frame=analysisCtx.getImageData(0,0,w,h).data;
  const boardSmall={x:board.x*w/els.video.videoWidth,
    y:board.y*h/els.video.videoHeight,radius:board.radius*w/els.video.videoWidth};
  const motion=previous?G.motionRatio(previous,frame,w,h,boardSmall):1;
  previous=new Uint8ClampedArray(frame);
  if(motion>.008){quiet=0;streak=0;lastCandidate=null;return}
  quiet++;
  if(quiet<4||performance.now()-lastAccept<1100)return;
  const hit=G.findChange(base,frame,w,h,boardSmall);
  if(!hit){streak=0;lastCandidate=null;return}
  if(lastCandidate&&Math.hypot(hit.x-lastCandidate.x,hit.y-lastCandidate.y)<Math.max(12,boardSmall.radius*.13)){
    streak++;
  }else streak=1;
  lastCandidate=hit;
  if(streak<2)return;
  // A new stable image region is an estimated dart location, NOT a detected tip.
  const x=hit.x*els.video.videoWidth/w,y=hit.y*els.video.videoHeight/h;
  aim(x,y,'Siste endring');
  els.last.textContent='Område ved '+Math.round(x)+', '+Math.round(y)+' (estimat)';
  accepted++;els.count.textContent=String(accepted);
  base=new Uint8ClampedArray(frame);
  quiet=0;streak=0;lastCandidate=null;lastAccept=performance.now();
  status('Ny stabil endring funnet. Zoom flyttet (ikke bekreftet pilspiss).');
}
function stopCamera(){
  if(analysisTimer){clearInterval(analysisTimer);analysisTimer=null}
  if(animationFrame){cancelAnimationFrame(animationFrame);animationFrame=null}
  if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}
  els.video.pause();els.video.srcObject=null;
  board=null;calibrationBull=null;calibrationStep=0;current=null;target=null;
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
    const media=await navigator.mediaDevices.getUserMedia({
      video:{width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30,max:30}},audio:false
    });
    stream=media;
    els.video.srcObject=stream;
    await els.video.play();
    const w=els.video.videoWidth,h=els.video.videoHeight;
    if(!w||!h)throw new Error('Kameraet har ingen videobilder.');
    els.stage.style.aspectRatio=`${w}/${h}`;
    els.overlay.width=w;els.overlay.height=h;
    analysis.width=480;analysis.height=Math.round(480*h/w);
    board=null;calibrationStep=0;current=null;target=null;
    clearDetection();
    animationFrame=requestAnimationFrame(animate);
    analysisTimer=setInterval(analyse,150);
    status('Kamera klart. Trykk «Kalibrer skive» og klikk Bull, deretter D20.');
  }catch(error){
    status('Kamera kunne ikke startes: '+(error?.message||String(error)));
    stopCamera();
    status('Kameratilgang feilet. Sjekk at nettleseren har tilgang (HTTPS).');
  }finally{starting=false;updateButtons()}
}
function startCalibration(){
  if(!stream)return;
  calibrationStep=1;calibrationBull=null;board=null;current=null;target=null;
  clearDetection();updateButtons();
  status('Klikk midt i Bull på hovedbildet.');
  overlay();
}
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
els.stop.addEventListener('click',stopCamera);
els.calibrate.addEventListener('click',startCalibration);
els.reference.addEventListener('click',chooseReference);
els.auto.addEventListener('click',()=>{
  autoEnabled=!autoEnabled;
  quiet=0;streak=0;lastCandidate=null;
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
