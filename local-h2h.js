/* Local Head-to-Head UI. No camera, Supabase or remote calls. */
(function(){
'use strict';
const E=window.DartArenaLocalH2HEngine;
const $=id=>document.getElementById(id);
if(!E||!$('localSetupForm'))return;
const KEY='dartarena-local-h2h-state-v1';
let state=null,pendingCheckout=null,message='Skriv score og trykk Enter.',isError=false;
const ui={
  setup:$('localSetup'),setupForm:$('localSetupForm'),setupError:$('localSetupError'),
  name1:$('localName1'),name2:$('localName2'),format:$('localFormat'),bestOf:$('localBestOf'),starter:$('localStarter'),
  game:$('localGame'),scoreForm:$('localScoreForm'),score:$('localScoreInput'),
  submit:$('localSubmit'),bust:$('localBust'),turn:$('localTurn'),
  between:$('localBetween'),finished:$('localFinished'),checkout:$('localCheckout'),
  checkoutForm:$('localCheckoutForm'),checkoutDarts:$('localCheckoutDarts'),checkoutTitle:$('localCheckoutTitle'),
  checkoutText:$('localCheckoutText'),history:$('localHistory'),message:$('localMessage')
};
function showMessage(text,error=false){message=text;isError=error;ui.message.textContent=text;ui.message.classList.toggle('is-error',error)}
function safeSave(){
  try{if(state)localStorage.setItem(KEY,JSON.stringify(state));else localStorage.removeItem(KEY)}
  catch{showMessage('Kampen kjører, men kunne ikke lagres i denne nettleseren.',true)}
}
function focusScore(){
  if(state?.status==='playing'&&!pendingCheckout){
    ui.score.focus({preventScroll:true});
    // Numeric inputs cannot reliably select text across all browsers.
  }
}
function player(i){return state.players[i]}
function statValue(id,value){$(id).textContent=String(value)}
function render(){
  ui.setup.hidden=!!state;ui.game.hidden=!state;
  if(!state)return;
  statValue('localFormatLabel',state.format);
  statValue('localLegLabel','Leg '+state.leg);
  statValue('localBestLabel','Best av '+state.bestOf);
  $('localUndo').disabled=!state.undo?.length;
  for(let i=0;i<2;i++){
    const st=E.stats(state,i),active=state.status==='playing'&&state.turn===i;
    const card=$('localPlayer'+i);
    card.classList.toggle('active',active);
    card.classList.toggle('winner',state.status==='finished'&&state.winner===i);
    statValue('localPlayerName'+i,player(i));
    statValue('localScore'+i,state.scores[i]);
    statValue('localLegs'+i,state.legs[i]);
    statValue('localAverage'+i,'3-dart snitt: '+(st.darts?st.average.toFixed(2).replace('.',','):'–'));
    statValue('localStatsName'+i,player(i));
    statValue('localStatAvg'+i,st.darts?st.average.toFixed(2).replace('.',','):'–');
    statValue('localStat100'+i,st.hundreds);
    statValue('localStat140'+i,st.forties);
    statValue('localStat180'+i,st.oneEighties);
    statValue('localStatCheckout'+i,st.highestCheckout||'–');
    statValue('localStatFastest'+i,st.fastestLeg!==null?st.fastestLeg+' piler':'–');
    statValue('localStatVisits'+i,st.visits);
  }
  const playing=state.status==='playing';
  ui.scoreForm.hidden=!playing;ui.bust.disabled=!playing;ui.submit.disabled=!playing;
  ui.between.hidden=state.status!=='between';ui.finished.hidden=state.status!=='finished';
  if(playing)ui.turn.textContent=player(state.turn)+' kaster · '+state.scores[state.turn]+' igjen';
  else if(state.status==='between'){
    const last=state.visits[state.visits.length-1];
    ui.turn.textContent='Leg '+state.leg+' ferdig';
    statValue('localBetweenTitle',player(last.player)+' vant leg '+state.leg);
    statValue('localBetweenText',player(1-state.starter)+' starter neste leg.');
  }else{
    ui.turn.textContent='Kampen er ferdig';
    statValue('localWinnerText',player(state.winner)+' vant!');
    statValue('localFinalText',state.legs[0]+' – '+state.legs[1]+' i legs · '+state.format+' · best av '+state.bestOf);
  }
  showMessage(message,isError);
  ui.history.replaceChildren();
  if(!state.visits.length){
    const empty=document.createElement('p');
    empty.className='muted compact';empty.textContent='Ingen kast registrert ennå.';
    ui.history.append(empty);
  }else{
    for(const visit of state.visits.slice(-14).reverse()){
      const row=document.createElement('div');row.className='local-history-row';
      const title=document.createElement('strong'),score=document.createElement('strong'),detail=document.createElement('span');
      title.textContent=player(visit.player);
      score.textContent=visit.bust?'BUST':visit.score+' poeng';
      detail.textContent='Leg '+visit.leg+' · '+(visit.checkout?'Utsjekk med '+visit.darts+' pil'+(visit.darts!==1?'er':''):visit.remaining+' igjen');
      row.append(title,score,detail);ui.history.append(row);
    }
  }
}
function commit(fn,msg){
  try{
    state=fn();
    pendingCheckout=null;
    ui.checkout.hidden=true;
    ui.score.value='';
    showMessage(msg||'Score registrert.');
    safeSave();render();focusScore();
  }catch(e){showMessage(e?.message||'Ugyldig registrering.',true)}
}
function closeCheckout(){
  pendingCheckout=null;
  ui.checkout.hidden=true;
  focusScore();
}
function openCheckout(score){
  const available=E.checkoutOptions(score);
  if(!available.length){
    showMessage('Dette er ikke en mulig utsjekk. Bruk BUST hvis turen ble ugyldig.',true);
    return;
  }
  pendingCheckout={score,player:state.turn};
  ui.checkoutTitle.textContent='Utsjekk: '+score+' poeng';
  ui.checkoutText.textContent=player(state.turn)+': bekreft at siste pil traff en dobbel.';
  ui.checkoutDarts.replaceChildren();
  for(const darts of available){
    const option=document.createElement('option');
    option.value=String(darts);
    option.textContent=darts+' pil'+(darts===1?'':'er');
    ui.checkoutDarts.appendChild(option);
  }
  ui.checkoutDarts.value=String(available[available.length-1]);
  ui.checkout.hidden=false;ui.checkoutDarts.focus();
}
ui.setupForm.addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const starter=Number(ui.starter.value);
    state=E.setup({name1:ui.name1.value,name2:ui.name2.value,
      format:ui.format.value,bestOf:ui.bestOf.value,starter});
    ui.setupError.hidden=true;message='Skriv score og trykk Enter.';isError=false;
    safeSave();render();focusScore();
  }catch(e){ui.setupError.textContent=e.message;ui.setupError.hidden=false}
});
ui.scoreForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!state||state.status!=='playing'||pendingCheckout)return;
  const raw=ui.score.value.trim();
  if(!raw){showMessage('Skriv en score fra 0 til 180.',true);return}
  const value=Number(raw);
  if(!Number.isInteger(value)||value<0||value>180){showMessage('Scoren må være fra 0 til 180.',true);return}
  if(value===state.scores[state.turn]){openCheckout(value);return}
  const p=state.turn,old=state.scores[p];
  const isBust=value>old||old-value===1;
  commit(()=>E.submit(state,value),isBust?'BUST – '+player(p)+' beholder '+old+'.':'Registrert: '+value+' poeng.');
});
$('localBust').addEventListener('click',()=>{
  if(!state||state.status!=='playing')return;
  const name=player(state.turn);
  commit(()=>E.bust(state),'BUST for '+name+'.');
});
document.querySelectorAll('[data-local-score]').forEach(btn=>btn.addEventListener('click',()=>{
  if(!state||state.status!=='playing')return;
  ui.score.value=btn.dataset.localScore;
  focusScore();
}));
$('localUndo').addEventListener('click',()=>{
  if(!state?.undo?.length)return;
  commit(()=>E.undo(state),'Siste registrering angret.');
});
$('localNextLeg').addEventListener('click',()=>commit(()=>E.nextLeg(state),'Neste leg startet.'));
ui.checkoutForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!pendingCheckout||!state||state.turn!==pendingCheckout.player)return closeCheckout();
  const score=pendingCheckout.score,darts=Number(ui.checkoutDarts.value),name=player(state.turn);
  commit(()=>E.submit(state,score,{doubleConfirmed:true,darts}),name+' sjekket ut '+score+' med '+darts+' pil'+(darts===1?'':'er')+'.');
});
$('localCheckoutCancel').addEventListener('click',closeCheckout);
$('localCheckoutBust').addEventListener('click',()=>{
  if(!pendingCheckout||!state)return closeCheckout();
  const score=pendingCheckout.score,name=player(state.turn);
  commit(()=>E.submit(state,score,{bust:true}),'BUST for '+name+'.');
});
function newMatch(){
  if(state&&state.status!=='finished'&&!window.confirm('Avslutte denne lokale kampen? Resultatet kan ikke gjenopprettes etterpå.'))return;
  const oldPlayers=state?.players||[];
  state=null;pendingCheckout=null;ui.checkout.hidden=true;
  ui.name1.value=oldPlayers[0]||'';ui.name2.value=oldPlayers[1]||'';
  safeSave();render();ui.name1.focus();
}
$('localNewMatch').addEventListener('click',newMatch);
$('localPlayAgain').addEventListener('click',newMatch);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!ui.checkout.hidden){event.preventDefault();closeCheckout()}});
try{state=E.restore(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{state=null}
if(state){message='Lokal kamp gjenopprettet fra denne nettleseren.';isError=false}
render();
})();
