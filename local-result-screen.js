/* Offline result overlay: same visual structure/classes as online shared-results.
   Reads only local in-memory match state; never connects to Supabase. */
(function(root){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const n=value=>Number(value)||0;
 const initial=name=>String(name||'?').trim().slice(0,1).toUpperCase()||'?';
 const fmt=value=>n(value).toFixed(2);
 let lastKey=null;

 function hide(){
   document.getElementById('dartArenaResultOverlay')?.remove();
   document.body.classList.remove('da-result-open');
 }
 function statRows(rows){
   return (rows||[]).map(row=>'<div class="da-result-statrow"><span>'+esc(row.label)+'</span><b>'+esc(row.value)+'</b></div>').join('');
 }
 function comparisonTable(state,rows,order){
   const [first,second]=order;
   const valuesA=rows[first]||[],valuesB=rows[second]||[];
   const lineCount=Math.max(valuesA.length,valuesB.length);
   const values=Array.from({length:lineCount},(_,i)=>{
     const a=valuesA[i],b=valuesB[i];
     return '<tr><th scope="row">'+esc(a?.label||b?.label||'–')+'</th>'+
       '<td>'+esc(a?.value??'–')+'</td><td>'+esc(b?.value??'–')+'</td></tr>';
   }).join('');
   const name=p=>esc(state.players[p])+(state.winner===p?'<small>VINNER</small>':'');
   return '<section class="da-local-comparison" aria-label="Kampstatistikk">'+
     '<table><thead><tr><th scope="col">STATISTIKK</th>'+
     '<th scope="col"'+(state.winner===first?' class="is-winner"':'')+'>'+name(first)+'</th>'+
     '<th scope="col"'+(state.winner===second?' class="is-winner"':'')+'>'+name(second)+'</th>'+
     '</tr></thead><tbody>'+values+'</tbody></table></section>';
 }
 function playerCard(p,state,rows){
   const winning=state.winner===p;
   return '<article class="da-result-statcard'+(winning?' winner':'')+'"><div class="da-result-playerhead">'+
     '<div class="da-result-playericon">'+(winning?'♛':esc(initial(state.players[p])))+'</div>'+
     '<div style="min-width:0"><div class="da-result-stat-name">'+esc(state.players[p])+'</div>'+
     (winning?'<span class="da-result-winner-badge">VINNER</span>':'')+
     '</div></div><div class="da-result-statlist">'+statRows(rows[p])+'</div></article>';
 }
 function summaryHtml(items,state){
   if(!items?.length)return '';
   const all=items,visible=all.slice(-5),score=[0,0];
   const rows=visible.map(item=>{
     const left=Number.isInteger(state.winner)?state.winner:0,other=1-left;
     const winning=Number.isInteger(item.winner)?state.players[item.winner]:'Uavgjort';
     return '<div class="da-result-legrow"><span>'+esc(item.label)+'</span>'+
       '<span class="da-result-legscore">'+esc(item.score||'–')+'</span>'+
       '<span class="da-result-legwinner'+(item.winner===state.winner?' is-winner':'')+'">'+esc(winning)+'</span></div>';
   }).join('');
   return '<section class="da-result-legs"><div class="da-result-legs-title">'+
     (state.game==='chicago'?'SPILL FOR SPILL':'LEG-OVERSIKT')+'</div>'+rows+
     (all.length>5?'<div class="da-result-more">+ '+(all.length-5)+' tidligere</div>':'')+'</section>';
 }
 function x01Payload(state){
   const rows=state.visits.map(v=>({
     player_id:v.player,score:v.score,is_checkout:v.checkout,
     darts_used:v.darts,set_no:v.set||1,leg_no:v.leg
   }));
   const stats=[0,1].map(p=>{
     const s=root.DartArenaX01Stats?.statsFor(rows,p);
     return [
       {label:'3-DART AVG',value:s?fmt(s.avg):'–'},
       {label:'FIRST 9 AVG',value:s?fmt(s.first9):'–'},
       {label:'HØYESTE UT',value:s?.high||'–'},
       {label:'RASKESTE LEG',value:s?.fast?s.fast+' piler':'–'},
       {label:'100+',value:s?.c100??0},
       {label:'140+',value:s?.c140??0},
       {label:'170+',value:s?.c170??0},
       {label:'180',value:s?.c180??0}
     ];
   });
   let previousSet=null,legWins=[0,0];
   const summary=state.visits.filter(v=>v.checkout).map(v=>{
     const setNumber=v.set||1;
     if(state.mode==='sets'&&setNumber!==previousSet){legWins=[0,0];previousSet=setNumber}
     legWins[v.player]++;
     return {label:state.mode==='sets'?'S'+setNumber+' • L'+v.leg:'Leg '+v.leg,
       winner:v.player,score:legWins[0]+' – '+legWins[1]};
   });
   return {
     label:state.format+' X01',
     format:state.mode==='sets'?'Best av '+state.bestOfSets+' sets • Best av '+state.bestOf+' legs':'Best av '+state.bestOf+' legs',
     scores:state.mode==='sets'?state.sets:state.legs,
     stats,summary
   };
 }
 function specialPayload(state){
   const visits=state.visits||[];
   const forPlayer=p=>visits.filter(v=>v.player===p);
   const turns=visits.reduce((n,v)=>{if(v.winner!==undefined&&v.winner!==null)n.push(v);return n},[]);
   const summary=turns.map((visit,i)=>{
     const current=turns.slice(0,i+1).reduce((acc,v)=>{acc[v.winner]++;return acc},[0,0]);
     return{label:'Leg '+visit.leg,winner:visit.winner,score:current.join(' – ')};
   });
   let label=state.game,format='Best av '+state.bestOf+' legs',scores=state.legs,stats=[];
   if(state.game==='cricket'){
     label='Cricket';
     stats=[0,1].map(p=>{
       const v=forPlayer(p),marks=v.reduce((a,t)=>a+n(t.marks),0);
       return[
         {label:'MPR',value:v.length?fmt(marks/v.length):'0.00'},
         {label:'POENG',value:v.reduce((a,t)=>a+n(t.points),0)},
         {label:'MERKER',value:marks},
         {label:'KAST',value:v.length}
       ];
     });
   }else if(state.game==='half_standard'||state.game==='half_dartcounter'){
     label=state.game==='half_standard'?'Half-It (Standard)':'Half-It (DartCounter)';
     stats=[0,1].map(p=>{
       const v=forPlayer(p);
       return[
         {label:'SLUTTSCORE',value:state.scores[p]},
         {label:'BESTE RUNDE',value:Math.max(0,...v.map(x=>n(x.points)))},
         {label:'TREFFRUNDER',value:v.filter(x=>x.success).length},
         {label:'RUNDER SPILT',value:v.length}
       ];
     });
   }else if(state.game==='sixty_one'){
     label='61';format=state.minutes+' minutter • Best av '+state.bestOf+' legs';
     stats=[0,1].map(p=>{
       const v=forPlayer(p);
       return[
         {label:'HIGHSCORE',value:state.high61?.[p]||'–'},
         {label:'TREFF',value:v.filter(x=>x.hit===true).length},
         {label:'BOM',value:v.filter(x=>x.hit===false).length},
         {label:'FORSØK',value:v.length}
       ];
     });
   }else if(state.game==='jdc'){
     label='JDC Challenge';format='33 mål • Shanghai og doubles';scores=state.scores;
     const tier=x=>x>=1250?'Gold':x>=850?'Black':x>=700?'Red':x>=600?'Blue':x>=450?'Green':x>=300?'Yellow':x>=150?'Purple':'White';
     stats=[0,1].map(p=>{
       const v=forPlayer(p);
       return[
         {label:'POENG',value:state.scores[p]},
         {label:'TIER',value:tier(state.scores[p])},
         {label:'BESTE RUNDE',value:Math.max(0,...v.map(x=>n(x.points)))},
         {label:'SHANGHAI +100',value:v.filter(x=>x.bonus).length}
       ];
     });
   }else if(state.game==='chicago'){
     label='Chicago Style';format='301 DIDO • Cricket • 501 SIDO';scores=state.legs;
     const stages=[1,2,3].map(stage=>visits.filter(v=>v.stage===stage));
     const winners=[
       stages[0].find(v=>v.checkout)?.player,
       (stages[2].length||state.status==='finished'&&state.stage===2)?stages[1].at(-1)?.player:undefined,
       stages[2].find(v=>v.checkout)?.player
     ];
     stats=[0,1].map(p=>[
       ...['301 DIDO','CRICKET','501 SIDO'].map((title,i)=>({label:title,value:winners[i]===undefined?'–':winners[i]===p?'VANT':'TAP'})),
       {label:'VUNNE SPILL',value:state.legs[p]}
     ]);
     summary.length=0;
     const tallies=[0,0];
     ['301 DIDO','Cricket','501 SIDO'].forEach((name,i)=>{
       if(winners[i]===undefined)return;
       tallies[winners[i]]++;
       summary.push({label:name,winner:winners[i],score:tallies.join(' – ')});
     });
   }else{
     stats=[0,1].map(p=>[{label:'SCORE',value:state.scores[p]},
       {label:'LEGS',value:state.legs[p]},
       {label:'KAST',value:forPlayer(p).length},{label:'STATUS',value:p===state.winner?'VANT':'FERDIG'}]);
   }
   return{label,format,scores,stats,summary};
 }
 function show(state,payload,onRematch){
   hide();
   const order=Number.isInteger(state.winner)?[state.winner,1-state.winner]:[0,1];
   const [a,b]=order;
   const winner=Number.isInteger(state.winner)?state.players[state.winner]:null;
   const result=payload.scores||[0,0];
   const note='DartArena • lokal kamp, lagret bare i denne nettleseren';
   document.body.classList.add('da-result-open');
   const overlay=document.createElement('div');
   overlay.id='dartArenaResultOverlay';
   overlay.className='da-result-overlay';
   overlay.innerHTML='<section class="da-result-card" role="dialog" aria-modal="true" aria-label="Kampresultat">'+
     '<div class="da-result-kicker">KAMP FERDIG</div>'+
     '<h1 class="da-result-title"><span class="da-result-winner-name">'+esc(winner||'Uavgjort')+'</span>'+(winner?' vant!':'')+'</h1>'+
     '<div class="da-result-sub">'+esc(payload.label)+' • '+esc(payload.format)+'</div>'+
     '<div class="da-result-scorebox">'+esc(result[a])+'<span>–</span>'+esc(result[b])+'</div>'+
     '<div class="da-result-stats">'+playerCard(a,state,payload.stats)+playerCard(b,state,payload.stats)+'</div>'+
     comparisonTable(state,payload.stats,order)+
     summaryHtml(payload.summary,state)+
     '<div class="da-result-actions"><button type="button" class="primary" id="daLocalResultNew">Ny kamp</button>'+
     '<button type="button" class="outline" id="daLocalResultLobby">Til lobby</button>'+
     '<button type="button" class="outline" id="daLocalResultReview">Se kampskjerm</button></div>'+
     '<p class="da-result-note">'+esc(note)+'</p></section>';
   document.body.appendChild(overlay);
   overlay.querySelector('#daLocalResultNew').addEventListener('click',()=>{
     if(typeof onRematch!=='function')return;
     hide();
     onRematch();
   });
   overlay.querySelector('#daLocalResultLobby').addEventListener('click',()=>{location.href='./'});
   overlay.querySelector('#daLocalResultReview').addEventListener('click',hide);
 }
 function sync(state,kind,onRematch){
   if(!state||state.status!=='finished'){
     hide();lastKey=null;return;
   }
   const key=kind+':'+state.id+':'+state.visits.length+':'+state.winner+':'+state.leg;
   if(lastKey===key)return;
   const payload=kind==='x01'?x01Payload(state):specialPayload(state);
   lastKey=key;
   show(state,payload,onRematch);
 }
 root.DartArenaLocalResults={syncX01:(state,onRematch)=>sync(state,'x01',onRematch),
   syncSpecial:(state,onRematch)=>sync(state,'special',onRematch),hide,
   isOpen:()=>!!document.getElementById('dartArenaResultOverlay')};
})(window);
