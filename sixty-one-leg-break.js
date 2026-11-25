/* 61 result presentation. Leg winner is taken from authoritative leg-count
   changes, never inferred from checkout scores (sudden death can break ties). */
function sixtyOneLegTransition(){
 let previous=null;
 return match=>{
  if(!match||match.status!=='playing'){previous=null;return {close:true}}
  const next={leg:Number(match.current_leg||1),legs:[Number(match.player1_legs||0),Number(match.player2_legs||0)]};
  const prev=previous;previous=next;
  if(!prev)return {};
  if(next.leg<prev.leg||next.legs.some((v,i)=>v<prev.legs[i]))return {close:true};
  if(next.leg!==prev.leg+1)return {};
  const delta=next.legs.map((v,i)=>v-prev.legs[i]),winner=delta[0]===1&&delta[1]===0?0:delta[1]===1&&delta[0]===0?1:-1;
  if(winner<0)return {};
  const ids=[match.player1_id,match.player2_id];
  return {data:{leg:prev.leg,nextLeg:next.leg,legs:next.legs,ids,winnerId:ids[winner],starterId:match.match_starter_id||null}};
 };
}
function sixtyOneLegStats(rows,ids){
 return ids.map(id=>{
   const list=rows.filter(r=>r.player_id===id),hit=list.filter(r=>r.result==='hit');
   return {high:hit.reduce((max,r)=>Math.max(max,Number(r.target_before)||0),0),attempts:list.length};
 });
}
(()=>{
 const track=sixtyOneLegTransition(),get=id=>document.getElementById(id);
 const dialog=document.createElement('dialog');dialog.id='sixtyOneLegBreakDialog';dialog.className='da-dialog-card';dialog.setAttribute('aria-labelledby','sixtyOneLegTitle');
 dialog.innerHTML='<small class="da-dialog-kicker">61</small><h2 class="da-dialog-title" id="sixtyOneLegTitle"></h2><p id="sixtyOneLegWinner"></p><div id="sixtyOneLegScores"></div><p id="sixtyOneLegStanding"></p><p id="sixtyOneLegNext"></p><div class="da-dialog-actions one"><button type="button" class="da-dialog-confirm" id="sixtyOneLegContinue">Neste leg · ENTER</button></div>';
 document.body.append(dialog);
 let active=null;
 const name=id=>names[id]||'Spiller';
 function close(){active=null;if(dialog.open)dialog.close()}
 function paintScores(data,stats){
   const cards=get('sixtyOneLegScores');cards.replaceChildren();
   data.ids.forEach((id,i)=>{
     const card=document.createElement('div');card.className='sixty-one-leg-player'+(id===data.winnerId?' winner':'');
     const label=document.createElement('span');label.textContent=name(id);
     const caption=document.createElement('small');caption.textContent='HØYESTE UT';
     const high=document.createElement('strong');high.textContent=stats?String(stats[i].high):'–';
     const attempts=document.createElement('small');attempts.textContent=stats?stats[i].attempts+' forsøk':'';
     card.append(label,caption,high,attempts);cards.append(card);
   });
 }
 function show(data){
   active=data;
   get('sixtyOneLegTitle').textContent='Leg '+data.leg+' · Resultat';
   get('sixtyOneLegWinner').textContent=name(data.winnerId)+' vant leget!';
   paintScores(data,null);
   get('sixtyOneLegStanding').textContent='Stilling: '+data.legs.join(' – ');
   get('sixtyOneLegNext').textContent='Leg '+data.nextLeg+(data.starterId?' · '+name(data.starterId)+' starter':'');
   const history=get('sixtyOneHistoryDialog');if(history?.open)history.close();
   if(!dialog.open)dialog.showModal();get('sixtyOneLegContinue').focus({preventScroll:true});
   // The match-row update may arrive before the visits refresh. Read once
   // after the committed transition so checkout stats include the final throw.
   Promise.resolve().then(async()=>{
     const {data:rows,error}=await db.from('sixty_one_visits').select('player_id,result,target_before').eq('match_id',matchId).eq('leg_no',data.leg);
     if(error)throw error;
     if(active===data)paintScores(data,sixtyOneLegStats(rows||[],data.ids));
   }).catch(e=>console.warn('61 leg result details unavailable',e));
 }
 get('sixtyOneLegContinue').onclick=close;
 dialog.addEventListener('cancel',e=>e.preventDefault());
 window.addEventListener('keydown',e=>{
   if(!dialog.open)return;
   e.stopImmediatePropagation();
   if(e.key==='Enter'){e.preventDefault();if(!e.repeat)close()}
   else if(['0','2','Backspace','Escape','p','P','z','Z'].includes(e.key))e.preventDefault();
 },true);
 const base=render;
 function sync(){
   if(!m||!profile)return;
   const result=track(m);
   if(result.close)close();
   else if(result.data)show(result.data);
 }
 render=function(...args){const value=base.apply(this,args);sync();return value};
 sync();
})();
