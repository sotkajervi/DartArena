const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('half-it-round-correction.js','utf8'),ctx={};vm.createContext(ctx);vm.runInContext(source.slice(0,source.indexOf('/* Both online variants')),ctx);
const get=(r,p,t)=>JSON.parse(JSON.stringify(ctx.halfCorrectionDarts(r,p,t)));
const board=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const color=d=>d.n===25?(d.mult===1?'green':'red'):d.mult===1?(board.indexOf(d.n)%2===0?'black':'white'):(board.indexOf(d.n)%2===0?'red':'green');
const val=d=>d.n*d.mult;
const darts=[{n:0,mult:0}];for(let n=1;n<=20;n++)for(let mult=1;mult<=3;mult++)darts.push({n,mult});darts.push({n:25,mult:1},{n:25,mult:2});
function evaluate(r,ds,t){
 const sum=ds.reduce((s,d)=>s+val(d),0),non=ds.filter(d=>d.n!==0);
 if(r.type==='exact')return t===undefined?(non.length===3&&sum===41?41:0):((t===121?sum>=121:sum===t)?sum:0);
 if(r.type==='same'||r.type==='different')return non.length===3&&new Set(ds.map(color)).size===(r.type==='same'?1:3)?sum:0;
 return ds.filter(d=>r.type==='number'?d.n===r.target:r.type==='double'?d.mult===2:r.type==='treble'?d.mult===3:d.n===25).reduce((s,d)=>s+val(d),0);
}
test('Score correction matches all reachable round totals and rejects impossible ones',()=>{
 const cases=[...Array.from({length:8},(_,i)=>[{type:'number',target:i+13}]),...['double','treble','bull','same','different'].map(type=>[{type}]),[{type:'exact',target:41}],[{type:'exact'},65],[{type:'exact'},121]];
 for(const [r,t] of cases){
  const possible=new Set([0]);
  for(let i=0;i<darts.length;i++)for(let j=i;j<darts.length;j++)for(let k=j;k<darts.length;k++)possible.add(evaluate(r,[darts[i],darts[j],darts[k]],t));
  for(let p=0;p<=180;p++){const ds=get(r,p,t);a.equal(!!ds,possible.has(p),JSON.stringify({r,t,p}));if(ds){a.equal(ds.length,3);a.equal(evaluate(r,ds,t),p);if(t!==undefined)a.equal(ds[0].exact_target,t)}}
 }
 a.equal(get({type:'double'},181),null);a.equal(get({type:'double'},-1),null);a.equal(get({type:'double'},1.5),null);
});
test('Correction dialog uses a round score, not total or per-dart dropdowns',()=>{
 a.match(source,/scoreInput\.value=String\(v\.success\?v\.round_points:0\)/);
 a.match(source,/0 = halvering/);a.doesNotMatch(source,/selects\.push/);
 a.match(source,/p_expected_darts:editing\.darts,p_darts:darts/);
 a.match(source,/unchanged\?editing\.darts:halfCorrectionDarts/);
});
