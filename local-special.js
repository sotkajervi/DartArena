/* DartArena local special games: keyboard-first, no camera or remote calls. */
(function(){
'use strict';
const E=window.DartArenaLocalSpecial,$=id=>document.getElementById(id);
if(!E||!$('specialSetupForm'))return;
const KEY_PREFIX='dartarena-local-special-v1:',config={
 cricket:'Cricket',half_standard:'Half-It (Standard)',half_dartcounter:'Half-It (DartCounter)',
 sixty_one:'61',jdc:'JDC Challenge',chicago:'Chicago Style'
};
let state=null,pending=[],selectedMult=1,editingIndex=null,message='',isError=false,nextTimer=null,cricketDisclosureInitialized=false,halfSelectedDart=null,halfFieldOpen=false;
const w=window,dom={
 setup:$('specialSetup'),game:$('specialGame'),mode:$('specialMode'),name1:$('specialSetupName1'),
 name2:$('specialSetupName2'),legs:$('specialLegs'),minutes:$('specialMinutes'),starter:$('specialStarter'),
 controls:$('specialControls'),submit:$('specialSubmit'),miss:$('specialMiss'),remove:$('specialRemove'),
 selected:$('specialPending'),progress:$('specialProgress'),stats:$('specialStats'),
 hist:$('specialHistory'),checkout:$('specialCheckout'),choice:$('specialCheckoutButtons')
};
const esc=text=>String(text).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const mode=()=>E.stageMode(state);
function fail(text){message=text;isError=true;$('specialMessage').textContent=text;$('specialMessage').classList.add('is-error')}
function info(text){message=text;isError=false;$('specialMessage').textContent=text;$('specialMessage').classList.remove('is-error')}
function storageKey(game){return KEY_PREFIX+game}
function store(gameToDelete){
  try{
    if(gameToDelete)localStorage.removeItem(storageKey(gameToDelete));
    if(state)localStorage.setItem(storageKey(state.game),JSON.stringify(state));
  }catch(e){fail('Kunne ikke lagre kampen lokalt.')}
}
function resetPending(){pending=[];selectedMult=1;editingIndex=null;halfSelectedDart=null;halfFieldOpen=false;dom.checkout.hidden=true}
function halfMobile(){return !!w.matchMedia?.('(max-width: 700px)')?.matches}
function cricketMobile(){return state?.game==='cricket'&&!!w.matchMedia?.('(max-width: 700px)')?.matches}
function closeCricketStats(){
 document.body.classList.remove('special-cricket-stats-open');
 $('specialStatsBackdrop').hidden=true;
 $('specialStatsOpen').setAttribute('aria-expanded','false');
 $('specialStatsPanel').removeAttribute('role');
 $('specialStatsPanel').removeAttribute('aria-modal');
}
function openCricketStats(){
 if(!cricketMobile())return;
 document.body.classList.add('special-cricket-stats-open');
 $('specialStatsBackdrop').hidden=false;
 $('specialStatsOpen').setAttribute('aria-expanded','true');
 $('specialStatsPanel').setAttribute('role','dialog');
 $('specialStatsPanel').setAttribute('aria-modal','true');
 $('specialStatsClose').focus({preventScroll:true});
}
$('specialStatsOpen').addEventListener('click',openCricketStats);
$('specialStatsClose').addEventListener('click',closeCricketStats);
$('specialStatsBackdrop').addEventListener('click',closeCricketStats);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&document.body.classList.contains('special-cricket-stats-open')){
   event.preventDefault();
   event.stopImmediatePropagation();
   closeCricketStats();
 }
},true);
function formatScore(value){return Number(value||0).toLocaleString('nb-NO')}
function labelDart(d){
 if(typeof d==='string')return ({M:'MISS',S:'Single',D:'Double',T:'Triple',H:'Treff'})[d]||d;
 if('target' in d)return d.target==='MISS'?'MISS':(d.mult===1?'S':d.mult===2?'D':'T')+(d.target==='B'?'BULL':d.target);
 return d.n===0?'MISS':d.n===25?(d.mult===1?'25':'50'):(d.mult===1?'S':d.mult===2?'D':'T')+d.n;
}
function neededJdc(){let r=E.round(state);return r>=7&&r<=27?Math.min(27,9+3*Math.floor((r-7)/3))-r+1:3}
function setupVisibility(){
 const val=dom.mode.value;
 $('specialLegsField').hidden=val==='jdc'||val==='chicago';
 $('specialMinutesField').hidden=val!=='sixty_one';
}
function renderScores(){
 for(let p=0;p<2;p++){
   const visits=state.visits.filter(v=>v.player===p),legVisits=visits.filter(v=>v.leg===state.leg);
   $('specialName'+p).textContent=state.players[p];
   $('specialPlayer'+p).classList.toggle('active',state.status==='playing'&&state.turn===p);
   $('specialPlayer'+p).style.order=p===state.firstStarter?0:1;
   const game=state.game;
   const value=game==='sixty_one'?state.target[p]:state.scores[p];
   $('specialScore'+p).textContent=formatScore(value);
   let darts=legVisits.reduce((sum,v)=>sum+(Array.isArray(v.darts)?v.darts.length:Number.isInteger(v.darts)?v.darts:Array.isArray(v.codes)?v.codes.length:(typeof v.hit==='boolean'?1:3)),0);
   if(mode()==='half'&&state.status==='playing'&&state.turn===p)darts+=pending.length;
   $('specialDarts'+p).textContent=String(darts);
   let average=0,unit='AVG';
   if(mode()==='cricket'){
     const marks=legVisits.reduce((sum,v)=>sum+Number(v.marks||0),0);
     average=legVisits.length?marks/legVisits.length:0;unit='MPR';
   }else if(mode()==='half'||mode()==='jdc'){
     average=visits.length?visits.reduce((sum,v)=>sum+Number(v.points||0),0)/visits.length:0;
     unit=mode()==='half'?'P/R':'P/R';
   }else if(mode()==='sixty_one'){
     average=state.attempts[p]?state.target[p]/state.attempts[p]:0;unit='61/F';
   }else {
     const dartsSum=visits.reduce((sum,v)=>sum+(v.darts||3),0);
     const pts=visits.reduce((sum,v)=>sum+Number(v.score||0),0);
     average=dartsSum?pts/dartsSum*3:0;unit='AVG';
   }
   $('specialAvg'+p).textContent=average.toFixed(2);
   $('specialAvgLabel'+p).textContent=unit;
   $('specialLegText'+p).textContent=state.legs[p]+' LEGS';
 }
}
function stats(){
 const cards=[];
 const overall=state.visits;
 function card(title,values){
   return '<div class="special-stats-cell"><span>'+esc(title)+'</span><strong>'+
     esc(String(values[0]))+'</strong><strong>'+esc(String(values[1]))+'</strong></div>';
 }
 const stat=(p,fn)=>fn(overall.filter(v=>v.player===p),p);
 if(mode()==='cricket'){
   cards.push(card('MPR',[0,1].map(p=>{const vis=overall.filter(v=>v.player===p),marks=vis.reduce((sum,v)=>sum+(v.marks||0),0);return vis.length?(marks/vis.length).toFixed(2):'0.00'})));
   cards.push(card('Poeng',state.scores));
   cards.push(card('Lukkede felt',[0,1].map(p=>E.TARGETS.filter(t=>state.marks[p][t]===3).length+'/7')));
   cards.push(card('Kast',[0,1].map(p=>stat(p,v=>v.length))));
 }else if(mode()==='half'){
   cards.push(card('Score',state.scores));
   cards.push(card('Runde',[0,1].map(p=>Math.min(12,state.round[p]-1)+'/12')));
   cards.push(card('Vellykkede runder',[0,1].map(p=>stat(p,v=>v.filter(t=>t.success).length))));
   cards.push(card('Høyeste runde',[0,1].map(p=>stat(p,v=>Math.max(0,...v.map(t=>t.points||0))))));
 }else if(mode()==='sixty_one'){
   cards.push(card('Nåværende mål',state.target));
   cards.push(card('Forsøk',state.attempts));
   cards.push(card('Høyeste checkout',state.high61||[0,0]));
   cards.push(card('Treff',[0,1].map(p=>stat(p,v=>v.filter(t=>t.hit).length))));
   cards.push(card('Bom',[0,1].map(p=>stat(p,v=>v.filter(t=>!t.hit).length))));
 }else if(mode()==='jdc'){
   cards.push(card('JDC-poeng',state.scores));
   cards.push(card('Mål fullført',[0,1].map(p=>(state.round[p]-1)+'/33')));
   cards.push(card('Shanghai-bonus',[0,1].map(p=>stat(p,v=>v.filter(t=>t.bonus).length))));
   cards.push(card('Beste runde',[0,1].map(p=>stat(p,v=>Math.max(0,...v.map(t=>t.points||0))))));
   const tier=score=>score>=1250?'Gold':score>=850?'Black':score>=700?'Red':score>=600?'Blue':score>=450?'Green':score>=300?'Yellow':score>=150?'Purple':'White';
   cards.push(card('JDC tier',state.scores.map(tier)));
 }else{
   cards.push(card('Gjenstår',state.scores));
   cards.push(card('Fase',[state.stage,state.stage]));
   cards.push(card('Kast',[0,1].map(p=>stat(p,v=>v.length))));
   cards.push(card('Utsjekk',[0,1].map(p=>stat(p,v=>Math.max(0,...v.filter(t=>t.checkout).map(t=>t.score))))));
 }
 dom.stats.innerHTML='<div class="special-stats-names"><span></span><strong>'+esc(state.players[0])+'</strong><strong>'+esc(state.players[1])+'</strong></div>'+cards.join('');
}
function cricketBoard(){
 const counts=Object.fromEntries(E.TARGETS.map(t=>[t,0]));
 for(const t of pending){if(counts[t]!==undefined)counts[t]++}
 const glyph=n=>n===0?'–':n===1?'╱':n===2?'×':'⊗';
 const rows=E.TARGETS.map(t=>{
   const label=t==='B'?'BULL':t,n=counts[t];
   return '<div class="special-cricket-row">'+
      '<span class="special-cricket-mark" aria-label="'+esc(state.players[0])+': '+state.marks[0][t]+' merker">'+glyph(state.marks[0][t])+'</span>'+
      '<button type="button" class="special-cricket-target'+(n?' has-pending':'')+
      '" data-mark="'+t+'" aria-label="Legg til ett merke på '+label+'">'+label+
      (n?'<small>+'+n+'</small>':'')+'</button>'+
      '<span class="special-cricket-mark" aria-label="'+esc(state.players[1])+': '+state.marks[1][t]+' merker">'+glyph(state.marks[1][t])+'</span>'+
      '</div>';
 }).join('');
 return '<div class="special-cricket-vertical" aria-label="Cricket – 20 til 15 og Bull">'+
   '<div class="special-cricket-head"><span>'+esc(state.players[0])+'</span><strong>FELT</strong><span>'+esc(state.players[1])+'</span></div>'+
   rows+'</div><p class="muted compact special-cricket-hint">Trykk én gang per merke, f.eks. 20 fire ganger = 4 merker. Maks tre piler per tur. Trykk Enter for å registrere.</p>';
}
function halfPad(){
 const rule=E.halfRule(state),n=E.round(state),choice=rule==='exact'?
   '<div class="special-choice-row">'+state.exactOptions.map(x=>'<button class="'+(state.exactChoice===x?'primary':'outline')+'" type="button" data-exact="'+x+'">'+x+'</button>').join('')+'</div>':'';
 let keys=[];
 if(typeof rule==='number'&&rule!==41){keys=[1,2,3].map(m=>({n:rule,m}))}
 else if(rule==='bull'){keys=[{n:25,m:1},{n:25,m:2}]}
 else if(rule==='double'||rule==='treble'){
   keys=Array.from({length:20},(_,i)=>({n:i+1,m:rule==='double'?2:3}));
   if(rule==='double')keys.push({n:25,m:2});
 }else{
   keys=Array.from({length:20},(_,i)=>({n:i+1,m:selectedMult}));
   if(selectedMult<=2)keys.push({n:25,m:selectedMult});
 }
 const multis=['same','different','exact',41].includes(rule)?
   '<div class="special-choice-row">'+[1,2,3].map(m=>
   '<button type="button" class="'+(selectedMult===m?'primary':'outline')+'" data-mult="'+m+'">'+
   ({1:'SINGLE',2:'DOBBEL',3:'TRIPPEL'})[m]+'</button>').join('')+'</div>':'';
 const open=!halfMobile()||halfFieldOpen?' open':'';
 const digits=['1','2','3','4','5','6','7','8','9','del','0','enter'];
 const keypad=digits.map(d=>d==='del'?
   '<button type="button" data-half-action="delete" aria-label="Slett siffer">⌫</button>':
   d==='enter'?'<button type="button" class="primary" data-half-action="enter">Enter</button>':
   '<button type="button" data-half-digit="'+d+'">'+d+'</button>').join('');
 return '<div class="special-half-controls">'+choice+
  '<div class="special-half-input"><input id="specialHalfInput" type="text" inputmode="'+(halfMobile()?'none':'numeric')+'"'+
  (halfMobile()?' readonly':'')+
  ' maxlength="2" autocomplete="off" aria-label="Poeng for neste pil" placeholder="0–60 per pil">'+
  '<button type="button" class="primary" data-half-action="enter">Enter / MISS</button></div>'+
  '<div class="special-half-keypad" role="group" aria-label="Tall for én pil">'+keypad+'</div>'+
  '<p class="special-half-hint">Skriv f.eks. 13 + Enter. Tom Enter = MISS. Etter 3 piler byttes spiller.</p>'+
  '<details id="specialHalfFields" class="special-half-fields"'+open+'>'+
  '<summary>Feltvalg: single, dobbel, trippel</summary>'+multis+
  '<div class="special-numbers">'+keys.map(d=>'<button type="button" class="outline special-choice" data-n="'+d.n+'" data-m="'+d.m+'">'+labelDart(d)+'</button>').join('')+'</div></details></div>';
}
function jdcPad(){
 const r=E.round(state),double=r>=7&&r<=27,expected=neededJdc(),target=r<=6?9+r:r>=28?r-13:null;
 const stage=double?'Doubles '+(r-6)+'–'+(Math.min(27,9+3*Math.floor((r-7)/3))-6):(r<=6?'Shanghai '+target:'Shanghai '+target);
 const buttons=double?[['M','MISS','0'],['H','TREFF','2']]:[['M','MISS','0'],['S','SINGLE','1'],['D','DOUBLE','2'],['T','TRIPLE','3']];
 return '<div class="special-target"><small>FASE '+(r<=6?1:r<=27?2:3)+' • MÅL '+r+'/33</small><strong>'+esc(stage)+'</strong><span>'+expected+' pil'+(expected===1?'':'er')+' denne turen</span></div>'+
  '<div class="special-choice-row">'+buttons.map(([code,label,key])=>'<button type="button" class="outline special-choice" data-jdc="'+code+'">'+label+' <span class="da-key">'+key+'</span></button>').join('')+'</div>';
}
function sixtyPad(){
 const remaining=Math.max(0,state.minutes*60*1000-(state.paused?state.pausedAt-state.phaseStart:Date.now()-state.phaseStart));
 const clock=Math.floor(remaining/60000)+':'+String(Math.ceil(remaining/1000)%60).padStart(2,'0');
 return '<div class="special-target"><small>'+(state.sudden?'SUDDEN DEATH':'61 • TID IGJEN')+'</small><strong>'+ (state.sudden?'SUDDEN DEATH':clock)+'</strong>'+
  '<span>Mål: '+state.target[state.turn]+' • Forsøk: '+state.attempts[state.turn]+'</span></div>'+
  '<div class="special-choice-row"><button type="button" class="primary" data-hit="yes">TREFF <span class="da-key">Space</span></button>'+
  '<button type="button" class="outline" data-hit="no">BOM <span class="da-key">Backspace</span></button>'+
  '<button type="button" class="outline" data-pause="1">'+(state.paused?'FORTSETT':'PAUSE')+' <span class="da-key">P</span></button></div>';
}
function chicagoPad(){
 const is301=state.stage===1,remaining=state.scores[state.turn];
 return '<div class="special-target"><small>CHICAGO • GAME '+state.stage+'/3</small><strong>'+ (state.stage===1?'301 DOUBLE IN / DOUBLE OUT':'501 SINGLE IN / DOUBLE OUT')+'</strong></div>'+
  '<div class="special-x01-input"><input id="specialX01" type="text" inputmode="numeric" maxlength="3" pattern="[0-9]{1,3}" autocomplete="off" placeholder="0–180">'+
  '<button class="primary" id="specialX01Submit" type="button">Registrer / Enter</button></div>'+
  (is301&&!state.entered[state.turn]?'<label class="special-double-in"><input id="specialDoubleIn" type="checkbox"> Første tellende pil traff dobbel (DOUBLE IN)</label>':'')+
  '<p class="muted compact">'+remaining+' igjen • Gyldig dobbel-ut med 1–3 piler bekreftes ved checkout.</p>';
}
function renderPad(){
 if(state.status!=='playing'){dom.controls.replaceChildren();return}
 const game=mode();let contents='';
 if(game==='cricket')contents=cricketBoard();
 else if(game==='half')contents=halfPad();
 else if(game==='jdc')contents=jdcPad();
 else if(game==='sixty_one')contents=sixtyPad();
 else if(game==='x01')contents=chicagoPad();
 dom.controls.innerHTML=contents;
 const usual=['cricket','half','jdc'].includes(game);
 dom.selected.parentElement.hidden=!usual;
 dom.submit.hidden=!usual||game==='half';dom.remove.hidden=!usual;dom.miss.hidden=game!=='cricket';
 dom.miss.innerHTML=game==='cricket'?'MISS <span class="da-key">M</span>':'MISS <span class="da-key">0</span>';
 const max=game==='jdc'?neededJdc():3;
 dom.submit.disabled=state.paused||!pending.length||(game==='jdc'&&pending.length!==max);
 dom.submit.innerHTML=editingIndex===null?'Registrer <span class="da-key">Enter</span>':'Lagre korrigering <span class="da-key">Enter</span>';
 dom.remove.disabled=!pending.length;
 if(usual){
   dom.selected.replaceChildren();
   if(!pending.length)dom.selected.textContent='–';
   else{
     if(game==='cricket'){
     const counts=Object.fromEntries(E.TARGETS.map(t=>[t,0]));
     let misses=0;
     for(const t of pending){if(t==='MISS')misses++;else if(counts[t]!==undefined)counts[t]++}
     for(const t of E.TARGETS){
       if(!counts[t])continue;
       const chip=document.createElement('span');chip.className='special-dart-chip';
       chip.textContent=(t==='B'?'BULL':t)+' × '+counts[t];
       dom.selected.appendChild(chip);
     }
     if(misses){const chip=document.createElement('span');chip.className='special-dart-chip';chip.textContent='MISS × '+misses;dom.selected.appendChild(chip)}
     const count=document.createElement('small');
     count.textContent=pending.filter(t=>t!=='MISS').length+' merker';
     dom.selected.appendChild(count);
   }else{
     for(const d of pending){
       const chip=document.createElement('span');chip.className='special-dart-chip';
       if(game==='half'){
         const color=E.dartColor(d);
         chip.classList.add('dart-'+color);
         chip.title=({black:'SORT',white:'HVIT',red:'RØD',green:'GRØNN',miss:'MISS'})[color]||color;
       }
       chip.textContent=labelDart(d);
       dom.selected.appendChild(chip);
     }
     const count=document.createElement('small');
     count.textContent=pending.length+'/'+max;
     dom.selected.appendChild(count);
   }
   }
 }
 $('specialInfo').textContent=game==='half'?'Runde '+Math.min(12,E.round(state))+'/12 • Mål: '+String(E.halfRule(state)).toUpperCase()+' • Pil '+(pending.length+1)+'/3':
 game==='jdc'?'Velg treff eller bom for hver pil i turen.':
 game==='cricket'?'Lukk 20–15 og Bull, ta poeng ved overskytende merker.':'';
}
function renderCorrections(){
 const section=$('specialCorrections');
 section.hidden=!(state.game==='cricket'&&state.status==='playing');
 if(section.hidden)return;
 $('specialEditActions').hidden=editingIndex===null;
 if(editingIndex!==null){
   const old=state.visits[editingIndex];
   $('specialEditLabel').textContent='Korriger '+state.players[old.player]+' – endre pilene, og lagre.';
 }
 for(let p=0;p<2;p++){
   $('specialThrowName'+p).textContent=state.players[p];
   const host=$('specialThrowChips'+p);host.replaceChildren();
   const last=state.visits.map((v,i)=>({visit:v,index:i}))
      .filter(({visit})=>visit.player===p&&visit.leg===state.leg&&visit.darts).slice(-3);
   const allowed=new Set(E.editableCricket(state,p));
   if(!last.length){const blank=document.createElement('span');blank.className='local-throw-empty';blank.textContent='Ingen kast ennå';host.appendChild(blank);continue}
   for(const row of last){
     const editable=allowed.has(row.index);
     const node=document.createElement(editable?'button':'span');
     node.className='local-throw-chip'+(editable?' editable':'');
     const taps=E.cricketDartTaps(row.visit.darts);
     const labels=E.TARGETS.filter(t=>taps.includes(t)).map(t=>(t==='B'?'BULL':t)+'×'+taps.filter(x=>x===t).length);
     const label=labels.join(' ')||'MISS';
     node.textContent=label+' ('+(row.visit.points||0)+'p)';
     if(editable){
       node.type='button';node.title='Korriger '+label;
       node.setAttribute('aria-label','Korriger '+label);
       node.addEventListener('click',()=>{
         editingIndex=row.index;pending=E.cricketDartTaps(row.visit.darts);
         info('Korriger kastet, og trykk Lagre korrigering.');
         renderPad();renderCorrections();
       });
     }
     host.appendChild(node);
   }
 }
}
function renderHistory(){
 dom.hist.replaceChildren();
 const last=state.visits.slice(-14).reverse();
 if(!last.length){const item=document.createElement('p');item.className='muted';item.textContent='Ingen kast registrert.';dom.hist.append(item);return}
 for(const v of last){
   const item=document.createElement('div');item.className='local-history-row';
   const title=document.createElement('strong'),detail=document.createElement('span'),point=document.createElement('strong');
   title.textContent=state.players[v.player];
   detail.textContent=(v.round?'Runde '+v.round:'Leg '+v.leg)+(v.codes?' · '+v.codes.join(','):Array.isArray(v.darts)?' · '+v.darts.map(labelDart).join(' '):v.hit!==undefined?' · '+(v.hit?'Treff':'Bom'):'');
   point.textContent=v.score!==undefined?String(v.score):v.points!==undefined?String(v.points):'';
   item.append(title,detail,point);dom.hist.append(item);
 }
}
function render(){
 dom.setup.hidden=!!state;dom.game.hidden=!state;
 document.body.classList.toggle('local-cricket-playing',state?.game==='cricket');
 document.body.classList.toggle('local-special-finished',state?.status==='finished');
 if(!state){window.DartArenaLocalResults?.syncSpecial(null,newGame);return;}
 if(state.game==='cricket'&&!cricketDisclosureInitialized){
   $('specialCorrections').open=!cricketMobile();
   cricketDisclosureInitialized=true;
 }
 $('localSpecialHeading').textContent=config[state.game]||'Lokale spill';
 $('specialGameName').textContent=E.stageName(state);
 $('specialStage').textContent=state.game==='chicago'?'Game '+state.stage+'/3':'Leg '+state.leg;
 $('specialFormat').textContent=state.game==='jdc'?'33 mål':state.game==='sixty_one'?state.minutes+' min/leg':'Best av '+state.bestOf;
 renderScores();stats();renderPad();renderCorrections();renderHistory();
 $('specialUndo').disabled=!state.undo?.length;
 $('specialBetween').hidden=state.status!=='between';
 $('specialFinish').hidden=state.status!=='finished';
 $('specialMessage').textContent=message||'Velg treff, og trykk Enter.';
 $('specialMessage').classList.toggle('is-error',isError);
 if(state.status==='between')$('specialBetweenText').textContent=state.game==='sixty_one'?'Leg ferdig':'Leg '+state.leg+' ferdig';
 if(state.status==='finished'){
   $('specialFinishTitle').textContent=state.winner===null?'Uavgjort':state.players[state.winner]+' vant!';
   $('specialFinishText').textContent=state.scores[0]+' – '+state.scores[1]+' · '+E.stageName(state);
 }
 $('specialTurn').textContent=state.status==='playing'?state.players[state.turn]+' kaster':state.status==='between'?'Leg ferdig':'Kampen er ferdig';
 if(mode()==='sixty_one'){
   dom.submit.hidden=true;dom.miss.hidden=true;dom.remove.hidden=true;dom.selected.parentElement.hidden=true;
 }
 const x=$('specialX01');if(x&&state.status==='playing')x.focus({preventScroll:true});
 if(state.status==='playing'&&mode()==='half'&&!halfMobile())halfInput()?.focus({preventScroll:true});
 if(state.status==='finished'&&document.body.classList.contains('special-cricket-stats-open'))closeCricketStats();
 window.DartArenaLocalResults?.syncSpecial(state,newGame);
}
function commit(fn,msg){
 try{state=fn();resetPending();message=msg||'Registrert.';isError=false;store();render()}
 catch(e){fail(e?.message||String(e))}
}
function pushCricketMark(target){
 if(!state||state.status!=='playing'||state.paused)return;
 const candidate=[...pending,target];
 try{E.cricketMarkDarts(candidate)}
 catch(e){return fail(e?.message||'Maks tre piler per tur.')}
 pending=candidate;info('');renderPad();
}
function push(dart){if(!state||state.status!=='playing'||state.paused)return;
 const max=mode()==='jdc'?neededJdc():3;if(pending.length>=max)return fail('Maks '+max+' piler per tur.');
 pending.push(dart);info('');renderPad();
}
function halfInput(){return $('specialHalfInput')}
function halfTypeDigit(digit){
 const input=halfInput();if(!input||input.value.length>=2)return;
 input.value+=digit;halfSelectedDart=null;
}
function halfDeleteDigit(){
 const input=halfInput();if(!input)return;
 input.value=input.value.slice(0,-1);halfSelectedDart=null;
}
function halfChooseField(n,mult){
 const input=halfInput();if(!input)return;
 const dart={n,mult};
 halfSelectedDart=dart;
 input.value=String(E.dartScore(dart));
 info(labelDart(dart)+' valgt. Trykk Enter for å registrere pilen.');
 input.focus({preventScroll:true});
}
function submitHalfDart(){
 if(!state||mode()!=='half'||state.status!=='playing'||state.paused)return;
 const input=halfInput(),raw=String(input?.value??'').trim();
 let dart;
 try{
   if(raw==='')dart={n:0,mult:0};
   else if(halfSelectedDart&&raw===String(E.dartScore(halfSelectedDart)))dart={...halfSelectedDart};
   else dart=E.halfDartFromScore(raw,E.halfRule(state));
 }catch(error){return fail(error?.message||'Ugyldig score for én pil.')}
 if(pending.length>=3)return;
 pending.push(dart);halfSelectedDart=null;
 if(pending.length===3){
   const darts=clonePending();
   commit(()=>E.submit(state,{darts,exactChoice:state.exactChoice}),'Tre piler registrert. Neste spiller.');
 }else{
   info((dart.n===0?'MISS':labelDart(dart))+' registrert. Pil '+(pending.length+1)+' av 3.');
   renderPad();renderScores();
   if(!halfMobile())halfInput()?.focus({preventScroll:true});
 }
}
function submit(){
 if(!state||state.status!=='playing')return;
 if(mode()==='half')return submitHalfDart();
 if(mode()==='jdc'&&pending.length!==neededJdc())return fail('Registrer alle pilene før Enter.');
 if(!pending.length)return fail('Velg minst én pil.');
 let darts;
 try{darts=mode()==='cricket'?E.cricketMarkDarts(pending):clonePending()}
 catch(e){return fail(e?.message||String(e))}
 if(editingIndex!==null){
   const index=editingIndex;
   commit(()=>E.correctCricket(state,index,darts),'Cricket-kast korrigert.');
 }else commit(()=>E.submit(state,mode()==='jdc'?{codes:darts}:{darts,exactChoice:state.exactChoice}),'Kast registrert.');
}
function clonePending(){return pending.map(x=>typeof x==='string'?x:{...x})}
function submit61(hit){if(state?.game!=='sixty_one'||state.status!=='playing'||state.paused)return;
 commit(()=>E.submit(state,{hit}),hit?'TREFF registrert.':'BOM registrert.')}
function x01score(){
 const input=$('specialX01');if(!input)return;
 const raw=input.value.trim(),n=Number(raw);
 if(!raw||!Number.isInteger(n))return fail('Skriv score 0–180.');
 if(n===state.scores[state.turn]){
   const opts=[1,2,3].filter(d=>w.DartArenaLocalH2HEngine?.validCheckout(n,d));
   if(!opts.length)return fail('Ugyldig dobbel-ut.');
   dom.choice.innerHTML=opts.map(d=>'<button class="primary" type="button" data-checkout="'+d+'">'+d+'</button>').join('');
   $('specialCheckoutLabel').textContent='Checkout '+n;
   dom.checkout.hidden=false;return;
 }
 const doubleIn=$('specialDoubleIn')?.checked===true;
 commit(()=>E.submit(state,{score:n,doubleIn}),'Score registrert.');
}
function finalizeCheckout(darts){
 const n=Number($('specialX01')?.value),doubleIn=$('specialDoubleIn')?.checked===true;
 commit(()=>E.submit(state,{score:n,darts,doubleIn}),'Checkout registrert.');
}
dom.mode.addEventListener('change',setupVisibility);
$('specialSetupForm').addEventListener('submit',event=>{
 event.preventDefault();try{
  state=E.init({game:dom.mode.value,name1:dom.name1.value,name2:dom.name2.value,
    bestOf:dom.legs.value,minutes:dom.minutes.value,starter:dom.starter.value});
  closeCricketStats();cricketDisclosureInitialized=false;
  resetPending();store();message='Kampen startet.';isError=false;render();
 }catch(e){$('specialSetupError').textContent=e.message;$('specialSetupError').hidden=false}
});
dom.controls.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||!state)return;
 if(button.dataset.ct)push({target:button.dataset.ct,mult:Number(button.dataset.cm)});
 else if(button.dataset.mark)pushCricketMark(button.dataset.mark);
 else if(button.dataset.n){if(mode()==='half')halfChooseField(Number(button.dataset.n),Number(button.dataset.m));else push({n:Number(button.dataset.n),mult:Number(button.dataset.m)})}
 else if(button.dataset.halfDigit!==undefined)halfTypeDigit(button.dataset.halfDigit);
 else if(button.dataset.halfAction==='delete')halfDeleteDigit();
 else if(button.dataset.halfAction==='enter')submitHalfDart();
 else if(button.dataset.jdc)push(button.dataset.jdc);
 else if(button.dataset.mult){halfFieldOpen=true;selectedMult=Number(button.dataset.mult);renderPad()}
 else if(button.dataset.exact){state.exactChoice=Number(button.dataset.exact);store();renderPad()}
 else if(button.dataset.hit)submit61(button.dataset.hit==='yes');
 else if(button.dataset.pause)commit(()=>E.pause(state),state.paused?'Fortsett':'Pause');
 else if(button.id==='specialX01Submit')x01score();
});
dom.choice.addEventListener('click',e=>{if(e.target.dataset.checkout)finalizeCheckout(Number(e.target.dataset.checkout))});
$('specialCheckoutCancel').addEventListener('click',()=>{dom.checkout.hidden=true;$('specialX01')?.focus()});
dom.miss.addEventListener('click',()=>mode()==='cricket'?pushCricketMark('MISS'):mode()==='half'?submitHalfDart():push({n:0,mult:0}));
dom.remove.addEventListener('click',()=>{pending.pop();halfSelectedDart=null;renderPad();if(mode()==='half')renderScores()});
dom.submit.addEventListener('click',submit);
$('specialCancelEdit').addEventListener('click',()=>{editingIndex=null;pending=[];info('Korrigeringen er avbrutt.');render()});
$('specialUndo').addEventListener('click',()=>{if(pending.length){pending.pop();halfSelectedDart=null;renderPad();if(mode()==='half')renderScores()}else if(state?.undo?.length)commit(()=>E.undo(state),'Angret siste registrering.')});
$('specialNext').addEventListener('click',()=>commit(()=>E.next(state),'Neste leg startet.'));
function newGame(){if(state?.status==='playing'&&!w.confirm('Avslutte lokal kamp?'))return;
 const players=state?.players||[],oldGame=state?.game;
 closeCricketStats();cricketDisclosureInitialized=false;
 state=null;resetPending();dom.name1.value=players[0]||'';dom.name2.value=players[1]||'';store(oldGame);render();}
$('specialNew').addEventListener('click',newGame);$('specialAgain').addEventListener('click',newGame);
document.addEventListener('keydown',event=>{
 if(event.ctrlKey||event.altKey||event.metaKey||event.isComposing||!state||state.status!=='playing')return;
 if(!dom.checkout.hidden){
   if(event.key==='Escape'){event.preventDefault();dom.checkout.hidden=true}
   else if(['1','2','3'].includes(event.key)){
     const b=dom.choice.querySelector('[data-checkout="'+event.key+'"]');
     if(b){event.preventDefault();finalizeCheckout(Number(event.key))}
   }return;
 }
 if(state.paused&&event.key.toLowerCase()!=='p')return;
 if(mode()==='x01'){
   if(event.key==='Enter'){event.preventDefault();x01score()}
   else if(event.target?.tagName!=='INPUT'&&/^[0-9]$/.test(event.key)){
     const input=$('specialX01');if(input){event.preventDefault();input.value=event.key;input.focus()}
   }return;
 }
 if(mode()==='half'){
   const input=halfInput();
   if(event.key==='Enter'){event.preventDefault();submitHalfDart();return}
   if(event.target===input)return; // Desktop input accepts native digits and Backspace
   if(event.target?.tagName==='INPUT'||event.target?.tagName==='TEXTAREA'||event.target?.tagName==='SELECT')return;
   if(/^\\d$/.test(event.key)){
     event.preventDefault();halfTypeDigit(event.key);
     if(!halfMobile())input?.focus({preventScroll:true});
   }else if(event.key==='Backspace'){
     event.preventDefault();halfDeleteDigit();
   }return;
 }
 if(event.target?.tagName==='INPUT'||event.target?.tagName==='TEXTAREA'||event.target?.tagName==='SELECT')return;
 const modeNow=mode(),key=event.key.toLowerCase();
 if(modeNow==='sixty_one'){
   if(event.code==='Space'){event.preventDefault();submit61(true)}
   else if(event.key==='Backspace'){event.preventDefault();submit61(false)}
   else if(key==='p'){event.preventDefault();commit(()=>E.pause(state),'Pause endret.')}
   else if(key==='z'){event.preventDefault();if(state.undo?.length)commit(()=>E.undo(state),'Angret.')}
   return;
 }
 if(event.key==='Enter'){event.preventDefault();submit();return}
 if(event.key==='Backspace'){event.preventDefault();pending.pop();renderPad();return}
 if(modeNow==='cricket'){
   const t=({'0':'20','9':'19','8':'18','7':'17','6':'16','5':'15','b':'B'})[key];
   if(t){event.preventDefault();pushCricketMark(t)}
   else if(key==='m'){event.preventDefault();pushCricketMark('MISS')}
 }else if(modeNow==='jdc'){
   const code=E.round(state)>=7&&E.round(state)<=27?({'0':'M','2':'H'})[key]:
      ({'0':'M','1':'S','2':'D','3':'T'})[key];
   if(code){event.preventDefault();push(code)}
 }
});
const q=new URLSearchParams(location.search).get('game');
const chosen=q&&config[q]?q:'cricket';
const stored=(()=>{try{return E.restore(JSON.parse(localStorage.getItem(storageKey(chosen))||'null'))}catch{return null}})();
if(stored){state=stored;message='Kamp gjenopprettet fra denne nettleseren.'}
if(!state)dom.mode.value=chosen;
setupVisibility();render();
setInterval(()=>{
 if(state?.game==='sixty_one'&&state.status==='playing'){
   if(!state.paused){const next=E.tick(state);if(next!==state){state=next;store()}}
   render();
 }
},1000);
})();
