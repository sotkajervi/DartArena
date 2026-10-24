/* Owner-only AI Rival tip + score suggestion sandbox.
   Suggestions never submit an actual visit. Works only inside training=1 games. */
(()=>{
'use strict';
if(new URLSearchParams(location.search).get('training')!=='1'||
   new URLSearchParams(location.search).has('tournamentAiMatch'))return;
const $=id=>document.getElementById(id),panel=$('ownerAiScoring');
if(!panel)return;
const Z=window.DartArenaZoomCam,T=window.DartArenaAutoZoom;
const FORMAT=Number(new URLSearchParams(location.search).get('format'))||501;
const stateKey=FORMAT===501?'dartarena-ai-rival-501-state-v1':'dartarena-ai-rival-'+FORMAT+'-state-v1';
let active=false,ready=false,video=null,config=null,before=null,weights=[],
  darts=[],busy=false,matchId=null,roundId=null,lastHitAt=0;
window.DartArenaOwnerTipAssistActive=false;
const order=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const say=t=>$('ownerAiScoringStatus').textContent=t;
function state(){try{return JSON.parse(localStorage.getItem(stateKey)||'null')}catch{return null}}
function human(){const s=state();return !!s&&s.status==='playing'&&s.turn===0}
function roundKey(s){
 if(!s)return '';
 const count=(s.visits||[]).filter(v=>v.player===0&&v.leg===s.leg&&(v.set||1)===(s.currentSet||1)).length;
 return [s.id,s.currentSet||1,s.leg,count].join(':');
}
function update(){
 const sum=darts.reduce((a,d)=>a+d.points,0);
 $('ownerAiTotal').textContent=sum+' poeng';
 $('ownerAiApplyScore').disabled=!active||!darts.length||!human();
 const host=$('ownerAiDarts');host.replaceChildren();
 darts.forEach((d,i)=>{
  const label=document.createElement('label');label.style.cssText='display:grid;gap:5px;min-width:118px;flex:1;font-size:12px;color:#b6dce0';
  const note=document.createElement('span');note.textContent='Pil '+(i+1)+' · AI '+d.label;
  const input=document.createElement('input');input.type='number';input.min='0';input.max='60';input.step='1';
  input.value=String(d.points);input.style.cssText='background:#071519;color:white;border:1px solid #44717a;border-radius:7px;padding:9px;width:100%';
  input.setAttribute('aria-label','Poeng pil '+(i+1));
  input.addEventListener('change',()=>{
   const val=Number(input.value);
   if(!Number.isInteger(val)||val<0||val>60){input.value=String(d.points);say('Hver pil må ha et gyldig poengtall mellom 0 og 60.');return}
   d.points=val;update();
  });
  label.append(note,input);host.append(label);
 });
}
function frame(videoEl){
 if(!videoEl?.videoWidth||!videoEl?.videoHeight)throw Error('Kamerabildet er ikke klart.');
 const c=document.createElement('canvas');c.width=videoEl.videoWidth;c.height=videoEl.videoHeight;
 c.getContext('2d').drawImage(videoEl,0,0,c.width,c.height);return c;
}
function sample(canvas,w,h){
 const c=document.createElement('canvas');c.width=w;c.height=h;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,w,h);
 return ctx.getImageData(0,0,w,h).data;
}
function crop(canvas,rect){
 const c=document.createElement('canvas');c.width=640;c.height=480;
 c.getContext('2d').drawImage(canvas,rect.x,rect.y,rect.width,rect.height,0,0,640,480);
 return c;
}
function tensor(first,second){
 const a=sample(first,160,120),b=sample(second,160,120),z=new Float32Array(120*160*6);
 for(let i=0;i<120*160;i++)for(let c=0;c<3;c++){
  const k=i*6,p=i*4,x=b[p+c]/255,y=a[p+c]/255;
  z[k+c]=x;z[k+c+3]=Math.min(1,Math.abs(x-y)*2);
 }
 return z;
}
function dec(b64,count){
 const b=atob(b64);if(b.length!==count*4)throw Error('Ugyldig modellfil');
 const bytes=Uint8Array.from(b,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),f=new Float32Array(count);
 for(let i=0;i<count;i++)f[i]=view.getFloat32(i*4,true);
 return f;
}
const same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
async function load(file){
 if(!active||!window.tf)return;
 const newWeights=[];
 try{
  const x=JSON.parse(await file.text()),shapes=[[5,5,6,24],[3,3,24,48],[3,3,48,64],[3,3,64,64],[3,3,64,64],[1,1,64,1]];
  if(x.format!=='dartarena-diffnet-v1-tfjs-f32'||!same(x.input,[120,160,6])||
     !same(x.output,[30,40,1])||x.steps?.length!==6)throw Error('Dette er ikke DartArena før-/ettermodell v1.');
  await tf.ready();
  for(let i=0;i<6;i++){
   const p=x.steps[i],shape=shapes[i],n=shape.reduce((a,b)=>a*b,1);
   if(!same(p.shape,shape)||p.stride!==(i<2?2:1)||p.activation!==(i===5?'linear':'relu'))throw Error('Modellens lag stemmer ikke.');
   newWeights.push({k:tf.tensor4d(dec(p.kernelB64,n),shape),b:tf.tensor1d(dec(p.biasB64,shape[3])),stride:p.stride,relu:i!==5});
  }
  for(const w of weights){w.k.dispose();w.b.dispose()}
  weights=newWeights;ready=true;window.DartArenaOwnerTipAssistActive=true;
  say('Modell klar. Start runden med tom skive, kast tre piler og kontroller poengforslagene.');
 }catch(e){for(const w of newWeights){w.k.dispose();w.b.dispose()}say('Modellen kunne ikke lastes: '+e.message)}
}
async function predict(first,second){
 const input=tensor(first,second);
 const out=tf.tidy(()=>{
  let x=tf.tensor4d(input,[1,120,160,6]);
  for(const w of weights){x=tf.conv2d(x,w.k,w.stride,'same').add(w.b);if(w.relu)x=x.relu()}
  return x.reshape([1200]);
 });
 try{
  const z=await out.data();let best=-Infinity,index=0;
  for(let i=0;i<z.length;i++)if(z[i]>best){best=z[i];index=i}
  const ix=index%40,iy=Math.floor(index/40);let sx=0,sy=0,sum=0;
  for(let y=Math.max(0,iy-1);y<=Math.min(29,iy+1);y++)
   for(let x=Math.max(0,ix-1);x<=Math.min(39,ix+1);x++){
    const v=Math.exp(z[y*40+x]-best);sx+=x*v;sy+=y*v;sum+=v;
   }
  if(!sum)throw Error('Ingen pilspiss funnet');
  return{x:(sx/sum+.5)*16,y:(sy/sum+.5)*16};
 }finally{out.dispose()}
}
// Bull and D20 midline calibration from Zoom-cam; approximate circular
// geometry only. Never automatically commit a score near a wire.
function segment(point,w,h){
 const cx=config.cx*w,cy=config.cy*h,r=config.radius*w/.976;
 const dx=(point.x-cx)/r,dy=(point.y-cy)/r;
 const distance=Math.hypot(dx,dy);
 if(distance>1)return{label:'MISS',points:0};
 if(distance<=6.35/170)return{label:'DB',points:50};
 if(distance<=15.9/170)return{label:'SB',points:25};
 const angle=(Math.atan2(dx,-dy)-config.rotation+Math.PI*2)%(2*Math.PI);
 const n=order[Math.round(angle/(Math.PI/10))%20];
 const ring=distance>=162/170?'D':distance>=99/170&&distance<=107/170?'T':'S';
 return{label:ring+n,points:n*(ring==='D'?2:ring==='T'?3:1)};
}
async function onHit(event){
 if(!active||!ready||busy||!human()||darts.length>=3||!before)return;
 const s=state();if(roundKey(s)!==roundId)return;
 const now=performance.now();if(now-lastHitAt<2400)return;
 const after=event.detail?.frame,hit=event.detail?.point;
 if(!after||!hit||after.width!==before.width||after.height!==before.height)return;
 busy=true;lastHitAt=now;
 try{
  const rect=T.zoomCrop(after.width,after.height,hit.x,hit.y,config.radius*after.width,4/3);
  const point=await predict(crop(before,rect),crop(after,rect));
  const absolute={x:rect.x+point.x*rect.width/640,y:rect.y+point.y*rect.height/480};
  const score=segment(absolute,after.width,after.height);
  darts.push(score);
  before=after;
  say('Pil '+darts.length+'/3: '+score.label+' ('+score.points+'). Kontroller forslagene før registrering.');
  update();
 }catch(e){say('AI fant ikke en sikker pil: '+e.message+'. Registrer runden manuelt.')}
 finally{busy=false}
}
function reset(){
 darts=[];roundId=roundKey(state());lastHitAt=performance.now();
 try{before=video&&video.videoWidth?frame(video):null}
 catch{before=null}
 update();
 say(before?'Ny referanse klar. Kast første pil.':'Venter på kamera. Start treningskameraet først.');
}
window.addEventListener('dartarena:owner-tip-camera',event=>{
 if(!active)return;
 video=event.detail?.video||null;config=event.detail?.config||null;
 const start=()=>{if(active&&video?.videoWidth)reset()};
 if(video?.videoWidth)start();else video?.addEventListener('loadedmetadata',start,{once:true});
});
window.addEventListener('dartarena:owner-tip-hit',event=>{void onHit(event)});
window.addEventListener('dartarena:practice-save',()=>{
 const s=state();
 if(!active||!s)return;
 if(roundId!==roundKey(s))reset();
});
$('ownerAiNewRound').addEventListener('click',reset);
$('ownerAiModelFile').addEventListener('change',e=>{if(e.target.files?.[0])void load(e.target.files[0])});
$('ownerAiApplyScore').addEventListener('click',()=>{
 if(!active||!human()||!darts.length)return;
 const score=darts.reduce((a,d)=>a+d.points,0);
 const input=$('localScoreInput');if(!input)return;
 input.value=String(score);input.dispatchEvent(new Event('input',{bubbles:true}));
 say('Forslag: '+score+' poeng er fylt inn. Kontroller og trykk Enter for å registrere.');
 if(!input.readOnly)input.focus();
});
window.addEventListener('dartarena:owner-tip-authorized',()=>{
 active=true;panel.hidden=false;update();
 say('Owner-verifisert. Velg JSON-modellen før du starter kampen. Manuell scoring er alltid tilgjengelig.');
});
window.addEventListener('pagehide',()=>{
 window.DartArenaOwnerTipAssistActive=false;
 for(const w of weights){w.k.dispose();w.b.dispose()}weights=[];
});
})();