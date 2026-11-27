const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Visit=require('../seer-visit.js');
const {preview}=require('../seer-x01-preview.js');
const ctx={window:{}};
vm.runInNewContext(fs.readFileSync(require.resolve('../local-h2h-engine.js'),'utf8'),ctx);
const E=ctx.window.DartArenaLocalH2HEngine;
const state=(remaining=501)=>{const s=E.setup({name1:'A',name2:'B',format:501,bestOf:1,starter:0});s.scores[0]=remaining;return s;};
const dart=(number,base,multiplier=1)=>({darts:number,base_score:base,multiplier,score:base*multiplier,dx:10,dy:20});
const visit=(...darts)=>{const v=new Visit();v.receive({throwId:'a',observations:darts});return v;};
function apply(s,v){const p=preview(s,v);assert.equal(p.status,'ready');return E.submit(s,p.score,p.options);}
test('ordinary visit uses existing engine; same score, turn, stats and undo as manual entry',()=>{
 const s=state(),v=visit(dart(1,20,3),dart(2,20),dart(3,20,2));
 const n=apply(s,v),manual=E.submit(s,120);
 assert.equal(n.scores[0],381);assert.equal(n.turn,1);
 assert.deepEqual(Array.from(n.scores),Array.from(manual.scores));
 assert.equal(E.stats(n,0).average,E.stats(manual,0).average);
 assert.equal(E.undo(n).scores[0],501);assert.equal(s.scores[0],501);
});
test('two-dart double checkout uses actual final dart and engine leg result',()=>{
 const s=state(60),p=preview(s,visit(dart(1,20),dart(2,20,2)));
 assert.equal(p.kind,'checkout');assert.equal(p.options.darts,2);
 const n=E.submit(s,p.score,p.options);assert.equal(n.status,'finished');assert.equal(n.winner,0);assert.equal(n.visits[0].darts,2);
});
test('bull checkout and one-dart checkout',()=>{
 const n=apply(state(50),visit(dart(1,25,2)));assert.equal(n.status,'finished');assert.equal(n.visits[0].darts,1);
});
test('zero remainder on a single is bust, not a falsely confirmed checkout',()=>{
 const n=apply(state(20),visit(dart(1,20)));assert.equal(n.scores[0],20);assert.equal(n.visits[0].bust,true);assert.equal(n.turn,1);
});
test('overshoot or leave one busts; terminal hit cannot be overwritten by later darts',()=>{
 for(const r of [19,21]){const n=apply(state(r),visit(dart(1,20)));assert.equal(n.visits[0].bust,true);}
 assert.equal(preview(state(20),visit(dart(1,20),dart(2,10))).reason,'darts-after-terminal');
});
test('missing or conflicting dart never silently counts as zero; correction resolves it',()=>{
 const s=state(),v=visit(dart(1,20),dart(2,20),dart(2,20,3),dart(3,20));
 assert.equal(preview(s,v).reason,'unresolved-dart');assert.ok(v.correct(2,'T20'));
 assert.equal(preview(s,v).score,100);
 assert.equal(preview(s,visit(dart(1,20),dart(3,20))).reason,'missing-dart');
});
test('detected miss can be included; unconfirmed missing detection is pending',()=>{
 const m={darts:1,score:0,dx:10,dy:20};assert.equal(preview(state(),visit(m,dart(2,20),dart(3,20))).score,40);
 assert.equal(preview(state(),visit({...m,dx:0,dy:0},dart(2,20),dart(3,20))).status,'pending');
});
test('duplicate frame cannot add points; a fourth dart blocks proposal',()=>{
 const v=visit(dart(1,20),dart(2,20),dart(3,20));assert.equal(v.receive({throwId:'a',observations:[dart(1,20,3)]}),false);
 assert.equal(preview(state(),v).score,60);
 v.receive({throwId:'b',observations:[dart(4,20)]});assert.equal(preview(state(),v).reason,'unexpected-dart-number');
});
test('non-501 or inactive matches are blocked',()=>{
 const s=state(),v=visit(dart(1,20),dart(2,20),dart(3,20));
 assert.equal(preview({...s,format:301},v).status,'blocked');
 assert.equal(preview({...s,status:'finished'},v).status,'blocked');
});
