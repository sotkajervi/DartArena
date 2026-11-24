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
 let refreshFailures=0,nextRefreshAt=0,lastRefreshError=null;
 const offline=()=>navigator.onLine===false;
 // Place the blinking caret in X01 as each turn becomes playable.
 // Never open the mobile soft keyboard or steal focus from other text fields.
 let focusedTurn=null,initialFocusTimer=null;
 function focusScoreWhenReady(force=false){
   requestAnimationFrame(()=>{
     if(closed||busy||!mine(current())||input.disabled||input.readOnly||document.hidden)return;
     if(window.matchMedia?.('(max-width: 700px)').matches)return; // mobile uses its own keypad
     if(typeof document.hasFocus==='function'&&!document.hasFocus())return;
     const checkout=$('checkoutDartsDialog');
     if(checkout&&!checkout.classList.contains('hidden'))return;
     const active=document.activeElement;
     if(active&&active!==input){
       const tag=String(active.tagName||'').toUpperCase();
       if(['INPUT','TEXTAREA','SELECT'].includes(tag)||active.isContentEditable)return;
       if(!force&&active!==document.body&&active!==document.documentElement
         &&active.isConnected!==false&&active.getClientRects?.().length!==0)return;
     }
     if(active!==input)input.focus({preventScroll:true});
   });
 }
 function focusForNewTurn(){
   const m=current();
   const key=mine(m)?[m.id,m.current_set,m.current_leg,m.turn_player_id].join(':'):null;
   if(key===focusedTurn)return;
   focusedTurn=key;
   if(key)focusScoreWhenReady(true);
 }

 function log(reason,error){
   const detail=String(error?.message||error||'').slice(0,180);
   const now=Date.now(),key=reason+'|'+detail;
   if(now-(logSeen.get(key)||0)<15000)return;
   if(logSeen.size>50)logSeen.clear();
   logSeen.set(key,now);
   console.warn('[X01 score]',reason,detail);
   try{
     Promise.resolve(db.from('client_error_logs').insert({
       user_id:me,match_id:matchId,page:location.pathname.split('/').pop()||'match.html',
       message:('X01 score: '+reason+(detail?' | '+detail:'')).slice(0,1000),source:'set-engine.js'
     })).catch(()=>{});
   }catch(_){} // Telemetry must never interrupt scoring.
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
   input.disabled=btn.disabled=busy||!mine(m)||!!(uncertain&&!uncertain.verified);
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
   focusForNewTurn();
 }
 async function bounded(make,timeoutMs){
   const controller=new AbortController();let timedOut=false;
   const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs);
   try{
     const result=await make(controller.signal);
     if(timedOut&&result?.error)throw Error('Request timeout ('+timeoutMs/1000+' s)');
     return result;
   }catch(e){if(timedOut)throw Error('Request timeout ('+timeoutMs/1000+' s)');throw e}
   finally{clearTimeout(timer)}
 }
 async function refresh({force=false}={}){
   if(closed||offline())return false;
   // A forced post-submit read must be issued AFTER any existing poll.
   if(fetching){
     if(!force)return fetching;
     await fetching;
     if(closed||offline())return false;
     if(fetching)return refresh({force:true});
   }
   if(!force&&Date.now()<nextRefreshAt)return false;
   const task=(async()=>{
     try{
       const {data,error}=await bounded(signal=>db.from('matches').select('*').eq('id',matchId).abortSignal(signal).single(),15000);
       if(error||!data)throw error||Error('Kampstatus mangler');
       if(closed)return false;
       state.applyScoreState(data);
       refreshFailures=0;nextRefreshAt=0;lastRefreshError=null;
       if(uncertain){
         if(revision(current())!==uncertain.revision){
           input.value='';uncertain=null;
           message('Kampstatus er endret. Kontroller kastloggen. Ikke registrer samme kast på nytt.');
         }else{
           uncertain.verified=true;
           if(!busy)message('Kampstatus er bekreftet. Kontroller kastloggen før du eventuelt registrerer på nytt.');
         }
       }
       reconcile();return true;
     }catch(e){
       if(closed)return false;
       refreshFailures++;
       nextRefreshAt=Date.now()+Math.min(60000,15000*Math.pow(2,Math.min(refreshFailures-1,2)));
       const detail=String(e?.message||e);
       if(refreshFailures===1||detail!==lastRefreshError||refreshFailures%5===0)log('refresh_failed',e);
       lastRefreshError=detail;return false;
     }
   })();
   fetching=task;
   try{return await task}finally{if(fetching===task)fetching=null}
 }
 async function submit(){
   if(closed||busy)return;
   if(offline()){message('Ingen nettforbindelse. Vent til forbindelsen er tilbake.');return}
   if(uncertain&&!uncertain.verified){message('Venter på bekreftet kampstatus. Kastet sendes ikke på nytt.');return}
   const raw=String(input.value??'').trim(),n=Number(raw);
   if(!raw||!Number.isInteger(n)||n<0||n>180){message('Skriv en gyldig score fra 0 til 180.');return}
   const before=current(),expected=revision(before);
   if(!expected){message('Kampstatus mangler. Prøv igjen.');log('no_revision');return}
   if(entryRevision!==expected){
     input.value='';entryRevision=expected;message('Kampstatus er endret. Skriv poengsummen på nytt.');log('stale_input');return;
   }
   busy=true;draw();
   let sent=false,darts=null;
   try{
     // No extra read on each throw: the database RPC checks the exact
     // expected match revision under a row lock. Reconcile on rejection.
     if(!mine(before)){
       message('Det er ikke din tur. Kampstatus oppdateres.');
       log('turn_not_current');
       await refresh({force:true});
       return;
     }
     const m=before,remaining=Number(me===m.player1_id?m.player1_score:m.player2_score);
     if(n===remaining){
       if(!window.DartArenaCheckout.possibleDarts(n).length){message(n+' kan ikke avsluttes på tre piler.');return}
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
     }).abortSignal(signal),20000);
     if(error||!data)throw error||Error('Mangler svar fra serveren');
     const next=data.match||data;
     if(!next?.id||next.id!==matchId)throw Error('Ugyldig svar fra serveren');
     input.value='';uncertain=null;state.applyScoreState(next);
     if(darts){
       const won=next.status==='finished',setWon=Number(next.current_set||1)>Number(before.current_set||1);
       message('Checkout '+n+' på '+darts+' '+(darts===1?'pil':'piler')+' • '+(won?'Kamp vunnet!':setWon?'Set vunnet!':'Leg vunnet!'));
     }else message(data.bust?'Bust.':'');
   }catch(error){
     const reason=String(error?.message||'');
     const rejected=sent&&/DA_STALE_SCORE_STATE|DA_INVALID_SCORE_TURN/.test(reason);
     log(rejected?'stale_server_state':sent?'submit_failed':'checkout_failed',error);
     if(rejected){
       // The guarded RPC has definitely rejected this throw: never replay
       // it automatically and never leave a pending input from an old turn.
       const refreshed=await refresh({force:true});
       input.value='';uncertain=null;
       message(refreshed
         ?'Kampstatus ble endret. Kastet er ikke registrert herfra. Kontroller hvem som kaster før du prøver igjen.'
         :'Kampstatus er endret. Kunne ikke hente siste stilling. Kontroller kampen før du prøver igjen.');
     }else if(sent){
       uncertain={revision:expected,verified:false};
       const refreshed=await refresh({force:true});
       if(refreshed&&revision(current())!==expected){
         input.value='';uncertain=null;message('Kampstatus er endret. Kontroller kastloggen. Ikke registrer samme kast på nytt.');
       }else if(refreshed&&revision(current())===expected){
         message('Kastet er ikke bekreftet, men kampstatus er uendret. Kontroller kastloggen før du eventuelt registrerer på nytt.');
       }else{
         message('Kastet er ikke bekreftet. Vent på bekreftet kampstatus. Kastet sendes ikke automatisk på nytt.');
       }
     }else message('Registreringen ble avbrutt. Prøv igjen.');
   }finally{
     busy=false;
     if(revision(current())!==expected){input.value='';uncertain=null;}
     entryRevision=revision(current());
     reconcile();
     if(!input.disabled)focusScoreWhenReady(true);
   }
 }
 function onInput(){if(!busy)entryRevision=revision(current())}
 function click(e){e.preventDefault();e.stopImmediatePropagation();submit()}
 function key(e){if(e.key==='Enter'&&!e.repeat&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();submit()}}
 function wake(){if(!closed&&!document.hidden&&!busy&&current()?.status==='playing'){focusScoreWhenReady();refresh()}}
 function reconnect(){if(!closed&&!document.hidden&&!busy&&current()?.status==='playing'){nextRefreshAt=0;refresh({force:true})}}
 input.addEventListener('input',onInput);
 btn.addEventListener('click',click,true);
 input.addEventListener('keydown',key,true);
 // Remove old direct-write handlers. Both ordinary score and checkout use submit().
 btn.onclick=null;input.onkeydown=null;
 window.addEventListener('dartarena:score-state',reconcile);
 window.addEventListener('online',reconnect);
 window.addEventListener('focus',focusScoreWhenReady);
 document.addEventListener('visibilitychange',wake);
 const timer=setInterval(wake,15000);
 // Same-page handoff can finish loading the match UI after the first focus.
 initialFocusTimer=setTimeout(focusScoreWhenReady,700);
 window.addEventListener('pagehide',()=>{
   closed=true;clearInterval(timer);clearTimeout(initialFocusTimer);
   window.removeEventListener('dartarena:score-state',reconcile);
   window.removeEventListener('online',reconnect);
   window.removeEventListener('focus',focusScoreWhenReady);
   document.removeEventListener('visibilitychange',wake);
 },{once:true});
 reconcile();
 wake();
}
})();
