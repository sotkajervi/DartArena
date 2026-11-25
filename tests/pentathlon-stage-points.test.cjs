const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../pentathlon-2p-engine.js');
const js=fs.readFileSync('pentathlon-room-test.js','utf8');
const start=js.indexOf('function stagePointBreakdown('),end=js.indexOf('function renderStagePointBreakdown(',start);
assert(start>=0&&end>start);
const breakdown=vm.runInNewContext(js.slice(start,end)+'\nstagePointBreakdown');
const plain=x=>JSON.parse(JSON.stringify(x));
function sums(s){for(let p=0;p<2;p++){const rows=breakdown(s,p);assert.ok(rows,'missing breakdown '+s.id+' player '+p);assert.equal(rows.reduce((a,r)=>a+r.points,0),s.pent[p]);}}
test('Actual 501 result: two 180s, 141 checkout, leg win and nine-dart bonus total 20',()=>{
 let s=E.create({name1:'A',name2:'B',starter:0});
 for(const score of [180,100,180,131])s=E.submitX01(s,{score});
 s=E.submitX01(s,{score:141,darts:3,doubleConfirmed:true});
 const last=s.summaries.at(-1);assert.deepEqual(last.pent,[20,3]);sums(last);
 assert.deepEqual(plain(breakdown(last,0)),[
  {label:'180',count:2,points:6},{label:'141 utgang',count:1,points:2},{label:'Vunnet leg',count:1,points:2},{label:'9-pilers leg',count:1,points:10}
 ]);
 assert.deepEqual(plain(breakdown(last,1)),[{label:'131–159',count:1,points:2},{label:'95–130',count:1,points:1}]);
});
test('All seven actual exercise summaries reconcile to the engine totals',()=>{
 let s=E.create({name1:'A',name2:'B',starter:0});
 for(let i=0;i<7;i++){
  let guard=0;
  while(s.status==='playing'){
   assert(++guard<200);
   const c=s.current,p=c.turn;
   if(c.kind==='x01'){
    const r=c.remaining[p];
    const score=r>170?(r-180>=2?180:100):r;
    s=E.submitX01(s,r<=170?{score,darts:3,doubleConfirmed:true}:{score});
   }else if(c.kind==='shanghai'){
    const n=E.currentTarget(s).number;
    s=E.submitShanghaiTurn(s,p===0?[{n,m:1},{n,m:2},{n,m:3}]:n===1?[]:n===2?[{n,m:3},{n,m:3}]:[{n,m:1}]);
   }else if(c.kind==='clock'){
    const n=E.currentTarget(s).number;
    s=E.submitClockTurn(s,[{n,m:2}]);
   }else{
    const t=E.currentTarget(s);
    s=E.submitDart(s,{n:t.number,m:t.mult||1});
   }
  }
  const summary=s.summaries.at(-1);
  sums(summary);
  if(summary.kind==='shanghai'){
   const a=plain(breakdown(summary,0)),b=plain(breakdown(summary,1));
   assert.equal(a.length,9);assert.equal(b.length,9);
   for(let i=0;i<9;i++)assert.deepEqual(a[i],{label:(i+1)+': S · D · T (+6)',count:1,points:12});
   assert.deepEqual(b[0],{label:'1: – · – · –',count:1,points:0});
   assert.deepEqual(b[1],{label:'2: T · T · –',count:1,points:6});
   for(let i=2;i<9;i++)assert.deepEqual(b[i],{label:(i+1)+': S · – · –',count:1,points:1});
   assert.equal(summary.pent[1],13);
   const bad=JSON.parse(JSON.stringify(summary));bad.entries.find(e=>e.player===0).target='TALL 10';
   assert.equal(breakdown(bad,0),null);
  }
  if(summary.kind==='clock')assert.ok(breakdown(summary,0).some(r=>r.label==='Riktig dobbel'));
  s=E.nextStage(s);
 }
 assert.equal(s.status,'finished');assert.equal(s.summaries.length,7);
});
test('Zero points, missing or inconsistent entries never invent scoring',()=>{
 assert.deepEqual(plain(breakdown({kind:'x01',pent:[0,0],entries:[]},0)),[]);
 assert.equal(breakdown({kind:'x01',pent:[10,0],entries:[]},0),null);
 assert.equal(breakdown({kind:'clock',pent:[2,0],entries:[{player:0,bonus:1}]},0),null);
});
test('Existing per-player popup renders breakdown, exercise score and running total',()=>{
 assert.match(js,/renderStagePointBreakdown\(last,i\),\s*node\('small','','Totalt: '/);
 assert.match(fs.readFileSync('room.html','utf8'),/pentathlon-room-test\.js\?v=20261125-standardfinal1/);
});
