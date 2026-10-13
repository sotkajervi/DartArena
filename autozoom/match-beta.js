/* Owner/Admin AutoZoom beta for X01 match.html. Shares crop coordinates only;
   no new media capture, scoring or WebRTC track replacement. */
(()=>{
'use strict';
const G=window.DartArenaAutoZoom;
const head=document.querySelector('#matchView .match-head');
const actions=head?.querySelector('.top-actions');
const videos={local:document.getElementById('localVideo'),remote:document.getElementById('remoteVideo')};
const cards={local:document.getElementById('localVideoCard'),remote:document.getElementById('remoteVideoCard')};
if(!G||!actions||!head||!videos.local||!videos.remote||!cards.local||!cards.remote||!window.supabase)return;
const endpoint='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const publishable='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(endpoint,publishable);
const toggle=document.createElement('button');
toggle.id='matchAutoZoomBtn';toggle.className='outline hidden';toggle.type='button';
toggle.textContent='AutoZoom (BETA)';
actions.prepend(toggle);
let panel=null,ui=null,authorized=false,visible=false,source='remote';
let overlay=null,inset=null,insetCtx=null,video=null;
let board=null,bull=null,calibrationStep=0,reference=null,previous=null,quiet=0;
let zoomTarget=null,zoomCurrent=null,zoomLabel='T20';
let loop=0,watch=0,gate=null,serial=0,lastDimensions='',calibratedStream=null;
const analysis=document.createElement('canvas');
const analysisCtx=analysis.getContext('2d',{willReadFrequently:true});
const SEARCH_RADIUS=1.65; // Include the board surround beyond the outer double ring.
function status(message){if(ui)ui.status.textContent=message}
function syncSharing(){
  const share=window.DartArenaMatchAutoZoomShare;
  if(!share)return;
  const active=visible&&source==='local'&&ui?.share?.value==='on'&&ui.enabledOn
    &&board&&reference&&zoomTarget&&ready();
  if(!active)return share.stop();
  share.publish({active:true,x:zoomTarget.x/video.videoWidth,
    y:zoomTarget.y/video.videoHeight,radius:board.radius/video.videoWidth,
    speed:ui.speed.value,label:zoomLabel});
}
function ready(){
  if(!video||!video.videoWidth||!video.videoHeight||video.readyState<2)return false;
  const track=video.srcObject?.getVideoTracks?.();
  return !track||track.some(t=>t.readyState==='live'&&t.enabled&&!t.muted);
}
function resetDetection(){
  reference=null;previous=null;quiet=0;gate?.reset();
}
function clearBoard(){
  window.DartArenaMatchAutoZoomShare?.stop();
  board=null;bull=null;calibrationStep=0;zoomTarget=null;zoomCurrent=null;calibratedStream=null;
  resetDetection();
  if(ui)ui.reference.disabled=true;
  if(overlay)overlay.classList.add('hidden');
}
function unmount(){
  if(overlay){overlay.remove();overlay=null}
  if(inset){inset.remove();inset=null;insetCtx=null}
  video=null;clearBoard();
}
function hide(){
  window.DartArenaMatchAutoZoomShare?.stop();
  visible=false;
  if(watch){clearInterval(watch);watch=0}
  if(loop){cancelAnimationFrame(loop);loop=0}
  unmount();
  if(panel)panel.classList.add('hidden');
  toggle.textContent='AutoZoom (BETA)';
}
function aim(x,y,label){
  zoomTarget={x,y};zoomLabel=label;
  if(ui)ui.last.textContent=label;
  const el=inset?.querySelector('.da-az-zoom-target');
  if(el)el.textContent=label;
  syncSharing();
}
function aimT20(){
  if(!board)return;
  const p=G.targetPoint(board.x,board.y,board.radius,'T20',board.rotation);
  if(p)aim(p.x,p.y,'T20');
}
function mount(){
  unmount();
  source=ui.source.value;
  video=videos[source];
  overlay=document.createElement('div');
  overlay.className='da-az-calibration-layer hidden';
  overlay.setAttribute('aria-label','Kalibrer skive: klikk Bull og D20');
  overlay.addEventListener('click',calibrationClick);
  inset=document.createElement('div');
  inset.className='da-az-inset';
  inset.innerHTML='<div class="da-az-inset-header"><span>AUTOZOOM BETA</span><span class="da-az-zoom-target">T20</span></div><canvas width="320" height="240"></canvas>';
  insetCtx=inset.querySelector('canvas').getContext('2d');
  cards[source].append(overlay,inset);
  lastDimensions='';
  status('Valgt '+(source==='remote'?'motstanderens':'ditt')+' kamera. Kalibrer Bull og D20 når hele skiva er synlig.');
}
function capture(){
  if(!ready())return null;
  const w=analysis.width,h=analysis.height;
  try{
    analysisCtx.drawImage(video,0,0,w,h);
    return new Uint8ClampedArray(analysisCtx.getImageData(0,0,w,h).data);
  }catch{
    status('Kan ikke lese videobildet. Kontroller kamera og nettlesertillatelser.');
    return null;
  }
}
function setSpeed(){
  const speed=G.speedPreset(ui.speed.value);
  gate=G.createChangeGate({stableFrames:speed.stableFrames,motionWindowMs:4000,cooldownMs:speed.cooldownMs});
  previous=null;quiet=0;
  if(watch){clearInterval(watch);watch=0}
  if(visible)watch=setInterval(analyse,speed.intervalMs);
}
function render(){
  if(!visible)return;
  if(source==='local'&&reference&&!ready())window.DartArenaMatchAutoZoomShare?.stop();
  if(ready()&&board&&zoomTarget&&insetCtx&&inset){
    const speed=G.speedPreset(ui.speed.value);
    if(!zoomCurrent)zoomCurrent={...zoomTarget};
    zoomCurrent.x+=(zoomTarget.x-zoomCurrent.x)*speed.ease;
    zoomCurrent.y+=(zoomTarget.y-zoomCurrent.y)*speed.ease;
    const canvas=inset.querySelector('canvas');
    const crop=G.zoomCrop(video.videoWidth,video.videoHeight,zoomCurrent.x,zoomCurrent.y,
      board.radius,canvas.width/canvas.height);
    try{
      insetCtx.drawImage(video,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
    }catch{}
  }
  loop=requestAnimationFrame(render);
}
function analyse(){
  if(!visible||!board||!reference||!ready()||!ui.enabledOn||calibrationStep)return;
  const dimensions=video.videoWidth+'x'+video.videoHeight;
  if(dimensions!==lastDimensions||video.srcObject!==calibratedStream){
    clearBoard();status('Kamera eller videoformat endret. Kalibrer skiva på nytt.');return
  }
  const frame=capture();if(!frame)return;
  const w=analysis.width,h=analysis.height;
  const small={x:board.x*w/video.videoWidth,y:board.y*h/video.videoHeight,
    radius:board.radius*w/video.videoWidth};
  const motion=previous?G.motionRatio(previous,frame,w,h,small,{searchRadius:SEARCH_RADIUS}):0;
  const preset={...G.sensitivityPreset(ui.sensitivity.value),searchRadius:SEARCH_RADIUS};
  const motionHit=previous&&motion<=.008?G.findChange(previous,frame,w,h,small,
    {...preset,maxRatio:.045}):null;
  previous=frame;
  if(motion>.008)quiet=0;
  else quiet++;
  const speed=G.speedPreset(ui.speed.value);
  const candidate=quiet>=speed.quietFrames?G.findChange(reference,frame,w,h,small,preset):null;
  const hit=gate.observe(candidate,{movement:motion>.008||!!motionHit,now:performance.now(),radius:small.radius});
  if(!hit)return;
  const x=hit.x*video.videoWidth/w,y=hit.y*video.videoHeight/h;
  aim(x,y,'Siste treff*');
  reference=frame;quiet=0;
  status('Zoom flyttet til ny stabil bildeendring'+(Math.hypot(x-board.x,y-board.y)>board.radius?' utenfor dobbelringen':'')+'. *Estimat, ikke bekreftet pilspiss.');
}
function calibrationClick(event){
  if(!visible||!ready()||!calibrationStep)return;
  const r=video.getBoundingClientRect();
  const vw=video.videoWidth,vh=video.videoHeight;
  const scale=Math.min(r.width/vw,r.height/vh);
  const left=(r.width-vw*scale)/2,top=(r.height-vh*scale)/2;
  const x=(event.clientX-r.left-left)/scale,y=(event.clientY-r.top-top)/scale;
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>vw||y>vh){
    status('Klikk innenfor selve kamerabildet.');return;
  }
  if(calibrationStep===1){
    bull={x,y};calibrationStep=2;
    status('Klikk midt på D20-dobbelringen.');
    return;
  }
  const dist=Math.hypot(x-bull.x,y-bull.y);
  if(dist<Math.min(vw,vh)*.08){
    status('D20 er for nær Bull. Klikk på den ytre dobbelringen.');return;
  }
  board={x:bull.x,y:bull.y,radius:dist/.976,rotation:Math.atan2(x-bull.x,bull.y-y)};
  lastDimensions=vw+'x'+vh;
  calibratedStream=video.srcObject;
  analysis.width=480;analysis.height=Math.max(80,Math.round(480*vh/vw));
  calibrationStep=0;
  overlay.classList.add('hidden');
  resetDetection();zoomCurrent=null;aimT20();
  ui.reference.disabled=false;
  status('Kalibrert. Fjern pilene, trykk «Tom skive / referanse», så kast én pil om gangen.');
}
function buildPanel(){
  panel=document.createElement('section');
  panel.id='matchAutoZoomPanel';panel.className='card da-az-panel hidden';
  panel.innerHTML=`<div class="da-az-head"><div><strong>AutoZoom – test i kamp</strong><small> Mitt kamera kan deles med motstander • video og poeng er uendret</small></div><button id="azMatchClose" type="button" class="outline">Lukk test</button></div>
    <div class="da-az-controls">
      <label>Kamera<select id="azMatchSource"><option value="remote">Motstanderens kamera</option><option value="local">Mitt kamera</option></select></label>
      <label>Del zoom<select id="azMatchShare"><option value="on" selected>På – når Mitt kamera er valgt</option><option value="off">Av – bare hos meg</option></select></label>
      <label>Følsomhet<select id="azMatchSensitivity"><option value="normal" selected>Normal (stabil)</option><option value="low">Lav</option><option value="high">Høy (eksperimentell)</option></select></label>
      <label>Responshastighet<select id="azMatchSpeed"><option value="fast">Rask</option><option value="normal" selected>Normal</option><option value="smooth">Rolig</option></select></label>
      <button type="button" id="azMatchCalibrate" class="outline">Kalibrer</button>
      <button type="button" id="azMatchReference" class="primary" disabled>Tom skive / referanse</button>
      <label class="da-az-enable"><span>Følg treff</span><select id="azMatchEnabled"><option value="on">På</option><option value="off">Av</option></select></label>
    </div>
    <p class="da-az-status" id="azMatchStatus" role="status" aria-live="polite">Velg videokilde, kalibrer Bull og D20, og ta referanse med tom skive.</p>
    <p class="da-az-status">Piler utenfor dobbelringen spores innenfor synlig kamerabilde. Bildeendringer er ikke sikker pilspissdeteksjon.</p>`;
  head.insertAdjacentElement('afterend',panel);
  ui={
    source:panel.querySelector('#azMatchSource'),
    sensitivity:panel.querySelector('#azMatchSensitivity'),
    speed:panel.querySelector('#azMatchSpeed'),
    share:panel.querySelector('#azMatchShare'),
    enabled:panel.querySelector('#azMatchEnabled'),
    calibrate:panel.querySelector('#azMatchCalibrate'),
    reference:panel.querySelector('#azMatchReference'),
    status:panel.querySelector('#azMatchStatus'),
    last:document.createElement('span')
  };
  // HTMLSelectElement has no checked prop; interpret this input as a mode select.
  const enabledElement=ui.enabled;
  Object.defineProperty(ui,'enabledOn',{get(){return enabledElement.value==='on'}});
  panel.querySelector('#azMatchClose').addEventListener('click',hide);
  ui.source.addEventListener('change',()=>{if(visible)mount()});
  ui.sensitivity.addEventListener('change',()=>{
    gate?.reset();previous=null;quiet=0;
    status('Følsomhet oppdatert. Normal og Lav har samme stabile filter.');
  });
  ui.speed.addEventListener('change',()=>{
    setSpeed();syncSharing();
    status('Hastighet endret til '+ui.speed.selectedOptions[0].textContent+'.');
  });
  ui.share.addEventListener('change',()=>{
    syncSharing();
    status(ui.share.value==='on'?'Deler zoom fra Mitt kamera med motstander når kalibrert.':'Zoom vises bare hos deg.');
  });
  ui.enabled.addEventListener('change',()=>{
    gate?.reset();previous=null;quiet=0;
    syncSharing();
    status(ui.enabledOn?'Sporing er på.':'Sporing pauset. Fullt kamerabilde fortsetter.');
  });
  ui.calibrate.addEventListener('click',()=>{
    if(!ready()){status('Vent til valgt kamera viser video før kalibrering.');return}
    clearBoard();calibrationStep=1;overlay.classList.remove('hidden');
    status('Klikk midt i Bull på valgt kamerabilde.');
  });
  ui.reference.addEventListener('click',()=>{
    if(!board||!ready())return status('Kalibrer skiva først.');
    const frame=capture();if(!frame)return;
    reference=frame;previous=null;quiet=0;gate?.reset();
    zoomCurrent=null;aimT20();
    status('Referanse tatt. Kast én pil og vent på stabilisering. Med Mitt kamera deles zoom med motstander dersom deling er på.');
  });
}
async function allowed(){
  try{
    const {data,error}=await db.auth.getUser();
    if(error||!data?.user)return false;
    const [owner,admin]=await Promise.all([db.rpc('is_owner'),db.rpc('is_admin')]);
    return !owner.error&&!admin.error&&(owner.data===true||admin.data===true);
  }catch{return false}
}
toggle.addEventListener('click',async()=>{
  if(visible)return hide();
  const ticket=++serial;
  toggle.disabled=true;
  const permitted=await allowed();
  toggle.disabled=false;
  if(ticket!==serial)return;
  if(!permitted){hide();toggle.classList.add('hidden');authorized=false;return}
  authorized=true;
  if(!panel)buildPanel();
  visible=true;panel.classList.remove('hidden');toggle.textContent='Lukk AutoZoom';
  mount();setSpeed();render();
});
window.addEventListener('pagehide',()=>{serial++;hide()});
db.auth.onAuthStateChange((event)=>{
  if(event==='SIGNED_OUT'){serial++;authorized=false;hide();toggle.classList.add('hidden')}
});
(async()=>{const ticket=++serial;if(await allowed()&&ticket===serial){authorized=true;toggle.classList.remove('hidden')}})();
})();
