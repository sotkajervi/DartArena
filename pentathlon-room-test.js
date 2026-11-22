
/* Owner-only launch, both players can score. Uses existing room video unchanged. */
(()=>{
'use strict';
const R=window.DartArenaChallengeRoomState,E=window.DartArenaPentathlon;
if(!R||!E)return;
const $=id=>document.getElementById(id),db=R.client(),challengeId=R.challengeId();
if(!challengeId)return;
let uid=null,challenge=null,record=null,channel=null,poll=null,pending=[],saving=false,lastInputTurn=null;
const copy=o=>JSON.parse(JSON.stringify(o));
const clean=o=>{const a=copy(o);delete a.undo;return a};
const game=()=>record?.state,stage=()=>game()?.current;
const player=()=>uid===challenge?.challenger_id?0:1;
const mine=()=>game()?.status==='playing'&&stage()?.turn===player();
const msg=(s,bad=false)=>{const el=$('ptMessage');if(el){el.textContent=s;el.classList.toggle('error',bad)}};
function node(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el}
async function setup(){
 const launch=node('button','outline','Pentathlon Online · TEST');launch.id='ptStart';launch.hidden=true;launch.type='button';launch.onclick=startGame;
 document.querySelector('.room-head-copy')?.append(launch);
 // Reuse the original match.html X01 score-card/sidebar markup. Nothing from match.js is executed.
 const response=await fetch(new URL('match.html',location.href),{cache:'no-store'});
 if(!response.ok)throw Error('X01-mal ikke tilgjengelig: '+response.status);
 const doc=new DOMParser().parseFromString(await response.text(),'text/html');
 const original=doc.querySelector('#matchView .match-grid');
 if(!original||!original.querySelector('.score-card')||!original.querySelector('.match-info'))throw Error('X01-scorekort mangler');
 const panel=document.importNode(original,true);panel.id='ptPanel';panel.hidden=true;
 const map={matchP1:'ptCard0',matchP2:'ptCard1',matchName1:'ptName0',matchName2:'ptName1',matchScore1:'ptScore0',matchScore2:'ptScore1',matchLegs1:'ptDetail0',matchLegs2:'ptDetail1',matchScoreInput:'ptInput',matchScoreBtn:'ptXSubmit',matchMessage:'ptMessage',matchStatus:'ptStatus',turnText:'ptTurn'};
 for(const [from,to] of Object.entries(map)){const el=panel.querySelector('#'+from);if(!el)throw Error('X01-felt mangler: '+from);el.id=to;}
 for(let i=0;i<2;i++){const sets=panel.querySelector('#ptCard'+i+' .match-sets');if(!sets)throw Error('X01-statistikk mangler');sets.classList.remove('hidden');
 sets.innerHTML='PILER <b id="ptDarts'+i+'">0</b> · <b id="ptAverage'+i+'">0.00</b> <span id="ptAverageLabel'+i+'">AVG</span>';}
 const card=panel.querySelector('.score-card');
 card.insertAdjacentHTML('afterbegin',"<div class=\"pt-stage-head\"><small id=\"ptProgressTitle\">ØVELSE 1 AV 7</small><strong id=\"ptStage\">501 · Leg 1</strong><span id=\"ptDescription\">Dobbel ut</span></div><div id=\"ptCounter\" hidden></div><div id=\"ptProgress\" class=\"pt-progress\"></div>");
 const players=card.querySelector('.match-players'),board=node('div');board.id='ptBoard';players.replaceWith(board);board.append(players);
 const entry=card.querySelector('.score-entry');entry.id='ptX01';
 entry.insertAdjacentHTML('afterbegin','<div id="ptX01Turn" class="pt-x01-turn">Spiller 1 kaster</div>');
 entry.insertAdjacentHTML('beforebegin',"<div id=\"ptTarget\" class=\"pt-target\">REST 501</div><div id=\"ptSpecial\" class=\"pt-special\" hidden><div id=\"ptSpecialTurn\" class=\"pt-special-turn\">Spiller 1 kaster</div><div class=\"pt-special-target\"><small id=\"ptSpecialPhase\">SHANGHAI</small><strong id=\"ptSpecialTarget\">Shanghai 1</strong><span id=\"ptSpecialRemaining\">3 piler</span></div><div id=\"ptChoices\" class=\"pt-choices\"></div><div class=\"pt-pending\">Registrert: <b id=\"ptPending\">–</b></div><div class=\"pt-special-actions\"><button id=\"ptRemove\" type=\"button\" class=\"outline\">Fjern siste · Backspace</button><button id=\"ptSSubmit\" type=\"button\" class=\"primary\">Registrer · Enter</button></div></div><div id=\"ptReview\" class=\"pt-review\" hidden><small>ØVELSEN ER FULLFØRT</small><h3 id=\"ptReviewTitle\">Resultat</h3><p id=\"ptReviewCaption\"></p><div id=\"ptReviewDetails\"></div><button id=\"ptAdvance\" type=\"button\" class=\"primary\">Neste øvelse →</button></div><div id=\"ptFinished\" class=\"pt-finished\" hidden><small>ALLE SJU ØVELSER FULLFØRT</small><h3 id=\"ptWinner\">Pentathlon ferdig!</h3><p id=\"ptFinalText\"></p><strong id=\"ptFinalScore\"></strong></div>");
 const aside=panel.querySelector('.match-info');aside.querySelector('#cameraBtn')?.remove();
 if(aside.querySelector('small'))aside.querySelector('small').textContent='PENTATHLON ONLINE';
 aside.insertAdjacentHTML('beforeend',"<div class=\"pt-tools\"><button id=\"ptRefresh\" type=\"button\" class=\"outline\">Oppdater</button><button id=\"ptUndo\" type=\"button\" class=\"outline\">↶ Angre</button></div><small class=\"pt-side-label\">RESULTATLISTE</small><div id=\"ptResultsTable\"></div><p class=\"pt-test-note\">Owner-test. Ingen karriere-, ranking- eller turneringsstatistikk.</p><small class=\"pt-side-label\">SISTE REGISTRERINGER</small><div id=\"ptLog\" class=\"pt-log\"></div>");
 document.getElementById('matchView')?.append(panel);
 $('ptRefresh').onclick=refresh;$('ptXSubmit').onclick=submitX01;$('ptSSubmit').onclick=submitSpecial;
 $('ptRemove').onclick=()=>{pending.pop();render()};$('ptAdvance').onclick=advance;$('ptUndo').onclick=undo;
 $('ptInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submitX01()}};
 document.addEventListener('keydown',e=>{
  if(!record||saving||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.isComposing)return;
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable)return;
  if(e.key==='Enter'){if(game().status==='review'){e.preventDefault();advance()}else if(mine()){e.preventDefault();stage().kind==='x01'?$('ptInput').focus():submitSpecial()}}
  else if(e.key==='Backspace'&&pending.length){e.preventDefault();pending.pop();render()}
  else if(mine()&&stage().kind!=='x01'){const btn=[...$('ptChoices').querySelectorAll('button')].find(b=>b.dataset.key===e.key);if(btn){e.preventDefault();btn.click()}}
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
 panel.hidden=false;document.body.classList.add('pt-active','match-page','match-tv-layout');
 $('ptStart').hidden=true;
 const live=s.status==='playing',review=s.status==='review',finished=s.status==='finished';
 document.body.classList.toggle('opponent-focus',live&&!mine());
 const st=E.STAGES[s.stageIndex];
 $('ptProgressTitle').textContent=finished?'PENTATHLON FULLFØRT':'ØVELSE '+(s.stageIndex+1)+' AV '+E.STAGES.length;
 const progress=$('ptProgress');progress.replaceChildren();
 E.STAGES.forEach((item,i)=>{
   const step=node('div',s.summaries[i]?'done':i===s.stageIndex?'active':'',String(i+1));
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
 $('ptTarget').hidden=!live||c.kind!=='x01';
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
 if(live&&c.kind==='x01'&&mine()&&!saving){
   const key=s.stageIndex+':'+c.turn+':'+c.used[c.turn];
   if(lastInputTurn!==key){
     lastInputTurn=key;
     requestAnimationFrame(()=>{
       const el=$('ptInput'),focused=document.activeElement;
       if(el&&!el.disabled&&!document.hidden&&
          (!focused||focused===document.body||focused===el))
         el.focus({preventScroll:true});
     });
   }
 }else lastInputTurn=null;
 $('ptAdvance').disabled=saving;
 $('ptStatus').textContent=review?'Øvelse fullført':finished?'Ferdig':'Pågår';
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
   record=null;document.body.classList.remove('pt-active','match-page','match-tv-layout','opponent-focus');$('ptPanel').hidden=true;
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
 await setup();
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