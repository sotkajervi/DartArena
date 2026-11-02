'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Exact popup script from 31 October 20:38, exercised in a completely mocked
// browser. Neither network access nor a real Supabase client is permitted.
const popup=fs.readFileSync(path.join(__dirname,'..','tournament-match-alerts.js'),'utf8');
const START=Date.parse('2026-10-31T19:01:02Z');
const CUP=Date.parse('2026-10-31T21:51:47Z');
const END=Date.parse('2026-10-31T23:18:05Z');
const players=Array.from({length:12},(_,i)=>'sim-player-'+i);
const groups=['a','b'];
const history=[];
let gameNo=0;
for(let group=0;group<2;group++){
  const base=group*6;
  let local=0;
  for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
    local++;
    history.push({
      id:'g-'+(++gameNo),stage:'group',group_id:groups[group],
      round_no:Math.ceil(local/3),match_no:local,
      status:'pending',player1_id:players[base+i],player2_id:players[base+j],
      winner_id:null
    });
  }
}
assert.equal(history.length,30);
const cup=[];
let ordinal=0;
for(const [round,number] of [[1,8],[2,4],[3,2],[4,1]]){
  for(let i=1;i<=number;i++)cup.push({
    id:'c-'+(++ordinal),stage:'cup',group_id:null,round_no:round,
    match_no:i,status:'pending',player1_id:players[(i*2-2)%12],
    player2_id:players[(i*2-1)%12],winner_id:null
  });
}
assert.equal(cup.length,15);

function browserNode(){
  return {className:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},
    addEventListener(){},setAttribute(){},append(){},appendChild(){},remove(){},
    get dataset(){return {}}};
}
async function scenario(enabled){
  const state={now:START,status:'groups',matches:history.map(x=>({...x})),
    requests:[],popups:0,simulatedVisits:0};
  const clients=[];
  for(let i=0;i<12;i++){
    const uid=players[i],intervals=[];
    const record=table=>state.requests.push({table,when:state.now});
    const db={
      auth:{getSession:async()=>({data:{session:{user:{id:uid}}}})},
      from(table){
        return {
          select(){return this},
          eq(){return this},
          limit(){return this},
          maybeSingle(){
            record(table);
            return Promise.resolve({data:table==='tournaments'?{status:state.status}:null,error:null});
          },
          then(onFulfilled,onRejected){
            record(table);
            return Promise.resolve({data:table==='tournament_matches'?state.matches.map(x=>({...x})):[],error:null})
              .then(onFulfilled,onRejected);
          }
        };
      }
    };
    const document={
      head:{append(){}},body:{append(node){if(node.className==='da-ready-overlay')state.popups++}},
      createElement:()=>browserNode(),querySelectorAll:()=>[],
      getElementById:()=>browserNode(),addEventListener(){}
    };
    const window={supabase:{createClient:()=>db},addEventListener(){}};
    const context={window,document,
      location:{pathname:'/DartArena/tournament.html',search:'?id=sim-tournament',assign(){}},
      URLSearchParams,console:{warn(){},debug(){}},
      MutationObserver:class {observe(){}},
      setInterval(fn,ms){intervals.push({fn,ms});return intervals.length},
      clearInterval(){},setTimeout(){return 1},clearTimeout(){}};
    const script=enabled?popup:popup.replace(
      'window.__daReadyWatcher=true;',
      'window.__daReadyWatcher=true;\nreturn;'
    );
    vm.runInNewContext(script,context,{filename:'tournament-match-alerts.js'});
    clients.push({intervals});
  }
  // Flush the async init/auth path and its initial read, then run all 7s ticks.
  for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(clients.every(c=>c.intervals.length===(enabled?1:0)),true);
  let lastDone=-1;
  for(let t=START+7000;t<=END;t+=7000){
    state.now=t;
    if(t<CUP){
      const done=Math.min(30,Math.floor((t-START)/(CUP-START)*30));
      for(let j=lastDone+1;j<done;j++){
        const m=state.matches[j];
        if(m){m.status='finished';m.winner_id=m.player1_id}
      }
      lastDone=done-1;
      state.simulatedVisits=Math.min(1806,Math.floor((t-START)/(CUP-START)*1806));
    }else{
      if(state.status!=='cup'){
        state.status='cup';
        state.matches.push(...cup.map(x=>({...x})));
        for(let j=0;j<30;j++) {
          state.matches[j].status='finished';
          state.matches[j].winner_id=state.matches[j].player1_id;
        }
      }
      const elapsed=(t-CUP)/(END-CUP);
      const cupDone=Math.min(7,Math.floor(elapsed*7));
      for(let j=0;j<cupDone;j++){const m=state.matches[30+j];m.status='finished';m.winner_id=m.player1_id}
      state.simulatedVisits=1806+Math.min(52,Math.floor(elapsed*52));
    }
    if(enabled)await Promise.all(clients.map(c=>c.intervals[0].fn()));
  }
  state.simulatedVisits=1858; // Fixture total from original 31 October history.
  const byPeriod=(predicate,table)=>state.requests.filter(r=>predicate(r.when)&&r.table===table).length;
  return {
    players:12,groups:2,groupMatches:30,cupMatches:15,syntheticVisits:state.simulatedVisits,
    durationMinutes:Math.round((END-START)/60000),enabled,
    matchReads:byPeriod(()=>true,'tournament_matches'),
    statusReads:byPeriod(()=>true,'tournaments'),
    totalExtraReads:state.requests.length,
    readsBeforeCup:state.requests.filter(r=>r.when<CUP).length,
    readsAfterCup:state.requests.filter(r=>r.when>=CUP).length,
    popupsShown:state.popups
  };
}
test('31 October: popup on versus off with identical 12-player full-tournament replay',async()=>{
  assert.equal(popup.includes('setInterval(refresh,7000)'),true,
    'Historical script must still use original 7-second polling');
  assert.equal(popup.includes('Disabled during live tournament incident'),false,
    'Must run from the historical active-popup commit, not disabled main');
  const on=await scenario(true);
  const off=await scenario(false);
  assert.equal(on.groupMatches,30);
  assert.equal(on.cupMatches,15);
  assert.equal(on.syntheticVisits,1858);
  assert.equal(on.matchReads,on.statusReads);
  assert.ok(on.totalExtraReads>0);
  assert.ok(on.popupsShown>0);
  assert.equal(off.totalExtraReads,0);
  assert.equal(off.popupsShown,0);
  console.log('SIMULATED POPUP A/B (historical script, fake browser + fake DB)');
  console.log(JSON.stringify({popupOn:on,popupOff:off,avoidedPopupReads:on.totalExtraReads},null,2));
});
