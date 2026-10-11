/* Standalone offline bot match. Uses existing local X01 rules; never touches online ranking. */
(function(){
'use strict';
const E=window.DartArenaLocalH2HEngine,B=window.DartArenaBotEngine;
const $=id=>document.getElementById(id);
if(!E||!B||!$('botForm'))return;
const MATCH_KEY='dartarena-bot-match-v1',ADAPT_KEY='dartarena-bot-adaptive-v1',HISTORY_KEY='dartarena-bot-history-v1';
const LABELS={steady:'Jevn',erratic:'Ustabil',scorer:'Power Scorer',finisher:'Finisher'};
let state=null,config=null,botTimer=null,recorded=false;
const el={
 setup:$('botSetup'),match:$('botMatch'),form:$('botForm'),error:$('botSetupError'),
 name:$('botPlayerName'),mode:$('botMode'),average:$('botAverage'),profile:$('botProfile'),
 format:$('botFormat'),bestOf:$('botBestOf'),starter:$('botStarter'),hint:$('botAdaptiveHint'),
 history:$('botHistory'),meta:$('botMatchMeta'),humanName:$('botHumanName'),aiName:$('botAiName'),
 humanCard:$('botHumanCard'),aiCard:$('botAiCard'),humanTurn:$('botHumanTurn'),
 aiTurn:$('botAiTurn'),humanScore:$('botHumanScore'),aiScore:$('botAiScore'),
 humanAvg:$('botHumanAvg'),aiAvg:$('botAiAvg'),humanLegs:$('botHumanLegs'),aiLegs:$('botAiLegs'),
 inputForm:$('botScoreForm'),input:$('botScoreInput'),submit:$('botSubmit'),checkout:$('botCheckoutFields'),
 checkoutDarts:$('botCheckoutDarts'),checkoutConfirm:$('botCheckoutConfirm'),
 message:$('botMessage'),between:$('botBetween'),betweenText:$('botBetweenText'),
 next:$('botNextLeg'),finished:$('botFinished'),winner:$('botWinner'),throws:$('botThrows')
};
function read(key,fallback){
 try{const v=JSON.parse(localStorage.getItem(key)||'null');return v??fallback}catch{return fallback}
}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
function getAdaptive(){
 const item=read(ADAPT_KEY,{level:55,games:0});
 return {level:Math.max(20,Math.min(120,Number(item.level)||55)),
   games:Math.max(0,Number(item.games)||0)};
}
function history(){
 const data=read(HISTORY_KEY,[]);
 return Array.isArray(data)?data.slice(0,20):[];
}
function showHistory(){
 const rows=history();
 const adaptive=getAdaptive();
 $('botResetAdaptive').disabled=adaptive.games===0;
 const target=el.history;target.replaceChildren();
 if(!rows.length){target.textContent='Ingen botkamper registrert ennå.';return}
 for(const r of rows.slice(0,8)){
   const line=document.createElement('p');
   const title=document.createElement('b');
   title.textContent=(r.won?'Seier':'Tap')+' · '+String(r.format)+' · ';
   line.append(title,document.createTextNode(
     'du '+Number(r.you).toFixed(1)+' / bot '+Number(r.bot).toFixed(1)+
     ' i snitt · '+(r.adaptive?'Adaptive':'Standard')+
     ' · '+new Date(r.date).toLocaleDateString('nb-NO')));
   target.appendChild(line);
 }
}
function showHint(){
 const adaptive=getAdaptive(),isAdaptive=el.mode.value==='adaptive';
 el.hint.textContent=isAdaptive
   ?(adaptive.games?'Adaptivt nivå: '+adaptive.level.toFixed(1)+' etter '+adaptive.games+' kamper. Endres først etter fullført kamp.'
      :'Ingen fullførte botkamper ennå. Første adaptive kamp starter på valgt snitt.')
   :'Valgt snitt er et langsiktig statistisk mål, ikke en fast score per runde.';
}
function saveMatch(){
 if(!state||!config){try{localStorage.removeItem(MATCH_KEY)}catch{}return}
 write(MATCH_KEY,{state,config,recorded});
}
function msg(value,isError=false){
 el.message.textContent=value;
 el.message.classList.toggle('bot-error',isError);
}
function complete(){
 if(!state||state.status!=='finished'||recorded)return;
 recorded=true;
 const you=E.stats(state,0),bot=E.stats(state,1);
 const rows=history();
 rows.unshift({id:state.id,won:state.winner===0,format:state.format,
   adaptive:config.mode==='adaptive',you:you.average,bot:bot.average,date:new Date().toISOString()});
 write(HISTORY_KEY,rows.slice(0,20));
 if(config.mode==='adaptive'){
   const current=getAdaptive();
   write(ADAPT_KEY,{level:B.nextAdaptive(config.average,you.average),games:current.games+1});
 }
 saveMatch();showHistory();showHint();
}
function renderVisits(){
 el.throws.replaceChildren();
 const visits=state?.visits?.slice(-12).reverse()||[];
 if(!visits.length){el.throws.textContent='Ingen kast ennå.';return}
 for(const v of visits){
   const row=document.createElement('div');
   row.className='bot-throw-row'+(v.player===0?' bot-human-row':'');
   const title=document.createElement('strong');
   title.textContent=(v.player===0?state.players[0]:state.players[1])+
     ' · '+(v.bust?'BUST':String(v.score)+' poeng')+(v.checkout?' · CHECKOUT':'');
   const detail=document.createElement('p');
   detail.textContent=v.player===1&&Array.isArray(v.dartDetails)
     ?v.dartDetails.map(d=>d.aim+' → '+d.hit+(d.score?' ('+d.score+')':'')).join(' · ')
     :'Registrert '+(v.bust?'bust':v.score+' poeng')+(v.checkout?' med '+v.darts+' pil(er)':'');
   row.append(title,detail);el.throws.appendChild(row);
 }
}
function render(){
 const playing=!!state;
 el.setup.hidden=playing;el.match.hidden=!playing;
 if(!playing){showHistory();showHint();return}
 const human=E.stats(state,0),bot=E.stats(state,1);
 el.humanName.textContent=state.players[0];el.aiName.textContent=state.players[1];
 el.humanScore.textContent=state.scores[0];el.aiScore.textContent=state.scores[1];
 el.humanAvg.textContent=human.darts?human.average.toFixed(1):'–';
 el.aiAvg.textContent=bot.darts?bot.average.toFixed(1):'–';
 el.humanLegs.textContent=state.legs[0];el.aiLegs.textContent=state.legs[1];
 el.meta.textContent=state.format+' · best av '+state.bestOf+
   ' · '+(config.mode==='adaptive'?'Adaptive AI':'Standard Bot')+
   ' · mål '+Number(config.average).toFixed(1);
 const active=state.status==='playing';
 el.humanCard.classList.toggle('active',active&&state.turn===0);
 el.aiCard.classList.toggle('active',active&&state.turn===1);
 el.humanCard.classList.toggle('winner',state.status==='finished'&&state.winner===0);
 el.aiCard.classList.toggle('winner',state.status==='finished'&&state.winner===1);
 el.inputForm.hidden=!active||state.turn!==0;
 el.between.hidden=state.status!=='between';
 el.finished.hidden=state.status!=='finished';
 if(state.status==='between')el.betweenText.textContent='Leg '+state.leg+' ferdig · '+state.legs[0]+'–'+state.legs[1];
 if(state.status==='finished'){el.winner.textContent=state.players[state.winner]+' vant '+state.legs[0]+'–'+state.legs[1];complete()}
 renderVisits();
 if(active&&state.turn===1)scheduleBot();
}
function resetCheckout(){
 el.checkout.hidden=true;el.checkoutConfirm.checked=false;el.checkoutDarts.replaceChildren();
}
function scheduleBot(){
 if(botTimer!==null||!state||state.status!=='playing'||state.turn!==1)return;
 msg(state.players[1]+' kaster…');
 botTimer=setTimeout(()=>{
   botTimer=null;
   if(!state||state.status!=='playing'||state.turn!==1)return;
   try{
     const outcome=B.visit(state.scores[1],config);
     state=E.submit(state,outcome.score,{
       bust:outcome.bust,doubleConfirmed:outcome.checkout,darts:outcome.darts
     });
     const last=state.visits[state.visits.length-1];
     last.dartDetails=outcome.throws;
     if(outcome.bust)last.darts=outcome.darts;
     saveMatch();
     msg(outcome.bust?state.players[1]+' fikk BUST.':
       outcome.checkout?state.players[1]+' sjekket ut med '+outcome.darts+' piler.':
       state.players[1]+' scoret '+outcome.score+'.');
     render();
   }catch(err){msg('Botfeil: '+err.message,true)}
 },700);
}
function start(event){
 event.preventDefault();
 el.error.hidden=true;
 const name=String(el.name.value).trim().slice(0,32);
 const level=Number(el.average.value),profile=el.profile.value,mode=el.mode.value;
 if(!name||!Number.isInteger(level)||level<20||level>120||
   !B.profiles.includes(profile)||!['standard','adaptive'].includes(mode)){
   el.error.textContent='Skriv gyldig navn og et botnivå mellom 20 og 120.';el.error.hidden=false;return;
 }
 const adaptive=getAdaptive();
 const avg=mode==='adaptive'&&adaptive.games>0?adaptive.level:level;
 try{
   if(botTimer!==null){clearTimeout(botTimer);botTimer=null}
   state=E.setup({name1:name,name2:LABELS[profile]+' · '+avg.toFixed(0),
     format:Number(el.format.value),mode:'legs',bestOf:Number(el.bestOf.value),
     starter:Number(el.starter.value)});
   config={mode,profile,average:avg,sigma:B.calibrate(avg,profile)};
   recorded=false;window.DartArenaLocalNameHistory?.remember(name);
   saveMatch();resetCheckout();el.input.value='';
   msg('Kampen er i gang.');render();
 }catch(err){state=null;config=null;el.error.textContent=err.message;el.error.hidden=false;render()}
}
function humanSubmit(event){
 event.preventDefault();
 if(!state||state.status!=='playing'||state.turn!==0)return;
 const raw=el.input.value.trim(),value=Number(raw);
 if(!raw||!E.validScore(value)){msg('Skriv en mulig trepilsscore mellom 0 og 180.',true);return}
 const remaining=state.scores[0];
 let options={};
 if(value===remaining){
   const possible=E.checkoutOptions(value);
   if(!possible.length){msg('Denne scoren kan ikke sjekkes ut med maks tre piler.',true);return}
   if(el.checkout.hidden){
     el.checkoutDarts.replaceChildren();
     for(const n of possible){
       const opt=document.createElement('option');
       opt.value=String(n);opt.textContent=n+' pil'+(n===1?'':'er');el.checkoutDarts.append(opt);
     }
     el.checkout.hidden=false;
     msg('Bekreft dobbel og antall piler ved utsjekk.');
     return;
   }
   if(!el.checkoutConfirm.checked){msg('Bekreft at siste pil traff dobbel før utsjekk.',true);return}
   options={doubleConfirmed:true,darts:Number(el.checkoutDarts.value)};
 }
 try{
   state=E.submit(state,value,options);
   const latest=state.visits[state.visits.length-1];
   msg(latest.bust?'BUST. Restscore beholdes.':
     latest.checkout?'Utsjekk godkjent!':'Registrert '+latest.score+' poeng.');
   el.input.value='';resetCheckout();saveMatch();render();
 }catch(err){msg(err.message,true)}
}
function newMatch(){
 if(state?.status==='playing'&&!window.confirm('Avslutte den aktive botkampen?'))return;
 if(botTimer!==null){clearTimeout(botTimer);botTimer=null}
 const previous=state?.players?.[0];
 state=null;config=null;recorded=false;
 saveMatch();
 if(previous)el.name.value=previous;
 resetCheckout();render();el.name.focus();
}
el.form.addEventListener('submit',start);
el.mode.addEventListener('change',showHint);
el.inputForm.addEventListener('submit',humanSubmit);
el.input.addEventListener('input',resetCheckout);
el.next.addEventListener('click',()=>{
 if(!state||state.status!=='between')return;
 try{state=E.nextLeg(state);saveMatch();resetCheckout();msg('Neste leg er startet.');render()}
 catch(err){msg(err.message,true)}
});
$('botNewMatch').addEventListener('click',newMatch);
$('botPlayAgain').addEventListener('click',newMatch);
$('botResetAdaptive').addEventListener('click',()=>{
 if(!window.confirm('Nullstille botens lærte nivå? Tidligere kampresultater beholdes.'))return;
 try{localStorage.removeItem(ADAPT_KEY)}catch{}
 showHint();showHistory();
});
window.DartArenaLocalNameHistory?.attach(['botPlayerName']);
const saved=read(MATCH_KEY,null);
if(saved?.state&&saved?.config){
 const restored=E.restore(saved.state);
 if(restored&&['standard','adaptive'].includes(saved.config.mode)&&B.profiles.includes(saved.config.profile)
   &&Number(saved.config.sigma)>0){
   state=restored;config=saved.config;recorded=saved.recorded===true;
   el.name.value=state.players[0];el.mode.value=config.mode;el.profile.value=config.profile;
   el.average.value=String(Math.round(config.average));el.format.value=String(state.format);
   el.bestOf.value=String(state.bestOf);el.starter.value=String(state.firstStarter);
 }
}
render();
})();
