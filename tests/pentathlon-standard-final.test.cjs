const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const E=require('../pentathlon-2p-engine.js'),src=fs.readFileSync('pentathlon-room-test.js','utf8');
const extract=(x,y)=>{const i=src.indexOf(x),j=src.indexOf(y,i);a.ok(i>=0&&j>i);return src.slice(i,j)};
const code=extract('function fitPentathlonFinal(){','function render(){').replace(/window.addEventListener\('resize',.*?;\n/,'');
function fixture(){
 let s=E.create({name1:'Player A',name2:'Player B',starter:0});
 for(let i=0;i<7;i++){
  let guard=0;while(s.status==='playing'){
   a.ok(++guard<250);const c=s.current,p=c.turn;
   if(c.kind==='x01'){const r=c.remaining[p],score=r>170?(r-180>=2?180:100):r;s=E.submitX01(s,r<=170?{score,darts:3,doubleConfirmed:true}:{score})}
   else if(c.kind==='shanghai'){const n=E.currentTarget(s).number;s=E.submitShanghaiTurn(s,[{n,m:1},{n,m:2},{n,m:3}])}
   else if(c.kind==='clock'){const n=E.currentTarget(s).number;s=E.submitClockTurn(s,[{n,m:2}])}
   else{const t=E.currentTarget(s);s=E.submitDart(s,{n:t.number,m:t.mult||1})}
  }s=E.nextStage(s);
 }
 a.equal(s.status,'finished');return s;
}
test('Live and archived Pentathlon final use one X01 surface, ordered scores, seven exercises and no clipping',async()=>{
 const browser=await chromium.launch({headless:true});const s=fixture();
 try{
 for(const viewport of [{width:1280,height:720},{width:390,height:844}]){
  for(const archived of [false,true]){
   const p=await browser.newPage({viewport});
   await p.setContent('<body class="pt-online-test"><main><span class="video-name">Live name</span></main><div id="ptStageOverlay" class="'+(archived?'da-result-overlay':'da-dialog-layer')+'"><div class="da-dialog-backdrop"></div><section class="pt-stage-modal '+(archived?'da-result-card da-result-card--match':'da-dialog-card')+'"><h2 class="pt-brand-heading">PENTATHLON</h2><div id="ptFinished"><small>ALL DONE</small><h3 id="ptWinner"></h3><p id="ptFinalText">Endelig resultat etter sju øvelser</p><strong id="ptFinalScore"></strong><div id="ptFinalDetails" class="pt-final-details"></div></div><div class="da-dialog-actions"><button id="'+(archived?'ptFinishedLobby':'ptCloseStageModal')+'">Lukk</button></div></section></div></body>');
   for(const f of ['style.css','shared-results.css','dartarena-dialog.css','pentathlon-room-test.css'])await p.addStyleTag({content:fs.readFileSync(f,'utf8')});
   await p.evaluate(({code,stages,s})=>{const $=id=>document.getElementById(id),E={STAGES:stages};function node(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el}eval(code+'\npreparePentathlonFinalSurface();renderPentathlonWinner(s.total[0]===s.total[1]?"Uavgjort":s.players[s.total[0]>s.total[1]?0:1]+" vant",s.total[0]!==s.total[1]);renderPentathlonFinalScore(s);renderFinalPentathlon(s);fitPentathlonFinal();')},{code,stages:E.STAGES,s});
   const r=await p.evaluate(()=>{const card=document.querySelector('.pt-stage-modal'),b=card.getBoundingClientRect();return{score:document.querySelector('#ptFinalScore').textContent,names:[...document.querySelectorAll('.pt-final-player-name')].map(e=>e.textContent),rows:document.querySelectorAll('.pt-final-table tbody tr').length,button:document.querySelector('.da-result-actions button').textContent,visible:getComputedStyle(document.querySelector('.video-name')).visibility,rect:[b.left,b.top,b.right,b.bottom],width:innerWidth,height:innerHeight,cards:document.querySelectorAll('.da-result-card').length}});
   a.equal(r.cards,1);a.equal(r.rows,8);a.equal(r.button,'Til hovedlobby');a.equal(r.visible,'hidden');a.equal(r.score,s.total.slice().sort((a,b)=>b-a).join('–'));
   a.equal(r.names[0],s.players[s.total[1]>s.total[0]?1:0]);a.ok(r.rect[0]>=-1&&r.rect[1]>=-1&&r.rect[2]<=r.width+1&&r.rect[3]<=r.height+1,JSON.stringify(r));await p.close();
  }
 }
 }finally{await browser.close()}
});
