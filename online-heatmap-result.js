/* Online X01 result heatmap beta.
   Invisible while playing. Reads existing local camera frames (raw ZoomCam
   track where available), gathers approximate insertion points and shares
   ONLY normalized coordinates with the other player via Realtime broadcasts.
   Never writes to matches, calls scoring RPCs or opens an additional camera. */
(()=>{
'use strict';
const G=window.DartArenaAutoZoom,H=window.DartArenaHeatmapMath,Chart=window.DartArenaHeatmapChart;
const Z=window.DartArenaZoomCam;
const matchId=new URLSearchParams(location.search).get('id');
if(!G||!H||!Chart||!Z||!matchId||!window.supabase||
   new URLSearchParams(location.search).has('tournamentMatch'))return;
const db=window.supabase.createClient(
 'https://jqpxlbhwvskhjbqrbidk.supabase.co',
 'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
);
const $=id=>document.getElementById(id);
const cacheKey='dartarena-x01-heatmap-result-v1:'+matchId;
const MAX=600;
const data={};
let userId=null,m=null,channel=null,connected=false,video=null,ownsVideo=false,sourceTrack=null,sourceKey='',cal=null;
let reference=null,previous=null,still=0,motion=null,gate=null,turnActive=null,turnHits=0,turnAt=0;
let sampling=null,replay=null,lastStatus='',frameW=0,frameH=0,remoteUpdatedAt=0;
let overlay=null,playerIds=[];
const analysis=document.createElement('canvas');
const ctx=analysis.getContext('2d',{willReadFrequently:true});
function valid(row){
 return !!row&&Number.isFinite(row.u)&&Number.isFinite(row.v)&&Math.hypot(row.u,row.v)<=1.55;
}
function clean(rows){
 return Array.isArray(rows)?rows.slice(-MAX).filter(valid).map(p=>({
   u:+p.u,v:+p.v,tipDetected:p.tipDetected===true,
   time:typeof p.time==='string'?p.time.slice(0,32):'',
   quality:typeof p.quality==='string'?p.quality.slice(0,90):''
 })): [];
}
try{
 const saved=JSON.parse(sessionStorage.getItem(cacheKey)||'{}');
 if(saved&&typeof saved==='object')
   for(const [id,rows] of Object.entries(saved)){
     if(/^[0-9a-f-]{36}$/i.test(id))data[id]=clean(rows);
   }
}catch{}
function persist(){
 try{sessionStorage.setItem(cacheKey,JSON.stringify(data))}catch{}
}
function disposeVideo(){
 if(ownsVideo&&video){try{video.pause();video.srcObject=null}catch{}}
 video=null;ownsVideo=false;sourceTrack=null;sourceKey='';cal=null;frameW=0;frameH=0;
 resetDetection();
}
function resetDetection(){
 reference=null;previous=null;still=0;motion=null;
 gate=G.createChangeGate({stableFrames:5,motionWindowMs:4000,cooldownMs:1800});
}
function hasVideo(v){return !!v&&v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0&&!v.paused}
function source(){
 const local=$('localVideo'),raw=window.DartArenaX01ZoomSession?.sourceTrack;
 if(raw?.readyState==='live')return{key:'raw:'+raw.id,track:raw,clone:true};
 const track=local?.srcObject?.getVideoTracks?.()?.[0];
 return track?.readyState==='live'?{key:'local:'+track.id,track,clone:false,video:local}:null;
}
function attach(){
 const s=source();
 if(!s){if(sourceKey)disposeVideo();return false}
 if(s.key===sourceKey)return hasVideo(video);
 disposeVideo();sourceKey=s.key;sourceTrack=s.track;
 if(s.clone){
   const v=document.createElement('video');v.muted=true;v.autoplay=true;v.playsInline=true;
   v.srcObject=new MediaStream([s.track]);video=v;ownsVideo=true;
   v.play().catch(()=>{});
 }else video=s.video;
 return false;
}
function configure(){
 if(!hasVideo(video)||!sourceTrack)return false;
 const conf=Z.loadConfig(localStorage),dev=sourceTrack.getSettings?.()?.deviceId||'';
 const ratio=video.videoWidth/video.videoHeight;
 if(!conf||!dev||dev!==conf.deviceId||Math.abs(ratio-conf.aspect)/conf.aspect>.085)return false;
 if(cal&&frameW===video.videoWidth&&frameH===video.videoHeight)return true;
 cal={
   x:conf.cx*video.videoWidth,y:conf.cy*video.videoHeight,
   radius:conf.radius*video.videoWidth,rotation:conf.rotation
 };
 frameW=video.videoWidth;frameH=video.videoHeight;
 analysis.width=480;analysis.height=Math.max(80,Math.round(480*frameH/frameW));
 resetDetection();turnActive=null;turnAt=0;
 return true;
}
function ownTurn(){
 return $('matchStatus')?.textContent?.trim()==='Pågår'&&
   $('matchScoreInput')?.disabled===false;
}
function record(frame,w,h,hit,small){
 const point=H.infer(reference,frame,w,h,hit,small);
 const norm=H.normalize(cal,{x:point.x*frameW/w,y:point.y*frameH/h});
 if(!norm)return false;
 // Include low-confidence estimates, but label them as such in the result.
 const row={u:norm.u,v:norm.v,tipDetected:point.tipDetected===true,
    quality:point.quality||'Bildeestimat',time:new Date().toISOString()};
 const ours=data[userId]||(data[userId]=[]);
 ours.push(row);if(ours.length>MAX)ours.splice(0,ours.length-MAX);
 turnHits++;persist();sendPoints();refreshResult();
 return true;
}
function sample(){
 if(!userId||!m||m.status==='cancelled'||m.status==='finished')return;
 if(!attach()||!configure())return;
 if(!ownTurn()){
   if(turnActive!==false){turnActive=false;turnHits=0;turnAt=0;resetDetection()}
   return;
 }
 const now=performance.now();
 if(turnActive!==true){
   turnActive=true;turnHits=0;turnAt=now;resetDetection();
   return;
 }
 if(turnHits>=3)return;
 const w=analysis.width,h=analysis.height;
 let frame;
 try{ctx.drawImage(video,0,0,w,h);frame=new Uint8ClampedArray(ctx.getImageData(0,0,w,h).data)}
 catch{return}
 // Reference is taken after the thrower's new turn has started and the board
 // has settled; this is a conservative, automatic replacement for "tom skive".
 if(!reference){
   if(now-turnAt<1150)return;
   reference=frame;previous=null;still=0;
   return;
 }
 const b={x:cal.x*w/frameW,y:cal.y*h/frameH,radius:cal.radius*w/frameW};
 const opts={...G.sensitivityPreset('normal'),searchRadius:1.55};
 const movement=previous?G.motionRatio(previous,frame,w,h,b,{searchRadius:1.55}):0;
 const movementHit=previous&&movement<=.008?
   G.findChange(previous,frame,w,h,b,{...opts,maxRatio:.045}):null;
 if(movementHit&&movementHit.changedSamples>=opts.minSamples&&
   movementHit.localSamples/Math.max(1,movementHit.changedSamples)>=.5)
   motion={x:movementHit.x,y:movementHit.y,time:now};
 if(motion&&now-motion.time>3000)motion=null;
 previous=frame;still=movement>.008?0:still+1;
 const candidate=still>=G.speedPreset('normal').quietFrames?
   G.findChange(reference,frame,w,h,b,opts):null;
 const hit=gate.observe(candidate,{movement:movement>.008||!!movementHit,now,radius:b.radius});
 if(!hit)return;
 const confirmed=motion&&now-motion.time<=3000&&
   Math.hypot(hit.x-motion.x,hit.y-motion.y)<=Math.max(9,b.radius*.22)&&
   hit.changedSamples>=Math.max(12,opts.minSamples)&&
   hit.localSamples/Math.max(1,hit.changedSamples)>=.5;
 if(!confirmed)return;
 // Advance the baseline even when a dubious point is outside the calibrated
 // board; otherwise the same physical dart could be counted repeatedly.
 record(frame,w,h,hit,b);
 reference=new Uint8ClampedArray(frame);previous=null;still=0;motion=null;
}
function sendPoints(){
 if(!connected||!userId||!channel||!playerIds.includes(userId))return;
 try{
   const promise=channel.send({type:'broadcast',event:'heatmap-v1',
     payload:{matchId,from:userId,points:clean(data[userId]||[])}});
   if(promise?.catch)promise.catch(()=>{});
 }catch{}
}
function requestPoints(){
 if(!connected||!channel)return;
 try{const p=channel.send({type:'broadcast',event:'heatmap-request-v1',
   payload:{matchId,from:userId}});if(p?.catch)p.catch(()=>{})}catch{}
}
function receive(payload){
 if(payload?.matchId!==matchId||!playerIds.includes(payload.from)||payload.from===userId)return;
 if(!Array.isArray(payload.points)||payload.points.length>MAX)return;
 const cleanRows=clean(payload.points);
 // Identical-player snapshots are authoritative only for the other player's
 // camera; save the latest one received (including their empty baseline).
 if(cleanRows.length<(data[payload.from]||[]).length)return;
 data[payload.from]=cleanRows;remoteUpdatedAt=Date.now();persist();refreshResult();
}
function resultDraw(card,id){
 const canvas=card.querySelector('canvas'),label=card.querySelector('.da-hm-caption');
 const points=data[id]||[];
 Chart.draw(canvas,points);
 label.textContent=points.length
   ?points.length+' registrert'+(points.length===1?'':'e')+' treff · '+points.filter(p=>p.tipDetected).length+' spissforslag (beta)'
   :id===userId?'Ingen registrerte treff – kontroller ZoomCam-kalibrering.':
     'Ingen heatmap-data mottatt fra motstander.';
}
function refreshResult(){
 if(!overlay?.isConnected)return;
 for(const card of overlay.querySelectorAll('[data-heatmap-player]')){
   const id=card.getAttribute('data-heatmap-player');
   resultDraw(card,id);
 }
}
function attachResult(result,mrow){
 if(!result?.isConnected||!mrow||mrow.status!=='finished')return;
 if(mrow.game_variant&&mrow.game_variant!=='x01')return;
 if(String(mrow?.game_config?.chicago||'false')==='true')return;
 overlay=result;
 if(m)m.status='finished';
 const left=mrow.winner_id===mrow.player2_id?mrow.player2_id:mrow.player1_id;
 const right=left===mrow.player1_id?mrow.player2_id:mrow.player1_id;
 const stats=result.querySelector('.da-result-stats');
 if(!stats)return;
 const section=document.createElement('section');
 section.className='da-result-heatmap-section';
 section.innerHTML='<div class="da-result-hm-title">HEATMAP <span>BETA</span></div>'+
   '<div class="da-result-hm-grid"></div>'+
   '<p class="da-result-hm-note">Automatisk estimerte treffpunkter fra kamera, ikke fasit for poeng. Kun kast som ble oppdaget mens kameraet og kalibreringen var aktive.</p>';
 const grid=section.querySelector('.da-result-hm-grid');
 for(const id of [left,right]){
   const card=document.createElement('article');
   card.className='da-result-hm-player';
   card.setAttribute('data-heatmap-player',id);
   const name=stats.querySelector('[data-player-id="'+id+'"] .da-result-stat-name')?.textContent||'Spiller';
   const heading=document.createElement('strong');heading.textContent=name;
   const canvas=document.createElement('canvas');canvas.width=340;canvas.height=340;
   canvas.setAttribute('aria-label','Heatmap for '+name);
   const caption=document.createElement('small');caption.className='da-hm-caption';
   card.append(heading,canvas,caption);grid.appendChild(card);
 }
 stats.insertAdjacentElement('afterend',section);
 refreshResult();sendPoints();requestPoints();
}
function stop(){
 if(sampling){clearInterval(sampling);sampling=null}
 if(replay){clearInterval(replay);replay=null}
 if(channel){try{db.removeChannel(channel)}catch{}channel=null;connected=false}
 disposeVideo();
}
async function start(){
 const {data:auth,error:authError}=await db.auth.getSession();
 if(authError||!auth?.session?.user)return;
 userId=auth.session.user.id;
 const {data:row,error}=await db.from('matches').select('id,player1_id,player2_id,turn_player_id,status,game_variant,game_config').eq('id',matchId).single();
 if(error||!row||![row.player1_id,row.player2_id].includes(userId))return;
 if(row.game_variant&&row.game_variant!=='x01')return;
 if(String(row?.game_config?.chicago||'false')==='true')return;
 m=row;playerIds=[row.player1_id,row.player2_id];refreshResult();
 for(const p of playerIds)if(!data[p])data[p]=[];
 const live=db.channel('x01-heatmap-'+matchId,{config:{broadcast:{self:false}}});
 channel=live;
 live.on('broadcast',{event:'heatmap-v1'},({payload})=>receive(payload))
   .on('broadcast',{event:'heatmap-request-v1'},({payload})=>{
      if(payload?.matchId===matchId&&payload.from!==userId&&playerIds.includes(payload.from))sendPoints();
   })
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:'id=eq.'+matchId},({new:updated})=>{
      if(!updated)return;
      m.status=updated.status;
      if(updated.status==='finished'){sendPoints();requestPoints();refreshResult()}
   })
   .subscribe(state=>{
     connected=state==='SUBSCRIBED';
     if(connected){sendPoints();requestPoints()}
   });
 if(row.status==='playing')sampling=setInterval(sample,170);
 // Resend briefly after game end and while results are visible. Realtime is
 // opportunistic; sessionStorage is the local fallback if a peer leaves early.
 let retransmissions=0;
 replay=setInterval(()=>{
   if(!m||!connected)return;
   if(m.status==='playing'){sendPoints();return}
   if(m.status==='finished'&&retransmissions++<12){sendPoints();requestPoints()}
   if(retransmissions>12){clearInterval(replay);replay=null}
 },4000);
}
window.DartArenaOnlineHeatmap={attachResult,refreshResult};
window.addEventListener('pagehide',stop,{once:true});
start().catch(e=>console.warn('Online heatmap beta unavailable',e?.message||e));
})();
