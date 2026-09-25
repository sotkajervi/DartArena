(()=>{
const $=id=>document.getElementById(id);
const wait=setInterval(()=>{if(!window.supabase||!$('matchScoreBtn'))return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id'); if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const {data:{session}}=await db.auth.getSession(); if(!session)return;
 let {data:match}=await db.from('matches').select('*').eq('id',matchId).single(); if(!match)return;
 const me=session.user.id;
 const opponent=id=>id===match.player1_id?match.player2_id:match.player1_id;
 const starterFor=(setNo,legNo)=>{const base=match.match_starter_id||match.turn_player_id;const setStarter=setNo%2===1?base:opponent(base);return legNo%2===1?setStarter:opponent(setStarter)};
 function draw(){const setMode=match.match_mode==='sets';$('matchSets1')?.classList.toggle('hidden',!setMode);$('matchSets2')?.classList.toggle('hidden',!setMode);if($('matchSets1'))$('matchSets1').textContent=`${match.player1_sets||0} sets`;if($('matchSets2'))$('matchSets2').textContent=`${match.player2_sets||0} sets`;if($('matchLegs1'))$('matchLegs1').textContent=`${match.player1_legs||0} legs`;if($('matchLegs2'))$('matchLegs2').textContent=`${match.player2_legs||0} legs`;if($('matchFormat'))$('matchFormat').textContent=setMode?`${match.game} • BEST OF ${match.best_of_sets} SETS • BEST OF ${match.legs} LEGS`:`${match.game} • BEST OF ${match.legs} LEGS`}
 draw();db.channel('set-engine-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{match=p.new;draw()}).subscribe();
 async function submit(){
   const input=$('matchScoreInput'),n=Number(input.value);if(!Number.isInteger(n)||n<0||n>180||match.status!=='playing'||match.turn_player_id!==me)return;
   const mineP1=me===match.player1_id,scoreKey=mineP1?'player1_score':'player2_score',legKey=mineP1?'player1_legs':'player2_legs',setKey=mineP1?'player1_sets':'player2_sets',left=Number(match[scoreKey])-n;
   if(left===0)return; // checkout-engine håndterer checkout og pileantall
   const before={...match},patch={updated_at:new Date().toISOString()};
   if(left<0||left===1){patch.turn_player_id=opponent(me);$('matchMessage').textContent='Bust.'}
   else{patch[scoreKey]=left;patch.turn_player_id=opponent(me);$('matchMessage').textContent=''}
   const {data,error}=await db.from('matches').update(patch).eq('id',match.id).eq('turn_player_id',me).select().single();if(error){$('matchMessage').textContent=error.message;return}
   match=data;input.value='';draw();
   if(window.DartArenaThrowLog?.record){const loggedScore=(left<0||left===1)?0:n;const r=await window.DartArenaThrowLog.record(loggedScore,3,false);if(r?.error)console.error('Throw log:',r.error)}
 }
 $('matchScoreBtn').onclick=e=>{e.stopImmediatePropagation();submit()};
 $('matchScoreInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();submit()}};
}
})();