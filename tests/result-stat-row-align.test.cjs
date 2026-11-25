const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const src=read('shared-results.js');
const start=src.indexOf('  function playerCardHtml('),end=src.indexOf('  function summaryHtml(',start);
a.ok(start>=0&&end>start);
const render=vm.runInNewContext(src.slice(start,end)+'\nplayerCardHtml',{esc:String,playerInitial:n=>n[0],statRowsHtml:()=>'<div class="da-result-statrow">VISITS</div>'});
test('Both player headers reserve identical winner badge space, including no winner',()=>{
 for(const winner_id of ['p1','p2',null]){
   for(const id of ['p1','p2']){
     const card=render(id,'Player',{winner_id},[]);
     const badge=card.match(/<span class="da-result-winner-badge"([^>]*)>VINNER<\/span>/);
     a.ok(badge);
     a.equal(badge[1].includes('visibility:hidden'),winner_id!==id);
     a.equal(badge[1].includes('aria-hidden="true"'),winner_id!==id);
     a.ok(card.indexOf(badge[0])<card.indexOf('da-result-statlist'));
   }
 }
});
test('Both Cricket routes load the aligned shared result renderer',()=>{
 for(const file of ['cricket.html','cricket-seamless-handoff.js'])a.match(read(file),/shared-results\.js\?v=20261125-stat-align1/);
 a.match(read('room.html'),/cricket-seamless-handoff\.js\?v=20261125-stat-align1/);
});
