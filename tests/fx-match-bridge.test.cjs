'use strict';
/* node --test tests/fx-match-bridge.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

async function mount(initial){
  const handlers={},instances=[],visits=[];
  const db={
    auth:{getSession:async()=>({data:{session:{user:{id:'alice'}}}})},
    from(table){
      assert.equal(table,'matches');
      return {select(){return this},eq(){return this},single:async()=>({data:initial,error:null})};
    },
    channel(){
      return {on(type,filter,cb){handlers[filter.table+':'+filter.event]=cb;return this},subscribe(){return this}};
    },
    removeChannel(){}
  };
  const FX={
    DEFAULT_EFFECTS:{rolling_score:true,neon_relay:true,led_score_rail:true,cinematic_switch:true,elimination_fx:true,bracket_power:true},
    createX01(config){
      const instance={config,syncSnapshot(){},destroy(){},acceptConfirmedOnlineVisit(visit){visits.push(visit);return 1}};
      instances.push(instance);return instance;
    }
  };
  const win={DartArenaFXLive:FX,supabase:{createClient:()=>db},addEventListener(){},
    setTimeout(fn){return 0}};
  const context=vm.createContext({window:win,location:{search:'?id=m1'},URLSearchParams,console});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../fx-match-bridge.js'),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(handlers['matches:UPDATE']);
  assert.ok(handlers['match_throws:INSERT']);
  return {handlers,instances,visits};
}
const initial={
  id:'m1',game:'501',status:'playing',current_set:1,current_leg:1,
  player1_id:'alice',player2_id:'bob',turn_player_id:'alice',
  player1_score:501,player2_score:501
};
test('Live bridge enables Cinematic + score effects without Neon or room controls',async()=>{
  const h=await mount(initial);
  assert.equal(h.instances.length,1);
  assert.equal(h.instances[0].config.level,'cinematic');
  assert.equal(h.instances[0].config.effects.neon_relay,false);
  assert.equal(h.instances[0].config.effects.cinematic_switch,true);
  assert.equal(h.instances[0].config.effects.rolling_score,true);
  assert.equal(h.instances[0].config.effects.led_score_rail,true);
  assert.equal(h.instances[0].config.slots.p1.camera,'#localVideoCard');
  assert.equal(h.instances[0].config.slots.p2.camera,'#remoteVideoCard');
  const online=fs.readFileSync(path.join(__dirname,'../match.html'),'utf8');
  assert.match(online,/fx-match-bridge\.js/);
  assert.doesNotMatch(online,/id="matchFxLevel"/);
});
test('Realtime SQL events animate only confirmed score and turn changes, in both orders',async()=>{
  const {handlers,visits}=await mount(initial);
  const matchUpdate=next=>handlers['matches:UPDATE']({new:next});
  const committed=row=>handlers['match_throws:INSERT']({new:{match_id:'m1',set_no:1,leg_no:1,is_checkout:false,...row}});
  const a={...initial,turn_player_id:'bob',player1_score:441};
  const b={...a,turn_player_id:'alice',player2_score:401};
  committed({id:11,player_id:'alice',score:60}); // INSERT before UPDATE
  matchUpdate(a);
  assert.equal(visits.length,1);
  assert.equal(visits[0].scored,60);
  assert.equal(visits[0].newScore,441);
  committed({id:11,player_id:'alice',score:60}); // Replayed event
  assert.equal(visits.length,1);
  matchUpdate(b); // UPDATE before INSERT
  committed({id:12,player_id:'bob',score:100});
  assert.equal(visits.length,2);
  assert.equal(visits[1].scored,100);
  assert.equal(visits[1].playerSlot,'p2');
  assert.equal(visits[1].nextTurnSlot,'p1');
  const correction={...b,player1_score:400}; // does not change whose turn it is
  matchUpdate(correction);
  committed({id:13,player_id:'alice',score:41}); // Should NOT pair with correction
  assert.equal(visits.length,2);
});
test('A BUST can trigger a cinematic turn change without rolling points',async()=>{
  const {handlers,visits}=await mount(initial);
  handlers['matches:UPDATE']({new:{...initial,turn_player_id:'bob'}});
  handlers['match_throws:INSERT']({new:{id:21,match_id:'m1',player_id:'alice',score:0,set_no:1,leg_no:1}});
  assert.equal(visits.length,1);
  assert.equal(visits[0].scored,0);
  assert.equal(visits[0].previousTurnSlot,'p1');
  assert.equal(visits[0].nextTurnSlot,'p2');
});
test('New leg resets FX without replaying previous-leg checkouts',async()=>{
  const {handlers,visits,instances}=await mount(initial);
  const next={...initial,current_leg:2,player1_score:501,player2_score:501,turn_player_id:'bob'};
  handlers['match_throws:INSERT']({new:{id:31,match_id:'m1',player_id:'alice',score:60,is_checkout:true,set_no:1,leg_no:1}});
  handlers['matches:UPDATE']({new:next});
  assert.equal(visits.length,0);
  assert.equal(instances.length,1);
});
