'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');

test('cup bracket loads active leg score from the linked live match',async()=>{
  const src=fs.readFileSync(path.join(root,'tournament-cup.js'),'utf8');
  const match=src.match(/  async function loadCupLiveLegs\(cupMatches\)\{[\s\S]*?\n  \}\n  async function finishTournamentIfNeeded/);
  assert.ok(match,'The cup live-leg loader must exist');
  const code=match[0].replace(/\n  async function finishTournamentIfNeeded$/,'');
  const db={from(table){
    assert.equal(table,'matches');
    return{select(){return this},in(field,ids){
      assert.equal(field,'id');assert.deepEqual(Array.from(ids),['live-1']);
      return Promise.resolve({data:[{id:'live-1',player1_legs:2,player2_legs:1}],error:null});
    }};
  }};
  const loader=Function('db',code+';return loadCupLiveLegs;')(db);
  const rows=[{id:'cup-1',status:'live',live_match_id:'live-1',player1_legs:0,player2_legs:0}];
  await loader(rows);
  assert.equal(rows[0]._live_player1_legs,2);
  assert.equal(rows[0]._live_player2_legs,1);
  assert.equal(rows[0].player1_legs,0,'Do not alter official final match results');
  assert.match(src,/m\._live_player1_legs\?\?m\.player1_legs/);
});

test('cup and group score nodes update in realtime and via polling without card replacement',async()=>{
  const src=fs.readFileSync(path.join(root,'tournament-live-refresh.js'),'utf8');
  assert.match(src,/id,stage,status,round_no/,'Live matching needs the tournament stage');
  const pending=[],intervals=[],channels=[];
  let liveRows=[
    {id:'live-cup',player1_legs:2,player2_legs:1},
    {id:'live-group',player1_legs:0,player2_legs:2}
  ];
  const matches=[
    {id:'cup-1',stage:'cup',status:'live',live_match_id:'live-cup'},
    {id:'group-1',stage:'group',status:'live',live_match_id:'live-group'}
  ];
  const db={
    auth:{getSession:async()=>({data:{session:{access_token:'test'}},error:null})},
    from(table){return{
      select(){return this},eq(){return this},
      in(){return Promise.resolve({data:liveRows,error:null})},
      maybeSingle(){return Promise.resolve({data:{id:'tour-1',status:'cup'},error:null})},
      then(done,fail){return Promise.resolve({
        data:table==='tournament_members'?[]:matches,error:null
      }).then(done,fail)}
    }},
    channel(name){
      const ch={name,events:[],
        on(type,opts,cb){this.events.push({type,opts,cb});return this},
        subscribe(cb){cb?.('SUBSCRIBED');return this}};
      channels.push(ch);return ch;
    },
    removeChannel(){return Promise.resolve()}
  };
  const cupScore={textContent:'0–0'},groupScore={textContent:'0–0'};
  const cupCard={dataset:{match:'cup-1'},querySelector:()=>cupScore};
  const groupCard={dataset:{match:'group-1'},querySelector:()=>groupScore};
  const document={
    visibilityState:'visible',addEventListener(){},
    querySelectorAll(sel){
      if(sel.startsWith('#cupBracket'))return[cupCard];
      if(sel.startsWith('#liveGroups'))return[groupCard];
      return[];
    }
  };
  const context={
    document,URLSearchParams,location:{search:'?id=tour-1'},console,
    window:{supabase:{createClient:()=>db},addEventListener(){},
      dartArenaSimulationViewActive:false},
    setTimeout(fn,ms){pending.push({fn,ms});return pending.length},
    setInterval(fn,ms){intervals.push({fn,ms});return intervals.length},
    clearTimeout(){},clearInterval(){}
  };
  vm.runInNewContext(src,context);
  const boot=pending.find(job=>job.ms===500);
  assert.ok(boot);
  await boot.fn();
  assert.equal(cupScore.textContent,'2–1');
  assert.equal(groupScore.textContent,'0–2');

  const scoreChannel=channels.find(ch=>ch.name.startsWith('tournament-leg-scores'));
  assert.ok(scoreChannel);
  assert.deepEqual(scoreChannel.events.map(x=>x.opts.filter).sort(),
    ['id=eq.live-cup','id=eq.live-group']);
  const eventFor=id=>scoreChannel.events.find(x=>x.opts.filter==='id=eq.'+id);
  eventFor('live-cup').cb({new:{id:'live-cup',player1_legs:3,player2_legs:1}});
  eventFor('live-group').cb({new:{id:'live-group',player1_legs:1,player2_legs:2}});
  assert.equal(cupScore.textContent,'3–1');
  assert.equal(groupScore.textContent,'1–2');

  liveRows=[
    {id:'live-cup',player1_legs:3,player2_legs:2},
    {id:'live-group',player1_legs:2,player2_legs:2}
  ];
  const poll=intervals.find(job=>job.ms===3000);
  assert.ok(poll);
  await poll.fn();
  assert.equal(cupScore.textContent,'3–2');
  assert.equal(groupScore.textContent,'2–2');
  assert.equal(cupCard.dataset.match,'cup-1','Cup card remains mounted');
  assert.equal(groupCard.dataset.match,'group-1','Group card remains mounted');
});
