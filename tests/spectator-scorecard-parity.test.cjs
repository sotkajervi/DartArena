'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dir=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(dir,name),'utf8');

function fixture(){
  const elements=new Map();
  const ids=['spectatePlayer1','spectatePlayer2','p1','p2',
    'spectateDarts1','spectateDarts2','spectateCardAvg1','spectateCardAvg2',
    'spectateFastLeg1','spectateFastLeg2','spectatePlayerCard1','spectatePlayerCard2'];
  for(let n=1;n<=2;n++){
    ids.push('p'+n+'Darts','p'+n+'Avg','p'+n+'FastLeg',
      'p'+n+'100','p'+n+'140','p'+n+'180','p'+n+'Checkout','p'+n+'PlayerCard');
  }
  const el=id=>{
    const obj={id,textContent:'',style:{},marker:null,
      classList:{toggle(name,value){obj[name]=value}},
      querySelector(selector){return selector==='.da-leg-starter-dart'?obj.marker:null},
      appendChild(item){obj.marker=item}};
    elements.set(id,obj);return obj;
  };
  for(const id of ids)el(id);
  const document={
    getElementById:id=>elements.get(id)||null,
    createElement:()=>({setAttribute(key,value){this[key]=value},
      remove(){for(const item of elements.values())if(item.marker===this)item.marker=null}})
  };
  const window={document};
  vm.runInNewContext(read('x01-stats.js'),{window});
  vm.runInNewContext(read('spectator-scorecard.js'),{window});
  const match={id:'m1',player1_id:'a',player2_id:'b',turn_player_id:'b',
    status:'playing',current_leg:2,current_set:1,match_starter_id:'a',
    game_variant:'x01',player1_avg:62.5,player2_avg:75.5};
  const visits=[
    {id:1,player_id:'a',score:120,leg_no:1,set_no:1,is_checkout:false},
    {id:2,player_id:'a',score:140,leg_no:1,set_no:1,is_checkout:false},
    {id:3,player_id:'a',score:90,leg_no:1,set_no:1,is_checkout:true,darts_used:2},
    {id:4,player_id:'b',score:180,leg_no:1,set_no:1,is_checkout:false},
    {id:5,player_id:'b',score:60,leg_no:2,set_no:1,is_checkout:false},
    {id:6,player_id:'a',score:100,leg_no:2,set_no:1,is_checkout:false}
  ];
  return {api:window.DartArenaSpectatorScorecard,elements,match,visits};
}
test('Spectator keeps REST centered between PILER and AVG, with tons below',()=>{
  for(const pageName of ['spectate.html','tournament-match-viewer.html']){
    const page=read(pageName);
    assert.match(page,/class="da-spectator-score-layout"/);
    assert.match(page,/class="live-darts da-spectator-pocket"/);
    assert.match(page,/class="da-spectator-score-center"/);
    assert.match(page,/class="live-avg da-spectator-pocket"/);
    assert.match(page,/class="da-spectator-stats-row"/);
    assert.match(page,/RASKESTE LEG/);
    assert.match(page,/HØY UTG\./);
    assert.match(page,/spectator-scorecard\.js\?v=20261027-scorestats2/);
  }
});
test('PILER, AVG, high-out, tons and fastest leg are derived from real visits',()=>{
  const {api,elements,match,visits}=fixture();
  api.sync(match,visits,{mode:'spectate'});
  assert.equal(elements.get('spectateDarts1').textContent,'3');
  assert.equal(elements.get('spectateDarts2').textContent,'3');
  assert.equal(elements.get('spectateCardAvg1').textContent,'62.50');
  assert.equal(elements.get('spectateFastLeg1').textContent,'8 PILER');
  api.sync(match,visits,{mode:'tournament'});
  assert.equal(elements.get('p1Darts').textContent,'3');
  assert.equal(elements.get('p1Avg').textContent,'122.73');
  assert.equal(elements.get('p1100').textContent,'2');
  assert.equal(elements.get('p1140').textContent,'1');
  assert.equal(elements.get('p2180').textContent,'1');
  assert.equal(elements.get('p1Checkout').textContent,'90');
  assert.equal(elements.get('p1FastLeg').textContent,'8 PILER');
});
test('Dart badge follows current thrower without reordering score and video cards',()=>{
  const {api,elements,match,visits}=fixture();
  api.sync(match,visits,{mode:'spectate'});
  assert.equal(elements.get('spectatePlayer1').marker,null);
  assert.equal(elements.get('spectatePlayer2').marker.title,'Kaster nå');
  api.sync({...match,turn_player_id:'a'},visits,{mode:'spectate'});
  assert.equal(elements.get('spectatePlayer1').marker.title,'Kaster nå');
  assert.equal(elements.get('spectatePlayer2').marker,null);
  for(const id of ['spectatePlayerCard1','spectatePlayerCard2'])
    assert.equal(elements.get(id).style.order,undefined);
});
test('Limited ordinary Spectate history never presents an incomplete fastest leg as final',()=>{
  const {api,match,visits}=fixture();
  const rows=[...visits];
  for(let i=0;i<144;i++)rows.push({id:100+i,player_id:'b',score:0,leg_no:4,set_no:1,is_checkout:false});
  const data=api.metrics(match,rows,'a',1);
  assert.equal(data.fastest,null);
});
