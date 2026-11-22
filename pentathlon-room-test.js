
/* Owner-only launch, both players can score. Uses existing room video unchanged. */
(()=>{
'use strict';
const R=window.DartArenaChallengeRoomState,E=window.DartArenaPentathlon;
if(!R||!E)return;
const $=id=>document.getElementById(id),db=R.client(),challengeId=R.challengeId();
if(!challengeId)return;
let uid=null,challenge=null,record=null,channel=null,poll=null,pending=[],saving=false;
const copy=o=>JSON.parse(JSON.stringify(o));
const clean=o=>{const a=copy(o);delete a.undo;return a};
const game=()=>record?.state,stage=()=>game()?.current;
const player=()=>uid===challenge?.challenger_id?0:1;
const mine=()=>game()?.status==='playing'&&stage()?.turn===player();
const msg=(s,bad=false)=>{const el=$('ptMessage');if(el){el.textContent=s;el.classList.toggle('error',bad)}};
function node(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el}
function setup(){
 const start=node('button','outline','Pentathlon Online · TEST');
 start.id='ptStart';start.hidden=true;start.onclick=startGame;
 document.querySelector('.room-head-copy')?.append(start);

 const panel=node('section','da-penta penta-shell pt-panel');
 panel.id='ptPanel';panel.hidden=true;
 panel.innerHTML=`
  <div class="penta-top-bar">
    <div id="ptProgressTitle">ØVELSE 1 AV 7</div>
    <div class="penta-top-actions">
      <button id="ptRefresh" type="button" class="outline">Oppdater</button>
      <button id="ptUndo" type="button" class="outline">↶ Angre</button>
    </div>
  </div>
  <div id="ptProgress" class="penta-progress" aria-label="Pentathlon-øvelser"></div>
  <div class="penta-layout">
    <div class="penta-primary">
      <section class="penta-card penta-active">
        <div class="penta-stage-header">
          <div><span id="ptCounter" class="penta-eyebrow">ØVELSE 1</span>
            <h2 id="ptStage">501 · Leg 1</h2><p id="ptDescription">Dobbel ut</p></div>
          <span id="ptTurn" class="penta-stage-tag">KASTER NÅ</span>
        </div>
        <div id="ptBoard" class="penta-x01-board">
          <div class="local-board" id="ptLocalBoard">
            <article id="ptCard0" class="local-player">
              <div class="local-player-top"><small>SPILLER 1</small><span class="local-current-marker">Kaster nå</span></div>
              <h2 class="local-match-name"><span id="ptName0">Spiller 1</span></h2>
              <div class="local-score-band">
                <div class="local-live-darts"><b id="ptDarts0">0</b><span>PILER</span></div>
                <div class="local-score" id="ptScore0">501</div>
                <div class="local-avg"><b id="ptAverage0">–</b><span id="ptAverageLabel0">AVG</span></div>
              </div>
              <div class="local-leg-label" id="ptDetail0">0 LEGS</div>
            </article>
            <article id="ptCard1" class="local-player">
              <div class="local-player-top"><small>SPILLER 2</small><span class="local-current-marker">Kaster nå</span></div>
              <h2 class="local-match-name"><span id="ptName1">Spiller 2</span></h2>
              <div class="local-score-band">
                <div class="local-live-darts"><b id="ptDarts1">0</b><span>PILER</span></div>
                <div class="local-score" id="ptScore1">501</div>
                <div class="local-avg"><b id="ptAverage1">–</b><span id="ptAverageLabel1">AVG</span></div>
              </div>
              <div class="local-leg-label" id="ptDetail1">0 LEGS</div>
            </article>
          </div>
        </div>
        <div id="ptX01" class="pt-score-entry">
          <div class="penta-target"><div><span>NESTE MÅL</span><strong id="ptTarget">REST 501</strong></div><span id="ptDartsRemaining">REGISTRER KASTESUM</span></div>
          <div class="penta-throw-entry card local-entry-card">
            <div class="local-turn" id="ptX01Turn">Spiller 1 kaster</div>
            <div class="local-score-form">
              <label for="ptInput">Score for tre piler</label>
              <div class="local-entry-controls">
                <input id="ptInput" type="text" maxlength="3" inputmode="numeric" autocomplete="off" placeholder="0–180">
                <button type="button" class="primary" id="ptXSubmit">Registrer / Enter</button>
              </div>
            </div>
          </div>
        </div>
        <div id="ptSpecial" class="penta-shanghai-game penta-special-online" hidden>
          <section class="card local-entry-card special-entry penta-jdc-entry">
            <div class="local-turn" id="ptSpecialTurn">Spiller 1 kaster</div>
            <p class="muted compact penta-jdc-help">Registrer treffene og trykk Enter. Resten av pilene blir bom.</p>
            <div class="special-target penta-jdc-target">
              <small id="ptSpecialPhase">SHANGHAI</small><strong id="ptSpecialTarget">1</strong><span id="ptSpecialRemaining">3 piler denne turen</span>
            </div>
            <div id="ptChoices" class="special-choice-row penta-jdc-choices"></div>
            <div class="special-darts penta-jdc-pending"><span>Registrert:</span><div id="ptPending">–</div></div>
            <div class="special-actions penta-jdc-actions">
              <button id="ptRemove" type="button" class="outline">Fjern siste · Backspace</button>
              <button id="ptSSubmit" type="button" class="primary">Registrer · Enter</button>
            </div>
          </section>
        </div>
        <p id="ptMessage" class="penta-feedback" role="status" aria-live="polite"></p>
        <div class="penta-recent"><span class="penta-eyebrow">SISTE REGISTRERINGER</span><div id="ptLog"></div></div>
      </section>
      <section id="ptReview" class="penta-card penta-review" hidden>
        <span class="penta-eyebrow">ØVELSEN ER FULLFØRT</span>
        <h2 id="ptReviewTitle">Resultat</h2>
        <p id="ptReviewCaption"></p>
        <div id="ptReviewDetails" class="penta-review-details"></div>
        <button id="ptAdvance" type="button" class="penta-main-btn">NESTE ØVELSE →</button>
      </section>
      <section id="ptFinished" class="penta-card penta-finish" hidden>
        <div class="penta-finish-kicker">DARTARENA · PENTATHLON</div>
        <div class="penta-finish-emblem" aria-hidden="true">♛</div>
        <span class="penta-eyebrow">ALLE 7 ØVELSER FULLFØRT</span>
        <h2 id="ptWinner">Pentathlon ferdig!</h2>
        <p id="ptFinalText" class="penta-finish-subtitle"></p>
        <div id="ptFinalScore" class="penta-finish-score"></div>
      </section>
    </div>
    <aside class="penta-side">
      <section class="penta-card penta-results">
        <span class="penta-eyebrow">KONTROLLKORT</span><h2>Resultatliste</h2>
        <p class="penta-hint">Poeng i hver øvelse og samlet total.</p>
        <div id="ptResultsTable"></div>
      </section>
      <section class="penta-card penta-rules">
        <span class="penta-eyebrow">PENTATHLON-POENG</span><h2>Hvordan telles det?</h2>
        <div class="penta-rule-line"><span>95–130 poeng på 3 piler</span><strong>+1</strong></div>
        <div class="penta-rule-line"><span>131–159 poeng</span><strong>+2</strong></div>
        <div class="penta-rule-line"><span>160–180 poeng</span><strong>+3</strong></div>
        <div class="penta-rule-line"><span>Vunnet X01-leg</span><strong>+2</strong></div>
        <div class="penta-rule-line"><span>Shanghai S/D/T</span><strong>1 / 2 / 3</strong></div>
        <div class="penta-rule-line"><span>Klokka · riktig dobbel</span><strong>+2</strong></div>
      </section>
      <section class="penta-card penta-online-note">
        <span class="penta-eyebrow">ONLINE TEST</span>
        <p class="penta-hint">Begge kontoene deler samme kampstatus. Kamera og lyd kommer fra det eksisterende venterommet. Resultatet teller ikke i karriere eller ranking.</p>
      </section>
    </aside>
  </div>`;
 $('matchView')?.append(panel);
 $('ptRefresh').onclick=refresh;
 $('ptXSubmit').onclick=submitX01;
 $('ptSSubmit').onclick=submitSpecial;
 $('ptRemove').onclick=()=>{pending.pop();render()};
 $('ptAdvance').onclick=advance;
 $('ptUndo').onclick=undo;
 $('ptInput').onkeydown=ev=>{if(ev.key==='Enter'){ev.preventDefault();submitX01()}};
 document.addEventListener('keydown',ev=>{
   if(!record||saving||ev.repeat||ev.ctrlKey||ev.altKey||ev.metaKey||ev.isComposing)return;
   if(['INPUT','TEXTAREA','SELECT'].includes(ev.target?.tagName)||ev.target?.isContentEditable)return;
   if(ev.key==='Enter'){
     if(game().status==='review'){ev.preventDefault();advance()}
     else if(mine()){ev.preventDefault();stage().kind==='x01'?$('ptInput').focus():submitSpecial()}
   }else if(ev.key==='Backspace'&&pending.length){ev.preventDefault();pending.pop();render()}
   else if(mine()&&stage().kind!=='x01'){
     const btn=[...$('ptChoices').querySelectorAll('button')].find(b=>b.dataset.key===ev.key);
     if(btn){ev.preventDefault();btn.click()}
   }
 });
}
function choice(key,label,dart){
 const b=node('button','outline',label);b.type='button';b.dataset.key=key;
 const c=stage();b.disabled=saving||!mine()||pending.length>=Math.min(3-c.pending.length,c.kind==='clock'?42-c.used[c.turn]:3);
 b.onclick=()=>{if(b.disabled)return;pending.push(dart);render()};
 $('ptChoices').append(b);
}
function actions(){
 const c=stage(),kind=c.kind,host=$('ptChoices');host.replaceChildren();
 if(kind==='shanghai'){
   const n=E.currentTarget(game()).number;
   choice('1','SINGLE · 1',{n,m:1});choice('2','DOUBLE · 2',{n,m:2});choice('3','TRIPLE · 3',{n,m:3});
 }else if(kind==='clock'){
   let n=c.clockTarget[c.turn];for(const d of pending)if(d.n===n&&d.m===2)n++;
   if(n<=20)choice('2','TREFF D'+n+' · 2',{n,m:2});
 }else if(kind==='half'){
   const t=E.currentTarget(game());
   for(const m of t.mult?[t.mult]:[1,2,3]){
     choice(String(m),(m===1?'SINGLE':m===2?'DOUBLE':'TRIPLE')+' · '+m,{n:t.number,m});
   }
 }
 if(!(kind==='clock'&&(c.clockTarget[c.turn]>20||pending.some(d=>d.n===20&&d.m===2))))
   choice('0','BOM · 0',{n:0,m:0});
}
function render(){
 if(!record)return;
 const panel=$('ptPanel'),s=game(),c=s.current;
 panel.hidden=false;document.body.classList.add('pt-active');
 $('ptStart').hidden=true;
 const live=s.status==='playing',review=s.status==='review',finished=s.status==='finished';
 const st=E.STAGES[s.stageIndex];
 $('ptProgressTitle').textContent=finished?'PENTATHLON FULLFØRT':'ØVELSE '+(s.stageIndex+1)+' AV '+E.STAGES.length;
 const progress=$('ptProgress');progress.replaceChildren();
 E.STAGES.forEach((item,i)=>{
   const step=node('div',s.summaries[i]?'done':i===s.stageIndex?'active':'',item.label);
   step.title=item.caption||item.label;progress.append(step);
 });
 $('ptCounter').textContent=finished?'FULLFØRT':'ØVELSE '+(s.stageIndex+1);
 $('ptStage').textContent=st?.label||'Pentathlon';
 $('ptDescription').textContent=st?.caption||'';
 $('ptTurn').textContent=live?s.players[c.turn]+' kaster':review?'ØVELSE FULLFØRT':'KAMP FULLFØRT';
 for(let i=0;i<2;i++){
   const entries=c.entries.filter(e=>e.player===i);
   const scored=entries.filter(e=>e.type==='visit').reduce((sum,e)=>sum+Number(e.score||0),0);
   const visits=Math.ceil(c.used[i]/3);
   const x01=c.kind==='x01';
   const avg=x01?(c.used[i]?scored*3/c.used[i]:0):(visits?c.pent[i]/visits:0);
   $('ptName'+i).textContent=s.players[i];
   $('ptScore'+i).textContent=x01?c.remaining[i]:c.kind==='half'?c.halfScores[i]:c.pent[i];
   $('ptDarts'+i).textContent=c.used[i];
   $('ptAverage'+i).textContent=avg.toFixed(2);
   $('ptAverageLabel'+i).textContent=x01?'AVG':'P/R';
   $('ptDetail'+i).textContent=x01?(c.win===i?'1':'0')+' LEGS · +'+c.pent[i]+' PENTATHLON-POENG':
      c.kind==='half'?c.pent[i]+' PENTATHLON-POENG': 'PENTATHLON-POENG';
   $('ptCard'+i).classList.toggle('active',live&&c.turn===i);
 }
 $('ptBoard').hidden=finished;
 $('ptX01').hidden=!live||c.kind!=='x01';
 $('ptSpecial').hidden=!live||c.kind==='x01';
 $('ptReview').hidden=!review;
 $('ptFinished').hidden=!finished;
 const turnName=s.players[c.turn]||'Spiller';
 if(live&&c.kind==='x01'){
   $('ptTarget').textContent=E.currentTarget(s)?.label||'';
   $('ptX01Turn').textContent=turnName+' kaster'+(mine()?' · din tur':' · vent');
 }
 if(live&&c.kind!=='x01'){
   actions();
   $('ptSpecialTurn').textContent=turnName+' kaster'+(mine()?' · din tur':' · vent');
   const target=E.currentTarget(s);
   let label=target?.label||'';
   if(c.kind==='clock'){
     let n=c.clockTarget[c.turn];for(const dart of pending)if(dart.n===n&&dart.m===2)n++;
     label=n>20?'D20 FULLFØRT':'D'+n;
   }
   $('ptSpecialTarget').textContent=label;
   $('ptSpecialPhase').textContent=c.kind==='shanghai'?'SHANGHAI · MÅL '+(target?.number||1)+'/9':
     c.kind==='clock'?'KLOKKA · D1–D20':'HALF-IT';
   const remain=Math.max(0,Math.min(3-c.pending.length,c.kind==='clock'?42-c.used[c.turn]:3)-pending.length);
   $('ptSpecialRemaining').textContent=remain+' piler denne turen';
   $('ptPending').textContent=[...c.pending,...pending].map(E.labelDart).join(' · ')||'–';
   $('ptRemove').disabled=saving||!mine()||!pending.length;
   $('ptSSubmit').disabled=saving||!mine();
 }
 $('ptInput').disabled=saving||!mine();
 $('ptXSubmit').disabled=saving||!mine();
 $('ptAdvance').disabled=saving;
 $('ptAdvance').textContent=s.stageIndex===6?'SE SLUTTRESULTAT →':'NESTE ØVELSE →';
 $('ptUndo').disabled=saving||record.last_actor!==uid||!(live||review)||!(s.undo?.length);
 if(review){
   const last=s.summaries.at(-1);
   $('ptReviewTitle').textContent=(last?.label||'Øvelse')+' · Resultat';
   $('ptReviewCaption').textContent='Poengene er lagt til den samlede stillingen.';
   $('ptReviewDetails').replaceChildren();
   for(let i=0;i<2;i++){
     const card=node('div');card.append(node('h3','',s.players[i]),node('strong','',(last?.pent[i]||0)+' poeng'),
       node('small','','Totalt: '+(last?.after[i]||0)+' Pentathlon-poeng'));
     $('ptReviewDetails').append(card);
   }
 }
 if(finished){
   const victor=s.total[0]===s.total[1]?'Uavgjort':s.players[s.total[0]>s.total[1]?0:1]+' vant';
   $('ptWinner').textContent=victor;
   $('ptFinalText').textContent='Endelig resultat etter sju øvelser';
   $('ptFinalScore').textContent=s.total[0]+' – '+s.total[1];
 }
 const table=$('ptResultsTable');table.replaceChildren();
 const t=node('table','penta-table'),head=node('thead'),header=node('tr');
 ['ØVELSE',s.players[0],s.players[1]].forEach(x=>header.append(node('th','',x)));
 head.append(header);t.append(head);
 const tbody=node('tbody');
 E.STAGES.forEach((item,i)=>{
   const entry=s.summaries[i],tr=node('tr',entry?'':'future');
   tr.append(node('td','',(i+1)+'. '+item.label),node('td','',entry?entry.pent[0]:'–'),node('td','',entry?entry.pent[1]:'–'));
   tbody.append(tr);
 });
 const total=node('tr');
 total.append(node('td','','TOTAL'),node('td','',s.total[0]+(live?c.pent[0]:0)),node('td','',s.total[1]+(live?c.pent[1]:0)));
 tbody.append(total);t.append(tbody);table.append(t);
 const log=$('ptLog');log.replaceChildren();
 const entries=c.entries.slice(-9).reverse();
 if(!entries.length)log.append(node('span','penta-hint','Ingen kast ennå.'));
 for(const entry of entries){
   const info=entry.type==='visit'?(entry.bust?'BUST':entry.score)+' · +'+entry.bonus+' P':
     entry.hit+' → '+entry.target+' · +'+entry.bonus+' P';
   log.append(node('span','penta-recent-item',s.players[entry.player]+': '+info));
 }
}
async function refresh(){
 if(!uid||!challenge)return;
 const {data,error}=await db.from('pentathlon_room_tests').select('*').eq('challenge_id',challengeId).maybeSingle();
 if(error){msg('Synkronisering feilet: '+error.message,true);return}
 if(data&&(!record||data.version>record.version)){
   record=data;pending=[];render();
 }else if(!data&&record){
   record=null;document.body.classList.remove('pt-active');$('ptPanel').hidden=true;
 }
}
async function broadcast(){
 await channel?.send({type:'broadcast',event:'changed',payload:{from:uid}}).catch(()=>{});
}
async function startGame(){
 if(saving||record)return;saving=true;$('ptStart').disabled=true;
 try{
   const {data:p,error:pe}=await db.from('profiles').select('id,username').in('id',[challenge.challenger_id,challenge.challenged_id]);
   if(pe)throw pe;
   const name=id=>p?.find(x=>x.id===id)?.username||'Spiller';
   const seed=E.create({name1:name(challenge.challenger_id),name2:name(challenge.challenged_id),starter:Math.random()<.5?0:1});
   const {data,error}=await db.rpc('start_pentathlon_room_test',{p_challenge_id:challengeId,p_state:seed});
   if(error)throw error;record=data;pending=[];render();msg('Test startet. Ingen karriere- eller rankingstatistikk.');
   await broadcast();
 }catch(e){msg(e.message||String(e),true)}
 finally{saving=false;$('ptStart').disabled=false;if(record)render()}
}
async function save(action,next){
 if(!record||saving)return;
 saving=true;const version=record.version;render();
 try{
   const {data,error}=await db.rpc('apply_pentathlon_room_test',{
     p_challenge_id:challengeId,p_expected_version:version,p_action:action,p_next:next
   });
   if(error)throw error;
   record=data;pending=[];$('ptInput').value='';render();msg('Registrert.');await broadcast();
 }catch(e){msg('Kunne ikke lagre: '+(e.message||e)+'. Henter ny kampstatus.',true);await refresh()}
 finally{saving=false;if(record)render()}
}
function turnState(next){const n=clean(next);n.undo=[clean(game())];return n}
function submitX01(){
 if(!mine()||saving||stage().kind!=='x01')return;
 const raw=$('ptInput').value.trim(),n=Number(raw);
 if(!raw||!E.isScore(n)){msg('Skriv score fra 0 til 180.',true);return}
 let darts=3,confirmed=false;
 if(n===stage().remaining[stage().turn]){
   const answer=prompt('Checkout: antall piler (1, 2 eller 3)?','2');
   if(answer===null)return;darts=Number(answer);confirmed=true;
 }
 try{save('turn',turnState(E.submitX01(game(),{score:n,darts,doubleConfirmed:confirmed})))}
 catch(e){msg(e.message||String(e),true)}
}
function submitSpecial(){
 if(!mine()||saving||stage().kind==='x01')return;
 try{
   let next=game(),c=stage();
   if(c.kind==='shanghai')next=E.submitShanghaiTurn(next,pending);
   else if(c.kind==='clock')next=E.submitClockTurn(next,pending);
   else{
     const darts=[...pending];while(darts.length<3-c.pending.length)darts.push({n:0,m:0});
     for(const dart of darts)next=E.submitDart(next,dart);
   }
   save('turn',turnState(next));
 }catch(e){msg(e.message||String(e),true)}
}
function advance(){
 if(game()?.status!=='review'||saving)return;
 try{const n=clean(E.nextStage(game()));n.undo=[];save('advance',n)}
 catch(e){msg(e.message||String(e),true)}
}
function undo(){
 if(!record||record.last_actor!==uid||saving||!['playing','review'].includes(game()?.status))return;
 try{const n=clean(E.undo(game()));n.undo=[];save('undo',n)}
 catch(e){msg(e.message||String(e),true)}
}
async function boot(){
 setup();
 for(let i=0;i<100&&!R.user();i++)await new Promise(resolve=>setTimeout(resolve,100));
 uid=R.user();if(!uid)return;
 const {data,error}=await db.from('challenges').select('id,challenger_id,challenged_id,status').eq('id',challengeId).maybeSingle();
 if(error||!data||data.status!=='room'||![data.challenger_id,data.challenged_id].includes(uid))return;
 challenge=data;
 const {data:isOwner}=await db.rpc('is_owner');
 $('ptStart').hidden=!isOwner;
 channel=db.channel('pentathlon-room-test-'+challengeId)
  .on('postgres_changes',{event:'*',schema:'public',table:'pentathlon_room_tests',filter:'challenge_id=eq.'+challengeId},()=>refresh())
  .on('broadcast',{event:'changed'},()=>refresh())
  .subscribe();
 await refresh();
 poll=setInterval(()=>{if(record&&!document.hidden)refresh()},6000);
}
window.addEventListener('pagehide',()=>{clearInterval(poll);if(channel)db.removeChannel(channel).catch(()=>{})},{once:true});
boot().catch(e=>console.warn('Pentathlon room test failed',e));
})();