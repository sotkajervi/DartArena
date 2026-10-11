/* Same premium result layout and stats calculation as online match-stats, using only local archived games. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const history=window.DartArenaH2HHistory,stats=window.DartArenaX01Stats;
const id=new URLSearchParams(window.location.search).get('id');
$('backBtn').addEventListener('click',()=>{window.location.href='./scoringarena.html#saH2HHistory'});
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const num=v=>Number(v)||0;
function date(value){
 const t=Date.parse(value||'');
 return Number.isFinite(t)?new Intl.DateTimeFormat('nb-NO',{
  day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'
 }).format(new Date(t)):'Dato ukjent';
}
function statRows(s,hasData){
 if(!s)return[['AVG','–'],['FIRST 9','–'],['HØYESTE UT','–'],['RASKESTE LEG','–'],
   ['100+','–'],['140+','–'],['170+','–'],['180','–']];
 return [
   ['AVG',hasData?s.avg.toFixed(2):'–'],
   ['FIRST 9',hasData&&s.first9Darts?s.first9.toFixed(2):'–'],
   ['HØYESTE UT',hasData?(s.high||'–'):'–'],
   ['RASKESTE LEG',hasData&&s.fast?s.fast+' piler':'–'],
   ['100+',hasData?s.c100:'–'],['140+',hasData?s.c140:'–'],
   ['170+',hasData?s.c170:'–'],['180',hasData?s.c180:'–']
 ];
}
function playerCard(pid,name,winner,values,hasData){
 const won=pid===winner;
 return '<article class="premium-player-card'+(won?' winner':'')+'">'+
   '<div class="premium-player-head"><div class="premium-player-icon">'+
   (won?'♛':esc(String(name).trim().slice(0,1).toUpperCase()||'?'))+'</div>'+
   '<div style="min-width:0"><div class="premium-player-name">'+esc(name)+'</div>'+
   (won?'<span class="premium-winner-badge">VINNER</span>':'')+'</div></div>'+
   '<div class="premium-stat-grid">'+statRows(values,hasData).map(([label,value])=>
    '<div class="premium-stat"><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>'
   ).join('')+'</div></article>';
}
function legRows(data,entry,first,second){
 let a=0,b=0;
 return data.map(v=>{
   if(v.player===first)a++;else if(v.player===second)b++;
   const darts=entry.visits.filter(t=>(t.set||1)===(v.set||1)&&t.leg===v.leg&&t.player===v.player)
     .reduce((sum,t)=>sum+stats.dartsFor({is_checkout:t.checkout,darts_used:t.darts}),0);
   return '<div class="premium-leg-row">'+
     '<span class="premium-leg-label">Leg '+num(v.leg)+'</span>'+
     '<span class="premium-leg-score">'+a+'–'+b+'</span>'+
     '<span class="premium-leg-winner'+(entry.winner===v.player?' match-winner':'')+'">'+esc(entry.players[v.player])+'</span>'+
     '<span class="premium-leg-meta">'+darts+' piler · checkout '+num(v.score)+'</span></div>';
 }).join('');
}
function legSection(entry,first,second){
 const legs=entry.visits.filter(v=>v.checkout);
 if(!legs.length)return '<section class="premium-leg-section"><div class="premium-leg-title">LEG-OVERSIKT</div><div class="premium-empty">Ingen ferdige legs registrert.</div></section>';
 let html='';
 if(entry.mode!=='sets'){
   html='<div class="premium-leg-list">'+legRows(legs,entry,first,second)+'</div>';
 }else{
   const groups=new Map();
   for(const v of legs){const set=v.set||1;if(!groups.has(set))groups.set(set,[]);groups.get(set).push(v)}
   html=[...groups.entries()].map(([setNo,data])=>{
     const a=data.filter(v=>v.player===first).length,b=data.filter(v=>v.player===second).length;
     const winner=a===b?'Uavgjort':entry.players[a>b?first:second];
     return '<div class="premium-set-block"><div class="premium-set-head"><strong>SETT '+
       setNo+'</strong><span><span class="set-winner">'+esc(winner)+'</span> · '+a+'–'+b+
       '</span></div><div class="premium-leg-list">'+legRows(data,entry,first,second)+'</div></div>';
   }).join('');
 }
 return '<section class="premium-leg-section"><div class="premium-leg-title">'+
   (entry.mode==='sets'?'SETT FOR SETT · LEGS':'LEG-OVERSIKT')+
   '</div>'+html+'</section>';
}
function throwSection(entry){
 const rows=entry.visits.map(v=>'<tr><td>'+esc((entry.mode==='sets'?'S'+(v.set||1)+' ':'')+'L'+v.leg)+'</td>'+
   '<td>'+esc(entry.players[v.player]||'Spiller')+'</td>'+
   '<td>'+esc(v.bust?'BUST':v.score)+'</td>'+
   '<td>'+esc(v.remaining??'–')+'</td>'+
   '<td>'+esc(stats.dartsFor({is_checkout:v.checkout,darts_used:v.darts}))+'</td></tr>').join('');
 return '<section class="premium-leg-section"><details class="local-premium-throws">'+
   '<summary class="premium-leg-title" style="cursor:pointer;margin:0;padding:4px 0">KASTLOGG · '+entry.visits.length+' REGISTRERINGER</summary>'+
   '<div style="overflow-x:auto"><table class="local-premium-throws-table">'+
   '<thead><tr><th>Leg</th><th>Spiller</th><th>Score</th><th>Igjen</th><th>Piler</th></tr></thead>'+
   '<tbody>'+rows+'</tbody></table></div></details></section>';
}
function render(){
 const entry=history?.read().find(x=>x.id===id);
 if(!entry){$('statsTitle').textContent='Kampen finnes ikke';$('statsMeta').textContent='Historikken er lagret lokalt i denne nettleseren.';$('statsView').innerHTML='<div class="premium-result-card"><div class="premium-empty">Fant ikke kampen. Gå tilbake til ScoringArena og oppdater historikken.</div></div>';return}
 const first=entry.winner,second=1-first;
 const names=entry.players,winName=names[first],score=entry.mode==='sets'?entry.sets:entry.legs;
 const all=entry.visits.map(v=>({
   player_id:v.player,score:v.score,is_checkout:v.checkout,darts_used:v.darts,
   set_no:v.set||1,leg_no:v.leg
 }));
 const statsBy=[stats.statsFor(all,0),stats.statsFor(all,1)];
 $('statsTitle').textContent=names[first]+' vs '+names[second];
 const description=date(entry.finishedAt)+' • Lokal Head-to-Head'+
   (entry.opponent==='adaptive'?' · Adaptive AI':entry.opponent==='bot'?' · Mot bot':' · Mot spiller');
 $('statsMeta').textContent=description;
 const format=entry.format+' • '+(entry.mode==='sets'
   ?'Best of '+entry.bestOfSets+' sets • Best of '+entry.bestOf+' legs'
   :'Best of '+entry.bestOf+' legs');
 const label=entry.mode==='sets'?'<div class="premium-result-score-label">SETS</div>':'';
 $('statsView').innerHTML=
 '<section class="premium-result-card"><div class="premium-result-kicker">KAMP FERDIG</div>'+
 '<h2 class="premium-result-title"><span class="winner-name">'+esc(winName)+'</span> vant!</h2>'+
 '<div class="premium-result-sub">'+esc(format)+'</div>'+
 '<div class="premium-result-score">'+score[first]+'<span>–</span>'+score[second]+'</div>'+label+
 '<div class="premium-player-grid">'+
 playerCard(first,names[first],entry.winner,statsBy[first],all.some(v=>v.player_id===first))+
 playerCard(second,names[second],entry.winner,statsBy[second],all.some(v=>v.player_id===second))+
 '</div>'+legSection(entry,first,second)+throwSection(entry)+'</section>';
}
try{history?.recover();render()}catch(e){
 console.error('Kunne ikke vise lokal kampstatistikk',e);
 $('statsView').innerHTML='<div class="premium-error">Kunne ikke laste kampstatistikken.</div>';
}
})();
