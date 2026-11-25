/* Shared online Half-It inter-leg presentation; no scoring or server changes. */
function halfItLegBreakData(match,rows,leg){
 const ids=[match.player1_id,match.player2_id];
 const last=ids.map(id=>rows.filter(r=>r.player_id===id&&Number(r.leg_no||1)===leg).sort((a,b)=>Number(b.round_no)-Number(a.round_no))[0]);
 if(last.some(r=>!r||Number(r.round_no)!==12||r.score_after==null))return null;
 const scores=last.map(r=>Number(r.score_after));
 if(scores.some(n=>!Number.isFinite(n)))return null;
 return {leg,ids,scores,winnerId:scores[0]>scores[1]?ids[0]:scores[1]>scores[0]?ids[1]:null,legs:[Number(match.player1_legs||0),Number(match.player2_legs||0)],nextLeg:Number(match.current_leg),starterId:match.match_starter_id||null};
}
function halfItLegBreakTracker(){
 let observed=null,pending=null;
 return (match,rows)=>{
   if(!match||match.status!=='playing'){pending=null;return {close:true}}
   const current=Math.max(1,Number(match.current_leg||1));
   if(observed===null){observed=current;return {}}
   if(current<observed)return {};
   if(current>observed){observed=current;pending=current-1}
   if(pending===null)return {};
   const data=halfItLegBreakData(match,rows,pending);
   if(!data)return {waiting:true};
   pending=null;return {data};
 };
}
(()=>{
 if(window.__dartArenaHalfLegBreak)return;
 window.__dartArenaHalfLegBreak=true;
 const track=halfItLegBreakTracker();
 const dialog=document.createElement('dialog');dialog.id='halfLegBreakDialog';dialog.className='da-dialog-card';dialog.setAttribute('aria-labelledby','halfLegBreakTitle');
 dialog.innerHTML='<small class="da-dialog-kicker">HALF-IT</small><h2 class="da-dialog-title" id="halfLegBreakTitle"></h2><div id="halfLegBreakWinner"></div><div id="halfLegBreakScores"></div><p id="halfLegBreakStanding"></p><p id="halfLegBreakNext"></p><div class="da-dialog-actions one"><button type="button" class="da-dialog-confirm" id="halfLegBreakContinue">Neste leg · ENTER</button></div>';
 document.body.append(dialog);
 const get=id=>document.getElementById(id),button=get('halfLegBreakContinue');
 let queued=null,retry=null,retryLeg=null;
 const name=id=>names[id]||'Spiller';
 function close(){queued=null;if(dialog.open)dialog.close()}
 function show(){
   if(!queued||m?.status!=='playing'||document.getElementById('halfCorrectionDialog')?.open)return;
   const data=queued;queued=null;
   get('halfLegBreakTitle').textContent='Leg '+data.leg+' · Resultat';
   get('halfLegBreakWinner').textContent=data.winnerId?name(data.winnerId)+' vant leget':'Leget endte uavgjort';
   const cards=get('halfLegBreakScores');cards.replaceChildren();
   data.ids.forEach((id,i)=>{
     const card=document.createElement('div');card.className='half-leg-break-player'+(id===data.winnerId?' winner':'');
     const label=document.createElement('span');label.textContent=name(id);
     const score=document.createElement('strong');score.textContent=String(data.scores[i]);
     card.append(label,score);cards.append(card);
   });
   get('halfLegBreakStanding').textContent='Stilling: '+data.legs.join(' – ');
   get('halfLegBreakNext').textContent='Leg '+data.nextLeg+(data.starterId?' · '+name(data.starterId)+' starter':'');
   if(!dialog.open)dialog.showModal();button.focus({preventScroll:true});
 }
 button.onclick=close;
 dialog.addEventListener('cancel',e=>e.preventDefault());
 // Capture before the game shortcut handler; ENTER must never submit a dart here.
 window.addEventListener('keydown',e=>{
   if(!dialog.open)return;
   if(e.key==='Enter'){e.preventDefault();if(!e.repeat)close()}
   else if(['Escape','0','1','2','3','Backspace'].includes(e.key))e.preventDefault();
   e.stopImmediatePropagation();
 },true);
 document.getElementById('halfCorrectionDialog')?.addEventListener('close',show);
 const base=render;
 function sync(){
   if(!m||!profile)return;
   const result=track(m,visits);
   if(result.close){clearTimeout(retry);close();return}
   if(result.data){clearTimeout(retry);queued=result.data;show()}
   // Match and visit reads may complete in different orders; retry at most once per leg.
   if(result.waiting&&retryLeg!==m.current_leg){retryLeg=m.current_leg;retry=setTimeout(()=>{if(m?.status==='playing')refreshGame().catch(e=>console.warn('Half-It leg result refresh failed',e))},250)}
 }
 render=function(...args){const value=base.apply(this,args);sync();return value};
 sync();
})();
