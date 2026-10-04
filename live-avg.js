(()=>{
const $=id=>document.getElementById(id),wait=setInterval(()=>{if(!window.supabase||!$('matchP1')||!$('matchP2'))return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id');if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 let {data:match}=await db.from('matches').select('id,player1_id,player2_id,current_set,current_leg').eq('id',matchId).single();if(!match)return;
 const addAvg=(card,id)=>{const el=document.createElement('div');el.id=id;el.className='live-avg';el.innerHTML='<span>AVG</span><b>0.00</b>';card.appendChild(el)};
 const addDarts=(card,id)=>{const el=document.createElement('div');el.id=id;el.className='live-darts';el.innerHTML='<b>0</b><span>PILER</span>';card.appendChild(el)};
 addDarts($('matchP1'),'liveDarts1');addAvg($('matchP1'),'liveAvg1');
 addDarts($('matchP2'),'liveDarts2');addAvg($('matchP2'),'liveAvg2');
 const dartsFor=v=>Number(v?.is_checkout?v?.darts_used:3)||3;
 const calcAvg=(all,pid)=>{const v=(all||[]).filter(x=>x.player_id===pid),score=v.reduce((s,x)=>s+Number(x.score||0),0),darts=v.reduce((s,x)=>s+dartsFor(x),0);return darts?score/darts*3:0};
 const calcLegDarts=(all,pid,setNo,legNo)=>(all||[]).filter(x=>x.player_id===pid&&Number(x.set_no||1)===setNo&&Number(x.leg_no||1)===legNo).reduce((s,x)=>s+dartsFor(x),0);
 async function load(){
  const [matchRes,throwsRes]=await Promise.all([
   db.from('matches').select('current_set,current_leg').eq('id',matchId).single(),
   db.from('match_throws').select('player_id,score,darts_used,is_checkout,set_no,leg_no').eq('match_id',matchId)
  ]);
  if(matchRes.data){match.current_set=matchRes.data.current_set;match.current_leg=matchRes.data.current_leg}
  const data=throwsRes.data||[],setNo=Number(match.current_set||1),legNo=Number(match.current_leg||1);
  $('liveAvg1').querySelector('b').textContent=calcAvg(data,match.player1_id).toFixed(2);
  $('liveAvg2').querySelector('b').textContent=calcAvg(data,match.player2_id).toFixed(2);
  $('liveDarts1').querySelector('b').textContent=String(calcLegDarts(data,match.player1_id,setNo,legNo));
  $('liveDarts2').querySelector('b').textContent=String(calcLegDarts(data,match.player2_id,setNo,legNo));
 }
 const channel=db.channel('live-avg-'+matchId)
  .on('postgres_changes',{event:'*',schema:'public',table:'match_throws',filter:`match_id=eq.${matchId}`},load)
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},load)
  .subscribe();
 await load();
}
})();
