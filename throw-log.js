(()=>{
const $=id=>document.getElementById(id),wait=setInterval(()=>{if(!window.supabase||!$('matchView'))return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id');if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const {data:{session}}=await db.auth.getSession();if(!session)return;const me=session.user.id;
 let {data:match}=await db.from('matches').select('*').eq('id',matchId).single();if(!match)return;let throws=[];
 const host=document.querySelector('.score-card');if(!host)return;
 const box=document.createElement('div');box.className='throw-log';box.innerHTML='<div class="throw-log-head"><strong>Kast i dette leget</strong><small>Kun dine 3 siste kan korrigeres</small></div><div class="throw-cols"><section><div class="throw-col-title">DINE KAST</div><div id="myThrowRows"></div></section><section><div class="throw-col-title">MOTSTANDER</div><div id="oppThrowRows"></div></section></div>';host.appendChild(box);
 const style=document.createElement('style');style.textContent='.throw-log{margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1)}.throw-log-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.throw-log-head small{opacity:.65}.throw-cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}.throw-cols>section{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden}.throw-col-title{padding:9px 12px;font-size:.72rem;font-weight:900;letter-spacing:.12em;color:#54e6d0;background:rgba(255,255,255,.035)}.throw-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px 12px;border-top:1px solid rgba(255,255,255,.06);min-height:42px}.throw-row .throw-score{font-size:1.1rem;font-weight:800}.throw-row button{padding:5px 9px}.throw-empty{opacity:.5;padding:12px}@media(max-width:600px){.throw-log-head{align-items:flex-start;flex-direction:column}.throw-cols{gap:8px}.throw-row{padding:8px}.throw-row button{font-size:.75rem;padding:5px 6px}}';document.head.appendChild(style);
 async function load(){const setNo=Number(match.current_set||1),legNo=Number(match.current_leg||1);const {data}=await db.from('match_throws').select('*').eq('match_id',matchId).eq('set_no',setNo).eq('leg_no',legNo).order('created_at',{ascending:true});throws=data||[];draw()}
 function renderColumn(elId,list,editable){const el=$(elId);el.innerHTML='';if(!list.length){el.innerHTML='<div class="throw-empty">Ingen kast ennå</div>';return}list.forEach(t=>{const row=document.createElement('div');row.className='throw-row';const score=document.createElement('span');score.className='throw-score';score.textContent=t.is_checkout?`${t.score} (${t.darts_used}p)`:String(t.score);const action=document.createElement('span');if(editable?.has(t.id)){const b=document.createElement('button');b.className='outline';b.textContent='Korriger';b.onclick=()=>editThrow(t);action.appendChild(b)}row.append(score,action);el.appendChild(row)})}
 function draw(){const mine=throws.filter(t=>t.player_id===me),opp=throws.filter(t=>t.player_id!==me),editable=new Set(mine.slice(-3).map(t=>t.id));renderColumn('myThrowRows',mine,editable);renderColumn('oppThrowRows',opp,null)}
 function syncScoreDisplay(updated){const p1=$('matchScore1'),p2=$('matchScore2');if(p1)p1.textContent=updated.player1_score;if(p2)p2.textContent=updated.player2_score}
 async function chooseCheckoutDarts(score){
  const api=window.DartArenaCheckout;
  if(api?.possibleDarts&&!api.possibleDarts(score).length){alert(`${score} kan ikke avsluttes på tre piler.`);return null}
  if(api?.askDarts)return api.askDarts(score);
  const raw=prompt(`Checkout ${score}. Hvor mange piler brukte du? (1–3)`,'3');if(raw===null)return null;const darts=Number(raw);if(![1,2,3].includes(darts)){alert('Velg 1, 2 eller 3 piler.');return null}return darts
 }
 async function editThrow(t){
  const raw=prompt('Ny score (0–180):',String(t.score));if(raw===null)return;const score=Number(raw);if(!Number.isInteger(score)||score<0||score>180){alert('Score må være 0–180.');return}
  const mine=throws.filter(x=>x.player_id===me),allowed=mine.slice(-3).some(x=>x.id===t.id);if(!allowed){alert('Bare dine tre siste kast i aktivt leg kan korrigeres.');return}
  if(t.is_checkout){alert('Checkout-kast korrigeres ikke her ennå.');return}
  const scoreKey=me===match.player1_id?'player1_score':'player2_score',oldRemaining=Number(match[scoreKey]),newRemaining=oldRemaining-(score-Number(t.score));
  if(newRemaining===0){
   const darts=await chooseCheckoutDarts(score);if(!darts)return;
   const {data:updated,error}=await db.rpc('correct_throw_to_checkout',{p_throw_id:t.id,p_score:score,p_darts:darts});
   if(error||!updated){alert('Checkout-korrigeringen kunne ikke lagres: '+(error?.message||'ukjent feil'));return}
   match=updated;syncScoreDisplay(updated);const msg=$('matchMessage');if(msg)msg.textContent=`Korrigert til checkout ${score} på ${darts} ${darts===1?'pil':'piler'}.`;await load();return
  }
  const {data:updated,error}=await db.rpc('correct_x01_throw',{p_throw_id:t.id,p_score:score});
  if(error||!updated){alert('Korrigeringen kunne ikke lagres: '+(error?.message||'ukjent feil'));return}
  match=updated;syncScoreDisplay(updated);await load();
 }
 db.channel('throw-log-'+matchId).on('postgres_changes',{event:'*',schema:'public',table:'match_throws',filter:`match_id=eq.${matchId}`},()=>load()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{const oldSet=match.current_set,oldLeg=match.current_leg;match=p.new;syncScoreDisplay(match);if(oldSet!==match.current_set||oldLeg!==match.current_leg)load()}).subscribe();
 await load();
 // Kept as a compatibility surface. New X01 visits are written atomically by submit_x01_visit/submit_match_checkout.
 window.DartArenaThrowLog={refresh:load};
}
})();
