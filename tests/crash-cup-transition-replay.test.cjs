'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const historical=fs.readFileSync(path.join(__dirname,'fixtures/tournament-crisis-20261031.js'),'utf8');
const current=fs.readFileSync(path.join(root,'tournament.js'),'utf8');
const fetchVisits=fs.readFileSync(path.join(root,'tournament-stats-fetch.js'),'utf8');

// No HTTP requests, database credentials, Supabase access, production writes, or browser network.
// Exercise actual historical and present-day tournament.js in 12 independent JS VM contexts.
const users=Array.from({length:12},(_,i)=>'sim-user-'+i);
const tid='sim-crash-tournament';
const ids={group1:'g-1',group2:'g-2'};
const groupPlayers=users.map((user_id,i)=>({user_id,group_id:i<6?ids.group1:ids.group2,seed_no:(i%6)+1}));
const groups=[{id:ids.group1,tournament_id:tid,group_no:1,best_of:5,advance_mode:'all',advance_count:6},
              {id:ids.group2,tournament_id:tid,group_no:2,best_of:5,advance_mode:'all',advance_count:6}];
const roster=users.map((user_id,i)=>({user_id,role:'participant',joined_at:i}));
const people=users.map((id,i)=>({id,username:'Test '+(i+1)}));
const groupMatches=[];
for(let group=0;group<2;group++){
  let matchNo=0;
  for(let a=0;a<6;a++)for(let b=a+1;b<6;b++){
    matchNo++;
    const n=group*15+matchNo;
    const isLast=n===30;
    const hasLive=n<=26||isLast;
    groupMatches.push({
      id:'gm-'+n,tournament_id:tid,stage:'group',group_id:group?ids.group2:ids.group1,
      round_no:Math.ceil(matchNo/3),match_no:matchNo,player1_id:users[group*6+a],
      player2_id:users[group*6+b],status:isLast?'pending':'finished',
      best_of:5,player1_legs:isLast?0:3,player2_legs:isLast?0:(n%3),
      winner_id:isLast?null:users[group*6+a],live_match_id:hasLive?'live-'+n:null,
      updated_at:isLast?'before-last':'unchanged-'+n
    });
  }
}
const fullCup=[];
for(const [round,n,bestOf] of [[1,8,5],[2,4,7],[3,2,7],[4,1,9]]){
  for(let i=1;i<=n;i++)fullCup.push({
    id:'cup-'+round+'-'+i,tournament_id:tid,stage:'cup',group_id:null,
    round_no:round,match_no:i,status:'pending',best_of:bestOf,
    player1_id:i<=6?users[(i*2-2)%12]:null,player2_id:i<=6?users[(i*2-1)%12]:null,
    winner_id:null,live_match_id:null,updated_at:'cup-original'
  });
}
// The historical tournament had 1858 recorded visits: 1806 from groups, 52 from cup.
// Keep 26 completed group matches with 1806 rows; the last initially pending match
// has its 56 rows included only when marked complete.
const throws=[];
let throwId=0;
for(let n=1;n<=26;n++){
  const quantity=n===26?56:70;
  for(let k=0;k<quantity;k++)throws.push({
    id:++throwId,match_id:'live-'+n,player_id:users[(n+k)%12],
    score:(k*17+n*11)%181,darts_used:3,is_checkout:k===quantity-1
  });
}
// 25 * 70 + 56 = 1806; use another 52 synthetic cup visits.
for(let k=0;k<52;k++)throws.push({
  id:++throwId,match_id:'live-cup',player_id:users[k%2],
  score:(k*13)%181,darts_used:3,is_checkout:k===51
});
assert.equal(throws.length,1858);

const makeNode=()=>({
  textContent:'',innerHTML:'',value:'',disabled:false,className:'',style:{},
  classList:{add(){},remove(){},toggle(){},contains(){return false}},
  addEventListener(){},setAttribute(){},removeAttribute(){},remove(){},
  querySelector(){return {textContent:''}},querySelectorAll(){return []},
  appendChild(){},append(){},insertAdjacentElement(){},getAttribute(){return null}
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wait=async(times=15)=>{for(let i=0;i<times;i++)await tick()};

function makeState(){
  return {
    phase:'groups',groupMatches:groupMatches.map(m=>({...m})),
    cupMatches:[],counts:new Map(),errors:[],events:0,executedTimers:0
  };
}
function record(state,table){state.counts.set(table,(state.counts.get(table)||0)+1)}
function queryFor(state,table){
  const query={filters:[],page:null,select(){return this},
    eq(column,value){this.filters.push(row=>row[column]===value);return this},
    in(column,values){const set=new Set(values);this.filters.push(row=>set.has(row[column]));return this},
    order(){return this},limit(){return this},
    range(first,last){this.page=[first,last];return Promise.resolve(this.run())},
    single(){return Promise.resolve(this.run(true))},
    maybeSingle(){return Promise.resolve(this.run(true))},
    then(ok,bad){return Promise.resolve(this.run()).then(ok,bad)},
    run(single=false){
      record(state,table);
      const rows={
        tournaments:[{id:tid,status:state.phase,tournament_type:'groups_cup',owner_id:users[0],game:501,
          game_variant:'x01',cup_game:501,cup_game_variant:'x01',starts_at:'2026-10-31T19:00:00Z'}],
        tournament_members:roster,
        profiles:people,
        tournament_groups:groups,
        tournament_group_players:groupPlayers,
        tournament_matches:[...state.groupMatches,...state.cupMatches],
        tournament_ai_group_matches:[],
        tournament_ai_rivals:[],
        matches:[],
        match_throws:throws,
      }[table];
      if(!rows)throw Error('Unexpected simulated table '+table);
      let results=rows.filter(r=>this.filters.every(f=>f(r)));
      if(this.page)results=results.slice(this.page[0],this.page[1]+1);
      return {data:single?results[0]||null:results.map(x=>({...x})),error:null};
    }
  };
  return query;
}
function browser(state,source,index){
  const nodes=new Map(),timers=new Map(),channels=[];
  let nextId=0;
  const node=id=>{if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id)};
  const db={
    auth:{getSession:async()=>({data:{session:{user:{id:users[index]},access_token:'SIMULATION_ONLY'}},error:null})},
    from(table){return queryFor(state,table)},
    channel(name){
      const ch={name,listeners:[],on(kind,params,cb){this.listeners.push({kind,params,cb});return this},
        subscribe(cb){cb?.('SUBSCRIBED');channels.push(this);return this}};
      return ch;
    },
    removeChannel:async()=>{}
  };
  const events=[];
  const window={
    supabase:{createClient:()=>db},
    DartArenaGroupResultsLayout:{
      show(t){return Boolean(t&&t.tournament_type==='groups_cup'&&['groups','cup_setup','cup','finished'].includes(t.status))},
      sync(){}
    },
    addEventListener(kind,cb){events.push({kind,cb})},
    dispatchEvent(){},
    DartArenaFXLive:null
  };
  const document={
    getElementById:node,querySelectorAll:()=>[],
    addEventListener(){},body:{append(){}},createElement:makeNode
  };
  const context={
    window,document,location:{search:'?id='+tid,href:'',assign(){}},
    URLSearchParams,Event:class{constructor(type){this.type=type}},
    CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},
    Date,Math,Intl,console:{log(){},warn(){},error(...args){state.errors.push(String(args[0]))}},
    setTimeout(fn,delay){const id=++nextId;timers.set(id,{fn,delay});return id},
    clearTimeout(id){timers.delete(id)},setInterval(){return 0},clearInterval(){},
    alert(){},confirm(){return false}
  };
  const injected=source.replace(/boot\(\)\.catch\(error=>\{[\s\S]*?\}\);\s*$/,
    'renderPage=()=>{};\n' +
    'boot().catch(error=>{globalThis.__bootError=String(error&&error.stack||error)});');
  assert.ok(injected.includes('renderPage=()=>{};')&&injected.includes('globalThis.__bootError'),
    'Boot replacement must match real source');
  vm.runInNewContext(fetchVisits,context,{filename:'tournament-stats-fetch.js'});
  vm.runInNewContext(injected,context,{filename:'tournament.js'});
  return {
    get err(){return context.__bootError},
    channels,events,
    async fire(table,record){
      const target='tournament-'+tid;
      const cb=channels.find(x=>x.name===target)?.listeners
        .filter(x=>x.params?.table===table).map(x=>x.cb)||[];
      assert.ok(cb.length,'tournament Realtime listener must exist for '+table);
      for(const fn of cb)fn({eventType:'UPDATE',new:record});
    },
    async runTimers(){
      for(let round=0;round<3;round++){
        if(timers.size===0)break;
        const pending=[...timers.values()];
        timers.clear();
        for(const job of pending){job.fn();state.executedTimers++}
        await wait(5);
      }
    }
  };
}
const countsObject=state=>Object.fromEntries([...state.counts.entries()].sort((a,b)=>a[0].localeCompare(b[0])));
const diff=(end,start)=>Object.fromEntries(Object.keys(end).map(key=>[key,end[key]-(start[key]||0)]));
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
async function scenario(label,source){
  const state=makeState();
  const browsers=Array.from({length:12},(_,i)=>browser(state,source,i));
  await wait(35);
  assert.equal(browsers.filter(b=>b.err).length,0,'Boot did not fail');
  assert.equal(browsers.every(b=>b.channels.some(ch=>ch.name==='tournament-'+tid)),true,
    'All 12 clients subscribed to tournament Realtime');
  const initial=countsObject(state);
  assert.ok(initial.tournament_groups>=12,'Initial group render must actually query group data');
  assert.ok(initial.match_throws>0,'Initial group render must fetch actual simulated throw history');

  const last=state.groupMatches.at(-1);
  last.status='finished';last.winner_id=last.player1_id;last.player1_legs=3;
  last.player2_legs=2;last.updated_at='2026-10-31T21:50:23Z';
  await Promise.all(browsers.map(b=>b.fire('tournament_matches',last)));
  await wait(15);await Promise.all(browsers.map(b=>b.runTimers()));await wait(5);
  const afterLast=countsObject(state);

  // Identical order to original backend: insert cup bracket, then update tournament stage.
  state.cupMatches=fullCup.map(m=>({...m}));
  state.phase='cup';
  await Promise.all(browsers.map(b=>b.fire('tournaments',{status:'cup'})));
  await wait(20);await Promise.all(browsers.map(b=>b.runTimers()));await wait(5);
  const afterCup=countsObject(state);
  
  // 15 bracket insert events plus 8 cup match status updates, delivered to all 12
  // clients. A known regression: historical tournament.js reloads group history
  // even while the tournament has moved into cup.
  for(const row of state.cupMatches){
    await Promise.all(browsers.map(b=>b.fire('tournament_matches',row)));
  }
  for(let i=0;i<8;i++){
    state.cupMatches[i].status='finished';
    state.cupMatches[i].winner_id=state.cupMatches[i].player1_id;
    state.cupMatches[i].updated_at='cup-result-'+i;
    await Promise.all(browsers.map(b=>b.fire('tournament_matches',state.cupMatches[i])));
  }
  await wait(45);await Promise.all(browsers.map(b=>b.runTimers()));await wait(30);
  assert.equal(browsers.filter(b=>b.err).length,0);
  assert.deepEqual(state.errors,[], 'No mock browser runtime errors expected');
  const afterBurst=countsObject(state);
  const cupEventDelta=diff(afterBurst,afterCup);
  return {
    version:label,clients:12,groups:2,groupMatches:30,cupMatches:15,syntheticThrows:1858,
    initialReads:sum(initial),
    lastGroupFinishReads:sum(diff(afterLast,initial)),
    cupStartReads:sum(diff(afterCup,afterLast)),
    cupRealtimeBurstReads:sum(cupEventDelta),
    cupBurstByTable:cupEventDelta,
    totalReads:sum(afterBurst),pendingTimersRun:state.executedTimers
  };
}
test('Crash-cup transition: 12 clients replay historical and current actual group logic without popup',async()=>{
  assert.equal(historical.includes("if(window.DartArenaGroupResultsLayout?.show(tournament))loadGroupLobby()"),true);
  assert.equal(current.includes("if(['groups','cup_setup'].includes(tournament?.status))"),true);
  assert.equal(historical.includes('const groupAverageCache=new Map()'),false);
  assert.equal(current.includes('const groupAverageCache=new Map()'),true);
  const crisis=await scenario('crisis-2026-10-31-21:00-popup-off',historical);
  const repaired=await scenario('main-2026-11-02-popup-off',current);
  assert.ok(crisis.cupRealtimeBurstReads>0,'Historical cup updates must reload group data');
  assert.equal(repaired.cupBurstByTable.tournament_groups||0,0,'Current cup updates must not reload groups');
  assert.equal(repaired.cupBurstByTable.match_throws||0,0,'Current cup updates must not re-fetch historical throws');
  assert.ok(crisis.cupRealtimeBurstReads>repaired.cupRealtimeBurstReads,
    'Cup burst must cause fewer reads in current build');
  console.log('REAL FRONTEND JS / SYNTHETIC DATABASE: LAST GROUP MATCH -> CUP -> 23 REALTIME MATCH EVENTS');
  console.log(JSON.stringify({crisis,current:repaired,avoidedAtCupBurst:crisis.cupRealtimeBurstReads-repaired.cupRealtimeBurstReads},null,2));
});
