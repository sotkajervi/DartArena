var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// dartarena-realtime.staging.js
import { DurableObject } from "cloudflare:workers";

// sfu-video-test-page.js
function videoTestHtml(env) {
  const settings = JSON.stringify({ url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DartArena \u2013 SFU videotest</title>
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
<h1>DartArena \u2013 isolert SFU-videotest</h1>
<p>Kun for testkontoer i aktive utfordringer eller kamper. Bruk samme rom-ID p\xE5 begge enheter. Denne siden endrer ikke den vanlige DartArena-kampen.</p>
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
<p>Den andre spilleren logger inn p\xE5 samme testadresse, bruker samme rom-ID og starter sitt kamera.</p></section>
<section><h2>Teststatus</h2><div id="log" role="status" aria-live="polite">Klar.</div></section>
</main>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"><\/script>
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
 const {data,error}=await sb.auth.getSession();if(error||!data.session)throw Error('Logg inn f\xF8rst');
 const ctx=context();
 const response=await fetch(endpoint+path,{method,headers:{
 Authorization:'Bearer '+data.session.access_token,
 'X-DartArena-Room-Kind':ctx.kind,'X-DartArena-Room-Id':ctx.id,
 'Content-Type':'application/json'
 },body:body===undefined?undefined:JSON.stringify(body)});
 const dataBody=await response.json().catch(()=>({}));
 if(!response.ok||dataBody.ok===false)throw Error(path+' \u2192 HTTP '+response.status+'; '+(dataBody.error||dataBody.sfu?.error||'Request failed')+(dataBody.stage?' ['+dataBody.stage+']':'')+(dataBody.upstreamStatus?' upstream '+dataBody.upstreamStatus:''));
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
 channel.on('broadcast',{event:'request-publication'},async()=>{
  if(pubSession&&publisher&&channel)await channel.send({type:'broadcast',event:'publication',payload:{sessionId:pubSession,tracks:stream?.getTracks().map((t,i)=>t.kind==='video'?'camera':'mic-'+i)||[]}});
 });
 channel.on('broadcast',{event:'publication'},async({payload})=>{
  if(!payload||!payload.sessionId||!Array.isArray(payload.tracks)||payload.sessionId===pubSession)return;
  try{await subscribe(payload)}catch(e){log('Abonnement feilet: '+e.message)}
 });
 await new Promise((resolve,reject)=>{
  channel.subscribe(status=>{if(status==='SUBSCRIBED')resolve();if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')reject(Error('Realtime-kanal feilet'))});
 });
 log('Koblet til testrom \u2013 venter p\xE5 motstander');
 await channel.send({type:'broadcast',event:'request-publication',payload:{}});
}
async function subscribe(publication){
 if(subscriber){subscriber.close();subscriber=null;}
 subscriber=pc();
 subscriber.ontrack=e=>{
  el('remote').srcObject=e.streams[0]||new MediaStream([e.track]);
  el('remote').play().catch(()=>log('Klikk Play for \xE5 starte fjernvideo/lyd'));
 };
 const session=await api('/api/sfu/session');subSession=session.sessionId;
 const tracks=publication.tracks.map(trackName=>({location:'remote',sessionId:publication.sessionId,trackName}));
 const result=await api('/api/sfu/subscribe',{sessionId:subSession,tracks});
 if(!result.sessionDescription)throw Error('Ingen SDP fra SFU');
 await subscriber.setRemoteDescription(result.sessionDescription);
 await subscriber.setLocalDescription(await subscriber.createAnswer());
 await ice(subscriber);
 await api('/api/sfu/renegotiate',{sessionId:subSession,sessionDescription:subscriber.localDescription},'PUT');
 log('Abonnert p\xE5 motstanderens video');
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
 await channel.send({type:'broadcast',event:'request-publication',payload:{}});
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
<\/script></body></html>`;
}
__name(videoTestHtml, "videoTestHtml");

// dartarena-realtime.staging.js
var SFU_BASE = "https://rtc.live.cloudflare.com/v1";

var ALLOWED_ORIGINS = new Set([
  "https://sotkajervi.github.io",
  "https://dartarena-realtime-security-test.sotkajervi.workers.dev",
  "https://dartarena-sfu-preview.sotkajervi.workers.dev",
  "https://dartarena-sfu-test.pages.dev",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
]);

var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var SESSION_LIFETIME_MS = 3 * 60 * 60 * 1e3;
var MAX_BODY_BYTES = 256 * 1024;
var SFU_SESSION_ID = /^[A-Za-z0-9_-]{8,128}$/;
function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
__name(json, "json");
function validId(value) {
  return typeof value === "string" && UUID.test(value);
}
__name(validId, "validId");
function validSfuSession(value) {
  return typeof value === "string" && SFU_SESSION_ID.test(value);
}
__name(validSfuSession, "validSfuSession");
function validSdp(s) {
  return s && typeof s === "object" && ["offer", "answer"].includes(s.type) && typeof s.sdp === "string" && s.sdp.length > 0 && s.sdp.length < 18e4;
}
__name(validSdp, "validSdp");
function validTracks(ts, kind) {
  return Array.isArray(ts) && ts.length > 0 && ts.length <= 8 && ts.every((t) => t && typeof t === "object" && t.location === kind && typeof t.trackName === "string" && t.trackName.length > 0 && t.trackName.length < 80 && (kind === "remote" ? validSfuSession(t.sessionId) : typeof t.mid === "string" && t.mid.length < 24));
}
__name(validTracks, "validTracks");
async function parseBody(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {
        });
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}
__name(parseBody, "parseBody");
async function authenticate(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!/^Bearer \S+$/.test(authorization)) return null;
  const r = await fetch(new URL("/auth/v1/user", env.SUPABASE_URL), { headers: { Authorization: authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY } });
  if (!r.ok) return null;
  const user = await r.json().catch(() => null);
  return validId(user?.id) ? { id: user.id, authorization } : null;
}
__name(authenticate, "authenticate");
async function isRoomMember(env, authorization, kind, roomId, action) {
  const r = await fetch(new URL("/rest/v1/rpc/can_access_sfu_room", env.SUPABASE_URL), {
    method: "POST",
    headers: { Authorization: authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_kind: kind, p_room_id: roomId, p_action: action })
  });
  if (!r.ok) return false;
  return await r.json().catch(() => false) === true;
}
__name(isRoomMember, "isRoomMember");
async function callSfu(env, path, method, body) {
  const r = await fetch(SFU_BASE + "/apps/" + encodeURIComponent(env.REALTIME_SFU_APP_ID) + path, {
    method,
    headers: { Authorization: "Bearer " + env.REALTIME_SFU_BEARER_TOKEN, "Content-Type": "application/json" },
    body: body === void 0 ? void 0 : JSON.stringify(body)
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: "Upstream returned non-JSON" };
  }
  return { ok: r.ok, status: r.status, sfu: data };
}
__name(callSfu, "callSfu");
// Cost guard: fixed windows, shared across all rooms. Counts admission attempts,
// not concurrent connections or bytes. Existing sessions are not interrupted.
const COST_LIMITS = Object.freeze({user5m:24,userHour:72,globalMinute:360,globalHour:2400});
function nextWindow(prior, now, duration) {
  const start = Math.floor(now / duration) * duration;
  return {start,count:prior?.start === start ? prior.count : 0};
}
async function admitNewSession(storage,userId,now=Date.now()) {
  return storage.transaction(async tx=>{
    const rules=[
      ["cost:global:minute",60000,COST_LIMITS.globalMinute],
      ["cost:global:hour",3600000,COST_LIMITS.globalHour],
      ["cost:user:"+userId+":5m",300000,COST_LIMITS.user5m],
      ["cost:user:"+userId+":hour",3600000,COST_LIMITS.userHour]
    ];
    const windows=[];
    for(const [key,duration,limit] of rules){
      const state=nextWindow(await tx.get(key),now,duration);
      windows.push({key,duration,limit,state});
    }
    const denied=windows.filter(w=>w.state.count>=w.limit);
    if(denied.length)return {allowed:false,retryAfter:Math.max(1,...denied.map(w=>Math.ceil((w.state.start+w.duration-now)/1000)))};
    for(const w of windows){
      w.state.count++;
      await tx.put(w.key,w.state);
    }
    return {allowed:true,globalWarning:windows.some((w,i)=>i<2&&w.state.count===Math.ceil(w.limit*.8))};
  });
}
var SfuRoom = class extends DurableObject {
  static {
    __name(this, "SfuRoom");
  }
  async getSession(id) {
    if (!validSfuSession(id)) return null;
    const session = await this.ctx.storage.get("s:" + id);
    if (!session) return null;
    if (Date.now() - session.createdAt > SESSION_LIFETIME_MS) {
      await this.ctx.storage.delete("s:" + id);
      return null;
    }
    return session;
  }
  async fetch(request) {
    const { userId, path, method, body, intent } = await request.json();
    // Internal-only endpoint on the dedicated named object; no public route.
    if (new URL(request.url).pathname === "/admit-session") {
      if (!validId(userId)) return json({ok:false,error:"Invalid user"},401);
      const decision=await admitNewSession(this.ctx.storage,userId);
      if (!decision.allowed) return new Response(JSON.stringify({ok:false,error:"SFU new-session rate limit",retryAfter:decision.retryAfter}),{status:429,headers:{"Content-Type":"application/json","Retry-After":String(decision.retryAfter),"Cache-Control":"no-store"}});
      if(decision.globalWarning)console.warn("[SFU COST] Global new-session admission reached 80% of window");
      return json({ok:true});
    }
    if (!validId(userId)) return json({ ok: false, error: "Invalid user" }, 401);
    const now = Date.now();
    const rateKey = "rate:" + userId;
    const prior = await this.ctx.storage.get(rateKey);
    const rate = prior && now - prior.since < 6e4 ? prior : { since: now, count: 0 };
    if (rate.count >= 120) return json({ ok: false, error: "Too many SFU operations" }, 429);
    rate.count += 1;
    await this.ctx.storage.put(rateKey, rate);
    const env = this.env;
    if (!env.REALTIME_SFU_APP_ID || !env.REALTIME_SFU_BEARER_TOKEN) return json({ ok: false, error: "SFU unavailable" }, 503);
    if (path === "/api/sfu/session" && method === "POST") {
      const result = await callSfu(env, "/sessions/new", "POST");
      if (!result.ok) return json({ ok: false, error: "Cloudflare SFU rejected request", stage: "sfu-upstream", upstreamStatus: result.status }, result.status);
      const id2 = result.sfu?.sessionId;
      if (!validSfuSession(id2)) return json({ ok: false, error: "Invalid SFU session response" }, 502);
      await this.ctx.storage.put("s:" + id2, {
  owner: userId,
  createdAt: Date.now(),
  published: [],
  intent: intent === "subscribe" ? "subscribe" : "publish"
});
      return result.ok ? json(result, result.status) : json({ ok: false, error: "Cloudflare SFU rejected request", stage: "sfu-upstream", upstreamStatus: result.status }, result.status);
    }
    const id = body?.sessionId;
    const session = await this.getSession(id);
    if (!session || session.owner !== userId) return json({ ok: false, error: "SFU session not owned by user in this room" }, 403);
    const suffix = "/sessions/" + encodeURIComponent(id);
    if (path === "/api/sfu/publish" && method === "POST") {
      if (session.intent === "subscribe") {
  return json(
    { ok: false, error: "Subscribe-only session cannot publish" },
    403
  );
}
      if (!validSdp(body?.sessionDescription) || !validTracks(body?.tracks, "local")) return json({ ok: false, error: "Invalid publish request" }, 400);
      const result = await callSfu(env, suffix + "/tracks/new", "POST", { sessionDescription: body.sessionDescription, tracks: body.tracks });
      if (result.ok) {
        const published = [.../* @__PURE__ */ new Set([...session.published, ...body.tracks.map((t) => t.trackName)])];
        await this.ctx.storage.put("s:" + id, { ...session, published });
      }
      return json(result, result.status);
    }
    if (path === "/api/sfu/subscribe" && method === "POST") {
      if (!validTracks(body?.tracks, "remote")) return json({ ok: false, error: "Invalid subscribe request" }, 400);
      for (const t of body.tracks) {
        const remote = await this.getSession(t.sessionId);
        if (!remote || !remote.published.includes(t.trackName)) return json({ ok: false, error: "Publication not found in authorized room" }, 403);
      }
      const result = await callSfu(env, suffix + "/tracks/new", "POST", { tracks: body.tracks });
      return json(result, result.status);
    }
    if (path === "/api/sfu/renegotiate" && method === "PUT") {
      if (!validSdp(body?.sessionDescription)) return json({ ok: false, error: "Invalid renegotiation request" }, 400);
      const result = await callSfu(env, suffix + "/renegotiate", "PUT", { sessionDescription: body.sessionDescription });
      return json(result, result.status);
    }
    return json({ ok: false, error: "Not found" }, 404);
  }
};
var dartarena_realtime_staging_default = {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      ...ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {},
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-DartArena-Room-Kind, X-DartArena-Room-Id, X-DartArena-SFU-Intent",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Vary": "Origin"
    };
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ ok: false, error: "Origin not allowed" }, 403, cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") return json({ ok: true, service: "DartArena Realtime" }, 200, cors);
    if (path === "/video-test" && request.method === "GET") {
      if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({ ok: false, error: "Unavailable" }, 503, cors);
      return new Response(videoTestHtml(env), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });
    }
    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY || !env.SFU_ROOMS) return json({ ok: false, error: "Security configuration unavailable" }, 503, cors);
    if (!["/api/sfu/access-check", "/api/sfu/session", "/api/sfu/publish", "/api/sfu/subscribe", "/api/sfu/renegotiate"].includes(path)) return json({ ok: false, error: "Not found" }, 404, cors);
    const method = path === "/api/sfu/renegotiate" ? "PUT" : "POST";
    if (request.method !== method) return json({ ok: false, error: "Method not allowed" }, 405, cors);
    const kind = request.headers.get("X-DartArena-Room-Kind");
    const roomId = request.headers.get("X-DartArena-Room-Id");
    if (!["challenge", "match", "tournament_match"].includes(kind) || !validId(roomId)) return json({ ok: false, error: "Unsupported room context" }, 403, cors);
    let user;
    try {
      user = await authenticate(request, env);
    } catch {
      return json({ ok: false, error: "Authentication service unavailable" }, 503, cors);
    }
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401, cors);
    const intent = request.headers.get("X-DartArena-SFU-Intent");
const action =
  path === "/api/sfu/subscribe" ||
  ((path === "/api/sfu/session" ||
    path === "/api/sfu/renegotiate") &&
    intent === "subscribe")
    ? "subscribe"
    : "publish";
    let authorized = false;
    try {
      authorized = await isRoomMember(env, user.authorization, kind, roomId, action);
    } catch {
      return json({ ok: false, error: "Room authorization unavailable" }, 503, cors);
    }
    if (!authorized) return json({ ok: false, error: "Room access denied" }, 403, cors);
    if (path === "/api/sfu/access-check") return json({ ok: true, authorized: true, mediaEnabled: false }, 200, cors);
    if (env.SFU_MEDIA_ENABLED !== "true") return json({ ok: false, error: "SFU media disabled in staging" }, 503, cors);
    if (
  path === "/api/sfu/publish" &&
  request.headers.get("X-DartArena-SFU-Intent") === "subscribe"
) {
  return json(
    { ok: false, error: "Spectators cannot publish video" },
    403,
    cors
  );
}
    const body = path === "/api/sfu/session" ? void 0 : await parseBody(request);
    if (path !== "/api/sfu/session" && (!body || typeof body !== "object")) return json({ ok: false, error: "Invalid body" }, 400, cors);
    if(path === "/api/sfu/session"){
      // Optional emergency switch; no change to existing session operations.
      if(env.SFU_NEW_SESSIONS_ENABLED === "false")return json({ok:false,error:"New SFU sessions temporarily disabled"},503,cors);
      try {
        const guard=env.SFU_ROOMS.getByName("cost-guard:v1");
        const admission=await guard.fetch("https://internal/admit-session",{method:"POST",body:JSON.stringify({userId:user.id})});
        if(!admission.ok){
          const retry=admission.headers.get("Retry-After");
          return new Response(admission.body,{status:admission.status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...(retry?{"Retry-After":retry,"Access-Control-Expose-Headers":"Retry-After"}:{})}});
        }
      }catch{
        return json({ok:false,error:"SFU admission service unavailable"},503,cors);
      }
    }
    let result;
    try {
      const stub = env.SFU_ROOMS.getByName(kind + ":" + roomId);
      result = await stub.fetch("https://internal/sfu", {
  method: "POST",
  body: JSON.stringify({
    userId: user.id,
    path,
    method,
    body,
    intent: action
  })
});
    } catch {
      return json({ ok: false, error: "Session service unavailable" }, 503, cors);
    }
    return new Response(result.body, { status: result.status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  }
};
export {
  SfuRoom,
  dartarena_realtime_staging_default as default
};