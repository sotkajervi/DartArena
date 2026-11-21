/* X01 scoring controller: one authoritative match snapshot, one Enter handler.
   Uses existing checkout dialog, scoring RPC rules and UI. No media transport changes. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const wait=setInterval(()=>{
 const state=window.DartArenaMatchEngineState;
 if(!state?.match?.()||!state.profile?.()?.id||!state.applyScoreState||!window.DartArenaCheckout||!$('matchScoreInput')||!$('matchScoreBtn'))return;
 clearInterval(wait);boot(state);
},100);
function boot(state){
 if(window.__dartArenaX01ScoreController)return;
 window.__dartArenaX01ScoreController=true;
 const db=state.client(),me=state.profile().id,matchId=state.matchId();
 const input=$('matchScoreInput'),btn=$('matchScoreBtn');
 const current=()=>state.match();
 const mine=m=>m?.status==='playing'&&m.turn_player_id===me&&(m.game_variant||'x01')==='x01';
 const revision=m=>m?.updated_at||null;
 const message=t=>{const e=$('matchMessage');if(e)e.textContent=t};
 let busy=false,closed=false,fetching=null,entryRevision=revision(current()),uncertain=null,logSeen=new Map();
 function log(reason,error){
   const detail=String(error?.message||error||'').slice(0,180);
   const now=Date.now(),key=reason+'|'+detail;
   if(now-(logSeen.get(key)||0)<15000)return;
   if(logSeen.size>50)logSeen.clear();
   logSeen.set(key,now);
   console.warn('[X01 score]',reason,detail);
   Promise.resolve(db.from('client_error_logs').insert({
     user_id:me,match_id:matchId,page:location.pathname.split('/').pop()||'match.html',
     message:('X01 score: '+reason+(detail?' | '+detail:'')).slice(0,1000),source:'set-engine.js'
   })).catch(()=>{});
 }
 function draw(){
   const m=current();if(!m)return;
   const chicago=String(m.game_config?.chicago??'false').toLowerCase()==='true',setMode=!chicago&&m.match_mode==='sets';
   for(const p of [1,2]){
     const sets=$('matchSets'+p),legs=$('matchLegs'+p);
     sets?.classList.toggle('hidden',!setMode);
     if(sets)sets.textContent=(m['player'+p+'_sets']||0)+' sets';
     if(legs){const n=Number(m['player'+p+'_legs']||0);legs.textContent=chicago?n+' game'+(n===1?'':'s'):n+' legs'}
   }
   if($('matchFormat')){
     const stage=Number(m.game_config?.chicago_stage||m.current_leg||1);
     $('matchFormat').textContent=chicago
       ?'CHICAGO STYLE • GAME '+stage+'/3 • '+(stage===1?'301 DOUBLE IN / DOUBLE OUT':stage===3?'501 DOUBLE OUT':'CRICKET')
       :setMode?m.game+' • BEST OF '+m.best_of_sets+' SETS • BEST OF '+m.legs+' LEGS':m.game+' • BEST OF '+m.legs+' LEGS';
   }
   input.disabled=btn.disabled=busy||!mine(m);
 }
 function reconcile(){
   const m=current();if(!m)return;
   if(!busy&&revision(m)!==entryRevision){
     if(input.value.trim()!==''){
       input.value='';
       message(uncertain?'Kampstatus er endret. Kontroller kastloggen før du registrerer på nytt.':'Kampstatus er oppdatert. Registrer poengsummen på nytt ved behov.');
       log('entry_invalidated');
     }
     entryRevision=revision(m);
     uncertain=null;
   }
   draw();
 }
 async function bounded(make){
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),10000);
   try{return await make(controller.signal)}finally{clearTimeout(timer)}
 }
 async function refresh(){
   if(closed)return false;
   if(fetching)return fetching;
   fetching=(async()=>{
     try{
       const {data,error}=await bounded(signal=>db.from('matches').select('*').eq('id',matchId).abortSignal(signal).single());
       if(error||!data)throw error||Error('Kampstatus mangler');
       if(closed)return false;
       state.applyScoreState(data);
       reconcile();
       return true;
     }catch(e){log('refresh_failed',e);return false}
   })();
   try{return await fetching}finally{fetching=null}
 }
 async function submit(){
   if(closed||busy)return;
   const raw=String(input.value??'').trim(),n=Number(raw);
   if(!raw||!Number.isInteger(n)||n<0||n>180){message('Skriv en gyldig score fra 0 til 180.');log('invalid_score');return}
   const before=current(),expected=revision(before);
   if(!expected){message('Kampstatus mangler. Prøv igjen.');log('no_revision');return}
   if(entryRevision!==expected){
     input.value='';entryRevision=expected;message('Kampstatus er endret. Skriv poengsummen på nytt.');log('stale_input');return;
   }
   busy=true;draw();
   let sent=false,darts=null;
   try{
     message('Kontrollerer kampstatus…');
     if(!await refresh()){message('Får ikke kontakt med serveren. Scoren er ikke sendt. Prøv igjen.');return}
     if(revision(current())!==expected||!mine(current())){
       if(revision(current())!==expected){input.value='';uncertain=null}
       message('Kampstatus er oppdatert. Kontroller hvem som skal kaste før du registrerer igjen.');
       log('state_changed_before_submit');return;
     }
     const m=current(),remaining=Number(me===m.player1_id?m.player1_score:m.player2_score);
     if(n===remaining){
       if(!window.DartArenaCheckout.possibleDarts(n).length){message(n+' kan ikke avsluttes på tre piler.');log('invalid_checkout');return}
       message('');
       darts=await window.DartArenaCheckout.askDarts(n);
       if(!darts){message('Checkout avbrutt.');return}
       if(revision(current())!==expected||!mine(current())){
         input.value='';message('Kampstatus er endret. Kontroller scoren før du prøver igjen.');log('checkout_state_changed');return;
       }
     }
     message('Lagrer score…');
     sent=true;
     const {data,error}=await bounded(signal=>db.rpc('submit_x01_checked',{
       p_match_id:matchId,p_score:n,p_expected_at:expected,p_darts:darts
     }).abortSignal(signal));
     if(error||!data)throw error||Error('Mangler svar fra serveren');
     const next=data.match||data;
     if(!next?.id||next.id!==matchId)throw Error('Ugyldig svar fra serveren');
     input.value='';uncertain=null;state.applyScoreState(next);
     if(darts){
       const won=next.status==='finished',setWon=Number(next.current_set||1)>Number(before.current_set||1);
       message('Checkout '+n+' på '+darts+' '+(darts===1?'pil':'piler')+' • '+(won?'Kamp vunnet!':setWon?'Set vunnet!':'Leg vunnet!'));
     }else message(data.bust?'Bust.':'');
   }catch(error){
     log(sent?'submit_failed':'checkout_failed',error);
     if(sent){
       uncertain={revision:expected};
       const refreshed=await refresh();
       if(refreshed&&revision(current())!==expected){
         input.value='';uncertain=null;message('Kampstatus er endret. Kontroller kastloggen. Ikke registrer samme kast på nytt.');
       }else{
         message('Kastet er ikke bekreftet. Prøv igjen når forbindelsen er tilbake – samme kampstatus kontrolleres på serveren.');
       }
     }else message('Registreringen ble avbrutt. Prøv igjen.');
   }finally{
     busy=false;
     if(revision(current())!==expected&&input.value.trim()!=='')input.value='';
     entryRevision=revision(current());
     reconcile();
     if(!input.disabled)requestAnimationFrame(()=>{if(!input.disabled&&!closed)input.focus({preventScroll:true})});
   }
 }
 function onInput(){if(!busy)entryRevision=revision(current())}
 function click(e){e.preventDefault();e.stopImmediatePropagation();submit()}
 function key(e){if(e.key==='Enter'&&!e.repeat&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();submit()}}
 function wake(){if(!closed&&!document.hidden&&!busy&&current()?.status==='playing')refresh()}
 input.addEventListener('input',onInput);
 btn.addEventListener('click',click,true);
 input.addEventListener('keydown',key,true);
 // Remove old direct-write handlers. Both ordinary score and checkout use submit().
 btn.onclick=null;input.onkeydown=null;
 window.addEventListener('dartarena:score-state',reconcile);
 window.addEventListener('online',wake);
 document.addEventListener('visibilitychange',wake);
 const timer=setInterval(wake,15000);
 window.addEventListener('pagehide',()=>{
   closed=true;clearInterval(timer);
   window.removeEventListener('dartarena:score-state',reconcile);
   window.removeEventListener('online',wake);
   document.removeEventListener('visibilitychange',wake);
 },{once:true});
 reconcile();
 wake();
}
})();
