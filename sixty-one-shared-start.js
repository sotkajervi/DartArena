(()=>{
const $=id=>document.getElementById(id),matchId=new URLSearchParams(location.search).get('id');
const wait=setInterval(()=>{if(!window.supabase||!$('p1Card')||!$('p2Card'))return;clearInterval(wait);boot()},100);
async function boot(){
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const mk=(card,id)=>{const e=document.createElement('div');e.id=id;e.className='sixty-one-highout';e.innerHTML='<span>HØYESTE UT</span><b>—</b>';card.appendChild(e)};mk($('p1Card'),'highOut1');mk($('p2Card'),'highOut2');
 const timerCard=document.querySelector('.sixty-one-timer-card');const b=document.createElement('button');b.id='startTimeBtn';b.className='primary wide sixty-one-start-btn';b.textContent='▶ START TID';timerCard.insertBefore(b,$('pauseBtn'));
 const note=document.createElement('div');note.id='sharedStartNote';note.className='sixty-one-start-note';note.textContent='Venter på felles start';timerCard.insertBefore(note,b);
 let state=null;
 async function load(){const{data,error}=await db.from('sixty_one_match_state').select('game_started_at,player1_high_checkout,player2_high_checkout,leg_duration_seconds,sudden_death').eq('match_id',matchId).single();if(error)return;state=data;$('highOut1').querySelector('b').textContent=data.player1_high_checkout||'—';$('highOut2').querySelector('b').textContent=data.player2_high_checkout||'—';const started=!!data.game_started_at;b.classList.toggle('hidden',started);note.textContent=started?'Felles servertid aktiv':'Begge klare? Start tiden';document.body.classList.toggle('sixty-one-not-started',!started)}
 b.onclick=async()=>{b.disabled=true;b.textContent='Starter…';const{error}=await db.rpc('start_sixty_one_match',{p_match_id:matchId});if(error){b.disabled=false;b.textContent='▶ START TID';alert(error.message);return}await load()};
 db.channel('61-shared-start-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'sixty_one_match_state',filter:`match_id=eq.${matchId}`},load).subscribe();await load();
}
})();