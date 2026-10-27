'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

function viewerFixture(){
  const channels=[], intervals=[], timeouts=new Map();
  let nextTimer=0, fetchCount=0, fxEvents=0;
  const element={
    textContent:'',innerHTML:'',
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(){},setAttribute(){}
  };
  const db={
    auth:{getSession:async()=>({data:{session:null}})},
    channel(name){
      const ch={name,events:[],
        on(kind,filter,handler){this.events.push({kind,filter,handler});return this},
        subscribe(cb){this.status=cb;channels.push(this);cb?.('SUBSCRIBED');return this}
      };
      return ch;
    },
    removeChannel(){}
  };
  const window={
    addEventListener(){},
    supabase:{createClient:()=>db},
    DartArenaTournamentStatsFetch:{fetchAllVisits:async()=>{fetchCount++;return []}},
    DartArenaSpectatorFX:{visits(){},visitEvent(){fxEvents++}},
    DartArenaSpectatorScorecard:{sync(){}}
  };
  const document={
    visibilityState:'visible',getElementById:()=>element,
    body:{classList:{add(){},remove(){},toggle(){}}},
    addEventListener(){}
  };
  const context={
    window,document,location:{search:'?id=tmatch',replace(){}},URLSearchParams,
    setTimeout(fn,delay){const id=++nextTimer;timeouts.set(id,{fn,delay});return id},
    clearTimeout(id){timeouts.delete(id)},
    setInterval(fn,delay){intervals.push({fn,delay});return intervals.length},
    clearInterval(){},
    console:{error(){},warn(){},log(){}}
  };
  const expose="\n;globalThis.__spectatorPerf={"+
    "enter:(m,l)=>{tm=m;live=l;syncViewerStats()},"+
    "queue:queueViewerStatsRefresh,"+
    "realtime:()=>({throwsRealtimeReady,cricketRealtimeReady})};";
  vm.runInNewContext(read('tournament-match-viewer.js')+expose,context,{filename:'tournament-match-viewer.js'});
  return {
    api:context.__spectatorPerf,channels,intervals,
    get fetchCount(){return fetchCount},
    get fxEvents(){return fxEvents},
    async flush(){for(let i=0;i<12;i++)await Promise.resolve()},
    fireTimeouts(delay){
      const jobs=[...timeouts.entries()].filter(([,x])=>x.delay===delay);
      for(const [id,entry] of jobs){timeouts.delete(id);entry.fn()}
      return jobs.length;
    },
    match:{id:'tmatch',live_match_id:'live1',player1_id:'p1',player2_id:'p2',status:'live'},
    live:{status:'playing',game_variant:'x01',current_leg:1}
  };
}
test('Tournament aggregate stats no longer subscribes to every throw in DartArena',()=>{
  const source=read('tournament-stats.js');
  assert.match(source,/table:'tournament_matches',filter:/);
  assert.doesNotMatch(source,/\.on\('postgres_changes',\{event:'\*',schema:'public',table:'match_throws'/);
  assert.match(source,/window\.addEventListener\('focus',scheduleLoad\)/);
  assert.match(source,/visibilitychange/);
});
test('Spectator retains event-driven updates but reduces healthy polling to 15s',async()=>{
  const f=viewerFixture();
  f.api.enter(f.match,f.live);
  await f.flush();
  assert.equal(f.fetchCount,1,'One initial visit-history fetch');
  assert.equal(f.api.realtime().throwsRealtimeReady,true);
  assert.equal(f.intervals.length,1);
  assert.equal(f.intervals[0].delay,5000);
  const baseline=f.fetchCount;
  f.intervals[0].fn();
  f.intervals[0].fn();
  assert.equal(f.fireTimeouts(180),0,'Healthy channel skips first two fallback ticks');
  f.intervals[0].fn();
  assert.equal(f.fireTimeouts(180),1);
  await f.flush();
  assert.equal(f.fetchCount-baseline,1,'Only one history refresh per three ticks');
});
test('Spectator retains 5s fallback when Realtime disconnects',async()=>{
  const f=viewerFixture();
  f.api.enter(f.match,f.live);
  await f.flush();
  f.channels.find(x=>x.name==='spectator-stats-live1').status('CHANNEL_ERROR');
  assert.equal(f.api.realtime().throwsRealtimeReady,false);
  const before=f.fetchCount;
  f.intervals[0].fn();
  assert.equal(f.fireTimeouts(180),1);
  await f.flush();
  assert.equal(f.fetchCount-before,1);
});
test('Two close Realtime changes request one read while FX remains immediate',async()=>{
  const f=viewerFixture();
  f.api.enter(f.match,f.live);
  await f.flush();
  const before=f.fetchCount;
  const throwChannel=f.channels.find(x=>x.name==='spectator-stats-live1');
  const insert=throwChannel.events.find(x=>x.kind==='postgres_changes');
  insert.handler({eventType:'INSERT',new:{id:20,match_id:'live1',score:60}});
  assert.equal(f.fxEvents,1,'FX receives throw without debounce');
  f.api.queue();
  assert.equal(f.fireTimeouts(180),1,'One consolidated stats refresh');
  await f.flush();
  assert.equal(f.fetchCount-before,1);
});
test('Pages load versioned optimized files; prior rollback preserved separately',()=>{
  assert.match(read('tournament.html'),/tournament-stats\.js\?v=20261027-perf1/);
  assert.match(read('tournament-match-viewer.html'),/tournament-match-viewer\.js\?v=20261027-perf1/);
});
