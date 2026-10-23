/* Compact, per-camera picture controls for Cam-test and Zoom-cam output.
   Only color adjustments: do not reshape pixels or modify the raw tracker input. */
(function(root){
'use strict';
const STORAGE_KEY='dartarena-camera-picture-v1';
const DEFAULTS=Object.freeze({brightness:100,contrast:100,saturation:100});
const ranges={brightness:[75,135],contrast:[80,140],saturation:[70,130]};
function normalize(input){
  const out={};
  for(const [key,[min,max]] of Object.entries(ranges)){
    const raw=input?.[key],value=raw===undefined||raw===null?DEFAULTS[key]:Number(raw);
    out[key]=Number.isFinite(value)?Math.round(Math.max(min,Math.min(max,value))):DEFAULTS[key];
  }
  return out;
}
function load(storage,deviceId){
  if(!storage||!deviceId)return {...DEFAULTS};
  try{
    const all=JSON.parse(storage.getItem(STORAGE_KEY)||'{}');
    return normalize(all&&typeof all==='object'?all[deviceId]:null);
  }catch{return {...DEFAULTS}}
}
function save(storage,deviceId,values){
  if(!storage||!deviceId)return false;
  try{
    const data=JSON.parse(storage.getItem(STORAGE_KEY)||'{}');
    const all=data&&typeof data==='object'&&!Array.isArray(data)?data:{};
    all[deviceId]=normalize(values);
    storage.setItem(STORAGE_KEY,JSON.stringify(all));
    return true;
  }catch{return false}
}
function cssFilter(values){
  const v=normalize(values);
  return 'brightness('+v.brightness+'%) contrast('+v.contrast+'%) saturate('+v.saturation+'%)';
}
// Normal cameras need a real outgoing filtered video track, not just a CSS preview.
// If no adjustments are stored, keep the original track and avoid extra processing.
function createStream(raw,{fps=25}={}){
  const sourceTrack=raw?.getVideoTracks?.()[0];
  if(!sourceTrack||sourceTrack.readyState!=='live')return null;
  const deviceId=sourceTrack.getSettings?.()?.deviceId||'';
  const values=load(root.localStorage,deviceId);
  if(Object.keys(DEFAULTS).every(key=>values[key]===DEFAULTS[key]))return null;
  if(typeof document==='undefined'||typeof MediaStream==='undefined')return null;
  const canvas=document.createElement('canvas');
  if(typeof canvas.captureStream!=='function')return null;
  const ctx=canvas.getContext('2d',{alpha:false});
  // Do not silently transmit unfiltered video if Canvas 2D filters are unavailable.
  if(!ctx||!('filter' in ctx))return null;
  const settings=sourceTrack.getSettings?.()||{};
  const w=Math.max(1,Math.round(settings.width||1280));
  const h=Math.max(1,Math.round(settings.height||720));
  canvas.width=w;canvas.height=h;
  const video=document.createElement('video');
  video.muted=true;video.autoplay=true;video.playsInline=true;
  video.srcObject=new MediaStream([sourceTrack]);
  let capture,track,frame=0,stopped=false;
  try{
    capture=canvas.captureStream(fps);
    track=capture.getVideoTracks()[0];
    if(!track)throw Error('Ingen filtrert videostrøm');
    const filter=cssFilter(values);
    function draw(){
      if(stopped)return;
      if(video.readyState>=2&&video.videoWidth&&video.videoHeight){
        ctx.filter=filter;
        ctx.drawImage(video,0,0,w,h);
        ctx.filter='none';
      }
      frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
    video.play().catch(()=>{});
  }catch(error){
    if(frame)cancelAnimationFrame(frame);
    track?.stop();
    video.pause();video.srcObject=null;
    throw error;
  }
  return{
    sourceTrack,track,
    stream:new MediaStream([track,...raw.getAudioTracks()]),
    stop(){
      if(stopped)return;
      stopped=true;
      if(frame)cancelAnimationFrame(frame);
      track.stop();video.pause();video.srcObject=null;
      // The caller owns and stops the physical track separately.
    }
  };
}
const api={STORAGE_KEY,DEFAULTS,normalize,load,save,cssFilter,createStream};
root.DartArenaCameraPicture=api;
if(typeof module==='object'&&module.exports)module.exports=api;
if(typeof document==='undefined')return;
const modal=document.getElementById('cameraTestModal');
const preview=modal?.querySelector('.cam-test-preview');
const video=document.getElementById('cameraTestVideo');
const camera=document.getElementById('cameraTestCameraSelect');
if(!modal||!preview||!video||!camera)return;

const panel=document.createElement('details');
panel.className='cam-picture-panel';
panel.innerHTML=`
  <summary>Bildejustering <span>Valgfritt</span></summary>
  <div class="cam-picture-body">
    <div class="cam-picture-sliders">
      <label>Lysstyrke <output id="camPicBrightnessValue">100%</output>
        <input id="camPicBrightness" type="range" min="75" max="135" step="1" value="100">
      </label>
      <label>Kontrast <output id="camPicContrastValue">100%</output>
        <input id="camPicContrast" type="range" min="80" max="140" step="1" value="100">
      </label>
      <label>Farger <output id="camPicSaturationValue">100%</output>
        <input id="camPicSaturation" type="range" min="70" max="130" step="1" value="100">
      </label>
    </div>
    <div class="cam-picture-actions">
      <button type="button" id="camPicCompare" class="outline" aria-pressed="false">Vis original</button>
      <button type="button" id="camPicReset" class="outline">Nullstill bilde</button>
    </div>
    <p class="muted compact">Lagres automatisk for valgt kamera. Gjelder forhåndsvisning og Zoom-cam. Original brukes til treffdeteksjon.</p>
  </div>`;
preview.insertAdjacentElement('afterend',panel);
const controls={
  brightness:panel.querySelector('#camPicBrightness'),
  contrast:panel.querySelector('#camPicContrast'),
  saturation:panel.querySelector('#camPicSaturation')
};
const compare=panel.querySelector('#camPicCompare');
let device='',values={...DEFAULTS},original=false;
function storage(){try{return root.localStorage}catch{return null}}
function activeDevice(){
  return video.srcObject?.getVideoTracks?.()[0]?.getSettings?.()?.deviceId
    ||camera.value||storage()?.getItem('dartarena-preferred-camera')||'';
}
function show(){
  modal.style.setProperty('--da-picture-filter',original?'none':cssFilter(values));
  compare.textContent=original?'Vis justert':'Vis original';
  compare.setAttribute('aria-pressed',String(original));
  for(const key of Object.keys(controls)){
    controls[key].value=String(values[key]);
    const output=panel.querySelector('#camPic'+key[0].toUpperCase()+key.slice(1)+'Value');
    if(output)output.textContent=values[key]+'%';
  }
}
function refresh(){
  const next=activeDevice();
  if(device!==next){
    device=next;
    values=load(storage(),device);
    original=false;
  }
  show();
}
for(const [key,input] of Object.entries(controls)){
  input.addEventListener('input',()=>{
    values=normalize({...values,[key]:input.value});
    original=false;
    save(storage(),device||activeDevice(),values);
    show();
  });
}
compare.addEventListener('click',()=>{original=!original;show()});
panel.querySelector('#camPicReset').addEventListener('click',()=>{
  values={...DEFAULTS};original=false;
  save(storage(),device||activeDevice(),values);
  show();
});
video.addEventListener('loadedmetadata',refresh);
camera.addEventListener('change',()=>{device='';setTimeout(refresh,350)});
document.getElementById('cameraTestBtn')?.addEventListener('click',()=>{device='';setTimeout(refresh,200)});
refresh();
})(typeof window!=='undefined'?window:globalThis);
