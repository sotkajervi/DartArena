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
 async function editThrow(t){
  const raw=prompt('Ny score (0–180):',String(t.score));if(raw===null)return;const score=Number(raw);if(!Number.isInteger(score)||score<0||score>180){alert('Score må være 0–180.');return}
  const mine=throws.filter(x=>x.player_id===me),allowed=mine.slice(-3).some(x=>x.id===t.id);if(!allowed){alert('Bare dine tre siste kast i aktivt leg kan korrigeres.');return}
  if(t.is_checkout){alert('Checkout-kast korrigeres ikke her ennå.');return}
  const delta=score-Number(t.score),scoreKey=me===match.player1_id?'player1_score':'player2_score',oldRemaining=Number(match[scoreKey]),newRemaining=oldRemaining-delta;
  if(newRemaining<2){alert('Denne korrigeringen gir ugyldig restscore.');return}
  const {data:updated,error:matchErr}=await db.from('matches').update({[scoreKey]:newRemaining,updated_at:new Date().toISOString()}).eq('id',match.id).eq(scoreKey,oldRemaining).select().single();
  if(matchErr||!updated){alert('Restscore kunne ikke korrigeres. Prøv igjen.');return}
  const {error}=await db.from('match_throws').update({score,updated_at:new Date().toISOString()}).eq('id',t.id).eq('player_id',me);
  if(error){await db.from('matches').update({[scoreKey]:oldRemaining,updated_at:new Date().toISOString()}).eq('id',match.id);alert(error.message);return}
  match=updated;syncScoreDisplay(updated);await load();
 }
 db.channel('throw-log-'+matchId).on('postgres_changes',{event:'*',schema:'public',table:'match_throws',filter:`match_id=eq.${matchId}`},()=>load()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{const oldSet=match.current_set,oldLeg=match.current_leg;match=p.new;syncScoreDisplay(match);if(oldSet!==match.current_set||oldLeg!==match.current_leg)load()}).subscribe();
 await load();
 window.DartArenaThrowLog={async record(score,dartsUsed=3,isCheckout=false){const setNo=Number(match.current_set||1),legNo=Number(match.current_leg||1);const {count}=await db.from('match_throws').select('*',{count:'exact',head:true}).eq('match_id',matchId).eq('player_id',me).eq('set_no',setNo).eq('leg_no',legNo);const visitNo=Number(count||0)+1;return db.from('match_throws').insert({match_id:matchId,player_id:me,set_no:setNo,leg_no:legNo,visit_no:visitNo,score,darts_used:dartsUsed,is_checkout:isCheckout})}};
}
})();