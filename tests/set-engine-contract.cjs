// Runs the actual set-engine.js with mocked DOM, auth and Supabase RPC.
// No network, credentials or writes. Usage: node tests/set-engine-contract.cjs
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'..','set-engine.js'),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const elements=new Map();
function el(id){
  if(!elements.has(id))elements.set(id,{
    id,value:'',disabled:false,textContent:'',style:{},classList:{toggle(){}},
    listeners:{},addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)},
    focus(){},blur(){}
  });
  return elements.get(id);
}
const match={
  id:'test-match',player1_id:'p1',player2_id:'p2',turn_player_id:'p1',
  player1_score:501,player2_score:501,player1_legs:0,player2_legs:0,
  status:'playing',match_mode:'legs',current_leg:1,current_set:1,game:501,
  legs:3,game_variant:'x01',game_config:{}
};
let resolveRpc,requests=0;
const db={
  auth:{getSession:async()=>({data:{session:{user:{id:'p1'}}}})},
  from(table){
    assert.equal(table,'matches');
    return {select(){return this},eq(){return this},single:async()=>({data:match})};
  },
  channel(){return {on(){return this},subscribe(){return this}}},
  rpc(name,params){
    assert.equal(name,'submit_x01_visit');
    assert.deepEqual(params,{p_match_id:'test-match',p_score:60});
    requests++;
    return new Promise(resolve=>{resolveRpc=resolve});
  }
};
const context={
  window:{supabase:{createClient(){throw Error('Must reuse shared client')}},DartArenaMatchDb:db,
    addEventListener(){},DartArenaX01ZoomSession:{}},
  document:{getElementById:el,activeElement:null},
  location:{search:'?id=test-match'},
  URLSearchParams,console,
  setInterval(fn){queueMicrotask(fn);return 1},clearInterval(){},
  setTimeout(){return 1},clearTimeout(){},
  requestAnimationFrame(fn){queueMicrotask(fn)}
};
vm.runInNewContext(script,context,{filename:'set-engine.js'});
(async()=>{
  await sleep(30);
  const input=el('matchScoreInput'),button=el('matchScoreBtn');
  assert.equal(typeof button.onclick,'function','Scoring handler must initialize');
  input.value='60';
  button.onclick({stopImmediatePropagation(){}});
  button.onclick({stopImmediatePropagation(){}});
  await sleep(5);
  assert.equal(requests,1,'Duplicate click must not start a second RPC');
  assert.equal(button.disabled,true,'Button must remain locked');
  assert.equal(input.value,'60','Pending score must not be cleared');
  resolveRpc({data:{match:{...match,player1_score:441,turn_player_id:'p2'},bust:false},error:null});
  await sleep(10);
  assert.equal(input.value,'','Accepted score must clear input');
  assert.equal(requests,1);
  console.log('PASS: duplicate scoring blocked; input retained pending confirmation; success clears input');
})().catch(error=>{console.error(error);process.exitCode=1});
