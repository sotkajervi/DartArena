(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId||!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isBye=m=>m?.stage==='cup'&&!!m.player1_id!==!!m.player2_id&&['finished','wo'].includes(m.status);
  let loading=false;
  let reloadRequested=false;
  let reloadTimer=null;

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
      <p class="muted compact">Snitt beregnes fra registrerte kast i ferdigspilte kamper. WO påvirker kampseire, mens BYE/frirunde ikke teller som kamp.</p>
      <div id="tournamentStatsHighlights" class="tournament-stats-highlights"></div>
      <div class="tournament-stats-scroll"><div id="tournamentStatsBody"></div></div>`;

    const style=document.createElement('style');
    style.textContent=`
      #cupLobby{overflow:hidden}
      #tournamentStats{position:relative;z-index:2;isolation:isolate;overflow:hidden;background:var(--card,rgba(7,16,18,.94))}
      .tournament-stats-highlights{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}
      .tournament-stat-highlight{min-width:0;padding:11px 12px;border:1px solid rgba(43,215,204,.18);border-radius:12px;background:rgba(43,215,204,.035)}
      .tournament-stat-highlight small{display:block;color:var(--muted);font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
      .tournament-stat-highlight strong{display:block;color:var(--text);font-size:16px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tournament-stat-highlight span{display:block;color:var(--cyan);font-size:11px;font-weight:800;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tournament-stats-scroll{overflow-x:auto;overflow-y:hidden;max-width:100%;margin-top:14px;overscroll-behavior-inline:contain}
      .tournament-stats-table{width:max-content;min-width:100%;border-collapse:collapse}
      .tournament-stats-table th,.tournament-stats-table td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.07);text-align:center;white-space:nowrap}
      .tournament-stats-table th{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.045em}
      .tournament-stats-table th:nth-child(2),.tournament-stats-table td:nth-child(2){text-align:left;position:sticky;left:0;background:#091416;z-index:1}
      .tournament-stats-table tbody tr:hover td{background:rgba(43,215,204,.035)}
      .tournament-stats-table tbody tr:hover td:nth-child(2){background:#0b1a1c}
      .stats-rank{color:var(--cyan);font-weight:900}
      .stats-player{font-weight:850;max-width:190px;overflow:hidden;text-overflow:ellipsis}
      .stats-positive{color:var(--cyan);font-weight:850}
      .stats-negative{color:#ff8b93;font-weight:850}
      .stats-empty{padding:18px 0;color:var(--muted)}
      @media(max-width:900px){.tournament-stats-highlights{grid-template-columns:repeat(2,minmax(0,1fr))}.tournament-stat-highlight:last-child{grid-column:1/-1}}
      @media(max-width:560px){.tournament-stats-highlights{grid-template-columns:1fr}.tournament-stat-highlight:last-child{grid-column:auto}.tournament-stats-table th,.tournament-stats-table td{padding:9px 7px;font-size:11px}.stats-player{max-width:135px}}
    `;
    document.head.appendChild(style);

    const anchor=document.getElementById('cupLobby')||document.getElementById('cupSetup')||document.getElementById('groupLobby')||document.querySelector('main.shell');
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

  function mprFor(visits){
    const rounds=(visits||[]).length;
    let marks=0;
    for(const row of visits||[]){
      const visit=Array.isArray(row?.darts)?row.darts:[];
      for(const dart of visit)marks+=Math.max(0,Math.min(3,Number(dart?.mult)||0));
    }
    return rounds?marks/rounds:0;
  }

  function bestBy(rows,field,{min=false,positive=false}={}){
    const valid=rows.filter(r=>Number.isFinite(Number(r[field]))&&(!positive||Number(r[field])>0));
    if(!valid.length)return null;
    return [...valid].sort((a,b)=>min?Number(a[field])-Number(b[field]):Number(b[field])-Number(a[field]))[0];
  }

  function highlight(label,row,value){
    if(!row)return`<div class="tournament-stat-highlight"><small>${esc(label)}</small><strong>–</strong><span>Ingen data ennå</span></div>`;
    return`<div class="tournament-stat-highlight"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(row.name)}</span></div>`;
  }

  function renderHighlights(rows,{chicago=false}={}){
    const host=document.getElementById('tournamentStatsHighlights');
    if(!host)return;
    const avg=bestBy(rows,'avg',{positive:true});
    const bestMatch=bestBy(rows,'bestAvg',{positive:true});
    const checkout=bestBy(rows,'highCheckout',{positive:true});
    const leg=bestBy(rows,'fast',{min:true,positive:true});
    const fifth=chicago?bestBy(rows,'mpr',{positive:true}):bestBy(rows,'c180',{positive:true});
    host.innerHTML=[
      highlight(chicago?'Høyest X01-snitt':'Høyest snitt',avg,avg?avg.avg.toFixed(2):'–'),
      highlight(chicago?'Beste X01-kampsnitt':'Beste kampsnitt',bestMatch,bestMatch?bestMatch.bestAvg.toFixed(2):'–'),
      highlight('Høyeste checkout',checkout,checkout?checkout.highCheckout:'–'),
      highlight(chicago?'Raskeste X01':'Raskeste leg',leg,leg?`${leg.fast} piler`:'–'),
      chicago
        ?highlight('Høyest MPR',fifth,fifth?fifth.mpr.toFixed(2):'–')
        :highlight('Flest 180',fifth,fifth?fifth.c180:'–')
    ].join('');
  }

  async function load(){
    if(loading){reloadRequested=true;return}
    loading=true;
    reloadRequested=false;
    ensureSection();
    const body=document.getElementById('tournamentStatsBody');
    const meta=document.getElementById('tournamentStatsMeta');
    const highlights=document.getElementById('tournamentStatsHighlights');
    try{
      const [{data:tournament,error:tournamentError},{data:matches,error:matchError}]=await Promise.all([
        db.from('tournaments').select('id,tournament_type,game,game_variant,cup_game,cup_game_variant').eq('id',tournamentId).maybeSingle(),
        db.from('tournament_matches')
          .select('id,stage,player1_id,player2_id,winner_id,status,player1_legs,player2_legs,live_match_id')
          .eq('tournament_id',tournamentId)
          .in('status',['finished','wo'])
      ]);
      if(tournamentError)throw tournamentError;
      if(matchError)throw matchError;
      const groupChicago=String(tournament?.game_variant||'x01').toLowerCase()==='chicago';
      const cupChicago=String((tournament?.cup_game_variant??tournament?.game_variant)||'x01').toLowerCase()==='chicago';
      const chicago=groupChicago||cupChicago;
      const mixedFormats=tournament?.tournament_type==='groups_cup'&&(
        groupChicago!==cupChicago||
        (!groupChicago&&!cupChicago&&(
          Number(tournament?.game||501)!==Number(tournament?.cup_game??tournament?.game??501)
        ))
      );
      const unitLabel=mixedFormats?'Games/legs':chicago?'Games':'Legs';

      const playedMatches=(matches||[]).filter(m=>!isBye(m));
      if(!playedMatches.length){
        meta.textContent='Ingen ferdige kamper';
        highlights.innerHTML='';
        body.innerHTML='<div class="stats-empty">Statistikk vises når første kamp er ferdig. BYE/frirunde teller ikke som kamp.</div>';
        return;
      }

      const playerIds=[...new Set(playedMatches.flatMap(m=>[m.player1_id,m.player2_id]).filter(Boolean))];
      const liveIds=[...new Set(playedMatches.map(m=>m.live_match_id).filter(Boolean))];
      const [{data:profiles,error:profileError},{data:throws,error:throwError},{data:cricketVisits,error:cricketError}]=await Promise.all([
        playerIds.length?db.from('profiles').select('id,username').in('id',playerIds):Promise.resolve({data:[]}),
        liveIds.length?db.from('match_throws').select('*').in('match_id',liveIds).order('created_at',{ascending:true}):Promise.resolve({data:[]}),
        chicago&&liveIds.length?db.from('cricket_visits').select('match_id,player_id,darts').in('match_id',liveIds).order('created_at',{ascending:true}):Promise.resolve({data:[]})
      ]);
      if(profileError)throw profileError;
      if(throwError)throw throwError;
      if(cricketError)throw cricketError;

      const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
      const allThrows=throws||[],allCricket=cricketVisits||[];
      const matchByLive=Object.fromEntries(playedMatches.filter(m=>m.live_match_id).map(m=>[m.live_match_id,m]));
      const rows=playerIds.map(pid=>{
        const pm=playedMatches.filter(m=>m.player1_id===pid||m.player2_id===pid);
        const wins=pm.filter(m=>m.winner_id===pid).length;
        const losses=Math.max(0,pm.length-wins);
        const legsFor=pm.reduce((sum,m)=>sum+Number(m.player1_id===pid?m.player1_legs||0:m.player2_legs||0),0);
        const legsAgainst=pm.reduce((sum,m)=>sum+Number(m.player1_id===pid?m.player2_legs||0:m.player1_legs||0),0);
        const pt=allThrows.filter(t=>t.player_id===pid&&matchByLive[t.match_id]);
        const pc=allCricket.filter(v=>v.player_id===pid&&matchByLive[v.match_id]);
        const byMatch={};
        pt.forEach(t=>(byMatch[t.match_id]??=[]).push(t));
        const matchAvgs=Object.values(byMatch).map(avgFor).filter(Number.isFinite);
        const checkoutScores=pt.filter(t=>t.is_checkout).map(t=>Number(t.score||0));
        const scores=pt.map(t=>Number(t.score||0));
        return{
          id:pid,
          name:names[pid]||'Spiller',
          matches:pm.length,
          wins,
          losses,
          winPct:pm.length?wins/pm.length*100:0,
          legsFor,
          legsAgainst,
          legDiff:legsFor-legsAgainst,
          avg:avgFor(pt),
          mpr:mprFor(pc),
          bestAvg:matchAvgs.length?Math.max(...matchAvgs):0,
          highVisit:scores.length?Math.max(...scores):0,
          highCheckout:checkoutScores.length?Math.max(...checkoutScores):0,
          c60:pt.filter(t=>Number(t.score)>=60&&Number(t.score)<=99).length,
          c100:pt.filter(t=>Number(t.score)>=100&&Number(t.score)<=139).length,
          c140:pt.filter(t=>Number(t.score)>=140&&Number(t.score)<=169).length,
          c170:pt.filter(t=>Number(t.score)>=170&&Number(t.score)<=179).length,
          c180:pt.filter(t=>Number(t.score)===180).length,
          fast:fastestLeg(pt,pid)
        };
      }).sort((a,b)=>b.wins-a.wins||b.winPct-a.winPct||b.avg-a.avg||a.name.localeCompare(b.name,'nb'));

      meta.textContent=chicago
        ?`${playedMatches.length} ferdige kamper • X01: ${allThrows.length} visits • Cricket: ${allCricket.length} visits`
        :`${playedMatches.length} ferdige kamper • ${allThrows.length} registrerte besøk`;
      const note=document.querySelector('#tournamentStats .muted.compact');
      if(note)note.textContent=mixedFormats
        ?'Blandet turneringsformat: statistikken samler X01-kast på tvers av pulje og cup, mens MPR hentes fra Chicago-Cricket. Games og legs er ulike enheter og vises derfor samlet som Games/legs.'
        :chicago
          ?'Chicago Style: X01-snitt beregnes fra 301 DIDO og 501 SIDO. MPR beregnes fra Cricket. WO påvirker kampseire, mens BYE/frirunde ikke teller som kamp.'
          :'Snitt beregnes fra registrerte kast i ferdigspilte kamper. WO påvirker kampseire, mens BYE/frirunde ikke teller som kamp.';
      renderHighlights(rows,{chicago});
      body.innerHTML=`<table class="tournament-stats-table"><thead><tr><th>#</th><th>Spiller</th><th>K</th><th>V</th><th>T</th><th>V%</th><th>${unitLabel}</th><th>+/−</th><th>${chicago?'X01 snitt':'Snitt'}</th>${chicago?'<th>MPR</th>':''}<th>Beste kamp</th><th>Høyeste kast</th><th>Checkout</th><th>${chicago?'Raskeste X01':'Raskeste leg'}</th><th>60+</th><th>100+</th><th>140+</th><th>170+</th><th>180</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td class="stats-rank">${i+1}</td><td class="stats-player" title="${esc(r.name)}">${esc(r.name)}</td><td>${r.matches}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.winPct.toFixed(0)}%</td><td>${r.legsFor}–${r.legsAgainst}</td><td class="${r.legDiff>0?'stats-positive':r.legDiff<0?'stats-negative':''}">${r.legDiff>0?'+':''}${r.legDiff}</td><td>${r.avg?r.avg.toFixed(2):'–'}</td>${chicago?`<td>${r.mpr?r.mpr.toFixed(2):'–'}</td>`:''}<td>${r.bestAvg?r.bestAvg.toFixed(2):'–'}</td><td>${r.highVisit||'–'}</td><td>${r.highCheckout||'–'}</td><td>${r.fast?`${r.fast} piler`:'–'}</td><td>${r.c60}</td><td>${r.c100}</td><td>${r.c140}</td><td>${r.c170}</td><td>${r.c180}</td></tr>`).join('')}</tbody></table>`;
    }catch(error){
      console.error('Tournament stats failed',error);
      meta.textContent='Kunne ikke laste';
      highlights.innerHTML='';
      body.innerHTML='<div class="stats-empty">Kunne ikke laste turneringsstatistikk.</div>';
    }finally{
      loading=false;
      if(reloadRequested){reloadRequested=false;setTimeout(load,0)}
    }
  }

  function scheduleLoad(){
    clearTimeout(reloadTimer);
    reloadTimer=setTimeout(load,120);
  }

  db.channel(`tournament-stats-${tournamentId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${tournamentId}`},scheduleLoad)
    .on('postgres_changes',{event:'*',schema:'public',table:'match_throws'},scheduleLoad)
    .subscribe();

  window.addEventListener('focus',scheduleLoad);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleLoad()});
  load();
})();