'use strict';
/* FX integration regression tests. Run: node --test tests/fx-live.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function fixture(){
  const doc={querySelector:()=>null,querySelectorAll:()=>[],
    addEventListener(){},removeEventListener(){},hidden:false};
  const store=new Map();
  const win={document:doc,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
    matchMedia:()=>({matches:true}),addEventListener(){},removeEventListener(){}};
  const sandbox={window:win,document:doc,console,Promise,Map,Set,AbortController,Date,Number,Object,Math};
  vm.runInNewContext(fs.readFileSync(path.join(root,'fx-live.js'),'utf8'),sandbox,{filename:'fx-live.js'});
  return {FX:win.DartArenaFXLive,store,doc};
}
test('FX engine: levels and confirmed local scores only',()=>{
  const {FX,doc,store}=fixture();
  assert.equal(FX.readLevel(),'off');
  FX.storeLevel('cinematic');assert.equal(FX.readLevel(),'cinematic');
  const fx=FX.createX01({document:doc,matchId:'match-1',startScore:501,level:'normal',
    initialScores:{p1:501,p2:501}});
  const before={id:'match-1',status:'playing',visits:[],turn:0,leg:1,currentSet:1,scores:[501,501]};
  const visit={player:0,set:1,leg:1,score:60,remaining:441,checkout:false,bust:false,at:'now'};
  const after={...before,turn:1,scores:[441,501],visits:[visit]};
  assert.equal(fx.acceptLocalTransition(before,after),2);
  assert.equal(fx.acceptLocalTransition(before,after),0);
  assert.equal(fx.acceptLocalTransition(before,after,'undo'),0);
  assert.equal(fx.acceptConfirmedOnlineVisit({confirmed:true,eventId:'late',
    playerSlot:'p1',previousScore:501,newScore:321,scored:180}),0);
  assert.equal(fx.acceptConfirmedOnlineVisit({confirmed:true,eventId:'bust',playerSlot:'p2',
    previousScore:501,newScore:501,scored:0,bust:true,
    previousTurnSlot:'p2',nextTurnSlot:'p1'}),1);
  fx.syncSnapshot({p1:501,p2:501},{resetEffects:true});
  fx.setLevel('off');assert.equal(fx.getLevel(),'off');
  assert.equal(fx.acceptConfirmedOnlineVisit({confirmed:true,eventId:'off',playerSlot:'p1',
    previousScore:501,newScore:441,scored:60}),0);
  fx.destroy();
});
test('Cup FX primes old results and accepts only new official human finishes and advancement',()=>{
  const {FX,doc}=fixture();
  const cup=FX.createCup({document:doc,tournamentId:'cup-1',level:'normal'});
  const semi={id:'semi',stage:'cup',round_no:1,match_no:1,status:'pending',
    player1_id:'alice',player2_id:'bob',winner_id:null};
  const final={id:'final',stage:'cup',round_no:2,match_no:1,status:'pending',
    player1_id:null,player2_id:'carol',winner_id:null};
  assert.equal(cup.afterBracketRender([semi,final]),0);
  assert.equal(cup.afterBracketRender([{...semi,status:'finished',winner_id:'alice'},final]),1);
  assert.equal(cup.afterBracketRender([{...semi,status:'finished',winner_id:'alice'},
    {...final,player1_id:'alice'}]),1);
  assert.equal(cup.afterBracketRender([{...semi,status:'finished',winner_id:'alice'},
    {...final,player1_id:'alice'}]),0);
  cup.destroy();
  const cup2=FX.createCup({document:doc,tournamentId:'cup-2',level:'normal'});
  const wo={...semi,id:'wo',status:'wo',winner_id:'alice',is_wo:true};
  assert.equal(cup2.afterBracketRender([semi,final]),0);
  assert.equal(cup2.afterBracketRender([wo,final]),0);
  cup2.destroy();
});
test('FX Studio has independent switches; live rooms have defaults without switches',()=>{
  const {FX,doc}=fixture();
  const names=Object.keys(FX.DEFAULT_EFFECTS);
  assert.deepEqual(names,['rolling_score','neon_relay','led_score_rail',
    'cinematic_switch','elimination_fx','bracket_power']);
  const match=FX.createX01({document:doc,matchId:'test-toggles',startScore:501,level:'cinematic'});
  assert.equal(match.getEffects().neon_relay,true);
  match.setEffects({neon_relay:false,rolling_score:false});
  assert.equal(match.getEffects().rolling_score,false);
  assert.equal(match.getEffects().neon_relay,false);
  assert.equal(match.getEffects().led_score_rail,true);
  match.setEffects({rolling_score:true});
  assert.equal(match.getEffects().rolling_score,true);
  assert.equal(match.getEffects().neon_relay,false);
  match.destroy();
  const cup=FX.createCup({document:doc,tournamentId:'test-cup-switches',level:'cinematic'});
  cup.setEffects({elimination_fx:false});
  assert.equal(cup.getEffects().elimination_fx,false);
  assert.equal(cup.getEffects().bracket_power,true);
  cup.destroy();
  const local=fs.readFileSync(path.join(root,'local-head-to-head.html'),'utf8');
  const tournament=fs.readFileSync(path.join(root,'tournament.html'),'utf8');
  const studio=fs.readFileSync(path.join(root,'fx-preview.html'),'utf8');
  const arena=fs.readFileSync(path.join(root,'scoringarena.html'),'utf8');
  const online=fs.readFileSync(path.join(root,'match.html'),'utf8');
  const bridge=fs.readFileSync(path.join(root,'fx-match-bridge.js'),'utf8');
  assert.match(local,/fx-live.js/);
  assert.match(tournament,/fx-live.js/);
  assert.match(online,/fx-match-bridge.js/);
  assert.doesNotMatch(local,/id="localFxLevel"/);
  assert.doesNotMatch(tournament,/id="cupFxLevel"/);
  assert.doesNotMatch(online,/id="matchFxLevel"/);
  assert.match(bridge,/neon_relay:false/);
  assert.match(bridge,/level:'cinematic'/);
  assert.match(arena,/href="\.\/fx-preview.html"/);
  for(const name of names)assert.match(studio,new RegExp('data-fx-effect="'+name+'"'));
  assert.match(studio,/studioEffectsAll/);
  assert.match(studio,/studioEffectsNone/);
});

test('Cinematic diagonal wave travels from bottom-left to upper-right and affects contours/text only',async()=>{
  const contacts=[],queue=[],cancelled=new Set();
  let now=0,id=0;
  const make=(name,left,top,right,bottom)=>{
    const active=new Set();
    return {
      isConnected:true,hidden:false,closest:()=>null,
      getBoundingClientRect:()=>({left,top,right,bottom,width:right-left,height:bottom-top}),
      classList:{
        add(cls){active.add(cls);contacts.push({name,cls,at:now,type:'add'})},
        remove(cls){active.delete(cls);contacts.push({name,cls,at:now,type:'remove'})},
        contains(cls){return active.has(cls)}
      }
    };
  };
  const lowerCard=make('lower-card',20,590,260,770);
  const upperCard=make('upper-card',700,20,980,175);
  const lowerText=make('lower-text',50,670,190,730);
  const upperText=make('upper-text',780,55,960,120);
  const doc={
    hidden:false,body:{},documentElement:{clientWidth:1000,clientHeight:800},
    addEventListener(){},removeEventListener(){},querySelector(){return null},
    querySelectorAll(selector){
      return selector.includes('.video-card')?[lowerCard,upperCard]:[lowerText,upperText];
    }
  };
  const win={
    document:doc,innerWidth:1000,innerHeight:800,
    matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},
    setTimeout(fn,ms){const key=++id;queue.push({key,at:now+ms,fn});return key},
    clearTimeout(key){cancelled.add(key)}
  };
  doc.defaultView=win;
  const context={window:win,document:doc,console,Promise,Map,Set,AbortController};
  vm.runInNewContext(fs.readFileSync(path.join(root,'fx-live.js'),'utf8'),context);
  const fx=win.DartArenaFXLive.engine('test',{document:doc,level:'cinematic',
    effects:{neon_relay:false}});
  assert.equal(fx.emit({id:'turn1',type:'turn_changed',matchId:'test',
    previousSlot:'p1',nextSlot:'p2'}),1);
  await Promise.resolve();
  await Promise.resolve();
  while(queue.length){
    queue.sort((a,b)=>a.at-b.at);
    const item=queue.shift();
    if(cancelled.has(item.key))continue;
    now=item.at;item.fn();
  }
  const time=name=>contacts.find(e=>e.type==='add'&&e.name===name)?.at;
  assert.ok(time('lower-card')<time('upper-card'));
  assert.ok(time('lower-text')<time('upper-text'));
  assert.equal(contacts.filter(e=>e.type==='add').length,4);
  assert.equal(contacts.filter(e=>e.type==='remove').length,4);
  assert.ok(contacts.some(e=>e.cls==='da-fx-diagonal-edge'));
  assert.ok(contacts.some(e=>e.cls==='da-fx-diagonal-text'));
  const css=fs.readFileSync(path.join(root,'fx-live.css'),'utf8');
  assert.match(css,/da-fx-diagonal-edge-glow/);
  assert.match(css,/da-fx-diagonal-text-glow/);
  assert.doesNotMatch(css,/da-fx-camera-sweep/);
  fx.destroy();
});
