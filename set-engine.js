(()=>{
const $=id=>document.getElementById(id);
const wait=setInterval(()=>{if(!window.supabase||!$('matchScoreBtn'))return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id'); if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const {data:{session}}=await db.auth.getSession(); if(!session)return;
 let {data:match}=await db.from('matches').select('*').eq('id',matchId).single(); if(!match)return;
 const me=session.user.id;
 function draw(){
   const setMode=match.match_mode==='sets';
   $('matchSets1')?.classList.toggle('hidden',!setMode);$('matchSets2')?.classList.toggle('hidden',!setMode);
   if($('matchSets1'))$('matchSets1').textContent=`${match.player1_sets||0} sets`;
   if($('matchSets2'))$('matchSets2').textContent=`${match.player2_sets||0} sets`;
   if($('matchLegs1'))$('matchLegs1').textContent=`${match.player1_legs||0} legs`;
   if($('matchLegs2'))$('matchLegs2').textContent=`${match.player2_legs||0} legs`;
   if($('matchFormat'))$('matchFormat').textContent=setMode?`${match.game} • BEST OF ${match.best_of_sets} SETS • BEST OF ${match.legs} LEGS`:`${match.game} • BEST OF ${match.legs} LEGS`;
 }
 draw();
 db.channel('set-engine-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{match=p.new;draw()}).subscribe();
 async function submit(){
   const input=$('matchScoreInput'),n=Number(input.value);
   if(!Number.isInteger(n)||n<0||n>180||match.status!=='playing'||match.turn_player_id!==me)return;
   const scoreKey=me===match.player1_id?'player1_score':'player2_score',remaining=Number(match[scoreKey]);
   if(n===remaining)return; // checkout-engine håndterer checkout + pileantall
   const btn=$('matchScoreBtn');btn.disabled=true;
   try{
     const {data,error}=await db.rpc('submit_x01_visit',{p_match_id:match.id,p_score:n});
     if(error||!data){$('matchMessage').textContent=error?.message||'Kastet kunne ikke lagres.';return}
     match=data.match||data;
     input.value='';
     $('matchMessage').textContent=data.bust?'Bust.':'';
     draw();
   }finally{
     btn.disabled=!(match.status==='playing'&&match.turn_player_id===me);
     if(!btn.disabled)requestAnimationFrame(()=>{input.focus({preventScroll:true});input.select()});
   }
 }
 $('matchScoreBtn').onclick=e=>{e.stopImmediatePropagation();submit()};
 $('matchScoreInput').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();submit()}};
}
})();
