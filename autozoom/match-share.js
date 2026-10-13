/* Realtime AutoZoom overlay: exchange only crop coordinates between X01 players.
   Original WebRTC video/audio tracks and match scoring are never modified. */
(()=>{
'use strict';
const G=window.DartArenaAutoZoom;
const remoteVideo=document.getElementById('remoteVideo');
const remoteCard=document.getElementById('remoteVideoCard');
const matchId=new URLSearchParams(location.search).get('id');
if(!G||!window.supabase||!matchId||!remoteVideo||!remoteCard)return;
const db=window.supabase.createClient(
  'https://jqpxlbhwvskhjbqrbidk.supabase.co',
  'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
);
const CHANNEL='match-autozoom-'+matchId;
const TIMEOUT=14000;
let channel=null,subscribed=false,stopped=false,localState=null;
let localAuthorized=null,revision=0,bootWatch=null,heartbeat=null;
let incoming=null,receivedAt=0,lastSeq=-1,lastSession=null;
let zoom=null,zoomCtx=null,canvas=null,target=null,current=null,frame=0;
function participants(){
  try{
    if(typeof m==='undefined'||typeof profile==='undefined'||!m?.id||!profile?.id||m.id!==matchId)return null;
    if(m.player1_id!==profile.id&&m.player2_id!==profile.id)return null;
    return{self:profile.id,other:m.player1_id===profile.id?m.player2_id:m.player1_id};
  }catch{return null}
}
function valid(state){
  if(!state||state.matchId!==matchId||state.source!=='local'||typeof state.active!=='boolean')return false;
  if(!state.active)return true;
  return Number.isFinite(state.x)&&state.x>=0&&state.x<=1
    &&Number.isFinite(state.y)&&state.y>=0&&state.y<=1
    &&Number.isFinite(state.radius)&&state.radius>.005&&state.radius<.8
    &&Number.isInteger(state.seq)&&state.seq>=0&&typeof state.session==='string'
    &&state.session.length<=80;
}
function removeOverlay(){
  if(frame){cancelAnimationFrame(frame);frame=0}
  if(zoom){zoom.remove();zoom=null;zoomCtx=null;canvas=null}
  target=null;current=null;incoming=null;receivedAt=0;
}
function ensureOverlay(){
  if(zoom)return;
  zoom=document.createElement('div');zoom.className='da-az-inset da-az-shared-inset';
  zoom.setAttribute('aria-label','AutoZoom fra motstanderen');
  zoom.innerHTML='<div class="da-az-inset-header"><span>AUTOZOOM LIVE</span><span class="da-az-zoom-target">T20</span></div><canvas width="320" height="240"></canvas>';
  canvas=zoom.querySelector('canvas');
  zoomCtx=canvas?.getContext('2d');
  if(!zoomCtx){removeOverlay();return}
  remoteCard.appendChild(zoom);
  frame=requestAnimationFrame(draw);
}
function draw(){
  if(!incoming||stopped){removeOverlay();return}
  if(performance.now()-receivedAt>TIMEOUT){removeOverlay();return}
  // An Owner/Admin may already be inspecting this remote camera locally.
  const otherInset=remoteCard.querySelector('.da-az-inset:not(.da-az-shared-inset)');
  if(zoom)zoom.style.display=otherInset?'none':'';
  if(remoteVideo.videoWidth&&remoteVideo.videoHeight&&remoteVideo.readyState>=2){
    if(!current)current={...target};
    current.x+=(target.x-current.x)*.22;
    current.y+=(target.y-current.y)*.22;
    const vw=remoteVideo.videoWidth,vh=remoteVideo.videoHeight;
    const crop=G.zoomCrop(vw,vh,current.x*vw,current.y*vh,
      incoming.radius*vw,canvas.width/canvas.height);
    try{zoomCtx.drawImage(remoteVideo,crop.x,crop.y,crop.width,crop.height,
      0,0,canvas.width,canvas.height)}catch{}
  }
  frame=requestAnimationFrame(draw);
}
function receive(state){
  const ids=participants();
  if(!ids||!valid(state)||state.from!==ids.other)return;
  if(state.session===lastSession&&state.seq<=lastSeq)return;
  if(state.session!==lastSession){lastSession=state.session;lastSeq=-1}
  lastSeq=state.seq;
  if(!state.active){removeOverlay();return}
  incoming=state;receivedAt=performance.now();target={x:state.x,y:state.y};
  ensureOverlay();
  if(zoom){
    const label=zoom.querySelector('.da-az-zoom-target');
    if(label)label.textContent=String(state.label||'Treff').slice(0,24);
  }
}
const SESSION=String(Date.now())+'-'+Math.random().toString(36).slice(2,9);
async function permitted(){
  if(!localAuthorized){
    localAuthorized=Promise.all([db.rpc('is_owner'),db.rpc('is_admin')])
      .then(([owner,admin])=>!owner.error&&!admin.error&&(owner.data===true||admin.data===true))
      .catch(()=>false);
  }
  return localAuthorized;
}
async function send(){
  const ids=participants();
  if(stopped||!subscribed||!channel||!ids||!localState)return;
  if(!await permitted())return;
  const payload={...localState,from:ids.self,matchId,source:'local',session:SESSION,seq:++revision};
  try{await channel.send({type:'broadcast',event:'autozoom-state',payload})}catch{}
}
function publish(state){
  if(stopped)return;
  if(state?.active){
    const proposed={...state,source:'local',active:true,matchId,session:SESSION,seq:0};
    if(!valid(proposed))return;
    localState={active:true,x:state.x,y:state.y,radius:state.radius,
      label:String(state.label||'Treff').slice(0,24)};
  }else{
    localState={active:false};
  }
  void send();
}
function stopPublishing(){
  if(!localState?.active)return;
  publish({active:false});
}
function request(){
  if(!subscribed||stopped||!channel)return;
  channel.send({type:'broadcast',event:'autozoom-request',
    payload:{matchId}}).catch(()=>{});
}
function start(){
  const ids=participants();if(!ids||channel||stopped)return;
  clearInterval(bootWatch);bootWatch=null;
  channel=db.channel(CHANNEL,{config:{broadcast:{ack:false}}});
  channel.on('broadcast',{event:'autozoom-state'},({payload})=>receive(payload));
  channel.on('broadcast',{event:'autozoom-request'},()=>{
    if(localState?.active)void send();
  });
  channel.subscribe(status=>{
    subscribed=status==='SUBSCRIBED';
    if(subscribed){
      request();
      if(localState?.active)void send();
    }
  });
  heartbeat=setInterval(()=>{
    if(incoming&&performance.now()-receivedAt>TIMEOUT)removeOverlay();
    if(localState?.active)void send();
  },4500);
}
function cleanup(){
  stopPublishing();
  stopped=true;
  clearInterval(bootWatch);clearInterval(heartbeat);
  bootWatch=null;heartbeat=null;
  removeOverlay();
  if(channel)try{db.removeChannel(channel)}catch{}
  channel=null;subscribed=false;
}
window.DartArenaMatchAutoZoomShare={publish,stop:stopPublishing};
bootWatch=setInterval(start,900);
start();
window.addEventListener('pagehide',cleanup);
db.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT')cleanup();
});
})();
