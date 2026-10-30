'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'match-sfu-media.js'),'utf8');
const sfuClient=fs.readFileSync(path.join(root,'sfu-client.js'),'utf8');
const matchId='a5800d04-69fc-4b07-bcdc-ed9dbabbda1d';
const worker='https://dartarena-realtime-security-test.sotkajervi.workers.dev';

function createHarness(id=matchId){
  const calls=[];
  const localWindow={
    DARTARENA_SFU:{workerUrl:worker},
    db:{auth:{getSession:async()=>({data:{session:{access_token:'mock-test-token'}},error:null})}},
    addEventListener(){},
  };
  const context={
    window:localWindow,
    location:{search:id?'?id='+id:''},
    matchId:id,
    document:{getElementById(){return null}},
    URLSearchParams,
    Response,
    fetch:async(url,options)=>{
      calls.push({url,options});
      return new Response(JSON.stringify({ok:true,sfu:{sessionId:'test-session'}}),{status:200});
    },
    console:{debug(){},warn(){}},
    setInterval(){return 1},
    clearInterval(){},
    setTimeout(){return 1},
    clearTimeout(){},
  };
  vm.runInNewContext(sfuClient,context,{filename:'sfu-client.js'});
  // Test seam: expose a local factory without adding a production API.
  const augmented=source.replace('  window.DartArenaMatchMedia={mode:', '  window.__testMatchSfuClient=ensureClient;\n  window.DartArenaMatchMedia={mode:');
  assert.notEqual(augmented,source,'expected insertion point in SFU module');
  vm.runInNewContext(augmented,context,{filename:'match-sfu-media.js'});
  return {window:localWindow,calls,ensureClient:localWindow.__testMatchSfuClient};
}

test('X01 match constructs SFU client with authenticated match ID and kind',async()=>{
  const h=createHarness();
  const client=h.ensureClient();
  assert.ok(client);
  assert.equal(client.room.kind,'match');
  assert.equal(client.room.id,matchId);
  assert.equal(client.workerUrl,worker);
  await client.request('/api/sfu/session');
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].options.headers.Authorization,'Bearer mock-test-token');
  assert.equal(h.calls[0].options.headers['X-DartArena-Room-Kind'],'match');
  assert.equal(h.calls[0].options.headers['X-DartArena-Room-Id'],matchId);
});

test('missing match ID must fail closed before creating any session',()=>{
  const h=createHarness(null);
  assert.equal(h.ensureClient(),null);
  assert.equal(h.window.__DartArenaLastSFU,undefined);
  assert.equal(h.calls.length,0);
});

test('waiting room and X01 match use different authoritative SFU contexts',()=>{
  const room=fs.readFileSync(path.join(root,'room-sfu-media.js'),'utf8');
  assert.match(room,/new window\.DartArenaSFU\(window\.DARTARENA_SFU\.workerUrl,\s*\{kind:'challenge',id:challengeId\}\)/);
  assert.match(source,/new window\.DartArenaSFU\(window\.DARTARENA_SFU\.workerUrl,\s*\{kind:'match',id\}\)/);
});

test('preview loads updated match script and shows failure instead of infinite switching',()=>{
  const router=fs.readFileSync(path.join(root,'match-media-router.js'),'utf8');
  const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
  assert.match(router,/match-sfu-media\.js\?v=20261031-recovery1/);
  assert.match(html,/match-media-router\.js\?v=20261031-recovery1/);
  assert.match(source,/Cloudflare-video kunne ikke starte/);
  assert.match(router,/Starter Cloudflare-video/);
});
