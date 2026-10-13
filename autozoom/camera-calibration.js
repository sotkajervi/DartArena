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
const button=tools.querySelector('#camZoomCalibrate'),clear=tools.querySelector('#camZoomClear'),help=tools.querySelector('#camZoomHelp');
const previewButton=tools.querySelector('#camZoomPreview');
const speedSelect=tools.querySelector('#camZoomSpeed');
const sensitivitySelect=tools.querySelector('#camZoomSensitivity');
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
  if(data&&data.deviceId===deviceId()){
    speedSelect.value=data.speed||'normal';
    sensitivitySelect.value=data.sensitivity||'normal';
    help.textContent='Zoom-cam kalibrert for dette kameraet. Velg Zoom-cam i venterommet for å sende full skive med zoomvindu.';
  }else{
    help.textContent='Kalibrer dette kameraet: klikk Bull, deretter D20 på dobbelringen. Valget lagres for venterommet.';
  }
}
function cancel(){step=0;bull=null;marker.classList.add('hidden')}
previewButton.addEventListener('click',async()=>{
  if(zoomSession){stopPreview();return}
  const config=Z.loadConfig(localStorage),physical=track();
  if(!config||!physical||!Z.compatible(config,physical,video.videoWidth,video.videoHeight)){
    help.textContent='Kalibrer valgt kamera først, med samme videoformat.';return
  }
  try{
    zoomSession=Z.create(new MediaStream([physical]),config);
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
  const pt=Z.pointer(video,event);
  if(!pt){help.textContent='Klikk innenfor kamerabildet.';return}
  if(step===1){bull=pt;step=2;help.textContent='Klikk midt i D20 på den ytre dobbelringen.';return}
  const settings=Z.calibration(video,bull,pt,deviceId());
  if(!settings||!Z.saveConfig(localStorage,{...settings,speed:speedSelect.value,sensitivity:sensitivitySelect.value})){
    help.textContent='Kalibreringen ble ikke gyldig. Sjekk D20 og prøv igjen.';return
  }
  cancel();stopPreview();updateHelp();
});
clear.addEventListener('click',()=>{
  stopPreview();
  localStorage.removeItem(Z.CONFIG_KEY);
  Z.setSelected(localStorage,false);
  cancel();updateHelp();
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
camera.addEventListener('change',()=>{stopPreview();cancel();setTimeout(updateHelp,300)});
document.getElementById('closeCameraTest')?.addEventListener('click',()=>{stopPreview();cancel()});
document.getElementById('restartCameraTest')?.addEventListener('click',stopPreview);
window.addEventListener('pagehide',stopPreview);
document.getElementById('cameraTestBtn')?.addEventListener('click',()=>{setTimeout(updateHelp,400)});
updateHelp();
})();
