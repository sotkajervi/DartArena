// Read-only archive view for completed tournaments.
(()=>{
  const $=id=>document.getElementById(id);let applied=false;
  async function apply(){
    if(applied||typeof tournament==='undefined'||!tournament||tournament.status!=='finished')return;
    applied=true;
    const hasGroups=tournament.tournament_type==='groups_cup';
    const info=$('tInfo');
    if(info)info.textContent=hasGroups
      ?'Turneringen er ferdig. Puljer, kampresultater, sluttspill og sluttstatistikk kan åpnes herfra.'
      :'Turneringen er ferdig. Cup, kampresultater og sluttstatistikk kan åpnes herfra.';
    const group=$('groupLobby');
    if(group){
      group.classList.toggle('hidden',!hasGroups);
      if(hasGroups){try{if(typeof loadGroupLobby==='function')await loadGroupLobby()}catch(e){console.error('Archive groups failed',e)}}
    }
    const actions=document.querySelector('.top-actions');
    if(actions&&!$('archiveStatsBtn')){const b=document.createElement('button');b.id='archiveStatsBtn';b.className='primary';b.textContent='Sluttstatistikk';b.onclick=()=>location.href=`tournament-results.html?id=${encodeURIComponent(new URLSearchParams(location.search).get('id')||'')}`;actions.insertBefore(b,$('backBtn')||null)}
    const tag=document.querySelector('.live');if(tag)tag.innerHTML='<i></i> Ferdig turnering';
    // Cup script supports status=finished; ask it to redraw after archive mode is applied.
    try{if(typeof window.dartArenaLoadCup==='function')await window.dartArenaLoadCup()}catch(e){console.error('Archive cup failed',e)}
  }
  const timer=setInterval(()=>{apply();if(applied)clearInterval(timer)},150);
  window.addEventListener('dartarena:tournament-loaded',apply);
})();
