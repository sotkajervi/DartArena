// Final summary + link to full tournament results. Does not alter live scoring logic.
(function(){
  const $=id=>document.getElementById(id),esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function ensure(){
    if($('tournamentFinishSummary'))return;
    const s=document.createElement('section');s.id='tournamentFinishSummary';s.className='card hidden';s.style.marginTop='20px';
    s.innerHTML='<div class="heading"><div><small>RESULTATER</small><h2>Sluttresultat</h2></div><div id="finishMeta" class="status"></div></div><div id="finishBody"></div>';
    document.querySelector('main.shell')?.appendChild(s);
  }
  async function loadSummary(){
    ensure();if(!tournament||!['cup','finished'].includes(tournament.status))return;
    const {data:m}=await db.from('tournament_matches').select('*').eq('tournament_id',id).eq('stage','cup').order('round_no').order('match_no');if(!m?.length)return;
    const max=Math.max(...m.map(x=>Number(x.round_no||0))),final=m.find(x=>Number(x.round_no||0)===max);if(!final?.winner_id)return;
    const semi=m.filter(x=>Number(x.round_no||0)===max-1),ids=[...new Set(m.flatMap(x=>[x.player1_id,x.player2_id,x.winner_id]).filter(Boolean))],{data:p}=await db.from('profiles').select('id,username').in('id',ids),nm=Object.fromEntries((p||[]).map(x=>[x.id,x.username])),runner=final.player1_id===final.winner_id?final.player2_id:final.player1_id,semis=semi.map(x=>x.winner_id?(x.player1_id===x.winner_id?x.player2_id:x.player1_id):null).filter(Boolean);
    $('tournamentFinishSummary').classList.remove('hidden');$('finishMeta').textContent='Finale avgjort';
    $('finishBody').innerHTML=`<div class="result-podium"><div class="player-row"><div><small>VINNER</small><h2 style="color:var(--cyan);margin:3px 0">${esc(nm[final.winner_id]||'Spiller')}</h2></div></div><div class="player-row"><div><small>2. PLASS</small><strong>${esc(nm[runner]||'Spiller')}</strong></div></div>${semis.length?`<div class="player-row"><div><small>SEMIFINALISTER</small><strong>${semis.map(x=>esc(nm[x]||'Spiller')).join(' • ')}</strong></div></div>`:''}<button id="openTournamentResultsBtn" class="primary wide" style="margin-top:12px">Se full resultat- og statistikkside</button></div>`;
    $('openTournamentResultsBtn').onclick=()=>location.href=`tournament-results.html?id=${encodeURIComponent(id)}`;
  }
  window.addEventListener('dartarena:tournament-loaded',loadSummary);setTimeout(loadSummary,900);
})();