'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const modeCode=read('media-transport.js');

async function modeHarness(value,error,session=true){
 const calls=[];
 const client={
   auth:{async getSession(){return {data:{session:session?{access_token:'redacted'}:null},error:null}}},
   from(table){
     calls.push(table);
     return{select(column){calls.push(column);return this},eq(k,v){calls.push(k+'='+v);return this},
       async single(){return {data:value?{mode:value}:null,error:error||null}}};
   }
 };
 const rootObj={supabase:{createClient(){return client}}};
 vm.runInNewContext(modeCode,{window:rootObj,console:{warn(){}},module:undefined});
 const first=await rootObj.DartArenaMediaMode.getMode();
 const second=await rootObj.DartArenaMediaMode.getMode();
 return{first,second,calls,api:rootObj.DartArenaMediaMode};
}

test('global mode defaults to legacy when a legacy selection is saved',async()=>{
 const m=await modeHarness('legacy');
 assert.equal(m.first,'legacy');
 assert.deepEqual(m.calls,['media_transport_config','mode','id=1']);
 assert.equal(m.api.isSfuActive(),false);
});
test('global owner choice enables new SFU only after authenticated database read',async()=>{
 const m=await modeHarness('sfu');
 assert.equal(m.first,'sfu');
 assert.equal(m.second,'sfu');
 assert.equal(m.api.isSfuActive(),true);
 assert.equal(m.calls.filter(x=>x==='media_transport_config').length,1);
});
test('stale or missing mode / DB errors / missing session all fail closed',async()=>{
 for(const [mode,error,session] of [
   ['unknown',null,true],[null,new Error('DB unavailable'),true],['sfu',null,false]
 ]){
   const m=await modeHarness(mode,error,session);
   assert.equal(m.first,'legacy');
   assert.equal(m.api.isSfuActive(),false);
 }
});
test('owner switch checks is_owner and sends an actual RLS-protected database update',()=>{
 const code=read('owner-media-switch.js');
 assert.match(code,/client\.rpc\('is_owner'\)/);
 assert.match(code,/if\(error\|\|isOwner!==true\)return/);
 assert.match(code,/\.from\('media_transport_config'\)/);
 assert.match(code,/\.update\(\{mode,updated_at:new Date\(\)\.toISOString\(\)\}\)/);
 assert.match(code,/onAuthStateChange/);
 assert.match(code,/confirm\(message\)/);
});
test('main pages load shared server-side config before their media routers and keep the Owner UI separate',()=>{
 for(const [page,after] of [
   ['room.html','room-media-router.js?v=20261031-owner1'],
   ['match.html','match-media-router.js?v=20261031-owner1'],
   ['tournament-match-room.html','tournament-match-room.js?v=20261031-owner1']
 ]){
   const html=read(page);
   const config=html.indexOf('media-transport.js?v=20261031-owner1');
   assert.ok(config>0, page);
   assert.ok(config<html.indexOf(after),page);
   assert.ok(html.includes('sfu-client.js?'),page+' missing legacy client');
   assert.ok(html.includes('sfu-client-secure.js?v=20261031-owner1'),page+' missing secure client');
 }
 assert.match(read('index.html'),/owner-media-switch\.js\?v=20261031-owner1/);
});
test('legacy fallback scripts are retained and new modules are opt-in',()=>{
 const waiting=read('room-media-router.js'),match=read('match-media-router.js');
 assert.match(waiting,/selected==='sfu'/);
 assert.match(waiting,/room-sfu-media-secure\.js\?v=20261031-owner1/);
 assert.match(waiting,/room-sfu-media\.js\?v=20261003-fallback1/);
 assert.match(match,/selected==='sfu'/);
 assert.match(match,/match-sfu-media-secure\.js\?v=20261031-owner1/);
 assert.match(match,/match-sfu-media\.js\?v=20261014-pollcleanup1/);
 assert.match(match,/if\(new URLSearchParams\(location.search\).has\('tournamentMatch'\)\)/);
});
test('new transports use the authenticated separate SFU gateway and room-level authorization',()=>{
 const config=read('sfu-config.js'),client=read('sfu-client-secure.js');
 const match=read('match-sfu-media-secure.js'),waiting=read('room-sfu-media-secure.js');
 assert.match(config,/workerUrl: 'https:\/\/dartarena-realtime\.sotkajervi\.workers\.dev'/);
 assert.match(config,/secureWorkerUrl: 'https:\/\/dartarena-realtime-security-test\.sotkajervi\.workers\.dev'/);
 assert.match(client,/Authorization.*Bearer/);
 assert.match(client,/X-DartArena-Room-Kind/);
 assert.match(client,/X-DartArena-Room-Id/);
 assert.match(match,/kind:'match'/);
 assert.match(waiting,/kind:'challenge'/);
 assert.match(match,/DartArenaSecureSFU/);
 assert.match(waiting,/DartArenaSecureSFU/);
});
test('tournament waiting room selects legacy or secure client with exact tournament match context',()=>{
 for(const path of ['tournament-match-room.js','tournament-room-preferred-media.js']){
   const source=read(path);
   assert.match(source,/secure\?window\.DartArenaSecureSFU:window\.DartArenaSFU/);
   assert.match(source,/kind:'tournament_match',id:tournamentMatchId/);
 }
});
test('tournament readiness refuses different mode versions and unsupported secure spectators',()=>{
 const source=read('tournament-match-room.js');
 assert.match(source,/payload\.mediaMode!==selected/);
 assert.match(source,/remoteTransportMismatch=true/);
 assert.match(source,/if\(starting\|\|remoteTransportMismatch/);
 assert.match(source,/mediaMode:await window\.DartArenaMediaMode/);
 assert.match(read('match-spectator-broadcast.js'),/if\(\(await window\.DartArenaMediaMode\?\.getMode\?\.\(\)\)==='sfu'\)return/);
});
test('SQL stores one global legacy-default setting and Owner-only update with RLS',()=>{
 const sql=read('supabase-media-transport-owner-switch-20261031.sql');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/grant update\(mode,updated_at\)/);
 assert.match(sql,/using \(\(select public\.is_owner\(\)\)\)/);
 assert.match(sql,/with check \(\(select public\.is_owner\(\)\)\)/);
 assert.match(sql,/values \(1,'legacy'\)/);
 assert.match(sql,/check \(mode in \('legacy','sfu'\)\)/);
});
