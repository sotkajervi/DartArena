'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

async function runRealtimeScript(name,authenticated){
  let subscriptions=0;
  const listeners=[];
  const channel={
    on(){return this},
    subscribe(){subscriptions++;return this}
  };
  const db={
    auth:{getSession:async()=>({data:{session:authenticated?{access_token:'test-jwt',user:{id:'test-user'}}:null},error:null})},
    channel(){return channel}
  };
  const context={
    window:{supabase:{createClient:()=>db},addEventListener(name,fn){listeners.push(name)}},
    document:{visibilityState:'visible',addEventListener(){},getElementById(){return null}},
    location:{search:'?id=test-tournament'},
    URLSearchParams,
    setInterval(){return 1},
    setTimeout(){return 1},
    clearInterval(){},clearTimeout(){},
    console:{warn(){},error(){}}
  };
  if(name==='tournament-finish-summary.js'){
    context.db=db;
    context.tournament=null;
    context.id='test-tournament';
  }
  vm.runInNewContext(read(name),context,{filename:name});
  for(let i=0;i<10;i++)await Promise.resolve();
  return {subscriptions,listeners};
}
test('Tournament live updates do not create anonymous filtered Realtime subscriptions',async()=>{
  const anonymous=await runRealtimeScript('tournament-live-refresh.js',false);
  assert.equal(anonymous.subscriptions,0);
  const signedIn=await runRealtimeScript('tournament-live-refresh.js',true);
  assert.equal(signedIn.subscriptions,1);
});
test('Tournament finish summary waits for session before its filtered subscription',async()=>{
  assert.equal((await runRealtimeScript('tournament-finish-summary.js',false)).subscriptions,0);
  assert.equal((await runRealtimeScript('tournament-finish-summary.js',true)).subscriptions,1);
});
test('Stats and cup-permission modules gate subscriptions on authenticated session',()=>{
  const stats=read('tournament-stats.js');
  const cup=read('tournament-cup-permissions.js');
  assert.match(stats,/async function subscribeStats\(\)\{[\s\S]*?await db\.auth\.getSession\(\)[\s\S]*?if\(!data\?\.session\?\.access_token\)return;[\s\S]*?db\.channel\(/);
  assert.match(cup,/await refreshPermission\(\);\s*if\(!userId\)return;/);
});
test('Tournament page cache versions invalidate every affected Realtime module',()=>{
  const html=read('tournament.html');
  for(const name of ['tournament-live-refresh','tournament-finish-summary','tournament-stats','tournament-cup-permissions']){
    assert.ok(html.includes(name+'.js?v=20261027-authfilter1'),name);
  }
});
