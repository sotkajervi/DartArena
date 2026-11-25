const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8'),shared=read('shared-results.js');
const extract=(s,x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i);a.ok(i>=0&&j>i);return s.slice(i,j)};
test('JDC provides official scores before mounting, and shared winner ordering applies for both sides and ties',async()=>{
 const c={window:{},num:v=>Number(v||0)};vm.createContext(c);vm.runInContext(read('jdc-shared-result.js'),c);
 vm.runInContext(extract(shared,'  function displayOrder(m)','  function playerInitial('),c);
 const db={from:()=>({select:()=>({eq:async()=>({data:[{player_id:'a',hits:['H','M']},{player_id:'b',hits:['M','H','H']}]})})})};
 for(const [s1,s2,winner] of [[450,700,'b'],[850,150,'a'],[300,300,null]]){
  const m={id:'test',player1_id:'a',player2_id:'b',player1_score:s1,player2_score:s2,winner_id:winner};
  const payload=await c.window.DartArenaResultProviders.jdc(m,db),order=c.orderedScore(m,payload.score);
  a.equal(payload.score.a,s1);a.equal(payload.score.b,s2);
  a.equal(order.left,winner==='b'?s2:s1);a.equal(order.right,winner==='b'?s1:s2);
  a.equal(payload.stats.a[2].value,1);a.equal(payload.stats.b[2].value,2);
 }
 a.match(shared,/payload\?\.score\|\|scoreInfo\(m\)/);
 a.doesNotMatch(read('jdc-shared-result.js'),/setTimeout|querySelector/);
});
test('JDC polish retains official tier grid without overwriting result or removing lobby navigation',()=>{
 const s=extract(read('jdc-finish-polish.js'),'  function polishSharedOverlay(){','  // Start the finishing window');
 a.match(s,/JDC Tierliste/);a.match(s,/value\.style\.color/);
 a.doesNotMatch(s,/da-result-title|da-result-scorebox|daResultLobby|daResultClose|innerHTML/);
 a.match(shared,/id="daResultLobby"/);a.match(shared,/onclick=returnFromResult/);
});
test('JDC and seamless Cricket use current assets; the other common result routes remain intact',()=>{
 const j=read('jdc-match.html');for(const p of ['jdc-shared-result.js','shared-results.js','jdc-finish-polish.js'])a.ok(j.includes(p+'?v=20261125-standardresult1'));
 a.match(read('cricket-seamless-scene.js'),/shared-results\.css\?v=20261125-online-result-labels1/);
 a.match(read('room.html'),/cricket-seamless-scene\.js\?v=20261125-result-css1/);
 for(const p of ['match.html','cricket.html','61-match.html','half-it.html'])a.match(read(p),/src="shared-results\.js\?/);
});
