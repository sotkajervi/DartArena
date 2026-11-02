'use strict';
// Read-only staging inspection. NO credentials, SFU sessions, room creation,
// login, Cloudflare media traffic, production database queries or load generation.
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const base='https://dartarena-realtime-security-test.sotkajervi.workers.dev';
const preview='https://dartarena-sfu-preview.sotkajervi.workers.dev';
const out={probe:'staging SFU accessibility, unauthorized denial and frontend fingerprint',
  sendsAuthentication:false,createsMediaSessions:false,sendsProductionTraffic:false,testsCloudflareLoad:false,
  probes:[],frontend:{}};
const digest=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,16);
async function request(label,url,init={}){
 const start=Date.now(), abort=new AbortController();
 const timer=setTimeout(()=>abort.abort(),13000);
 try{
  const res=await fetch(url,{redirect:'manual',...init,signal:abort.signal});
  const str=await res.text();
  const data={label,status:res.status,ms:Date.now()-start,contentType:res.headers.get('content-type'),
    size:str.length,sha256:digest(str)};
  out.probes.push(data);
  return{res,data,text:str};
 }catch(error){const e={label,error:String(error.cause?.message||error.message),ms:Date.now()-start};
  out.probes.push(e);return{error:e};}
 finally{clearTimeout(timer)}
}
async function run(){
 const health=await request('isolated worker health',base+'/health');
 const video=await request('isolated video test page',base+'/video-test');
 const home=await request('isolated frontend preview',preview+'/');
 const preflight=await request('SFU CORS preflight (NO actual SFU operation)',base+'/api/sfu/session',{
    method:'OPTIONS',headers:{
      Origin:preview,'Access-Control-Request-Method':'POST',
      'Access-Control-Request-Headers':'authorization,content-type,x-dartarena-room-kind,x-dartarena-room-id'
    }});
 if(preflight.res)out.cors={
   allowedOrigin:preflight.res.headers.get('access-control-allow-origin'),
   allowedHeaders:preflight.res.headers.get('access-control-allow-headers'),
   allowedMethods:preflight.res.headers.get('access-control-allow-methods')};
 const denied=await request('unauthenticated room access must fail',base+'/api/sfu/access-check',{
   method:'POST',headers:{
     Origin:preview,'content-type':'application/json',
     'X-DartArena-Room-Kind':'match',
     'X-DartArena-Room-Id':'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'
   }});
 for(const p of ['sfu-client.js','room-sfu-media.js','match-sfu-media.js','media-transport.js']){
   const resource=await request('isolated frontend '+p,preview+'/'+p);
   if(resource.text){
     let expectedStage=null,expectedMain=null;
     try{expectedStage=execFileSync('git',['show','FETCH_HEAD:'+p],{encoding:'utf8'})}catch{}
     try{expectedMain=fs.readFileSync(path.join(process.cwd(),p),'utf8')}catch{}
     out.frontend[p]={
       sha256:resource.data.sha256,
       sameAsStagingGit:expectedStage===null?null:resource.text===expectedStage,
       sameAsMainGit:expectedMain===null?null:resource.text===expectedMain,
       hasBearerAuthorization:/Bearer|authorization/i.test(resource.text),
       hasSfuRoomContext:/X-DartArena-Room-Kind|tournament_match|kind:\s*['"]match['"]/i.test(resource.text)
     };
   }
 }
 const validHealth=health.res?.ok;
 const validPreview=home.res?.ok&&/html/i.test(home.data.contentType||'');
 const unauthorized=denied.res?.status===401||denied.res?.status===403;
 const cors=preflight.res?.status===204&&out.cors.allowedOrigin===preview;
 out.summary={
   workerHealth:!!validHealth,previewReachable:!!validPreview,
   authRejectsUnauthenticated:!!unauthorized,corsForPreview:!!cors,
   videoTestPageAvailable:!!video.res?.ok,
   liveMediaEnabled:'NOT DETERMINABLE WITHOUT AUTHENTICATED TEST ROOM',
   isolatedDatabaseAvailable:false
 };
 out.pass=!!validHealth&&!!validPreview&&!!unauthorized&&!!cors;
 console.log('READ ONLY STAGING PROBE RESULT',JSON.stringify(out,null,2));
 if(!out.pass)process.exitCode=1;
}
run().catch(e=>{console.error('Probe error',e);process.exitCode=1});