const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../spectator-fx.js'),'utf8');

function setup(){
  const accepted=[],turns=[],snapshots=[],instances=[];
  const win={
    addEventListener(){},
    setTimeout(){return 1},
    clearTimeout(){},
    DartArenaFXLive:{
      DEFAULT_EFFECTS:{rolling_score:true,cinematic_switch:true,led_score_rail:true},
      createX01(options){
        const fx={
          syncSnapshot(v){snapshots.push({...v})},
          acceptConfirmedOnlineVisit(v){accepted.push(v);return 1},
          destroy(){fx.destroyed=true}
        };
        instances.push({type:'x01',options,fx});
        return fx;
      },
      engine(id,options){
        const fx={emit(e){turns.push(e);return 1},destroy(){fx.destroyed=true}};
        instances.push({type:'cricket',id,options,fx});
        return fx;
      }
    }
  };
  vm.runInNewContext(source,{window:win,console,Date});
  return {api:win.DartArenaSpectatorFX,accepted,turns,snapshots,instances};
}
const match=(overrides={})=>({
  id:'match-1',game_variant:'x01',game:501,status:'playing',player1_id:'p1',player2_id:'p2',
  turn_player_id:'p1',player1_score:501,player2_score:501,current_leg:1,current_set:1,
  updated_at:'2026-10-26T22:00:00Z',...overrides
});
const visit=(overrides={})=>({
  id:1,match_id:'match-1',player_id:'p1',score:80,leg_no:1,set_no:1,is_checkout:false,
  ...overrides
});
test('joining a live X01 match does not animate earlier throws',()=>{
  const x=setup();x.api.snapshot(match({player1_score:421,turn_player_id:'p2'}));
  x.api.visits([visit()]);
  assert.equal(x.accepted.length,0);
  assert.equal(x.instances.length,1);
  assert.equal(x.instances[0].options.level,'cinematic');
});
test('a confirmed new X01 visit animates rolling score and handoff once',()=>{
  const x=setup();x.api.snapshot(match());x.api.visits([]);
  x.api.snapshot(match({player1_score:421,turn_player_id:'p2',updated_at:'next'}));
  x.api.visits([visit()]);
  assert.equal(x.accepted.length,1);
  assert.equal(x.accepted[0].previousScore,501);
  assert.equal(x.accepted[0].newScore,421);
  assert.equal(x.accepted[0].previousTurnSlot,'p1');
  assert.equal(x.accepted[0].nextTurnSlot,'p2');
  x.api.visits([visit()]);
  assert.equal(x.accepted.length,1);
});
test('score corrections without a turn handoff do not animate',()=>{
  const x=setup();x.api.snapshot(match());x.api.visits([]);
  x.api.snapshot(match({player1_score:431,updated_at:'correction'}));
  x.api.visits([visit({score:70})]);
  assert.equal(x.accepted.length,0);
});
test('unrelated visit or leg never confirms a score animation',()=>{
  const x=setup();x.api.snapshot(match());x.api.visits([]);
  x.api.snapshot(match({player1_score:421,turn_player_id:'p2',updated_at:'changed'}));
  x.api.visits([visit({player_id:'p2'})]);
  assert.equal(x.accepted.length,0);
});
test('new leg and Chicago stage change reset FX without replay',()=>{
  const x=setup();x.api.snapshot(match());x.api.visits([]);
  x.api.snapshot(match({current_leg:2,turn_player_id:'p2',player1_score:501,updated_at:'leg2'}));
  x.api.visits([visit()]);
  assert.equal(x.accepted.length,0);
  x.api.snapshot(match({game_config:{chicago:true,chicago_stage:2},game_variant:'cricket'}));
  assert.equal(x.instances.at(-1).type,'cricket');
});
test('Cricket spectator gets cinematic handoff, without score countdown',()=>{
  const x=setup();
  const a=match({game_variant:'cricket',game:'cricket',player1_score:0,player2_score:0});
  x.api.snapshot(a);
  x.api.snapshot({...a,turn_player_id:'p2',updated_at:'turn2'});
  assert.equal(x.turns.length,1);
  assert.equal(x.turns[0].type,'turn_changed');
  assert.equal(x.turns[0].nextSlot,'p2');
  assert.equal(x.accepted.length,0);
});
test('destroy releases the FX engine',()=>{
  const x=setup();x.api.snapshot(match());
  const fx=x.instances[0].fx;
  x.api.destroy();assert.equal(fx.destroyed,true);
});

test('Realtime INSERT before match UPDATE still triggers spectator FX once',()=>{
  const x=setup();
  const before=match(),after=match({player1_score:421,turn_player_id:'p2',updated_at:'next'});
  x.api.snapshot(before);x.api.visits([]);
  x.api.visitEvent(visit());
  assert.equal(x.accepted.length,0);
  x.api.snapshot(after);
  assert.equal(x.accepted.length,1);
  assert.equal(x.accepted[0].scored,80);
  x.api.visitEvent(visit());
  x.api.visits([visit()]);
  assert.equal(x.accepted.length,1,'Same committed visit must not animate twice');
  assert.equal(x.snapshots.length,1,'Do not immediately overwrite the animated LED rail');
});
test('Spectator scorecard shares exact match-room score and name classes',()=>{
  const tournament=fs.readFileSync(path.join(__dirname,'../tournament-match-viewer.html'),'utf8');
  const ordinary=fs.readFileSync(path.join(__dirname,'../spectate.html'),'utf8');
  const standard=fs.readFileSync(path.join(__dirname,'../match.html'),'utf8');
  assert.match(standard,/id="matchScore1" class="match-score"/);
  assert.match(tournament,/id="s1" class="spectator-points match-score"/);
  assert.match(ordinary,/id="spectateResult1" class="match-score"/);
  for(const page of [tournament,ordinary]){
    assert.match(page,/spectator-scorecard\.css\?v=/);
    assert.match(page,/spectator-fx\.js\?v=/);
    assert.match(page,/fx-live\.js\?v=/);
  }
  assert.doesNotMatch(tournament,/id="matchScoreInput"/);
  assert.doesNotMatch(ordinary,/id="matchScoreInput"/);
});
test('Tournament spectator handles committed INSERT immediately, ordinary uses restricted RPCs',()=>{
  const tournament=fs.readFileSync(path.join(__dirname,'../tournament-match-viewer.js'),'utf8');
  const ordinary=fs.readFileSync(path.join(__dirname,'../spectate-runtime.js'),'utf8');
  const sql=fs.readFileSync(path.join(__dirname,'../supabase-spectator-fx-readonly.sql'),'utf8');
  assert.match(tournament,/DartArenaSpectatorFX\?\.visitEvent\(payload.new\)/);
  assert.match(ordinary,/get_spectate_fx_state/);
  assert.match(ordinary,/get_spectate_fx_visits/);
  assert.match(ordinary,/setInterval\(pollFxVisits,2000\)/);
  assert.doesNotMatch(ordinary,/from\('match_throws'\)/);
  assert.match(sql,/auth\.uid\(\) is not null/);
  assert.match(sql,/revoke execute on function public\.get_spectate_fx_state\(uuid\) from anon;/);
  assert.match(sql,/revoke execute on function public\.get_spectate_fx_visits\(uuid\) from anon;/);
});
