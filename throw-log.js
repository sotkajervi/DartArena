(()=>{
const $=id=>document.getElementById(id),wait=setInterval(()=>{if(!window.supabase||!$('matchView'))return;clearInterval(wait);boot()},100);
async function boot(){
 const matchId=new URLSearchParams(location.search).get('id');if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const {data:{session}}=await db.auth.getSession();if(!session)return;const me=session.user.id;
 let {data:match}=await db.from('matches').select('*').eq('id',matchId).single();if(!match)return;const chicago=String(match.game_config?.chicago??'false').toLowerCase()==='true';let throws=[];
 const host=document.querySelector('.score-card');if(!host)return;
 const box=document.createElement('div');box.className='throw-log';box.innerHTML=`<div class="throw-log-head"><strong>Kast i dette leget</strong><small>${chicago?'Chicago Style • korrigering låst i testversjonen':'Trykk på et av dine siste kast for å korrigere'}</small></div><div class="throw-compact"><div class="throw-line"><span class="throw-line-label">DU</span><div id="myThrowRows" class="throw-chip-row"></div></div><div class="throw-line"><span class="throw-line-label">MOT</span><div id="oppThrowRows" class="throw-chip-row"></div></div></div>`;host.appendChild(box);
 const style=document.createElement('style');style.textContent='.throw-log{margin-top:14px;padding-top:11px;border-top:1px solid rgba(255,255,255,.1)}.throw-log-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.throw-log-head strong{font-size:.85rem}.throw-log-head small{opacity:.6;font-size:.68rem}.throw-compact{display:grid;gap:6px}.throw-line{display:grid;grid-template-columns:34px minmax(0,1fr);gap:7px;align-items:center}.throw-line-label{color:#54e6d0;font-size:.64rem;font-weight:950;letter-spacing:.1em}.throw-chip-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;min-width:0}.throw-chip{display:flex;align-items:center;justify-content:center;min-width:0;min-height:31px;padding:5px 7px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.035);color:#eef7f7;font-size:.82rem;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.throw-chip.editable{cursor:pointer;border-color:rgba(35,226,209,.28);background:rgba(35,226,209,.055);color:#dffdf9}.throw-chip.editable:hover,.throw-chip.editable:focus-visible{border-color:var(--cyan);color:#00eaf4;outline:none}.throw-edit-icon{margin-left:4px;color:#00eaf4;font-size:.7em}.throw-empty{opacity:.45;grid-column:1/-1;padding:6px 2px;font-size:.76rem}@media(max-width:600px){.throw-log-head small{display:none}.throw-line{grid-template-columns:30px minmax(0,1fr)}.throw-chip{font-size:.78rem;padding:5px 4px}}';document.head.appendChild(style);
 async function load(){const setNo=Number(match.current_set||1),legNo=Number(match.current_leg||1);const {data}=await db.from('match_throws').select('*').eq('match_id',matchId).eq('set_no',setNo).eq('leg_no',legNo).order('created_at',{ascending:true});throws=data||[];draw()}
 function renderColumn(elId,list,editable){const el=$(elId);el.innerHTML='';const recent=list.slice(-3);if(!recent.length){el.innerHTML='<div class="throw-empty">Ingen kast ennå</div>';return}recent.forEach(t=>{const label=t.is_checkout?`${t.score} (${t.darts_used}p)`:String(t.score);if(editable?.has(t.id)){const b=document.createElement('button');b.type='button';b.className='throw-chip editable';b.title=`Korriger ${label}`;b.setAttribute('aria-label',`Korriger kast ${label}`);const score=document.createElement('span');score.textContent=label;const icon=document.createElement('span');icon.className='throw-edit-icon';icon.setAttribute('aria-hidden','true');icon.textContent='✎';b.append(score,icon);b.onclick=()=>editThrow(t);el.appendChild(b)}else{const chip=document.createElement('span');chip.className='throw-chip';chip.textContent=label;el.appendChild(chip)}})}
 function draw(){const mine=throws.filter(t=>t.player_id===me),opp=throws.filter(t=>t.player_id!==me),editable=chicago?new Set():new Set(mine.slice(-3).map(t=>t.id));renderColumn('myThrowRows',mine,editable);renderColumn('oppThrowRows',opp,null)}
 function syncScoreDisplay(updated){const p1=$('matchScore1'),p2=$('matchScore2');if(p1)p1.textContent=updated.player1_score;if(p2)p2.textContent=updated.player2_score}
 async function chooseCheckoutDarts(score){
  const api=window.DartArenaCheckout;
  if(api?.possibleDarts&&!api.possibleDarts(score).length){alert(`${score} kan ikke avsluttes på tre piler.`);return null}
  if(api?.askDarts)return api.askDarts(score);
  const raw=prompt(`Checkout ${score}. Hvor mange piler brukte du? (1–3)`,'3');if(raw===null)return null;const darts=Number(raw);if(![1,2,3].includes(darts)){alert('Velg 1, 2 eller 3 piler.');return null}return darts
 }
 async function editThrow(t){
  if(chicago)return;
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
