// Offline DartArena tournament load simulation. No network, credentials or Supabase calls.
// Run: node tests/offline-tournament-load.cjs
'use strict';
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const cases=[{players:2,delay:0},{players:12,delay:5},{players:16,delay:15},{players:12,delay:60}];
async function simulate({players,delay}){
  assert.equal(players%2,0);
  const games=Array.from({length:players/2},(_,i)=>({id:i,turn:0,score:[501,501],visits:[],busy:false}));
  let attempted=0,accepted=0,rejectedDuplicate=0,failed=0;
  const latencies=[];
  async function submit(game,player,points){
    attempted++;
    if(game.busy){rejectedDuplicate++;return false}
    game.busy=true;
    try{
      const t=performance.now();
      await wait(delay);
      if(game.turn!==player){failed++;return false}
      const left=game.score[player]-points;
      if(left<0||left===1)throw Error('invalid scripted score');
      game.score[player]=left;
      game.visits.push({player,points});
      game.turn=1-player;accepted++;
      latencies.push(performance.now()-t);
      return true;
    }finally{game.busy=false}
  }
  // Six/eight parallel matches. Attempt a duplicate submission before each first one completes.
  await Promise.all(games.map(async game=>{
    for(let round=0;round<10;round++){
      const player=game.turn;
      const first=submit(game,player,20);
      const duplicate=submit(game,player,20);
      await Promise.all([first,duplicate]);
    }
  }));
  assert.equal(failed,0);
  assert.equal(accepted,games.length*10);
  assert.equal(rejectedDuplicate,games.length*10);
  for(const game of games){
    assert.equal(game.visits.length,10);
    assert.deepEqual(game.score,[401,401]);
  }
  const sorted=latencies.sort((a,b)=>a-b);
  return {players,matches:games.length,attempted,accepted,rejectedDuplicate,failed,
    p95_ms:Number(sorted[Math.ceil(sorted.length*.95)-1].toFixed(1)),
    max_ms:Number(sorted.at(-1).toFixed(1))};
}
(async()=>{
  console.log('OFFLINE MODEL ONLY — NOT a Supabase, browser or WebRTC benchmark');
  for(const scenario of cases)console.log(JSON.stringify(await simulate(scenario)));
})().catch(err=>{console.error(err);process.exitCode=1});
