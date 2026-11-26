'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const matchSource=fs.readFileSync(path.join(__dirname,'..','match.js'),'utf8');
const helper=matchSource.match(/function syncZoomCamTurn\(previous,next\)\{[\s\S]*?\n\}/)?.[0];
function prepare(){
  assert.ok(helper,'X01 match exposes one turn synchronization helper');
  const calls=[];
  const session={pauseTracking(){calls.push('pause')},resetToT20(){calls.push('reset')}};
  const profile={id:'self'};
  const sync=new Function('zoomCamSession','profile',helper+';return syncZoomCamTurn;')(session,profile);
  const state=(turn,leg=1,status='playing',stage=0)=>({
    status,turn_player_id:turn,current_set:1,current_leg:leg,
    game_config:{chicago_stage:stage}
  });
  return{calls,sync,state};
}
test('Own saved visit pauses tracking; unrelated opponent updates do not reset',()=>{
  const {calls,sync,state}=prepare();
  sync(state('self'),state('other'));
  assert.deepEqual(calls,['pause']);
  sync(state('other'),state('other'));
  assert.deepEqual(calls,['pause','pause']);
});
test('Opponent confirms score: next own turn resets once to T20',()=>{
  const {calls,sync,state}=prepare();
  sync(state('other'),state('self'));
  assert.deepEqual(calls,['reset']);
  sync(state('self'),state('self'));
  assert.deepEqual(calls,['reset'],'Repeated own-turn updates do not reset zoom again');
});
test('Checkout, next leg and match end do not resume tracking at wrong time',()=>{
  const {calls,sync,state}=prepare();
  sync(state('self',1),state('other',2));
  assert.deepEqual(calls,['pause']);
  sync(state('other',2),state('self',2));
  assert.deepEqual(calls,['pause','reset']);
  sync(state('self',2),state('self',3));
  assert.deepEqual(calls,['pause','reset','reset'],'New leg resets if same player starts');
  sync(state('self',3),state('self',3,'finished'));
  assert.equal(calls.at(-1),'pause');
});
test('Chicago stage advances with same turn still recenter',()=>{
  const {calls,sync,state}=prepare();
  sync(state('self',1,'playing',1),state('self',1,'playing',2));
  assert.deepEqual(calls,['reset']);
});
test('Successful server score and checkout apply state through the shared turn synchronization',()=>{
  const js=fs.readFileSync(path.join(__dirname,'..','set-engine.js'),'utf8');
  const checkout=fs.readFileSync(path.join(__dirname,'..','checkout-engine.js'),'utf8');
  const submit=js.indexOf("db.rpc('submit_x01_checked'");
  const fail=js.indexOf('if(error||!data)',submit);
  const validate=js.indexOf('if(!next?.id||next.id!==matchId)',fail);
  const apply=js.indexOf('state.applyScoreState(next)',validate);
  assert.ok(submit>=0&&fail>submit&&validate>fail&&apply>validate);
  assert.match(js,/DartArenaCheckout\.askDarts/);
  assert.doesNotMatch(checkout,/\.rpc\(|pauseTracking|resetToT20/);
  assert.match(matchSource,/m=next;\s*syncZoomCamTurn\(previous,m\)/);
});
