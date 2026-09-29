(()=>{
const $=id=>document.getElementById(id),matchId=new URLSearchParams(location.search).get('id');
const wait=setInterval(()=>{if(!window.supabase||!$('p1Card')||!$('p2Card')||typeof canAct!=='function'||typeof tickClock!=='function'||typeof tryFinalize!=='function')return;clearInterval(wait);boot()},100);
async function boot(){
 const db2=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const mk=(card,id)=>{if($(id))return;const e=document.createElement('div');e.id=id;e.className='sixty-one-highout';e.innerHTML='<span>HØYESTE UT</span><b>—</b>';card.appendChild(e)};mk($('p1Card'),'highOut1');mk($('p2Card'),'highOut2');
 const timerCard=document.querySelector('.sixty-one-timer-card');let b=$('startTimeBtn');if(!b){b=document.createElement('button');b.id='startTimeBtn';b.className='primary wide sixty-one-start-btn';b.textContent='▶ START TID';timerCard.insertBefore(b,$('pauseBtn'))}
 let note=$('sharedStartNote');if(!note){note=document.createElement('div');note.id='sharedStartNote';note.className='sixty-one-start-note';note.textContent='Venter på felles start';timerCard.insertBefore(note,b)}
 let sharedState=null;
 const sharedEnd=()=>state?.game_started_at?new Date(state.game_started_at).getTime()+Number(state.leg_duration_seconds||600)*1000:null;
 const originalCanAct=canAct;
 canAct=function(){
   if(!m||!state||m.status!=='playing'||m.turn_player_id!==profile?.id||submitting)return false;
   if(!state.game_started_at||state.is_paused)return false;
   if(state.sudden_death)return true;
   const end=sharedEnd();
   if(end&&Date.now()<end)return true;
   return ownAttempts()<otherAttempts();
 };
 tryFinalize=async function(){
   if(finalizing||!m||!state||m.status!=='playing'||state.sudden_death||state.is_paused||!state.game_started_at)return;
   const end=sharedEnd();if(!end||Date.now()<end)return;
   if(Date.now()-lastFinalizeAt<1000)return;lastFinalizeAt=Date.now();finalizing=true;
   try{const{data,error}=await db.rpc('finalize_sixty_one_leg',{p_match_id:matchId});if(error)throw error;await refreshGame();if(data?.sudden_death)$('matchMessage').textContent=`Lik høyeste ut – sudden death på ${data.target||state?.sudden_death_target||'samme mål'}!`;else if(data?.catch_up)$('matchMessage').textContent='Tiden er ute – siste spiller får like mange forsøk.';else if(data?.leg_won)$('matchMessage').textContent=m.status==='finished'?'Kampen er avgjort!':'Tiden er ute – leg avgjort!';if(m.status==='finished')await setPlayersUnavailable()}catch(e){console.warn('61 finalize',e)}finally{finalizing=false}
 };
 tickClock=function(){
   if(!state||!m)return;
   if(m.status!=='playing'){return}
   if(state.sudden_death){$('clock').textContent='SUDDEN DEATH';$('clock').classList.remove('done');return}
   if(!state.game_started_at){$('clock').textContent=fmt(Number(state.leg_duration_seconds||600)*1000);$('clock').classList.remove('done');return}
   if(state.is_paused)return;
   const left=sharedEnd()-Date.now();$('clock').textContent=fmt(left);$('clock').classList.toggle('done',left<=0);if(left<=0)tryFinalize();
 };
 async function load(){
   const{data,error}=await db2.from('sixty_one_match_state').select('game_started_at,player1_high_checkout,player2_high_checkout,leg_duration_seconds,sudden_death,sudden_death_target,sudden_death_first_result,is_paused').eq('match_id',matchId).single();if(error)return;sharedState=data;
   $('highOut1').querySelector('b').textContent=data.player1_high_checkout||'—';$('highOut2').querySelector('b').textContent=data.player2_high_checkout||'—';
   const started=!!data.game_started_at;b.classList.toggle('hidden',started);document.body.classList.toggle('sixty-one-not-started',!started);
   if(data.sudden_death)note.textContent=`SUDDEN DEATH • ${data.sudden_death_target} • begge får ett forsøk`;
   else note.textContent=started?'Felles servertid aktiv':'Begge klare? Start tiden';
   tickClock();
 }
 b.onclick=async()=>{b.disabled=true;b.textContent='Starter…';const{error}=await db2.rpc('start_sixty_one_match',{p_match_id:matchId});if(error){b.disabled=false;b.textContent='▶ START TID';alert(error.message);return}await load();try{await refreshGame()}catch{}};
 db2.channel('61-shared-start-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'sixty_one_match_state',filter:`match_id=eq.${matchId}`},load).subscribe();await load();
 let tries=0;const adopt=()=>{tries++;if(typeof clockTimer!=='undefined'&&clockTimer){clearInterval(clockTimer);clockTimer=setInterval(tickClock,250);return}if(tries<80)setTimeout(adopt,250)};adopt();
}
})();