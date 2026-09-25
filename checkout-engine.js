(()=>{
const $=id=>document.getElementById(id);
const wait=setInterval(()=>{if(!window.supabase||!$('matchScoreBtn')||!$('matchScoreInput'))return;clearInterval(wait);boot()},100);

async function boot(){
 const matchId=new URLSearchParams(location.search).get('id'); if(!matchId)return;
 const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
 const {data:{session}}=await db.auth.getSession(); if(!session)return;
 let {data:match}=await db.from('matches').select('*').eq('id',matchId).single(); if(!match)return;
 const me=session.user.id;
 let busy=false;
 const opponent=id=>id===match.player1_id?match.player2_id:match.player1_id;
 const starterFor=(setNo,legNo)=>{const base=match.match_starter_id||match.turn_player_id;const setStarter=setNo%2===1?base:opponent(base);return legNo%2===1?setStarter:opponent(setStarter)};
 db.channel('checkout-engine-'+matchId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},p=>{match=p.new}).subscribe();

 const singles=Array.from({length:20},(_,i)=>i+1),doubles=Array.from({length:20},(_,i)=>(i+1)*2).concat(50),triples=Array.from({length:20},(_,i)=>(i+1)*3),all=[...singles,...doubles,...triples,25,50];
 function canCheckout(score,darts){
   if(darts===1)return doubles.includes(score);
   if(darts===2)return all.some(a=>doubles.includes(score-a));
   if(darts===3)return all.some(a=>all.some(b=>doubles.includes(score-a-b)));
   return false;
 }
 function possibleDarts(score){return[1,2,3].filter(d=>canCheckout(score,d))}
 function ensureDialog(){
   if($('checkoutDartsDialog'))return;
   const box=document.createElement('div');box.id='checkoutDartsDialog';box.className='hidden';box.innerHTML='<div class="checkout-darts-card"><small>CHECKOUT</small><h2 id="checkoutDartsTitle">Hvor mange piler?</h2><p id="checkoutDartsHint" class="muted"></p><div id="checkoutDartsButtons" class="checkout-darts-buttons"></div><button id="checkoutDartsCancel" class="outline wide" type="button">Tilbake</button></div>';
   document.body.appendChild(box);
   const style=document.createElement('style');style.textContent='#checkoutDartsDialog{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:20px}#checkoutDartsDialog.hidden{display:none}.checkout-darts-card{width:min(420px,100%);background:#0c171a;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.45)}.checkout-darts-card h2{margin:7px 0}.checkout-darts-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:20px 0}.checkout-darts-buttons button{font-size:1.45rem;font-weight:800;padding:16px 10px}.checkout-darts-buttons button:disabled{opacity:.25;cursor:not-allowed}';document.head.appendChild(style);
 }
 ensureDialog();
 function askDarts(score){return new Promise(resolve=>{const dlg=$('checkoutDartsDialog'),buttons=$('checkoutDartsButtons'),allowed=possibleDarts(score);$('checkoutDartsTitle').textContent=`Checkout ${score}`;$('checkoutDartsHint').textContent='Hvor mange piler brukte du på å lukke?';buttons.innerHTML='';[1,2,3].forEach(n=>{const b=document.createElement('button');b.type='button';b.className=allowed.includes(n)?'primary':'outline';b.textContent=String(n);b.disabled=!allowed.includes(n);b.onclick=()=>{dlg.classList.add('hidden');resolve(n)};buttons.appendChild(b)});$('checkoutDartsCancel').onclick=()=>{dlg.classList.add('hidden');resolve(null)};dlg.classList.remove('hidden')})}
 async function finishCheckout(score,darts){
   if(busy||match.status!=='playing'||match.turn_player_id!==me)return;busy=true;
   try{
    const p1=me===match.player1_id,legKey=p1?'player1_legs':'player2_legs',setKey=p1?'player1_sets':'player2_sets',scoreKey=p1?'player1_score':'player2_score';
    const newLegs=Number(match[legKey]||0)+1,legsNeeded=Math.floor(Number(match.legs)/2)+1,patch={updated_at:new Date().toISOString()};
    if(match.match_mode!=='sets'){
      patch[legKey]=newLegs;
      if(newLegs>=legsNeeded){patch[scoreKey]=0;patch.status='finished';patch.winner_id=me;patch.finished_at=new Date().toISOString()}
      else{const nextLeg=Number(match.current_leg||1)+1;patch.player1_score=match.game;patch.player2_score=match.game;patch.current_leg=nextLeg;patch.turn_player_id=starterFor(1,nextLeg)}
    }else if(newLegs>=legsNeeded){
      const newSets=Number(match[setKey]||0)+1,setsNeeded=Math.floor(Number(match.best_of_sets)/2)+1;patch[setKey]=newSets;
      if(newSets>=setsNeeded){patch[legKey]=newLegs;patch[scoreKey]=0;patch.status='finished';patch.winner_id=me;patch.finished_at=new Date().toISOString()}
      else{const nextSet=Number(match.current_set||1)+1;patch.player1_legs=0;patch.player2_legs=0;patch.player1_score=match.game;patch.player2_score=match.game;patch.current_set=nextSet;patch.current_leg=1;patch.turn_player_id=starterFor(nextSet,1)}
    }else{const nextLeg=Number(match.current_leg||1)+1;patch[legKey]=newLegs;patch.player1_score=match.game;patch.player2_score=match.game;patch.current_leg=nextLeg;patch.turn_player_id=starterFor(Number(match.current_set||1),nextLeg)}
    const {data,error}=await db.from('matches').update(patch).eq('id',match.id).eq('turn_player_id',me).select().single();if(error){$('matchMessage').textContent=error.message;return}match=data;$('matchScoreInput').value='';$('matchMessage').textContent=`Checkout ${score} på ${darts} ${darts===1?'pil':'piler'} • ${match.status==='finished'?'Kamp vunnet!':(match.match_mode==='sets'&&newLegs>=legsNeeded?'Set vunnet!':'Leg vunnet!')}`;
   }finally{busy=false}
 }
 async function intercept(){
   if(busy||match.status!=='playing'||match.turn_player_id!==me)return false;
   const input=$('matchScoreInput'),n=Number(input.value);if(!Number.isInteger(n)||n<0||n>180)return false;
   const scoreKey=me===match.player1_id?'player1_score':'player2_score',remaining=Number(match[scoreKey]);if(n!==remaining)return false;
   const allowed=possibleDarts(remaining);if(!allowed.length){$('matchMessage').textContent=`${remaining} kan ikke avsluttes på tre piler.`;return true}
   const darts=await askDarts(remaining);if(darts)await finishCheckout(remaining,darts);return true;
 }
 const btn=$('matchScoreBtn'),input=$('matchScoreInput');
 btn.addEventListener('click',async e=>{if(await intercept()){e.preventDefault();e.stopImmediatePropagation()}},true);
 input.addEventListener('keydown',async e=>{if(e.key!=='Enter')return;const scoreKey=me===match.player1_id?'player1_score':'player2_score',n=Number(input.value);if(Number.isInteger(n)&&n===Number(match[scoreKey])){e.preventDefault();e.stopImmediatePropagation();await intercept()}},true);
}
})();