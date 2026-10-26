/* Cam-test calibration for virtual Zoom-cam. Saves coordinates only, never camera streams. */
(()=>{
'use strict';
const Z=window.DartArenaZoomCam;
const modal=document.getElementById('cameraTestModal');
const preview=modal?.querySelector('.cam-test-preview');
const video=document.getElementById('cameraTestVideo');
const camera=document.getElementById('cameraTestCameraSelect');
if(!Z||!modal||!preview||!video||!camera)return;
const tools=document.createElement('div');
tools.className='cam-zoom-tools';
tools.innerHTML='<div class="cam-zoom-row"><button type="button" id="camZoomCalibrate" class="outline">Kalibrer Zoom-cam</button><button type="button" id="camZoomPreview" class="outline">Forhåndsvis Zoom-cam</button><button type="button" id="camZoomClear" class="outline">Fjern kalibrering</button></div><div class="cam-zoom-settings"><label>Følsomhet<select id="camZoomSensitivity"><option value="normal" selected>Normal (stabil)</option><option value="low">Lav</option><option value="high">Høy (test)</option></select></label><label>Hastighet<select id="camZoomSpeed"><option value="fast">Rask</option><option value="normal" selected>Normal</option><option value="smooth">Rolig</option></select></label></div><p class="muted compact" id="camZoomHelp">Marker Bull og deretter D20. Zoom-cam kan velges i venterom etter kalibrering.</p>';
preview.insertAdjacentElement('afterend',tools);
const activationLabel=document.createElement('label');
activationLabel.className='cam-zoom-guide-toggle';
activationLabel.innerHTML='<input type="checkbox" id="camZoomUseInMatch"> Bruk Zoom-cam automatisk i venterom og kamp';
tools.appendChild(activationLabel);
const activation=activationLabel.querySelector('input');
const button=tools.querySelector('#camZoomCalibrate'),clear=tools.querySelector('#camZoomClear'),help=tools.querySelector('#camZoomHelp');
const previewButton=tools.querySelector('#camZoomPreview');
const speedSelect=tools.querySelector('#camZoomSpeed');
const sensitivitySelect=tools.querySelector('#camZoomSensitivity');
const framingPanel=document.createElement('section');
framingPanel.className='cam-zoom-framing';
framingPanel.innerHTML=`
  <div class="cam-zoom-framing-header"><strong>UTSNITT OG PLASSERING</strong><span>Lagres med kalibreringen</span></div>
  <div class="cam-zoom-framing-controls">
    <label class="cam-zoom-range">Digital zoom <output id="camFramingValue">1,0×</output>
      <input id="camFramingZoom" type="range" min="1" max="3" step="0.1" value="1" aria-label="Digital zoom">
    </label>
    <button type="button" class="outline" id="camFramingReset">Nullstill utsnitt</button>
  </div>
  <label class="cam-zoom-guide-toggle"><input type="checkbox" id="camFramingGuide"> Vis hvor Zoom-cam-vinduet kommer</label>
  <p class="muted compact">Dra i kamerabildet for å flytte utsnittet etter at du har zoomet inn. Hold gjerne øvre høyre hjørne ledig – anbefalt, ikke nødvendig.</p>
`;
tools.appendChild(framingPanel);
const hitPanel=document.createElement('section');
hitPanel.className='cam-zoom-framing';
hitPanel.innerHTML=`
  <div class="cam-zoom-framing-header"><strong>TREFFPUNKT-KORREKSJON</strong><span>Kun dette kameraet</span></div>
  <div class="cam-zoom-framing-controls">
    <label class="cam-zoom-range">Horisontalt <output id="camHitOffsetXValue">Ingen</output>
      <input id="camHitOffsetX" type="range" min="-1" max="1" step="0.05" value="0" aria-label="Treffpunkt venstre eller høyre">
    </label>
    <label class="cam-zoom-range">Vertikalt <output id="camHitOffsetYValue">Ingen</output>
      <input id="camHitOffsetY" type="range" min="-1" max="1" step="0.05" value="0" aria-label="Treffpunkt opp eller ned">
    </label>
    <button type="button" class="outline" id="camHitOffsetReset">Nullstill treffpunkt</button>
  </div>
  <p class="muted compact">Bruk dette bare hvis Zoom-cam peker feil etter et kast. Er zoompunktet over pilspissen, juster vertikalt mot Ned. Verdien er en andel av skiveradiusen, og påvirker ikke kalibrering, scoring eller heatmap. Start forhåndsvisning på nytt etter justering.</p>
`;
tools.appendChild(hitPanel);
const hitX=hitPanel.querySelector('#camHitOffsetX');
const hitY=hitPanel.querySelector('#camHitOffsetY');
const hitXValue=hitPanel.querySelector('#camHitOffsetXValue');
const hitYValue=hitPanel.querySelector('#camHitOffsetYValue');
const hitReset=hitPanel.querySelector('#camHitOffsetReset');
function showHitOffset(){
  const x=Number(hitX.value),y=Number(hitY.value);
  hitXValue.textContent=x?(x<0?'Venstre ':'Høyre ')+Math.round(Math.abs(x)*100)+'%':'Ingen';
  hitYValue.textContent=y?(y<0?'Opp ':'Ned ')+Math.round(Math.abs(y)*100)+'%':'Ingen';
}
function loadHitOffset(){
  const data=Z.loadConfig(localStorage);
  const value=Z.hitOffsetOf(data&&data.deviceId===deviceId()?data:{});
  hitX.value=String(value.hitOffsetX);hitY.value=String(value.hitOffsetY);
  showHitOffset();
}
function saveHitOffset(){
  showHitOffset();
  const data=Z.loadConfig(localStorage);
  if(data&&data.deviceId===deviceId()){
    Z.saveConfig(localStorage,{...data,hitOffsetX:Number(hitX.value),hitOffsetY:Number(hitY.value)});
  }
  stopPreview();
}
hitX.addEventListener('input',saveHitOffset);
hitY.addEventListener('input',saveHitOffset);
hitReset.addEventListener('click',()=>{hitX.value='0';hitY.value='0';saveHitOffset()});
const zoomInput=framingPanel.querySelector('#camFramingZoom');
const zoomValue=framingPanel.querySelector('#camFramingValue');
const frameReset=framingPanel.querySelector('#camFramingReset');
const guideToggle=framingPanel.querySelector('#camFramingGuide');
const guide=document.createElement('div');
guide.className='cam-zoom-inset-guide hidden';
guide.innerHTML='<span>ZOOM-CAM HER</span>';
preview.appendChild(guide);
const framedCanvas=document.createElement('canvas');
framedCanvas.className='cam-zoom-framed-canvas';
framedCanvas.width=1280;framedCanvas.height=720;framedCanvas.hidden=true;
preview.appendChild(framedCanvas);
const frameCtx=framedCanvas.getContext('2d',{alpha:false});
let framing=Z.framingOf(),framingLoop=0,dragging=null;
function updateFramingDisplay(){
  zoomInput.value=String(framing.zoom);
  zoomValue.textContent=framing.zoom.toFixed(1).replace('.',',')+'×';
  framedCanvas.style.cursor=framing.zoom>1?'grab':'default';
}
function loadFraming(){
  const data=Z.loadConfig(localStorage);
  framing=Z.framingOf(data&&data.deviceId===deviceId()?data:null);
  updateFramingDisplay();
  loadHitOffset();
}
function saveFraming(){
  const data=Z.loadConfig(localStorage);
  if(data&&data.deviceId===deviceId())Z.saveConfig(localStorage,{...data,...framing});
}
function drawFramed(){
  if(modal.classList.contains('hidden')){framingLoop=0;return}
  if(frameCtx&&video.videoWidth&&video.videoHeight&&video.readyState>=2){
    const crop=Z.framingCrop(video.videoWidth,video.videoHeight,framing);
    const w=framedCanvas.width,h=framedCanvas.height,fit=Math.min(w/crop.width,h/crop.height);
    const dx=(w-crop.width*fit)/2,dy=(h-crop.height*fit)/2;
    frameCtx.fillStyle='#030708';frameCtx.fillRect(0,0,w,h);
    frameCtx.drawImage(video,crop.x,crop.y,crop.width,crop.height,
      dx,dy,crop.width*fit,crop.height*fit);
    framedCanvas.hidden=false;
  }else framedCanvas.hidden=true;
  framingLoop=requestAnimationFrame(drawFramed);
}
function startFramingLoop(){
  if(!framingLoop)framingLoop=requestAnimationFrame(drawFramed);
}
function stopFramingLoop(){
  if(framingLoop)cancelAnimationFrame(framingLoop);
  framingLoop=0;framedCanvas.hidden=true;dragging=null;
}
function framingChanged(){
  updateFramingDisplay();
  saveFraming();
  stopPreview();
}
zoomInput.addEventListener('input',()=>{
  framing=Z.framingOf({...framing,zoom:Number(zoomInput.value)});
  framingChanged();
});
frameReset.addEventListener('click',()=>{
  framing=Z.framingOf();
  framingChanged();
});
guideToggle.addEventListener('change',()=>{
  guide.classList.toggle('hidden',!guideToggle.checked);
});
framedCanvas.addEventListener('pointerdown',event=>{
  if(framing.zoom<=1||step||!video.videoWidth)return;
  dragging={id:event.pointerId,x:event.clientX,y:event.clientY};
  framedCanvas.setPointerCapture?.(event.pointerId);
  framedCanvas.style.cursor='grabbing';
  event.preventDefault();
});
framedCanvas.addEventListener('pointermove',event=>{
  if(!dragging||dragging.id!==event.pointerId)return;
  const rect=framedCanvas.getBoundingClientRect();
  const dx=event.clientX-dragging.x,dy=event.clientY-dragging.y;
  const extent=framing.zoom-1;
  const next=Z.framingOf({...framing,
    panX:framing.panX-2*dx/(rect.width*extent),
    panY:framing.panY-2*dy/(rect.height*extent)});
  framing=next;dragging.x=event.clientX;dragging.y=event.clientY;
  event.preventDefault();
});
function endFramingDrag(event){
  if(!dragging||dragging.id!==event.pointerId)return;
  dragging=null;framedCanvas.style.cursor='grab';saveFraming();stopPreview();
}
framedCanvas.addEventListener('pointerup',endFramingDrag);
framedCanvas.addEventListener('pointercancel',endFramingDrag);

const previewVideo=document.createElement('video');
previewVideo.className='cam-zoom-preview hidden';
previewVideo.muted=true;previewVideo.autoplay=true;previewVideo.playsInline=true;
previewVideo.setAttribute('aria-label','Forhåndsvisning av Zoom-cam');
tools.appendChild(previewVideo);
let zoomSession=null;
function stopPreview(){
  previewVideo.pause();
  previewVideo.srcObject=null;
  zoomSession?.stop();zoomSession=null;
  previewVideo.classList.add('hidden');
  previewButton.textContent='Forhåndsvis Zoom-cam';
}
const marker=document.createElement('div');marker.className='cam-zoom-calibration-layer hidden';
marker.title='Klikk Bull og deretter D20 i kamerabildet';
preview.appendChild(marker);
let step=0,bull=null;
function track(){return video.srcObject?.getVideoTracks?.()[0]||null}
function deviceId(){return track()?.getSettings?.()?.deviceId||camera.value||''}
function updateHelp(){
  const data=Z.loadConfig(localStorage);
  activation.checked=!!(data&&data.deviceId===deviceId()&&Z.selected(localStorage));
  if(data&&data.deviceId===deviceId()){
    speedSelect.value=data.speed||'normal';
    sensitivitySelect.value=data.sensitivity||'normal';
    help.textContent=activation.checked
      ?'Zoom-cam er kalibrert og valgt for venterom og kamp.'
      :'Zoom-cam er kalibrert. Huk av «Bruk Zoom-cam automatisk» eller velg den i venterommet.';
  }else{
    help.textContent='Kalibrer dette kameraet: klikk Bull, deretter D20 på dobbelringen. Valget lagres for venterommet.';
  }
}
activation.addEventListener('change',()=>{
  if(!activation.checked){
    Z.setSelected(localStorage,false);
    updateHelp();
    return;
  }
  const config=Z.loadConfig(localStorage);
  if(!config||config.deviceId!==deviceId()){
    Z.setSelected(localStorage,false);
    activation.checked=false;
    help.textContent='Kalibrer dette kameraet med Bull og D20 før du aktiverer Zoom-cam.';
    return;
  }
  Z.setSelected(localStorage,true);
  updateHelp();
});
function cancel(){step=0;bull=null;marker.classList.add('hidden')}
previewButton.addEventListener('click',async()=>{
  if(zoomSession){stopPreview();return}
  const config=Z.loadConfig(localStorage),physical=track();
  if(!config||!physical||!Z.compatible(config,physical,video.videoWidth,video.videoHeight)){
    help.textContent='Kalibrer valgt kamera først, med samme videoformat.';return
  }
  try{
    // Preview gets the same CSS color treatment as Cam-test; avoid applying it twice.
    zoomSession=Z.create(new MediaStream([physical]),config,{picture:false});
    previewVideo.srcObject=zoomSession.stream;
    previewVideo.classList.remove('hidden');
    previewButton.textContent='Stopp forhåndsvisning';
    await previewVideo.play();
    help.textContent='Dette er Zoom-cam-videoen som sendes til motstanderen. Hele skiva og zoomvinduet er i samme bilde.';
  }catch(error){
    stopPreview();
    help.textContent='Forhåndsvisning kan ikke startes: '+(error?.message||String(error));
  }
});
button.addEventListener('click',()=>{
  if(!video.videoWidth||!track()){help.textContent='Start kameraet først.';return}
  stopPreview();cancel();step=1;marker.classList.remove('hidden');help.textContent='Klikk midt i Bull på kamerabildet.';
});
marker.addEventListener('click',event=>{
  if(!step)return;
  const pt=Z.framedPointer(video,preview,event,framing);
  if(!pt){help.textContent='Klikk innenfor kamerabildet.';return}
  if(step===1){bull=pt;step=2;help.textContent='Klikk midt i D20 på den ytre dobbelringen.';return}
  const settings=Z.calibration(video,bull,pt,deviceId());
  if(!settings||!Z.saveConfig(localStorage,{...settings,...framing,speed:speedSelect.value,sensitivity:sensitivitySelect.value,
    hitOffsetX:Number(hitX.value),hitOffsetY:Number(hitY.value)})){
    help.textContent='Kalibreringen ble ikke gyldig. Sjekk D20 og prøv igjen.';return
  }
  cancel();stopPreview();updateHelp();
});
clear.addEventListener('click',()=>{
  stopPreview();
  localStorage.removeItem(Z.CONFIG_KEY);
  Z.setSelected(localStorage,false);
  cancel();loadFraming();updateHelp();
});
function saveOptions(){
  const data=Z.loadConfig(localStorage);
  if(data&&data.deviceId===deviceId()){
    Z.saveConfig(localStorage,{...data,speed:speedSelect.value,sensitivity:sensitivitySelect.value});
  }
  stopPreview();
}
speedSelect.addEventListener('change',saveOptions);
sensitivitySelect.addEventListener('change',saveOptions);
camera.addEventListener('change',()=>{stopPreview();cancel();setTimeout(()=>{loadFraming();updateHelp()},300)});
document.getElementById('closeCameraTest')?.addEventListener('click',()=>{stopPreview();cancel();stopFramingLoop()});
document.getElementById('cameraTestBackdrop')?.addEventListener('click',stopFramingLoop);
document.getElementById('restartCameraTest')?.addEventListener('click',stopPreview);
window.addEventListener('pagehide',()=>{stopPreview();stopFramingLoop()});
document.getElementById('cameraTestBtn')?.addEventListener('click',()=>{loadFraming();startFramingLoop();setTimeout(updateHelp,400)});
loadFraming();updateHelp();
})();
