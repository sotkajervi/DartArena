(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId||!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let loading=false;

  function ensureSection(){
    let section=document.getElementById('tournamentStats');
    if(section)return section;

    section=document.createElement('section');
    section.id='tournamentStats';
    section.className='card';
    section.style.marginTop='20px';
    section.innerHTML=`
      <div class="heading">
        <div><small>STATISTIKK</small><h2>Turneringsstatistikk</h2></div>
        <div id="tournamentStatsMeta" class="status">Laster…</div>
      </div>
      <p class="muted compact">Snitt beregnes fra alle registrerte kast i ferdigspilte kamper. WO påvirker kampseire, men ikke kastsnitt.</p>
      <div class="tournament-stats-scroll"><div id="tournamentStatsBody"></div></div>`;

    const style=document.createElement('style');
    style.textContent=`
      .tournament-stats-scroll{overflow-x:auto;margin-top:14px}
      .tournament-stats-table{width:100%;border-collapse:collapse;min-width:850px}
      .tournament-stats-table th,.tournament-stats-table td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.07);text-align:center;white-space:nowrap}
      .tournament-stats-table th{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
      .tournament-stats-table th:nth-child(2),.tournament-stats-table td:nth-child(2){text-align:left}
      .tournament-stats-table tbody tr:hover{background:rgba(43,215,204,.035)}
      .stats-rank{color:var(--cyan);font-weight:900}
      .stats-player{font-weight:850}
      .stats-empty{padding:18px 0;color:var(--muted)}
    `;
    document.head.appendChild(style);

    const anchor=document.getElementById('groupLobby')||document.querySelector('main.shell');
    if(anchor?.parentNode)anchor.insertAdjacentElement('afterend',section);
    else document.querySelector('main.shell')?.appendChild(section);
    return section;
  }

  function dartsForThrow(t){return Number(t.is_checkout?t.darts_used:3)||3}

  function fastestLeg(throws,pid){
    const wins=throws.filter(t=>t.player_id===pid&&t.is_checkout);
    let best=null;
    for(const win of wins){
      const legThrows=throws.filter(t=>t.player_id===pid&&t.match_id===win.match_id&&Number(t.set_no||1)===Number(win.set_no||1)&&Number(t.leg_no||1)===Number(win.leg_no||1));
      const darts=legThrows.reduce((sum,t)=>sum+dartsForThrow(t),0);
      if(darts>0&&(best===null||darts<best))best=darts;
    }
    return best;
  }

  function avgFor(throws){
    const darts=throws.reduce((sum,t)=>sum+dartsForThrow(t),0);
    const score=throws.reduce((sum,t)=>sum+Number(t.score||0),0);
    return darts?score/darts*3:0;
  }

  async function load(){
    if(loading)return;
    loading=true;
    ensureSection();
    const body=document.getElementById('tournamentStatsBody');
    const meta=document.getElementById('tournamentStatsMeta');
    try{
      const {data:matches,error:matchError}=await db
        .from('tournament_matches')
        .select('id,player1_id,player2_id,winner_id,status,player1_legs,player2_legs,live_match_id')
        .eq('tournament_id',tournamentId)
        .in('status',['finished','wo']);
      if(matchError)throw matchError;

      if(!matches?.length){
        meta.textContent='Ingen ferdige kamper';
        body.innerHTML='<div class="stats-empty">Statistikk vises når første kamp er ferdig.</div>';
        return;
      }

      const playerIds=[...new Set(matches.flatMap(m=>[m.player1_id,m.player2_id]).filter(Boolean))];
      const liveIds=[...new Set(matches.map(m=>m.live_match_id).filter(Boolean))];
      const [{data:profiles,error:profileError},{data:throws,error:throwError}]=await Promise.all([
        playerIds.length?db.from('profiles').select('id,username').in('id',playerIds):Promise.resolve({data:[]}),
        liveIds.length?db.from('match_throws').select('*').in('match_id',liveIds).order('created_at',{ascending:true}):Promise.resolve({data:[]})
      ]);
      if(profileError)throw profileError;
      if(throwError)throw throwError;

      const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
      const allThrows=throws||[];
      const matchByLive=Object.fromEntries(matches.filter(m=>m.live_match_id).map(m=>[m.live_match_id,m]));
      const rows=playerIds.map(pid=>{
        const pm=matches.filter(m=>m.player1_id===pid||m.player2_id===pid);
        const wins=pm.filter(m=>m.winner_id===pid).length;
        const pt=allThrows.filter(t=>t.player_id===pid&&matchByLive[t.match_id]);
        const byMatch={};
        pt.forEach(t=>(byMatch[t.match_id]??=[]).push(t));
        const matchAvgs=Object.values(byMatch).map(avgFor).filter(Number.isFinite);
        return{
          id:pid,
          name:names[pid]||'Spiller',
          matches:pm.length,
          wins,
          avg:avgFor(pt),
          bestAvg:matchAvgs.length?Math.max(...matchAvgs):0,
          c100:pt.filter(t=>Number(t.score)>=100&&Number(t.score)<=139).length,
          c140:pt.filter(t=>Number(t.score)>=140&&Number(t.score)<=169).length,
          c170:pt.filter(t=>Number(t.score)>=170&&Number(t.score)<=179).length,
          c180:pt.filter(t=>Number(t.score)===180).length,
          fast:fastestLeg(pt,pid)
        };
      }).sort((a,b)=>b.wins-a.wins||b.avg-a.avg||a.name.localeCompare(b.name,'nb'));

      meta.textContent=`${matches.length} ferdige kamper`;
      body.innerHTML=`<table class="tournament-stats-table"><thead><tr><th>#</th><th>Spiller</th><th>Kamper</th><th>V</th><th>Snitt</th><th>Beste kampsnitt</th><th>100+</th><th>140+</th><th>170+</th><th>180</th><th>Raskeste leg</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="stats-rank">${i+1}</td><td class="stats-player">${esc(r.name)}</td><td>${r.matches}</td><td>${r.wins}</td><td>${r.avg?r.avg.toFixed(2):'–'}</td><td>${r.bestAvg?r.bestAvg.toFixed(2):'–'}</td><td>${r.c100}</td><td>${r.c140}</td><td>${r.c170}</td><td>${r.c180}</td><td>${r.fast?`${r.fast} piler`:'–'}</td></tr>`).join('')}</tbody></table>`;
    }catch(error){
      console.error('Tournament stats failed',error);
      meta.textContent='Kunne ikke laste';
      body.innerHTML='<div class="stats-empty">Kunne ikke laste turneringsstatistikk.</div>';
    }finally{
      loading=false;
    }
  }

  db.channel(`tournament-stats-${tournamentId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${tournamentId}`},load)
    .on('postgres_changes',{event:'*',schema:'public',table:'match_throws'},load)
    .subscribe();

  window.addEventListener('focus',load);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load()});
  load();
})();