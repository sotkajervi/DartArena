// STAGING ONLY — DO NOT DEPLOY UNTIL RPC AND DURABLE OBJECT BINDING ARE SET UP.
// Worker variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, REALTIME_SFU_APP_ID
// Secrets: REALTIME_SFU_BEARER_TOKEN; binding: SFU_ROOMS -> SfuRoom
// See SFU_SECURITY_STAGING.md. Tournament room authorization is intentionally denied.
import { DurableObject } from 'cloudflare:workers';
import { videoTestHtml } from './sfu-video-test-page.js';

const SFU_BASE='https://rtc.live.cloudflare.com/v1';
const ALLOWED_ORIGINS=new Set(['https://sotkajervi.github.io','https://dartarena-realtime-security-test.sotkajervi.workers.dev','http://localhost:5500','http://127.0.0.1:5500']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_LIFETIME_MS=3*60*60*1000;
const MAX_BODY_BYTES=256*1024;
const SFU_SESSION_ID=/^[A-Za-z0-9_-]{8,128}$/;

function json(data,status=200,cors={}){
  return new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
function validId(value){return typeof value==='string'&&UUID.test(value)}
function validSfuSession(value){return typeof value==='string'&&SFU_SESSION_ID.test(value)}
function validSdp(s){return s&&typeof s==='object'&&['offer','answer'].includes(s.type)&&typeof s.sdp==='string'&&s.sdp.length>0&&s.sdp.length<180000}
function validTracks(ts,kind){
  return Array.isArray(ts)&&ts.length>0&&ts.length<=8&&ts.every(t=>t&&typeof t==='object'&&t.location===kind&&typeof t.trackName==='string'&&t.trackName.length>0&&t.trackName.length<80&&(kind==='remote'?validSfuSession(t.sessionId):typeof t.mid==='string'&&t.mid.length<24));
}
async function parseBody(request){
  if(Number(request.headers.get('Content-Length'))>MAX_BODY_BYTES)return null;
  // Reject oversized streaming bodies without buffering an unbounded request.
  if(!request.body)return null;
  const reader=request.body.getReader();
  const chunks=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>MAX_BODY_BYTES){
        await reader.cancel().catch(()=>{});
        return null;
      }
      chunks.push(value);
    }
    const bytes=new Uint8Array(total);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder().decode(bytes));
  }catch{return null}finally{reader.releaseLock()}
}
async function authenticate(request,env){
  const authorization=request.headers.get('Authorization')||'';
  if(!/^Bearer \S+$/.test(authorization))return null;
  const r=await fetch(new URL('/auth/v1/user',env.SUPABASE_URL),{headers:{Authorization:authorization,apikey:env.SUPABASE_PUBLISHABLE_KEY}});
  if(!r.ok)return null;
  const user=await r.json().catch(()=>null);
  return validId(user?.id)?{id:user.id,authorization}:null;
}
async function isRoomMember(env,authorization,kind,roomId,action){
  const r=await fetch(new URL('/rest/v1/rpc/can_access_sfu_room',env.SUPABASE_URL),{
    method:'POST',
    headers:{Authorization:authorization,apikey:env.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_kind:kind,p_room_id:roomId,p_action:action})
  });
  if(!r.ok)return false;
  return (await r.json().catch(()=>false))===true;
}
async function callSfu(env,path,method,body){
  const r=await fetch(SFU_BASE+'/apps/'+encodeURIComponent(env.REALTIME_SFU_APP_ID)+path,{
    method,headers:{Authorization:'Bearer '+env.REALTIME_SFU_BEARER_TOKEN,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const text=await r.text();
  let data;try{data=JSON.parse(text)}catch{data={error:'Upstream returned non-JSON'}}
  return {ok:r.ok,status:r.status,sfu:data};
}

export class SfuRoom extends DurableObject {
  async getSession(id){
    if(!validSfuSession(id))return null;
    const session=await this.ctx.storage.get('s:'+id);
    if(!session)return null;
    if(Date.now()-session.createdAt>SESSION_LIFETIME_MS){await this.ctx.storage.delete('s:'+id);return null}
    return session;
  }
  async fetch(request){
    // This Durable Object is callable only through the Worker binding, not a public route.
    const {userId,path,method,body}=await request.json();
    if(!validId(userId))return json({ok:false,error:'Invalid user'},401);
    const now=Date.now();
    const rateKey='rate:'+userId;
    const prior=await this.ctx.storage.get(rateKey);
    const rate=prior&&now-prior.since<60000?prior:{since:now,count:0};
    if(rate.count>=120)return json({ok:false,error:'Too many SFU operations'},429);
    rate.count+=1;
    await this.ctx.storage.put(rateKey,rate);
    const env=this.env;
    if(!env.REALTIME_SFU_APP_ID||!env.REALTIME_SFU_BEARER_TOKEN)return json({ok:false,error:'SFU unavailable'},503);
    if(path==='/api/sfu/session'&&method==='POST'){
      const result=await callSfu(env,'/sessions/new','POST');
      if(!result.ok)return json(result,result.status);
      const id=result.sfu?.sessionId;
      if(!validSfuSession(id))return json({ok:false,error:'Invalid SFU session response'},502);
      await this.ctx.storage.put('s:'+id,{owner:userId,createdAt:Date.now(),published:[]});
      return json(result,result.status);
    }
    const id=body?.sessionId;
    const session=await this.getSession(id);
    if(!session||session.owner!==userId)return json({ok:false,error:'SFU session not owned by user in this room'},403);
    const suffix='/sessions/'+encodeURIComponent(id);
    if(path==='/api/sfu/publish'&&method==='POST'){
      if(!validSdp(body?.sessionDescription)||!validTracks(body?.tracks,'local'))return json({ok:false,error:'Invalid publish request'},400);
      const result=await callSfu(env,suffix+'/tracks/new','POST',{sessionDescription:body.sessionDescription,tracks:body.tracks});
      if(result.ok){
        const published=[...new Set([...session.published,...body.tracks.map(t=>t.trackName)])];
        await this.ctx.storage.put('s:'+id,{...session,published});
      }
      return json(result,result.status);
    }
    if(path==='/api/sfu/subscribe'&&method==='POST'){
      if(!validTracks(body?.tracks,'remote'))return json({ok:false,error:'Invalid subscribe request'},400);
      for(const t of body.tracks){
        const remote=await this.getSession(t.sessionId);
        if(!remote||!remote.published.includes(t.trackName))return json({ok:false,error:'Publication not found in authorized room'},403);
      }
      const result=await callSfu(env,suffix+'/tracks/new','POST',{tracks:body.tracks});
      return json(result,result.status);
    }
    if(path==='/api/sfu/renegotiate'&&method==='PUT'){
      if(!validSdp(body?.sessionDescription))return json({ok:false,error:'Invalid renegotiation request'},400);
      const result=await callSfu(env,suffix+'/renegotiate','PUT',{sessionDescription:body.sessionDescription});
      return json(result,result.status);
    }
    return json({ok:false,error:'Not found'},404);
  }
}

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'';
    const cors={
      ...(ALLOWED_ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),
      'Access-Control-Allow-Headers':'Content-Type, Authorization, X-DartArena-Room-Kind, X-DartArena-Room-Id',
      'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Vary':'Origin'
    };
    if(origin&&!ALLOWED_ORIGINS.has(origin))return json({ok:false,error:'Origin not allowed'},403,cors);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const path=new URL(request.url).pathname;
    if(path==='/health'&&request.method==='GET')return json({ok:true,service:'DartArena Realtime'},200,cors);
    if(path==='/video-test'&&request.method==='GET'){
      if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY)return json({ok:false,error:'Unavailable'},503,cors);
      return new Response(videoTestHtml(env),{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
    }
    if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.SFU_ROOMS)return json({ok:false,error:'Security configuration unavailable'},503,cors);
    if(!['/api/sfu/access-check','/api/sfu/session','/api/sfu/publish','/api/sfu/subscribe','/api/sfu/renegotiate'].includes(path))return json({ok:false,error:'Not found'},404,cors);
    const method=path==='/api/sfu/renegotiate'?'PUT':'POST';
    if(request.method!==method)return json({ok:false,error:'Method not allowed'},405,cors);
    const kind=request.headers.get('X-DartArena-Room-Kind');
    const roomId=request.headers.get('X-DartArena-Room-Id');
    if(!['challenge','match'].includes(kind)||!validId(roomId))return json({ok:false,error:'Unsupported room context'},403,cors);
    let user;
    try{user=await authenticate(request,env)}catch{return json({ok:false,error:'Authentication service unavailable'},503,cors)}
    if(!user)return json({ok:false,error:'Unauthorized'},401,cors);
    const action=path==='/api/sfu/subscribe'?'subscribe':'publish';
    let authorized=false;
    try{authorized=await isRoomMember(env,user.authorization,kind,roomId,action)}
    catch{return json({ok:false,error:'Room authorization unavailable'},503,cors)}
    if(!authorized)return json({ok:false,error:'Room access denied'},403,cors);
    // Diagnostic-only endpoint: verifies real Supabase auth/RLS, never creates a media session.
    if(path==='/api/sfu/access-check')return json({ok:true,authorized:true,mediaEnabled:false},200,cors);
    // Safe staging default: an explicit environment opt-in is required before any SFU call.
    if(env.SFU_MEDIA_ENABLED!=='true')return json({ok:false,error:'SFU media disabled in staging'},503,cors);
    const body=path==='/api/sfu/session'?undefined:await parseBody(request);
    if(path!=='/api/sfu/session'&&(!body||typeof body!=='object'))return json({ok:false,error:'Invalid body'},400,cors);
    // Tournament authorization is not implemented: reject it before calling the RPC.
    // One stateful object per match/challenge prevents cross-room session references.
    let result;
    try{
      const stub=env.SFU_ROOMS.getByName(kind+':'+roomId);
      result=await stub.fetch('https://internal/sfu',{method:'POST',body:JSON.stringify({userId:user.id,path,method,body})});
    }catch{return json({ok:false,error:'Session service unavailable'},503,cors)}
    return new Response(result.body,{status:result.status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
  }
};
