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
tools.innerHTML='<div class="cam-zoom-row"><button type="button" id="camZoomCalibrate" class="outline">Kalibrer Zoom-cam</button><button type="button" id="camZoomClear" class="outline">Fjern kalibrering</button></div><p class="muted compact" id="camZoomHelp">Marker Bull og deretter D20. Zoom-cam kan velges i venterom etter kalibrering.</p>';
preview.insertAdjacentElement('afterend',tools);
const button=tools.querySelector('#camZoomCalibrate'),clear=tools.querySelector('#camZoomClear'),help=tools.querySelector('#camZoomHelp');
const marker=document.createElement('div');marker.className='cam-zoom-calibration-layer hidden';
marker.title='Klikk Bull og deretter D20 i kamerabildet';
preview.appendChild(marker);
let step=0,bull=null;
function track(){return video.srcObject?.getVideoTracks?.()[0]||null}
function deviceId(){return track()?.getSettings?.()?.deviceId||camera.value||''}
function updateHelp(){
  const data=Z.loadConfig(localStorage);
  if(data&&data.deviceId===deviceId()){
    help.textContent='Zoom-cam kalibrert for dette kameraet. Velg Zoom-cam i venterommet for å sende full skive med zoomvindu.';
  }else{
    help.textContent='Kalibrer dette kameraet: klikk Bull, deretter D20 på dobbelringen. Valget lagres for venterommet.';
  }
}
function cancel(){step=0;bull=null;marker.classList.add('hidden')}
button.addEventListener('click',()=>{
  if(!video.videoWidth||!track()){help.textContent='Start kameraet først.';return}
  cancel();step=1;marker.classList.remove('hidden');help.textContent='Klikk midt i Bull på kamerabildet.';
});
marker.addEventListener('click',event=>{
  if(!step)return;
  const pt=Z.pointer(video,event);
  if(!pt){help.textContent='Klikk innenfor kamerabildet.';return}
  if(step===1){bull=pt;step=2;help.textContent='Klikk midt i D20 på den ytre dobbelringen.';return}
  const settings=Z.calibration(video,bull,pt,deviceId());
  if(!settings||!Z.saveConfig(localStorage,settings)){
    help.textContent='Kalibreringen ble ikke gyldig. Sjekk D20 og prøv igjen.';return
  }
  cancel();updateHelp();
});
clear.addEventListener('click',()=>{
  localStorage.removeItem(Z.CONFIG_KEY);
  Z.setSelected(localStorage,false);
  cancel();updateHelp();
});
camera.addEventListener('change',()=>{cancel();setTimeout(updateHelp,300)});
document.getElementById('closeCameraTest')?.addEventListener('click',cancel);
document.getElementById('cameraTestBtn')?.addEventListener('click',()=>{setTimeout(updateHelp,400)});
updateHelp();
})();
