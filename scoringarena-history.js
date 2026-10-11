/* Online-match-history styling and controls for local Head-to-Head games. */
(function(){
'use strict';
const H=window.DartArenaH2HHistory;
const $=id=>document.getElementById(id);
if(!H||!$('saH2HHistory'))return;
const container=$('saHistoryList'),count=$('saHistoryCount'),more=$('saHistoryMore');
let activeFilter='all',expanded=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function date(value){
 const t=Date.parse(value||'');
 if(!Number.isFinite(t))return '–';
 return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(t));
}
const kind=entry=>entry.opponent==='adaptive'?'Adaptive AI':entry.opponent==='bot'?'Mot bot':'Mot spiller';
const result=entry=>entry.mode==='sets'?entry.sets:entry.legs;
function render(){
 const all=H.read(),filtered=all.filter(entry=>activeFilter==='all'||
   (activeFilter==='bot'&&entry.opponent!=='human')||
   (activeFilter==='human'&&entry.opponent==='human'));
 count.textContent=filtered.length+' '+(filtered.length===1?'kamp':'kamper');
 if(!filtered.length){
   container.innerHTML='<p class="muted history-empty">'+(all.length?
     'Ingen kamper passer filteret.':'Ingen ferdige X01-kamper lagret ennå.')+'</p>';
   more.hidden=true;return;
 }
 const rows=expanded?filtered:filtered.slice(0,8);
 container.innerHTML=rows.map(entry=>{
   const p1=entry.players?.[0]||'Spiller 1',p2=entry.players?.[1]||'Spiller 2';
   const r=result(entry),winner=entry.winner;
   const format=entry.mode==='sets'
     ?'Best of '+entry.bestOfSets+' sets · Best of '+entry.bestOf+' legs'
     :'Best of '+entry.bestOf+' legs';
   return '<article class="history-row">'+
    '<div class="history-main">'+
      '<div class="history-title">'+
       '<span class="history-game">'+esc(entry.format)+'</span>'+
       '<span class="history-player'+(winner===0?' winner':'')+'">'+esc(p1)+'</span>'+
       '<span class="history-result">'+esc(r[0])+'–'+esc(r[1])+'</span>'+
       '<span class="history-player'+(winner===1?' winner':'')+'">'+esc(p2)+'</span>'+
      '</div>'+
      '<div class="history-meta">'+
       '<span>'+esc(date(entry.finishedAt))+'</span>'+
       '<span>'+esc(format)+'</span>'+
       '<span class="history-tag">'+esc(kind(entry))+'</span>'+
      '</div>'+
     '</div>'+
     '<div class="history-actions">'+
      '<button type="button" class="small-btn" data-local-stats="'+esc(entry.id)+'">Se statistikk</button>'+
      '<button type="button" class="small-btn danger" data-local-delete="'+esc(entry.id)+'">Slett</button>'+
     '</div></article>';
 }).join('');
 container.querySelectorAll('[data-local-stats]').forEach(button=>{
   button.addEventListener('click',()=>{
     const id=button.dataset.localStats;
     window.open('local-match-stats.html?id='+encodeURIComponent(id),
       'dartarena-local-match-stats-'+id);
   });
 });
 container.querySelectorAll('[data-local-delete]').forEach(button=>{
   button.addEventListener('click',()=>{
     if(!window.confirm('Slette denne lokale kampen fra historikken? Dette kan ikke angres.'))return;
     if(!H.remove(button.dataset.localDelete)){window.alert('Kunne ikke slette kampen.');return}
     render();
   });
 });
 more.hidden=filtered.length<=8;
 more.textContent=expanded?'Vis færre':'Vis alle '+filtered.length+' kamper';
}
document.querySelectorAll('#saHistoryFilters .history-filter').forEach(button=>{
 button.addEventListener('click',()=>{
   activeFilter=button.dataset.filter||'all';expanded=false;
   document.querySelectorAll('#saHistoryFilters .history-filter').forEach(x=>x.classList.toggle('active',x===button));
   render();
 });
});
more.addEventListener('click',()=>{expanded=!expanded;render()});
window.addEventListener('storage',event=>{if(event.key===H.storageKey)render()});
// Recover the last completed game from the former current-match storage, if present.
const recovery=H.recover?.();
if(recovery?.ok&&!recovery.alreadySaved){
 const notice=document.createElement('p');
 notice.className='muted compact';
 notice.textContent='Siste fullførte Head-to-Head-kamp ble gjenopprettet i historikken.';
 $('saH2HHistory').insertBefore(notice,$('saHistoryCount').parentElement);
}
render();
})();
