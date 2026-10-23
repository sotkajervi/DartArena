/* Online X01 camera heatmap beta. Read-only; no scoring, uploads or extra camera capture. */
(()=>{
'use strict';
const G=window.DartArenaAutoZoom,H=window.DartArenaHeatmapMath,T=window.DartArenaAutoZoomTipMap,Z=window.DartArenaZoomCam;
const $=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
if(!G||!H||!T||!id||!$('matchView')||new URLSearchParams(location.search).has('tournamentMatch'))return;
const button=document.createElement('button');button.type='button';button.className='outline';button.id='onlineHeatmapBtn';button.textContent='Heatmap β';button.setAttribute('aria-expanded','false');
$('matchView').querySelector('.match-head .top-actions')?.prepend(button);
const panel=document.createElement('section');panel.className='card online-heatmap-panel';panel.id='onlineHeatmapPanel';panel.hidden=true;
panel.innerHTML=[
'<header class="hm-head"><div><small>ONLINE X01 · BETA</small><h2>Heatmap fra eget kamera</h2><p>Hver PC analyserer sine egne kast. Ingen automatisk scoring, opplasting eller lagring av videobilder.</p></div><button id="hmClose" class="outline" type="button">Lukk</button></header>',
'<nav class="hm-actions"><button type="button" class="outline" id="hmCalibrate">Kalibrer Bull + D20</button><button type="button" class="primary" id="hmReference">Tom skive / referanse</button><button type="button" class="outline" id="hmPause">Pause</button><button type="button" class="outline" id="hmUndo">Angre</button><button type="button" class="outline" id="hmClear">Tøm</button><button type="button" class="outline" id="hmExport">Eksporter JSON</button></nav>',
'<p id="hmStatus" role="status" aria-live="polite" class="hm-status">Start ditt kamera og åpne heatmap.</p>',
'<div class="hm-grid"><div class="hm-column"><strong>Originalt kamerabilde</strong><canvas id="hmPreview" width="640" height="360" aria-label="Kamerabilde: klikk Bull, deretter D20, ved kalibrering"></canvas>',
'<small>Klikk Bull og D20 ved kalibrering. ZoomCam-kalibrering gjenbrukes når den passer kameraet.</small><strong>Zoom på siste pil · klikk innslagspunktet</strong><canvas id="hmZoom" width="320" height="240" aria-label="Forstørret treffområde: klikk der pilspissen går inn i skiva"></canvas></div>',
'<div class="hm-column"><strong>Heatmap · dine piler</strong><canvas id="hmBoard" width="380" height="380" aria-label="Digital dartskive: klikk for å velge eller korrigere et treff"></canvas><b id="hmCount">0 registrerte</b>',
'<small>Turkis: spissforslag. Oransje: usikkert. Hvit: korrigert. Du kan korrigere i zoomvinduet eller på skiva. Registrering skjer kun på din tur.</small></div></div>'
].join('');
$('matchView').append(panel);
const preview=$('hmPreview'),zoom=$('hmZoom'),heat=$('hmBoard'),pctx=preview.getContext('2d'),zctx=zoom.getContext('2d'),hctx=heat.getContext('2d');
const analysis=document.createElement('canvas'),actx=analysis.getContext('2d',{willReadFrequently:true});
const storageKey='dartarena-heatmap-online-beta:'+id;
let marks=[],selected=-1,visible=false,paused=false,sourceId='',video=null,ownVideo=false,sourceTrack=null,board=null,bull=null,step=0;
let baseline=null,previous=null,quiet=0,motion=null,gate=null,turnState=null,turnHits=0,aim=null,zoomCrop=null;
let timer=0,frame=0,lastMessage='',videoDims='',tipQuality=null;
try{const old=JSON.parse(sessionStorage.getItem(storageKey)||'[]');
  if(Array.isArray(old))marks=old.slice(-600).filter(m=>Number.isFinite(m?.u)&&Number.isFinite(m?.v)&&Math.hypot(m.u,m.v)<=1.55)}catch{}
const active=()=>$('matchStatus')?.textContent?.trim()==='Pågår'&&$('matchScoreInput')?.disabled===false;
const ready=()=>!!video&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&!video.paused;
function say(msg){if(msg!==lastMessage){lastMessage=msg;$('hmStatus').textContent=msg}}
function save(){try{sessionStorage.setItem(storageKey,JSON.stringify(marks.slice(-600)))}catch{}}
function resetDetection(){baseline=null;previous=null;quiet=0;motion=null;gate=G.createChangeGate({stableFrames:4,motionWindowMs:4000,cooldownMs:1600})}
function stopVideo(){
 if(ownVideo&&video){try{video.pause();video.srcObject=null}catch{}}
 video=null;ownVideo=false;sourceTrack=null;sourceId='';board=null;bull=null;step=0;aim=null;zoomCrop=null;turnState=null;turnHits=0;videoDims='';resetDetection();
}
function source(){
 const local=$('localVideo'),src=local?.srcObject;
 const raw=window.DartArenaX01ZoomSession?.sourceTrack;
 if(raw?.readyState==='live')return{track:raw,key:'raw:'+raw.id,needsClone:true};
 const track=src?.getVideoTracks?.()[0];
 return track?.readyState==='live'?{track,key:'local:'+track.id,needsClone:false,video:local}:null;
}
function attach(){
 const s=source();if(!s){if(sourceId)stopVideo();return false}
 if(s.key===sourceId)return ready();
 stopVideo();sourceId=s.key;sourceTrack=s.track;
 if(s.needsClone){
   ownVideo=true;video=document.createElement('video');video.muted=true;video.autoplay=true;video.playsInline=true;
   video.srcObject=new MediaStream([s.track]);video.play().catch(()=>{});
 }else video=s.video;
 say('Kamera funnet. Venter på videobilde for kalibrering.');
 return false;
}
function loadBoard(){
 if(board||!ready())return;
 const conf=Z?.loadConfig(localStorage),settings=sourceTrack?.getSettings?.()||{};
 if(conf&&settings.deviceId===conf.deviceId&&Math.abs(video.videoWidth/video.videoHeight-conf.aspect)/conf.aspect<.085){
   board={x:conf.cx*video.videoWidth,y:conf.cy*video.videoHeight,radius:conf.radius*video.videoWidth,rotation:conf.rotation};
   resetDetection();say('ZoomCam-kalibrering lastet. Fjern pilene og ta referanse med tom skive.');
 }
}
function drawBoard(){
 const size=heat.width,C=size/2,R=size*.395,ORDER=G.ORDER;
 hctx.clearRect(0,0,size,size);hctx.fillStyle='#071012';hctx.fillRect(0,0,size,size);
 for(let i=0;i<20;i++){
   const a=(i-.5)*Math.PI/10-Math.PI/2,b=(i+.5)*Math.PI/10-Math.PI/2;
   hctx.beginPath();hctx.moveTo(C,C);hctx.arc(C,C,R,a,b);hctx.closePath();hctx.fillStyle=i%2?'#d6d2c0':'#26353b';hctx.fill();
   for(const [hi,lo] of [[1,.954],[.630,.583]]){
     hctx.beginPath();hctx.arc(C,C,R*hi,a,b);hctx.arc(C,C,R*lo,b,a,true);hctx.closePath();
     hctx.fillStyle=i%2?'#b52f46':'#078e70';hctx.fill();
   }
   hctx.beginPath();hctx.moveTo(C,C);hctx.lineTo(C+R*Math.cos(a),C+R*Math.sin(a));hctx.strokeStyle='#b9b8b4';hctx.lineWidth=.7;hctx.stroke();
   const rad=i*Math.PI/10-Math.PI/2;
   hctx.fillStyle='#edf9f9';hctx.font='bold 13px sans-serif';hctx.textAlign='center';hctx.textBaseline='middle';
   hctx.fillText(String(ORDER[i]),C+(R+17)*Math.cos(rad),C+(R+17)*Math.sin(rad));
 }
 for(const [r,c] of [[.093,'#159b73'],[.037,'#ba2d45']]){
   hctx.beginPath();hctx.arc(C,C,R*r,0,Math.PI*2);hctx.fillStyle=c;hctx.fill();
 }
 for(const m of marks){
   const x=C+m.u*R,y=C+m.v*R,spread=R*.13;
   const gradient=hctx.createRadialGradient(x,y,0,x,y,spread);
   gradient.addColorStop(0,'rgba(0,234,244,.44)');gradient.addColorStop(.5,'rgba(0,234,244,.15)');gradient.addColorStop(1,'rgba(0,234,244,0)');
   hctx.fillStyle=gradient;hctx.fillRect(x-spread,y-spread,spread*2,spread*2);
 }
 marks.forEach((m,i)=>{
   hctx.beginPath();hctx.arc(C+m.u*R,C+m.v*R,i===selected?6:3.5,0,Math.PI*2);
   hctx.fillStyle=m.corrected?'#fff':m.tipDetected?'#00eaf4':'#ffb547';hctx.fill();
   hctx.lineWidth=1.5;hctx.strokeStyle='#071012';hctx.stroke();
 });
 $('hmCount').textContent=marks.length+' registrerte · '+marks.filter(m=>m.corrected).length+' korrigerte';
 for(const b of ['hmUndo','hmClear','hmExport'])$(b).disabled=!marks.length;
}
function accept(hit,frameData,w,h){
 const suggestion=H.infer(baseline,frameData,w,h,hit,{
   x:board.x*w/video.videoWidth,y:board.y*h/video.videoHeight,radius:board.radius*w/video.videoWidth});
 const p={x:suggestion.x*video.videoWidth/w,y:suggestion.y*video.videoHeight/h};
 const n=H.normalize(board,p);
 if(!n)return;
 const item={...n,quality:suggestion.quality,tipDetected:suggestion.tipDetected,corrected:false,time:new Date().toISOString()};
 marks.push(item);if(marks.length>600)marks.shift();selected=marks.length-1;aim=p;tipQuality=suggestion.tipDetected;
 turnHits++;save();drawBoard();
 say('Pil '+turnHits+'/3 registrert: '+(suggestion.tipDetected?'mulig pilspiss':'usikkert estimat')+'. Klikk spissen i ZoomCam for å korrigere. Scoring endres ikke.');
}
function tick(){
 if(!visible||paused||!attach()||!ready())return;
 const dims=video.videoWidth+'x'+video.videoHeight;
 if(videoDims&&dims!==videoDims){board=null;resetDetection();say('Videoformat endret. Kalibrer skiva på nytt.')}
 videoDims=dims;
 if(!board){if(!step)loadBoard();return}
 if(step)return;
 if(!active()){
   if(turnState!==false){turnState=false;turnHits=0;resetDetection();say('Motstanderens tur. Heatmap venter på ditt neste kast.')}
   return;
 }
 if(turnState!==true){turnState=true;turnHits=0;resetDetection();say('Din tur. Fjern pilene og velg «Tom skive / referanse».');return}
 if(!baseline||turnHits>=3)return;
 const w=analysis.width,h=analysis.height;
 if(!w||!h)return;
 let data;try{actx.drawImage(video,0,0,w,h);data=new Uint8ClampedArray(actx.getImageData(0,0,w,h).data)}catch{return}
 const small={x:board.x*w/video.videoWidth,y:board.y*h/video.videoHeight,radius:board.radius*w/video.videoWidth};
 const now=performance.now(),opts={...G.sensitivityPreset('normal'),searchRadius:1.55};
 const moving=previous?G.motionRatio(previous,data,w,h,small,{searchRadius:1.55}):0;
 const localMotion=previous&&moving<=.008?G.findChange(previous,data,w,h,small,{...opts,maxRatio:.045}):null;
 if(localMotion&&localMotion.changedSamples>=opts.minSamples&&localMotion.localSamples/Math.max(1,localMotion.changedSamples)>=.5)
   motion={x:localMotion.x,y:localMotion.y,at:now};
 if(motion&&now-motion.at>3000)motion=null;
 previous=data;quiet=moving>.008?0:quiet+1;
 const candidate=quiet>=3?G.findChange(baseline,data,w,h,small,opts):null;
 const hit=gate.observe(candidate,{movement:moving>.008||!!localMotion,now,radius:small.radius});
 if(!hit)return;
 const valid=motion&&now-motion.at<=3000&&
   Math.hypot(hit.x-motion.x,hit.y-motion.y)<=Math.max(9,small.radius*.22)&&
   hit.changedSamples>=Math.max(12,opts.minSamples)&&
   hit.localSamples/Math.max(1,hit.changedSamples)>=.5;
 if(!valid)return;
 accept(hit,data,w,h);baseline=new Uint8ClampedArray(data);previous=null;quiet=0;motion=null;
}
function drawZoom(){
 if(!board||!ready())return;
 const center=aim||G.targetPoint(board.x,board.y,board.radius,'T20',board.rotation);
 if(!center)return;
 zoomCrop=G.zoomCrop(video.videoWidth,video.videoHeight,center.x,center.y,board.radius,zoom.width/zoom.height);
 zctx.clearRect(0,0,zoom.width,zoom.height);
 try{zctx.drawImage(video,zoomCrop.x,zoomCrop.y,zoomCrop.width,zoomCrop.height,0,0,zoom.width,zoom.height)}catch{return}
 if(aim){
   const p=T.pointOnZoom(aim,zoomCrop,zoom.width,zoom.height);
   if(p){zctx.save();zctx.beginPath();zctx.arc(p.x,p.y,9,0,Math.PI*2);
     zctx.strokeStyle=marks[selected]?.corrected?'#fff':tipQuality?'#00eaf4':'#ffb547';
     zctx.shadowColor=zctx.strokeStyle;zctx.shadowBlur=10;zctx.lineWidth=3;zctx.stroke();zctx.restore()}
 }
}
function display(){
 if(!visible)return;
 if(attach()&&ready()){
   const w=video.videoWidth,h=video.videoHeight;
   const targetH=Math.max(1,Math.round(preview.width*h/w)),sampleH=Math.max(1,Math.round(480*h/w));
   if(preview.height!==targetH)preview.height=targetH;
   if(analysis.width!==480||analysis.height!==sampleH){analysis.width=480;analysis.height=sampleH;resetDetection()}
   try{pctx.drawImage(video,0,0,preview.width,preview.height)}catch{}
   if(board){
     const scale=preview.width/w;
     pctx.beginPath();pctx.arc(board.x*scale,board.y*scale,board.radius*scale,0,Math.PI*2);
     pctx.strokeStyle='#00eaf4';pctx.lineWidth=2;pctx.stroke();
   }else if(bull){pctx.beginPath();pctx.arc(bull.x*preview.width/w,bull.y*preview.height/h,6,0,Math.PI*2);pctx.strokeStyle='#fff';pctx.stroke()}
   drawZoom();
 }
 frame=requestAnimationFrame(display);
}
function start(){
 visible=true;panel.hidden=false;button.textContent='Lukk heatmap β';button.setAttribute('aria-expanded','true');
 resetDetection();drawBoard();display();timer=setInterval(tick,180);
 panel.scrollIntoView?.({block:'nearest',behavior:'smooth'});
 say('Bruk ditt eksisterende kamera. Kalibrer eller gjenbruk ZoomCam-kalibrering, og ta referanse med tom skive.');
}
function stop(){
 visible=false;panel.hidden=true;button.textContent='Heatmap β';button.setAttribute('aria-expanded','false');
 if(frame)cancelAnimationFrame(frame);frame=0;if(timer)clearInterval(timer);timer=0;stopVideo();
}
button.onclick=()=>visible?stop():start();$('hmClose').onclick=stop;
$('hmCalibrate').onclick=()=>{if(!attach()||!ready()){say('Start kamera først.');return}
 board=null;bull=null;step=1;resetDetection();say('Klikk Bull midt på skiva i kamerabildet.');};
preview.onclick=event=>{
 if(!step||!ready())return;
 const rect=preview.getBoundingClientRect();
 const x=(event.clientX-rect.left)*video.videoWidth/rect.width,y=(event.clientY-rect.top)*video.videoHeight/rect.height;
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>video.videoWidth||y>video.videoHeight)return;
 if(step===1){bull={x,y};step=2;say('Klikk midt på D20-dobbelringen.');return}
 const dist=Math.hypot(x-bull.x,y-bull.y);
 if(dist<Math.min(video.videoWidth,video.videoHeight)*.08){say('For kort avstand mellom Bull og D20. Prøv igjen.');return}
 board={x:bull.x,y:bull.y,radius:dist/.976,rotation:Math.atan2(x-bull.x,bull.y-y)};
 step=0;resetDetection();say('Skiva kalibrert. Fjern pilene og trykk «Tom skive / referanse».');
};
$('hmReference').onclick=()=>{
 if(!board||!ready()||!analysis.width){say('Start kameraet og kalibrer skiva først.');return}
 if(!active()){say('Ta referansen med tom skive når det er din tur.');return}
 try{actx.drawImage(video,0,0,analysis.width,analysis.height);
   const shot=new Uint8ClampedArray(actx.getImageData(0,0,analysis.width,analysis.height).data);
   resetDetection();baseline=shot;turnState=true;turnHits=0;aim=null;
   say('Referanse tatt. Kast én pil om gangen. Maks tre treff registreres per tur.');}
 catch{say('Kunne ikke lese videobildet. Kontroller kameratilgangen.')}
};
zoom.onclick=event=>{
 if(!board||!marks.length||selected<0||!zoomCrop)return;
 const p=T.pointFromZoom(event,zoom.getBoundingClientRect(),zoomCrop,zoom.width,zoom.height);
 const n=p&&H.normalize(board,p);
 if(!n){say('Klikk der pilen går inn i skiva i ZoomCam.');return}
 marks[selected]={...marks[selected],...n,corrected:true,correctedFrom:'zoomcam'};
 aim=p;tipQuality=true;save();drawBoard();say('Innslagspunkt korrigert i heatmap. Scoring er uendret.');
};
heat.onclick=event=>{
 if(!marks.length)return;
 const rect=heat.getBoundingClientRect(),C=heat.width/2,R=heat.width*.395;
 const u=((event.clientX-rect.left)*heat.width/rect.width-C)/R,v=((event.clientY-rect.top)*heat.height/rect.height-C)/R;
 if(!Number.isFinite(u)||!Number.isFinite(v)||Math.hypot(u,v)>1.55)return;
 const found=marks.findLastIndex(m=>Math.hypot(m.u-u,m.v-v)<.045);
 if(found>=0){selected=found;aim=null;say('Treff '+(selected+1)+' valgt. Klikk et annet punkt for å korrigere.')}
 else{if(selected<0)selected=marks.length-1;
   marks[selected]={...marks[selected],u,v,corrected:true,correctedFrom:'heatmap'};aim=null;save();say('Heatmap-treff korrigert. Scoring er uendret.')}
 drawBoard();
};
$('hmPause').onclick=()=>{paused=!paused;$('hmPause').textContent=paused?'Fortsett':'Pause';resetDetection();
 say(paused?'Heatmap pauset.':'Heatmap startet igjen. Ta ny referanse før neste kast.')};
$('hmUndo').onclick=()=>{if(!marks.length)return;marks.pop();selected=marks.length-1;turnHits=Math.max(0,turnHits-1);
 aim=null;save();drawBoard();resetDetection();say('Siste treff fjernet. Ta ny referanse.');};
$('hmClear').onclick=()=>{if(!marks.length||!confirm('Tømme heatmap på denne PC-en?'))return;marks=[];selected=-1;turnHits=0;aim=null;
 save();drawBoard();resetDetection();say('Heatmap tømt. Ta ny referanse.');};
$('hmExport').onclick=()=>{
 if(!marks.length)return;
 const data={schema:'dartarena-online-heatmap-beta-v1',matchId:id,localOnly:true,createdAt:new Date().toISOString(),
   coordinateSystem:'board radii, u right, v down',marks};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download='heatmap-'+id.slice(0,8)+'.json';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
};
window.addEventListener('pagehide',stop,{once:true});drawBoard();
})();
