(()=>{
const $=id=>document.getElementById(id);
const wait=setInterval(()=>{if(!window.supabase||!$('matchScoreBtn'))return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id'); if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const {data:{session}}=await db.auth.getSession(); if(!session)return;
 let {data:match}=await db.from('matches').select('*').eq('id',matchId).single(); if(!match)return;
 const me=session.user.id;
 const isChicago=()=>String(match?.game_config?.chicago??'false').toLowerCase()==='true';
 const chicagoStage=()=>Number(match?.game_config?.chicago_stage||match?.current_leg||1);
 let legDelayUntil=0,legDelayTimer=null;
 function legDelayActive(){return Date.now()<legDelayUntil}
 function syncEntryLock(){
   const input=$('matchScoreInput'),btn=$('matchScoreBtn');
   if(!input||!btn)return;
   const mine=match.status==='playing'&&match.turn_player_id===me;
   const locked=mine&&legDelayActive();
   if(locked){
     input.disabled=true;
     btn.disabled=true;
     input.value='';
     input.blur();
     return;
   }
   input.disabled=!mine;
   btn.disabled=!mine;
   if(mine)requestAnimationFrame(()=>{if(!input.disabled){input.focus({preventScroll:true});input.select()}});
 }
 function startLegDelay(){
   clearTimeout(legDelayTimer);
   legDelayUntil=Date.now()+3000;
   syncEntryLock();
   legDelayTimer=setTimeout(()=>{legDelayUntil=0;syncEntryLock()},3000);
 }
 function draw(){
   const chicago=isChicago(),setMode=!chicago&&match.match_mode==='sets';
   $('matchSets1')?.classList.toggle('hidden',!setMode);$('matchSets2')?.classList.toggle('hidden',!setMode);
   if($('matchSets1'))$('matchSets1').textContent=`${match.player1_sets||0} sets`;
   if($('matchSets2'))$('matchSets2').textContent=`${match.player2_sets||0} sets`;
   if($('matchLegs1'))$('matchLegs1').textContent=chicago?`${match.player1_legs||0} game${Number(match.player1_legs||0)===1?'':'s'}`:`${match.player1_legs||0} legs`;
   if($('matchLegs2'))$('matchLegs2').textContent=chicago?`${match.player2_legs||0} game${Number(match.player2_legs||0)===1?'':'s'}`:`${match.player2_legs||0} legs`;
   if($('matchFormat')){
     if(chicago){
       const stage=chicagoStage(),label=stage===1?'301 DOUBLE IN / DOUBLE OUT':stage===3?'501 DOUBLE OUT':'CRICKET';
       $('matchFormat').textContent=`CHICAGO STYLE • GAME ${stage}/3 • ${label}`;
     }else $('matchFormat').textContent=setMode?`${match.game} • BEST OF ${match.best_of_sets} SETS • BEST OF ${match.legs} LEGS`:`${match.game} • BEST OF ${match.legs} LEGS`;
   }
 }
 draw();
 db.channel('set-engine-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{const oldSet=Number(match.current_set||1),oldLeg=Number(match.current_leg||1);match=p.new;const changedLeg=oldSet!==Number(match.current_set||1)||oldLeg!==Number(match.current_leg||1);if(changedLeg&&match.status==='playing')startLegDelay();draw();syncEntryLock()}).subscribe();
 async function submit(){
   const input=$('matchScoreInput'),raw=String(input.value??'').trim();
   if(!raw||legDelayActive())return;
   const n=Number(raw);
   if(!Number.isInteger(n)||n<0||n>180||match.status!=='playing'||match.turn_player_id!==me)return;
   const scoreKey=me===match.player1_id?'player1_score':'player2_score',remaining=Number(match[scoreKey]);
   if(n===remaining)return; // checkout-engine håndterer checkout + pileantall
   const btn=$('matchScoreBtn');btn.disabled=true;
   try{
     const rpc=isChicago()?'submit_chicago_x01_visit':'submit_x01_visit';
     const {data,error}=await db.rpc(rpc,{p_match_id:match.id,p_score:n});
     if(error||!data){$('matchMessage').textContent=error?.message||'Kastet kunne ikke lagres.';return}
     match=data.match||data;
     input.value='';
     $('matchMessage').textContent=data.bust?'Bust.':'';
     draw();
   }finally{syncEntryLock()}
 }
 const scoreBtn=$('matchScoreBtn'),scoreInput=$('matchScoreInput');
 scoreBtn.addEventListener('click',e=>{if(!legDelayActive())return;e.preventDefault();e.stopImmediatePropagation()},true);
 scoreInput.addEventListener('keydown',e=>{if(e.key!=='Enter'||!legDelayActive())return;e.preventDefault();e.stopImmediatePropagation()},true);
 scoreBtn.onclick=e=>{e.stopImmediatePropagation();submit()};
 scoreInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();submit()}};
 syncEntryLock();
 window.addEventListener('pagehide',()=>clearTimeout(legDelayTimer),{once:true});
}
})();
