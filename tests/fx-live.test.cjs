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

test('Cinematic follows the scorecards DOWN and UP with a short arrival pulse',async()=>{
  const previousTop=40, lowerTop=210, width=290, height=155;
  async function run(fromSlot,toSlot,sideBySide=false){
    const contacts=[],added=[],queue=[],cancelled=new Set();
    let time=0,seq=0;
    function node(name,top,left){
      const classes=new Set();
      return {
        isConnected:true,hidden:false,
        getBoundingClientRect:()=>({left,top,right:left+width,bottom:top+height,
          width,height}),
        classList:{
          add(cls){classes.add(cls);contacts.push({name,cls,time,action:'add'})},
          remove(cls){classes.delete(cls);contacts.push({name,cls,time,action:'remove'})},
          contains(cls){return classes.has(cls)}
        }
      };
    }
    const p1=node('p1',previousTop,40);
    const p2=node('p2',sideBySide?previousTop:lowerTop,sideBySide?350:40);
    const cards={p1,p2};
    const body={append(...nodes){added.push(...nodes)}};
    const doc={body,querySelector(selector){return cards[selector.slice(1)]||null},
      querySelectorAll:()=>[],addEventListener(){},removeEventListener(){},hidden:false,
      createElement(tag){
        assert.equal(tag,'span');
        const attrs={},style={setProperty(name,value){this[name]=value}};
        return {style,className:'',setAttribute(k,v){attrs[k]=v},remove(){this.removed=true},
          attrs};
      }};
    const win={document:doc,
      matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},
      setTimeout(fn,ms){const id=++seq;queue.push({id,time:time+ms,fn});return id},
      clearTimeout(id){cancelled.add(id)}
    };
    doc.defaultView=win;
    const context={window:win,document:doc,console,Promise,Map,Set,AbortController};
    vm.runInNewContext(fs.readFileSync(path.join(root,'fx-live.js'),'utf8'),context);
    const fx=win.DartArenaFXLive.engine('demo',{document:doc,level:'cinematic',
      effects:{neon_relay:false},
      targets:{'card:p1':p1,'card:p2':p2}});
    const count=fx.emit({id:'turn-'+fromSlot,type:'turn_changed',matchId:'demo',
      previousSlot:fromSlot,nextSlot:toSlot});
    assert.equal(count,1);
    await Promise.resolve();await Promise.resolve();
    assert.equal(added.length,2,'Only a guide line and a tracer are added');
    const tracer=added.find(n=>n.className.includes('da-fx-turn-tracer'));
    const deltaY=parseFloat(tracer.style['--da-fx-travel-y']);
    const deltaX=parseFloat(tracer.style['--da-fx-travel-x']);
    while(queue.length){
      queue.sort((a,b)=>a.time-b.time);const item=queue.shift();
      if(cancelled.has(item.id))continue;
      time=item.time;item.fn();
    }
    await Promise.resolve();
    assert.equal(added.filter(n=>!n.removed).length,0,'Both overlays are removed');
    const arrival=contacts.find(e=>e.name===toSlot&&e.cls==='da-fx-turn-arrival'&&e.action==='add');
    assert.ok(arrival,'The next player receives a card pulse');
    assert.equal(contacts.some(e=>e.cls.startsWith('da-fx-diagonal')),false);
    assert.equal(contacts.some(e=>e.name===fromSlot&&e.cls==='da-fx-turn-source'),true);
    fx.destroy();
    return {deltaY,deltaX,className:tracer.className,arrivalAt:arrival.time};
  }
  const down=await run('p1','p2');
  assert.ok(down.deltaY>0,'Top player sends the effect downward');
  assert.equal(down.deltaX,0);
  assert.match(down.className,/is-vertical/);
  assert.equal(down.arrivalAt,320);
  const up=await run('p2','p1');
  assert.ok(up.deltaY<0,'Lower player sends the effect upward');
  assert.equal(up.deltaX,0);
  const horizontal=await run('p1','p2',true);
  assert.ok(horizontal.deltaX>0,'Side-by-side cards travel horizontally');
  assert.match(horizontal.className,/is-horizontal/);
  const css=fs.readFileSync(path.join(root,'fx-live.css'),'utf8');
  assert.match(css,/da-fx-turn-travel/);
  assert.match(css,/da-fx-turn-arrival/);
  assert.doesNotMatch(css,/da-fx-diagonal/);
  const preview=fs.readFileSync(path.join(root,'fx-preview.html'),'utf8');
  assert.match(preview,/Turkis lysstripe som går fra forrige spillerkort til neste/);
});
