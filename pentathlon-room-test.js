
/* Owner-only launch, both players can score. Uses existing room video unchanged. */
(()=>{
'use strict';
const R=window.DartArenaChallengeRoomState,E=window.DartArenaPentathlon;
if(!R||!E)return;
const $=id=>document.getElementById(id),db=R.client(),challengeId=R.challengeId();
if(!challengeId)return;
let uid=null,challenge=null,record=null,channel=null,poll=null,pending=[],saving=false,lastInputTurn=null,sceneReady=false,sceneConfigured=false,sceneLoading=null,activeMatchId=null,entering=null;
let pentathlonMediaStream=null,pentathlonMediaStarting=null;
const copy=o=>JSON.parse(JSON.stringify(o));
const clean=o=>{const a=copy(o);delete a.undo;return a};
const game=()=>record?.state,stage=()=>game()?.current;
const player=()=>uid===challenge?.challenger_id?0:1;
const mine=()=>game()?.status==='playing'&&stage()?.turn===player();
const msg=(s,bad=false)=>{const el=$('ptMessage');if(el){el.textContent=s;el.classList.toggle('error',bad)}};
function node(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el}

function setup(){
 document.addEventListener('keydown',e=>{
   if(!sceneReady||!record||saving||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey)return;
   if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable)return;
   if(e.key==='Enter'){
     if(game().status==='review'){e.preventDefault();advance()}
     else if(mine()){e.preventDefault();stage().kind==='x01'?$('ptInput')?.focus():submitSpecial()}
   }else if(e.key==='Backspace'&&pending.length){e.preventDefault();pending.pop();render()}
   else if(mine()&&stage().kind!=='x01'){
     const b=[...$('ptChoices').querySelectorAll('button')].find(b=>b.dataset.key===e.key);
     if(b){e.preventDefault();b.click()}
   }
 });
}
async function ensureScene(){
 if(sceneReady)return;
 if(sceneLoading)return sceneLoading;
 sceneLoading=(async()=>{
   const host=window.DartArenaMatchSceneHost;
   if(!host)throw Error('Eksisterende X01-kamprom er ikke tilgjengelig.');
   if(host.isActive())throw Error('Et annet kamprom er allerede aktivt.');
   // Use the exact same stage/DOM transition as the existing X01 Online room.
   // The host moves existing video elements; no new media stream is created.
   await host.prepare();
   const scene=document.getElementById('daMatchStage');
   if(!sceneConfigured){
   const panel=scene?.querySelector('.match-grid');
   const score=panel?.querySelector('.score-card');
   const aside=panel?.querySelector('.match-info');
   if(!scene||!panel||!score||!aside)throw Error('X01-kamprommet mangler sin opprinnelige layout.');
   panel.id='ptPanel';
   const names={
     matchP1:'ptCard0',matchP2:'ptCard1',matchName1:'ptName0',matchName2:'ptName1',
     matchScore1:'ptScore0',matchScore2:'ptScore1',matchLegs1:'ptDetail0',
     matchLegs2:'ptDetail1',matchScoreInput:'ptInput',matchScoreBtn:'ptXSubmit',
     matchMessage:'ptMessage',matchStatus:'ptStatus',turnText:'ptTurn'
   };
   for(const [source,dest] of Object.entries(names)){
     const element=panel.querySelector('#'+source);
     if(!element)throw Error('X01-felt mangler: '+source);
     element.id=dest;
   }
   for(let i=0;i<2;i++){
     const card=panel.querySelector('#ptCard'+i),sets=card?.querySelector('.match-sets');
     if(!sets)throw Error('X01-spillerstatistikk mangler');
     sets.classList.add('hidden');
     const darts=node('div','live-darts');
     darts.innerHTML='<b id="ptDarts'+i+'">0</b><span>PILER</span>';
     const avg=node('div','live-avg');
     avg.innerHTML='<span id="ptAverageLabel'+i+'">AVG</span><b id="ptAverage'+i+'">0.00</b>';
     card.append(darts,avg);
     const detail=$('ptDetail'+i);
     detail.classList.add('pt-live-points');
     detail.innerHTML='<span class="pt-points-pair"><span>ØVELSE</span><b id="ptStagePoints'+i+'">0 P</b></span><span class="pt-points-divider" aria-hidden="true"></span><span class="pt-points-pair"><span>TOTALT</span><b id="ptTotalPoints'+i+'">0 P</b></span>';
   }
   const players=score.querySelector('.match-players');
   if(!players)throw Error('X01-spillerkortene mangler');
   players.id='ptBoard';
   score.insertAdjacentHTML('afterbegin',"<div class=\"pt-stage\"><small id=\"ptProgressTitle\">ØVELSE 1 AV 7</small><strong id=\"ptStage\">501 · Leg 1</strong><span id=\"ptDescription\">Dobbel ut</span></div><div id=\"ptCounter\" hidden></div><div id=\"ptProgress\" class=\"pt-progress\" aria-label=\"Pentathlon-øvelser\"></div>");
   const target=node('div','pt-target');target.id='ptTarget';
   players.after(target);
   const entry=score.querySelector('.score-entry');
   const message=score.querySelector('#ptMessage');
   if(!entry||!message)throw Error('Det originale X01-scorefeltet mangler.');
   entry.id='ptX01';
   const dock=node('div','focus-input-dock');dock.id='focusInputDock';
   const turn=node('div','pt-x01-turn');turn.id='ptX01Turn';
   dock.append(turn,entry);
   dock.insertAdjacentHTML('beforeend',"<div id=\"ptSpecial\" class=\"pt-special\" hidden><div id=\"ptSpecialTurn\" class=\"pt-special-turn\"></div><div class=\"pt-special-target\"><small id=\"ptSpecialPhase\">SHANGHAI</small><strong id=\"ptSpecialTarget\">TALL 1</strong><span id=\"ptSpecialRemaining\">3 piler</span></div><div id=\"ptChoices\" class=\"pt-choices\"></div><div class=\"pt-pending\">Valgt: <b id=\"ptPending\">–</b></div><div class=\"pt-special-actions\"><button type=\"button\" id=\"ptRemove\" class=\"outline\">Fjern siste · Backspace</button><button type=\"button\" id=\"ptSSubmit\" class=\"primary\">Registrer · Enter</button></div></div>");
   dock.append(message);
   scene.appendChild(dock);
   aside.querySelector('#cameraBtn')?.remove(); // Camera already belongs to the waiting room.
   aside.insertAdjacentHTML('beforeend',"<div class=\"pt-tools\"><button type=\"button\" id=\"ptRefresh\" class=\"outline\">Oppdater</button><button type=\"button\" id=\"ptUndo\" class=\"outline\">↶ Angre</button></div><div id=\"ptReview\" class=\"pt-review\" hidden><small>ØVELSE FULLFØRT</small><h3 id=\"ptReviewTitle\"></h3><p id=\"ptReviewCaption\"></p><div id=\"ptReviewDetails\"></div><button type=\"button\" id=\"ptAdvance\" class=\"primary\">Neste øvelse →</button></div><div id=\"ptFinished\" class=\"pt-finished\" hidden><small>ALLE SJU ØVELSER FULLFØRT</small><h3 id=\"ptWinner\"></h3><p id=\"ptFinalText\"></p><strong id=\"ptFinalScore\"></strong></div><section id=\"ptPointsGuide\" class=\"pt-points-guide\" aria-label=\"Poengregler for aktiv øvelse\"><div class=\"pt-guide-heading\">POENGOVERSIKT <small id=\"ptGuideStage\"></small></div><div id=\"ptGuideRows\" class=\"pt-guide-rows\"></div><p id=\"ptGuideNote\" class=\"pt-guide-note\"></p></section><p class=\"pt-note\">Owner-test · ikke ranket.</p>");
   // Result list lives in a top-right action and reuses the existing table/log renderers.
   const topActions=scene.querySelector('.match-head .top-actions');
   if(!topActions)throw Error('Kamprommets toppknapper mangler.');
   const resultButton=node('button','outline','Resultatliste');
   resultButton.id='ptResultsButton';resultButton.type='button';
   resultButton.setAttribute('aria-haspopup','dialog');
   resultButton.setAttribute('aria-expanded','false');
   topActions.prepend(resultButton);
   const resultOverlay=node('div','pt-results-overlay');
   resultOverlay.id='ptResultsOverlay';resultOverlay.hidden=true;
   resultOverlay.innerHTML='<section class="pt-results-modal" role="dialog" aria-modal="true" aria-labelledby="ptResultsHeading" tabindex="-1"><div class="pt-results-header"><h2 id="ptResultsHeading">Resultatliste · 7 øvelser</h2><button id="ptCloseResults" type="button" class="outline" aria-label="Lukk resultatliste">Lukk ×</button></div><div class="pt-results-body"><div id="ptResultsTable"></div><small class="pt-side-label">SISTE REGISTRERINGER</small><div id="ptLog" class="pt-log"></div></div></section>';
   scene.append(resultOverlay);
   const closeResults=()=>{
     resultOverlay.hidden=true;resultButton.setAttribute('aria-expanded','false');resultButton.focus();
   };
   resultButton.onclick=()=>{resultOverlay.hidden=false;resultButton.setAttribute('aria-expanded','true');resultOverlay.querySelector('.pt-results-modal').focus();};
   $('ptCloseResults').onclick=closeResults;
   resultOverlay.addEventListener('click',e=>{if(e.target===resultOverlay)closeResults()});
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!resultOverlay.hidden){e.preventDefault();closeResults()}});
   const cancel=scene.querySelector('#cancelMatchBtn');
   if(cancel){
     cancel.hidden=false;cancel.textContent='Avbryt testkamp';
     cancel.onclick=async()=>{
       if(!confirm('Vil du avbryte Pentathlon-testkampen?'))return;
       const {error}=await db.rpc('cancel_pentathlon_match_test',{p_match_id:activeMatchId});
       if(error){alert('Kunne ikke avbryte: '+error.message);return}
       location.replace('./');
     };
   }
   const close=scene.querySelector('#closeMatchBtn');
   if(close){close.textContent='Til hovedlobby';close.onclick=()=>{
     if(record?.state?.status==='playing'&&!confirm('Pentathlon-testen pågår. Gå til hovedlobbyen?'))return;
     location.replace('./');
   }}
   scene.querySelector('#matchFormat').textContent='PENTATHLON • 7 ØVELSER';
   scene.querySelector('#matchTitle').textContent='Pentathlon Online';
   $('ptRefresh').onclick=refresh;$('ptXSubmit').onclick=submitX01;$('ptSSubmit').onclick=submitSpecial;
   $('ptRemove').onclick=()=>{pending.pop();render()};$('ptAdvance').onclick=advance;$('ptUndo').onclick=undo;
   $('ptInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitX01()}});
   sceneConfigured=true;
   }
   await host.enter();
   const local=document.getElementById('localVideoCard');
   local?.classList.add('focus-local-pip');
   const mic=local?.querySelector('#micBtn');
   if(mic)mic.hidden=true; // Room media controls are owned by the existing waiting room.
   document.body.classList.add('pt-online-test');
   sceneReady=true;
 })();
 try{await sceneLoading}finally{sceneLoading=null}
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
function stLabel(i){return E.STAGES[i]?.label||'Pentathlon'}

// A visible rule reference for the current stage; no scoring changes.
function renderPointsGuide(s){
 const current=s.stageIndex>=E.STAGES.length?E.STAGES.length-1:s.stageIndex;
 const stageInfo=E.STAGES[current];
 if(!stageInfo)return;
 const rows=[];
 let note='';
 if(stageInfo.kind==='x01'){
   rows.push(['95–130 per runde','+1 P'],['131–159 per runde','+2 P'],['160–180 per runde','+3 P'],['Dobbel ut / vunnet leg','+2 P']);
   rows.push(['Utsjekk på 9 piler','+10 P'],['Utsjekk på 10–12 piler','+4 P'],['Utsjekk på 13–15 piler','+3 P'],['Utsjekk på 16–18 piler','+2 P'],['Utsjekk på 19–21 piler','+1 P']);
   note='Poeng per registrerte runde. Bust gir 0 poeng. Utsjekkbonus kommer i tillegg.';
 }else if(stageInfo.kind==='shanghai'){
   rows.push(['Single på riktig tall','+1 P'],['Dobbel på riktig tall','+2 P'],['Trippel på riktig tall','+3 P'],['S + D + T på samme tall i én runde','+6 P']);
   note='Tall 1–9, tre piler per tall. Feil tall og bom gir 0 P.';
 }else if(stageInfo.kind==='clock'){
   rows.push(['Hver riktig dobbel (D1 til D20)','+2 P'],['Fullfør D20','+1 P per ubrukt pil']);
   note='Maks 42 piler per spiller. Bonus = 42 minus brukte piler ved fullføring.';
 }else if(stageInfo.kind==='half'){
   rows.push(['20, 16, 14 og 17','0 P*'],['Treff på D7','+2 P'],['Treff på T10','+3 P'],['Treff på Bull 50','+2 P']);
   note='*Den nåværende motoren gir 0 P på vanlige tallmål (kjent feil). Halvering påvirker Half-It-score, ikke opptjente Pentathlon-poeng.';
 }
 $('ptGuideStage').textContent=stageInfo.label;
 const host=$('ptGuideRows');host.replaceChildren();
 for(const [label,amount] of rows){
   const line=node('div','pt-guide-row');
   line.append(node('span','',label),node('strong','',amount));
   host.append(line);
 }
 $('ptGuideNote').textContent=note;
}

function render(){
 if(!record)return;
 if(!sceneReady)return;
 const panel=$('ptPanel'),s=game(),c=s.current;
 panel.hidden=false;
 const live=s.status==='playing',review=s.status==='review',finished=s.status==='finished';
 document.body.classList.toggle('opponent-focus',live&&!mine());
 document.body.classList.toggle('own-turn-focus',live&&mine());
 document.body.classList.toggle('pt-special-turn',live&&mine()&&c.kind!=='x01');
 const st=E.STAGES[s.stageIndex];
 renderPointsGuide(s);
 $('ptProgressTitle').textContent=finished?'PENTATHLON FULLFØRT':'ØVELSE '+(s.stageIndex+1)+' AV '+E.STAGES.length;
 const formatEl=$('matchFormat');
 if(formatEl)formatEl.textContent=finished?'PENTATHLON · FULLFØRT':'PENTATHLON · '+(s.stageIndex+1)+'/7 · '+stLabel(s.stageIndex);
 const titleEl=$('matchTitle');if(titleEl)titleEl.textContent=s.players[0]+' vs '+s.players[1];
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
   $('ptStagePoints'+i).textContent=c.pent[i]+' P';
   $('ptTotalPoints'+i).textContent=(s.total[i]+(live?c.pent[i]:0))+' P';
   $('ptCard'+i).classList.toggle('active',live&&c.turn===i);
 }
 // Keep original X01 scorecards visible through the result screen.
 $('ptTarget').hidden=!live||c.kind==='x01';
 $('ptX01').hidden=!live||c.kind!=='x01';
 $('ptSpecial').hidden=!live||c.kind==='x01';
 $('ptReview').hidden=!review;
 $('ptFinished').hidden=!finished;
 if(review||finished)$('ptResultDetails').open=true;
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
       if(el&&!el.disabled&&!document.hidden&&!window.matchMedia?.('(max-width:700px)').matches&&
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
 if(!uid||!challenge||!activeMatchId)return;
 const {data,error}=await db.from('pentathlon_room_tests').select('*').eq('match_id',activeMatchId).maybeSingle();
 if(error){msg('Synkronisering feilet: '+error.message,true);return}
 if(data&&(!record||data.version>record.version)){record=data;pending=[];render()}
}
async function broadcast(){
 await channel?.send({type:'broadcast',event:'changed',payload:{from:uid}}).catch(()=>{});
}
// Use the existing authenticated X01 MATCH SFU module, never its scoring engine.
async function establishMatchVideo(matchId){
 if(pentathlonMediaStarting)return pentathlonMediaStarting;
 pentathlonMediaStarting=(async()=>{
   const state=window.DartArenaChallengeRoomState;
   const oldRoom=window.DartArenaRoomMedia;
   const captured=state.stream();
   if(!(captured instanceof MediaStream)||!captured.getTracks().some(t=>t.kind==='video'&&t.readyState==='live'))
     throw Error('Kamera fra venterommet er ikke klart.');
   if(window.DartArenaMatchEngineState)throw Error('Et annet X01-kamprom styrer allerede videoen.');
   pentathlonMediaStream=captured;
   // A media-only state adapter. The original X01 scoring controller is NOT loaded.
   window.DartArenaMatchEngineState=Object.freeze({
     client:()=>db,matchId:()=>matchId,stream:()=>pentathlonMediaStream,
     mediaReady:()=>!!pentathlonMediaStream?.getTracks().some(t=>t.readyState==='live')
   });
   oldRoom?.beginHandoff?.(); // Freeze the unauthorized challenge SFU retries.
   const source='match-sfu-media-secure.js?v=20261122-penta-mediaready1';
   await new Promise((resolve,reject)=>{
     const script=document.createElement('script');script.src=source;script.async=false;
     script.onload=resolve;script.onerror=()=>reject(Error('X01-kampvideo kunne ikke lastes.'));
     document.body.appendChild(script);
   });
   const started=Date.now();
   while(!window.DartArenaMatchMedia?.readyForHandoff?.()){
     if(Date.now()-started>20000)throw Error('X01-kampvideo ble ikke klar. Kontroller medieloggen.');
     await new Promise(resolve=>setTimeout(resolve,250));
   }
   window.DartArenaMediaTrace?.mark('PENTATHLON_MATCH_SFU_READY',{matchId:matchId.slice(0,8)});
   const opponent=uid===challenge.challenger_id?challenge.challenged_id:challenge.challenger_id;
   if(!window.DartArenaHandoffBarrier?.wait)throw Error('Synkronisering mellom spillerne mangler.');
   await window.DartArenaHandoffBarrier.wait({client:db,matchId,me:uid,opponent});
   // Match SFU owns the same live capture tracks; close only old transport.
   state.takeMediaOwnership?.();
   state.releaseForHandoff?.();
   window.DartArenaMediaTrace?.mark('PENTATHLON_MATCH_SFU_HANDOFF_COMPLETE');
 })();
 try{await pentathlonMediaStarting}
 catch(error){
   window.DartArenaMediaTrace?.mark('PENTATHLON_MATCH_SFU_FAILED',String(error?.message||error));
   throw error;
 }
}

async function enter({matchId}={}){
 if(entering)return entering;
 if(sceneReady&&activeMatchId===matchId)return;
 entering=(async()=>{
   if(!uid||!challenge){
     for(let i=0;i<50&&(!uid||!challenge);i++)await new Promise(r=>setTimeout(r,100));
     if(!uid||!challenge)throw Error('Venterommets sesjon er ikke klar');
   }
   const {data:m,error}=await db.from('matches')
     .select('id,player1_id,player2_id,match_starter_id,status,game_variant')
     .eq('id',matchId).maybeSingle();
   if(error||!m||m.game_variant!=='pentathlon'||m.status!=='playing'||
      ![m.player1_id,m.player2_id].includes(uid)||
      m.player1_id!==challenge.challenger_id||m.player2_id!==challenge.challenged_id){
     throw error||Error('Ugyldig Pentathlon-kamp');
   }
   activeMatchId=m.id;
   try{sessionStorage.setItem('dartarena-challenge-match:'+challengeId,m.id)}catch{}
   const {data:players,error:pe}=await db.from('profiles')
     .select('id,username').in('id',[m.player1_id,m.player2_id]);
   if(pe)throw pe;
   const name=id=>players?.find(p=>p.id===id)?.username||'Spiller';
   const seed=E.create({name1:name(m.player1_id),name2:name(m.player2_id),
     starter:m.match_starter_id===m.player1_id?0:1});
   const {data,error:initError}=await db.rpc('start_pentathlon_match_test',{
     p_match_id:m.id,p_challenge_id:challengeId,p_state:seed
   });
   if(initError||!data)throw initError||Error('Kunne ikke hente Pentathlon-kampen');
   record=data;pending=[];
   await ensureScene();render();msg('Kobler til X01-kampvideo…');
   try{await establishMatchVideo(m.id);msg('Pentathlon Online · X01-kampvideo klar');}
   catch(videoError){msg('Video: '+(videoError.message||videoError)+'. Scoringen er fortsatt tilgjengelig.',true);console.warn('[Pentathlon match media]',videoError)}
 })();
 try{await entering}finally{entering=null}
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
let checkoutPending=false;
async function submitX01(){
 if(!mine()||saving||checkoutPending||stage().kind!=='x01')return;
 const raw=$('ptInput').value.trim(),n=Number(raw);
 if(!raw||!E.isScore(n)){msg('Skriv score fra 0 til 180.',true);return}
 const expectedVersion=record.version,expectedPlayer=player(),expectedStage=game().stageIndex;
 let darts=3,confirmed=false;
 if(n===stage().remaining[stage().turn]){
   const checkout=window.DartArenaCheckout;
   if(!checkout){msg('Checkout-dialogen er ikke lastet. Oppdater siden.',true);return}
   if(!checkout.possibleDarts(n).length){msg(n+' kan ikke avsluttes på tre piler.',true);return}
   checkoutPending=true;
   try{
     darts=await checkout.askDarts(n);
   }catch(e){msg('Checkout-dialogen feilet: '+(e.message||e),true);return}
   finally{checkoutPending=false}
   if(!darts){msg('Checkout avbrutt.');return}
   confirmed=true;
 }
 if(!record||record.version!==expectedVersion||game().stageIndex!==expectedStage||!mine()||player()!==expectedPlayer){
   $('ptInput').value='';
   msg('Kampstatus er endret. Kontroller scoren før du prøver igjen.',true);
   return;
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
 if(error||!data||!['room','accepted'].includes(data.status)||![data.challenger_id,data.challenged_id].includes(uid))return;
 challenge=data;
 const {data:isOwner}=await db.rpc('is_owner');
 const option=document.querySelector('#roomGame option[value="pentathlon"]');
 if(option)option.hidden=!isOwner;
 channel=db.channel('pentathlon-room-test-'+challengeId)
  .on('postgres_changes',{event:'*',schema:'public',table:'pentathlon_room_tests',filter:'challenge_id=eq.'+challengeId},()=>refresh())
  .on('broadcast',{event:'changed'},()=>refresh())
  .subscribe();
 const resume=window.DartArenaPentathlonResumeMatchId;
 if(resume)enter({matchId:resume}).catch(e=>console.error('[Pentathlon resume]',e));
 poll=setInterval(()=>{if(activeMatchId&&!document.hidden)refresh()},6000);
}
window.addEventListener('pagehide',()=>{clearInterval(poll);if(channel)db.removeChannel(channel).catch(()=>{})},{once:true});
window.DartArenaPentathlonMatchTest=Object.freeze({enter});
boot().catch(e=>console.warn('Pentathlon match test failed',e));
})();