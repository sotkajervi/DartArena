const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Guard=require('../seer-turn-guard.js');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../local-h2h-engine.js'),'utf8'),ctx);
const E=ctx.window.DartArenaLocalH2HEngine;
const setup=()=>E.setup({name1:'A',name2:'B',format:501,bestOf:1,starter:0});
const arm=(g,s,epoch)=>g.begin(s,{sourceEpoch:epoch,boardClearConfirmed:true});
const frame=(sourceEpoch,throwId='a')=>({sourceEpoch,throwId,observations:[1,2,3].map(darts=>({darts,base_score:20,multiplier:1,score:20,dx:12,dy:20}))});
test('one confirmation per armed visit, then require new clear boundary for next player',()=>{
 const s=setup(),g=new Guard();assert.equal(g.mode,'manual');assert.ok(arm(g,s,'turn1'));
 assert.ok(g.receive(s,frame('turn1')));const p=g.proposal(s);assert.equal(p.status,'ready');
 const n=g.confirm(s,p,E);assert.equal(n.scores[0],441);assert.equal(n.turn,1);
 assert.equal(g.confirm(s,p,E),null);assert.equal(g.receive(n,frame('turn1','b')),false);
 assert.equal(arm(g,n,'turn1'),false);assert.ok(arm(g,n,'turn2'));
 assert.equal(g.receive(n,frame('turn1','late-unique')),false);
 assert.equal(g.receive(n,frame('turn2','a')),false);
 assert.equal(g.receive(n,frame(undefined,'untagged')),false);
 assert.ok(g.receive(n,frame('turn2','b')));
 const end=g.confirm(n,g.proposal(n),E);assert.equal(end.scores[1],441);
 assert.equal(end.scores[0],441);
});
test('manual fallback leaves existing score engine intact and rejects stale proposals',()=>{
 const s=setup(),g=new Guard();arm(g,s,'one');g.receive(s,frame('one'));
 const p=g.proposal(s);g.manual();const n=E.submit(s,100);
 assert.equal(g.confirm(s,p,E),null);assert.equal(g.receive(n,frame('one','b')),false);
 assert.equal(n.scores[0],401);assert.ok(arm(g,n,'two'));
 assert.equal(g.confirm(n,p,E),null);
});
test('replacement state invalidates pending turn even when same player returns after undo',()=>{
 const s=setup(),g=new Guard();arm(g,s,'one');g.receive(s,frame('one'));const p=g.proposal(s);
 const n=E.undo(E.submit(s,60));assert.equal(n.turn,s.turn);
 assert.equal(g.confirm(n,p,E),null);assert.equal(g.mode,'manual');
});
test('corrected or updated observation requires refreshed proposal',()=>{
 const s=setup(),g=new Guard();arm(g,s,'one');g.receive(s,frame('one'));
 const p=g.proposal(s);assert.ok(g.correct(s,1,'T20'));
 assert.equal(g.confirm(s,p,E),null);const q=g.proposal(s);assert.equal(q.score,100);
 const n=g.confirm(s,{...q,score:180,options:{bust:true}},E);assert.equal(n.scores[0],401);
});
test('cannot arm without clear acknowledgement or new source boundary',()=>{
 const s=setup(),g=new Guard();assert.equal(g.begin(s,{sourceEpoch:'one'}),false);
 assert.equal(g.begin(s,{boardClearConfirmed:true}),false);
 assert.ok(arm(g,s,'one'));g.manual();assert.equal(arm(g,s,'one'),false);
});
test('pending, malformed or failed submissions never retry automatically',()=>{
 const s=setup(),g=new Guard();arm(g,s,'one');
 assert.equal(g.receive(s,{sourceEpoch:'one',throwId:'x',observations:[null]}),false);
 assert.equal(g.confirm(s,g.proposal(s),E),null);
 assert.ok(g.receive(s,frame('one')));const p=g.proposal(s);
 assert.throws(()=>g.confirm(s,p,{submit(){throw Error('simulated failure')}}));
 assert.equal(g.confirm(s,p,E),null);assert.equal(g.mode,'manual');
});
test('browser classic scripts resolve lexical SeerVisit without changing existing owner page',()=>{
 const browser=vm.createContext({});vm.runInContext('window=globalThis',browser);
 for(const path of ['../seer-visit.js','../seer-x01-preview.js','../seer-turn-guard.js','../local-h2h-engine.js']){
  vm.runInContext(fs.readFileSync(require.resolve(path),'utf8'),browser);
 }
 const result=vm.runInContext(`(()=>{const E=DartArenaLocalH2HEngine,g=new DartArenaSeerTurnGuard(),s=E.setup({name1:'A',name2:'B',format:501,bestOf:1,starter:0});g.begin(s,{sourceEpoch:'a',boardClearConfirmed:true});g.receive(s,{sourceEpoch:'a',throwId:'a',observations:[1,2,3].map(darts=>({darts,base_score:20,multiplier:1,score:20,dx:1,dy:2}))});return g.confirm(s,g.proposal(s),E).scores[0]})()`,browser);
 assert.equal(result,441);
});
