(()=>{
const $=id=>document.getElementById(id),wait=setInterval(()=>{if(!window.supabase||!$('matchP1')||!$('matchP2'))return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id');if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 let {data:match}=await db.from('matches').select('id,player1_id,player2_id').eq('id',matchId).single();if(!match)return;
 const add=(card,id)=>{const el=document.createElement('div');el.id=id;el.className='live-avg';el.innerHTML='<span>AVG</span> <b>0.00</b>';card.appendChild(el)};
 add($('matchP1'),'liveAvg1');add($('matchP2'),'liveAvg2');
 const dartsFor=v=>Number(v?.is_checkout?v?.darts_used:3)||3;
 const calc=(all,pid)=>{const v=(all||[]).filter(x=>x.player_id===pid),score=v.reduce((s,x)=>s+Number(x.score||0),0),darts=v.reduce((s,x)=>s+dartsFor(x),0);return darts?score/darts*3:0};
 async function load(){const{data}=await db.from('match_throws').select('player_id,score,darts_used,is_checkout').eq('match_id',matchId);$('liveAvg1').querySelector('b').textContent=calc(data,match.player1_id).toFixed(2);$('liveAvg2').querySelector('b').textContent=calc(data,match.player2_id).toFixed(2)}
 db.channel('live-avg-'+matchId).on('postgres_changes',{event:'*',schema:'public',table:'match_throws',filter:`match_id=eq.${matchId}`},load).subscribe();
 await load();
}
})();
