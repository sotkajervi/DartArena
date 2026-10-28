// Isolated SFU video test UI. Supabase URL and publishable key are public client config.
// No service-role or Cloudflare bearer secrets are ever sent to the browser.
export function videoTestHtml(env) {
 const settings=JSON.stringify({url:env.SUPABASE_URL,key:env.SUPABASE_PUBLISHABLE_KEY})
   .replace(/</g,'\\u003c');
 return `<!doctype html><html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DartArena – SFU videotest</title>
<style>
:root{color-scheme:dark}body{margin:0;background:#081518;color:#ebffff;font:15px system-ui,sans-serif}
main{max-width:1080px;margin:25px auto;padding:20px}
h1{color:#38dfd6;font-size:26px}h2{font-size:18px}
section{background:#10282b;border:1px solid #255c5c;border-radius:14px;margin:15px 0;padding:18px}
input,select,button{font:inherit;padding:11px;border-radius:8px;border:1px solid #518585;margin:5px}
input,select{background:#082124;color:white;max-width:100%}
button{background:#24bab2;color:#052025;font-weight:700;cursor:pointer}
button:disabled{opacity:.4;cursor:default}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
label{display:flex;flex-direction:column}
video{width:100%;background:#01090a;border-radius:12px;aspect-ratio:16/9;object-fit:contain}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:700px){.grid{grid-template-columns:1fr}}
small,p{color:#afd3d1}#log{white-space:pre-wrap;max-height:220px;overflow:auto;background:#061718;padding:14px;border-radius:9px}
</style></head><body><main>
<h1>DartArena – isolert SFU-videotest</h1>
<p>Kun for testkontoer i aktive utfordringer eller kamper. Bruk samme rom-ID på begge enheter. Denne siden endrer ikke den vanlige DartArena-kampen.</p>
<section><h2>1. Logg inn</h2>
<div class="row"><label>E-post<input id="email" type="email" autocomplete="username"></label>
<label>Passord<input id="password" type="password" autocomplete="current-password"></label>
<button id="login">Logg inn</button><button id="logout">Logg ut</button></div>
<p id="authState">Ikke innlogget</p></section>
<section><h2>2. Velg rom</h2>
<div class="row"><label>Romtype<select id="kind"><option value="challenge">Venterom</option><option value="match">Kamp</option></select></label>
<label>Rom-ID<input id="room" size="38" placeholder="UUID fra DartArena URL"></label>
<button id="check">Kontroller tilgang</button></div><small>Kun aktive rom med to deltakere blir godkjent.</small></section>
<section><h2>3. Test kamera</h2>
<div class="row"><button id="start">Start kamera og publiser</button><button id="stop">Stopp</button></div>
<div class="grid"><div><h2>Ditt kamera</h2><video id="local" autoplay muted playsinline></video></div>
<div><h2>Motstander</h2><video id="remote" autoplay playsinline controls></video></div></div>
<p>Den andre spilleren logger inn på samme testadresse, bruker samme rom-ID og starter sitt kamera.</p></section>
<section><h2>Teststatus</h2><div id="log" role="status" aria-live="polite">Klar.</div></section>
</main>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"></script>
<script>
'use strict';
const cfg=${settings};
const sb=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:false,autoRefreshToken:true}});
const endpoint=location.origin;
const el=id=>document.getElementById(id);
const log=msg=>{el('log').textContent+='\\n'+new Date().toLocaleTimeString()+' '+msg;};
let stream=null,channel=null,publisher=null,subscriber=null,pubSession=null,subSession=null,roomKey=null;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function context(){const kind=el('kind').value,id=el('room').value.trim();if(!uuid.test(id))throw Error('Ugyldig rom-ID');return {kind,id};}
async function api(path,body,method='POST'){
 const {data,error}=await sb.auth.getSession();if(error||!data.session)throw Error('Logg inn først');
 const ctx=context();
 const response=await fetch(endpoint+path,{method,headers:{
 Authorization:'Bearer '+data.session.access_token,
 'X-DartArena-Room-Kind':ctx.kind,'X-DartArena-Room-Id':ctx.id,
 'Content-Type':'application/json'
 },body:body===undefined?undefined:JSON.stringify(body)});
 const dataBody=await response.json().catch(()=>({}));
 if(!response.ok||dataBody.ok===false)throw Error(dataBody.error||dataBody.sfu?.error||'HTTP '+response.status);
 return dataBody.sfu??dataBody;
}
function pc(){return new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});}
async function ice(peer){if(peer.iceGatheringState==='complete')return;await new Promise(resolve=>{const finish=()=>{peer.removeEventListener('icegatheringstatechange',check);clearTimeout(timer);resolve()},check=()=>{if(peer.iceGatheringState==='complete')finish()},timer=setTimeout(finish,6000);peer.addEventListener('icegatheringstatechange',check)});}
async function access(){const result=await api('/api/sfu/access-check');log('Romtilgang: '+(result.authorized?'godkjent':'avvist'));return result;}
async function join(){
 const ctx=context();const key=ctx.kind+':'+ctx.id;
 if(channel&&roomKey===key)return;
 if(channel)await sb.removeChannel(channel);
 roomKey=key;
 channel=sb.channel('sfu-video-test:'+key,{config:{broadcast:{self:false}}});
 channel.on('broadcast',{event:'publication'},async({payload})=>{
  if(!payload||!payload.sessionId||!Array.isArray(payload.tracks)||payload.sessionId===pubSession)return;
  try{await subscribe(payload)}catch(e){log('Abonnement feilet: '+e.message)}
 });
 await new Promise((resolve,reject)=>{
  channel.subscribe(status=>{if(status==='SUBSCRIBED')resolve();if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(Error('Realtime-kanal feilet'))});
 });
 log('Koblet til testrom – venter på motstander');
}
async function subscribe(publication){
 if(subscriber){subscriber.close();subscriber=null;}
 subscriber=pc();
 subscriber.ontrack=e=>{
  el('remote').srcObject=e.streams[0]||new MediaStream([e.track]);
  el('remote').play().catch(()=>log('Klikk Play for å starte fjernvideo/lyd'));
 };
 const session=await api('/api/sfu/session');subSession=session.sessionId;
 const tracks=publication.tracks.map(trackName=>({location:'remote',sessionId:publication.sessionId,trackName}));
 const result=await api('/api/sfu/subscribe',{sessionId:subSession,tracks});
 if(!result.sessionDescription)throw Error('Ingen SDP fra SFU');
 await subscriber.setRemoteDescription(result.sessionDescription);
 await subscriber.setLocalDescription(await subscriber.createAnswer());
 await ice(subscriber);
 await api('/api/sfu/renegotiate',{sessionId:subSession,sessionDescription:subscriber.localDescription},'PUT');
 log('Abonnert på motstanderens video');
}
async function start(){
 await access();await join();
 stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
 el('local').srcObject=stream;
 publisher=pc();
 const tracks=stream.getTracks().map((track,i)=>({track,transceiver:publisher.addTransceiver(track,{direction:'sendonly'}),trackName:track.kind==='video'?'camera':'mic-'+i}));
 await publisher.setLocalDescription(await publisher.createOffer());await ice(publisher);
 const session=await api('/api/sfu/session');pubSession=session.sessionId;
 const names=tracks.map(t=>({location:'local',mid:t.transceiver.mid,trackName:t.trackName}));
 const result=await api('/api/sfu/publish',{sessionId:pubSession,sessionDescription:publisher.localDescription,tracks:names});
 if(!result.sessionDescription)throw Error('Ingen SDP-svar fra SFU');
 await publisher.setRemoteDescription(result.sessionDescription);
 log('Kamera publisert til test-SFU');
 await channel.send({type:'broadcast',event:'publication',payload:{sessionId:pubSession,tracks:names.map(x=>x.trackName)}});
 log('Publisering sendt til motspiller');
}
function stop(){
 stream?.getTracks().forEach(t=>t.stop());stream=null;
 publisher?.close();subscriber?.close();publisher=null;subscriber=null;
 el('local').srcObject=null;el('remote').srcObject=null;
 pubSession=null;subSession=null;
 log('Lokale forbindelser stoppet');
}
function guard(fn){return async()=>{try{await fn()}catch(e){log('FEIL: '+e.message)}}}
el('login').onclick=guard(async()=>{
 const {data,error}=await sb.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});
 el('password').value='';
 if(error)throw error;
 el('authState').textContent='Innlogget: '+(data.user?.email||'bruker');log('Innlogging OK');
});
el('logout').onclick=guard(async()=>{stop();await sb.auth.signOut();el('authState').textContent='Ikke innlogget';log('Logget ut')});
el('check').onclick=guard(access);
el('start').onclick=guard(start);
el('stop').onclick=stop;
window.addEventListener('pagehide',stop);
</script></body></html>`;
}
