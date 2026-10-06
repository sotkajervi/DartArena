(()=>{
  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY),$=id=>document.getElementById(id),params=new URLSearchParams(location.search),id=params.get('id'),simMode=params.get('simulation')==='1';
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dartsFor=t=>Number(t.is_checkout?t.darts_used:3)||3;
  const avgFor=ts=>{const darts=ts.reduce((s,t)=>s+dartsFor(t),0),score=ts.reduce((s,t)=>s+Number(t.score||0),0);return darts?score/darts*3:0};
  const first9For=ts=>{const perLeg=new Map();let darts=0,score=0;for(const t of ts){const key=`${t.match_id}:${Number(t.set_no||1)}:${Number(t.leg_no||1)}`,count=perLeg.get(key)||0;if(count>=3)continue;perLeg.set(key,count+1);darts+=dartsFor(t);score+=Number(t.score||0)}return darts?score/darts*3:0};
  const stageLabel=m=>m?.stage==='group'?'Puljespill':m?.stage==='cup'?'Cup':'Kamp';
  const fmtAvg=n=>n?Number(n).toFixed(2):'–';
  const empty=txt=>`<div class="results-empty">${esc(txt)}</div>`;
  const isBye=m=>m?.stage==='cup'&&!!m.player1_id!==!!m.player2_id&&['finished','wo'].includes(m.status);
  function topRows(items,render){return items.length?items.slice(0,3).map((x,i)=>render(x,i)).join(''):empty('Ingen registrerte data.')}
  function openMatch(tournamentMatchId){if(tournamentMatchId)location.href=`tournament-match-stats.html?id=${encodeURIComponent(tournamentMatchId)}`}
  async function fetchAllThrows(liveIds){
    if(!liveIds.length)return{data:[],error:null};
    const out=[],pageSize=1000;
    for(let from=0;;from+=pageSize){
      const {data,error}=await db.from('match_throws').select('*').in('match_id',liveIds).order('created_at',{ascending:true}).range(from,from+pageSize-1);
      if(error)return{data:null,error};
      const page=data||[];out.push(...page);
      if(page.length<pageSize)break;
    }
    return{data:out,error:null};
  }
  async function fetchAllCricket(liveIds){
    if(!liveIds.length)return{data:[],error:null};
    const out=[],pageSize=1000;
    for(let from=0;;from+=pageSize){
      const {data,error}=await db.from('cricket_visits').select('match_id,player_id,darts,created_at').in('match_id',liveIds).order('created_at',{ascending:true}).range(from,from+pageSize-1);
      if(error)return{data:null,error};
      const page=data||[];out.push(...page);
      if(page.length<pageSize)break;
    }
    return{data:out,error:null};
  }
  const mprFor=rows=>{
    let marks=0,darts=0;
    for(const row of rows||[]){
      const visit=Array.isArray(row?.darts)?row.darts:[];
      for(const dart of visit){darts++;marks+=Math.max(0,Math.min(3,Number(dart?.mult)||0))}
    }
    return darts?marks/darts*3:0;
  };

  function bindNav(){$('backTournamentBtn').onclick=()=>location.href=`tournament.html?id=${encodeURIComponent(id||'')}`;$('backLobbyBtn').onclick=()=>location.href='./'}
  function renderSimulation(){
    const raw=sessionStorage.getItem('dartarena-sim-results');if(!raw)return false;let s;try{s=JSON.parse(raw)}catch{return false}if(!s)return false;
    const played=(s.matches||[]).filter(m=>m.a&&m.b);
    bindNav();$('tournamentName').textContent=s.tournamentName||'Testturnering';$('resultMeta').textContent=`TESTMODUS • ${played.length} simulerte kamper • kastsnitt lagres ikke`;
    $('winnerName').textContent=s.winner||'–';$('winnerSub').textContent='Simulert turneringsvinner';$('podiumGrid').innerHTML=`<div class="podium-box"><small>2. PLASS</small><strong>${esc(s.runner||'–')}</strong></div><div class="podium-box"><small>SEMIFINALISTER</small><strong>${(s.semifinalists||[]).length?(s.semifinalists||[]).map(esc).join(' • '):'–'}</strong></div>`;
    const map=new Map();for(const m of played){for(const n of [m.a,m.b].filter(Boolean)){if(!map.has(n))map.set(n,{name:n,matches:0,wins:0})}map.get(m.a).matches++;map.get(m.b).matches++;if(m.winner&&map.has(m.winner))map.get(m.winner).wins++;}
    const rows=[...map.values()].sort((a,b)=>b.wins-a.wins||a.name.localeCompare(b.name,'nb'));$('playerStatsMeta').textContent=`${rows.length} spillere • test`;$('playerStats').innerHTML=`<table class="results-table"><thead><tr><th>Spiller</th><th>Kamper</th><th>V</th><th>Snitt</th><th>First 9</th><th>Beste kampsnitt</th><th>Høyeste utgang</th><th>Raskeste leg</th><th>100+</th><th>140+</th><th>170+</th><th>180</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="results-player">${esc(r.name)}</td><td>${r.matches}</td><td>${r.wins}</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td></tr>`).join('')}</tbody></table>`;
    const msg='Kastdata finnes ikke i lokal simulering. Disse listene fylles automatisk etter ekte kamper.';$('topMatchAvg').innerHTML=empty(msg);$('topFastLeg').innerHTML=empty(msg);$('topCheckout').innerHTML=empty(msg);$('top180').innerHTML=empty(msg);return true;
  }

  async function boot(){
    if(!id)return location.replace('./');if(simMode&&renderSimulation())return;
    const {data:{session}}=await db.auth.getSession();if(!session)return location.replace('./');bindNav();
    const [{data:tournament,error:tErr},{data:matches,error:mErr}]=await Promise.all([db.from('tournaments').select('*').eq('id',id).single(),db.from('tournament_matches').select('*').eq('tournament_id',id).in('status',['finished','wo']).order('created_at',{ascending:true})]);
    if(tErr)throw tErr;if(mErr)throw mErr;
    const groupChicago=String(tournament?.game_variant||'x01').toLowerCase()==='chicago';
    const cupChicago=String((tournament?.cup_game_variant??tournament?.game_variant)||'x01').toLowerCase()==='chicago';
    const chicago=groupChicago||cupChicago;
    const mixedFormats=tournament?.tournament_type==='groups_cup'&&(
      groupChicago!==cupChicago||
      (!groupChicago&&!cupChicago&&Number(tournament?.game||501)!==Number(tournament?.cup_game??tournament?.game??501))
    );
    $('tournamentName').textContent=tournament?.name||'Turnering';
    const statNote=document.querySelector('.section-card .muted.compact');
    const highlightTitles=[...document.querySelectorAll('.highlight-grid h2')];
    if(chicago){
      if(statNote)statNote.textContent=mixedFormats
        ?'Blandet format: X01-snitt samler X01-kast fra både Chicago og vanlig X01. MPR er fra Chicago-Cricket. WO teller som kampresultat, mens BYE/frirunde ikke teller.'
        :'Chicago Style: X01-snitt er fra 301 DIDO og 501 SIDO. MPR er fra Cricket. WO teller som kampresultat, mens BYE/frirunde ikke teller som kamp eller seier.';
      if(highlightTitles[0])highlightTitles[0].textContent='Høyeste X01-kampsnitt';
      if(highlightTitles[1])highlightTitles[1].textContent='Raskeste X01';
      if(highlightTitles[3])highlightTitles[3].textContent='Høyeste MPR';
    }
    if(!matches?.length){$('resultMeta').textContent='Ingen ferdige kamper';$('winnerSub').textContent='Resultater blir tilgjengelige når turneringen er ferdig.';$('playerStats').innerHTML=empty('Ingen kampdata.');return}
    const playedMatches=matches.filter(m=>!isBye(m));
    const playerIds=[...new Set(matches.flatMap(m=>[m.player1_id,m.player2_id,m.winner_id]).filter(Boolean))],liveIds=[...new Set(playedMatches.map(m=>m.live_match_id).filter(Boolean))];
    const [{data:profiles,error:pErr},{data:throws,error:thErr},{data:cricketVisits,error:crErr}]=await Promise.all([
      playerIds.length?db.from('profiles').select('id,username').in('id',playerIds):Promise.resolve({data:[]}),
      fetchAllThrows(liveIds),
      chicago?fetchAllCricket(liveIds):Promise.resolve({data:[],error:null})
    ]);if(pErr)throw pErr;if(thErr)throw thErr;if(crErr)throw crErr;
    const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username])),allThrows=throws||[],allCricket=cricketVisits||[],byLive=Object.fromEntries(playedMatches.filter(m=>m.live_match_id).map(m=>[m.live_match_id,m]));
    const cup=matches.filter(m=>m.stage==='cup');if(cup.length){const max=Math.max(...cup.map(m=>Number(m.round_no||0))),final=cup.find(m=>Number(m.round_no||0)===max&&m.winner_id);if(final){const winner=final.winner_id,runner=final.player1_id===winner?final.player2_id:final.player1_id,semi=cup.filter(m=>Number(m.round_no||0)===max-1),semiLosers=semi.map(m=>m.winner_id?(m.player1_id===m.winner_id?m.player2_id:m.player1_id):null).filter(Boolean);$('winnerName').textContent=names[winner]||'Spiller';$('winnerSub').textContent='Vinner av DartArena-turneringen';$('podiumGrid').innerHTML=`<div class="podium-box"><small>2. PLASS</small><strong>${esc(names[runner]||'Spiller')}</strong></div><div class="podium-box"><small>SEMIFINALISTER</small><strong>${semiLosers.length?semiLosers.map(x=>esc(names[x]||'Spiller')).join(' • '):'–'}</strong></div>`;$('resultMeta').textContent=`${playedMatches.length} ferdige kamper • ${mixedFormats?'Blandet format • ':chicago?'Chicago Style • ':''}sluttresultat registrert`;}}
    const legEntries=[];for(const t of allThrows.filter(t=>t.is_checkout)){const leg=allThrows.filter(x=>x.player_id===t.player_id&&x.match_id===t.match_id&&Number(x.set_no||1)===Number(t.set_no||1)&&Number(x.leg_no||1)===Number(t.leg_no||1));const darts=leg.reduce((s,x)=>s+dartsFor(x),0);if(darts)legEntries.push({pid:t.player_id,liveId:t.match_id,darts,checkout:Number(t.score||0)});}
    const matchAvgEntries=[];for(const liveId of liveIds){const m=byLive[liveId];for(const pid of [m?.player1_id,m?.player2_id].filter(Boolean)){const pt=allThrows.filter(t=>t.match_id===liveId&&t.player_id===pid);if(!pt.length)continue;const opponent=m.player1_id===pid?m.player2_id:m.player1_id;matchAvgEntries.push({pid,opponent,avg:avgFor(pt),tmId:m.id,stage:stageLabel(m)});}}
    const rows=playerIds.map(pid=>{const pm=playedMatches.filter(m=>m.player1_id===pid||m.player2_id===pid),pt=allThrows.filter(t=>t.player_id===pid&&byLive[t.match_id]),pc=allCricket.filter(v=>v.player_id===pid&&byLive[v.match_id]),matchAvgs=matchAvgEntries.filter(x=>x.pid===pid).map(x=>x.avg),legs=legEntries.filter(x=>x.pid===pid),checkouts=legs.map(x=>x.checkout).filter(Boolean);return{id:pid,name:names[pid]||'Spiller',matches:pm.length,wins:pm.filter(m=>m.winner_id===pid).length,avg:avgFor(pt),mpr:mprFor(pc),first9:first9For(pt),bestAvg:matchAvgs.length?Math.max(...matchAvgs):0,highCheckout:checkouts.length?Math.max(...checkouts):0,fast:legs.length?Math.min(...legs.map(x=>x.darts)):null,c100:pt.filter(t=>+t.score>=100&&+t.score<=139).length,c140:pt.filter(t=>+t.score>=140&&+t.score<=169).length,c170:pt.filter(t=>+t.score>=170&&+t.score<=179).length,c180:pt.filter(t=>+t.score===180).length};}).sort((a,b)=>chicago?(b.wins-a.wins||b.avg-a.avg||b.mpr-a.mpr||a.name.localeCompare(b.name,'nb')):(b.avg-a.avg||b.wins-a.wins||a.name.localeCompare(b.name,'nb')));
    $('playerStatsMeta').textContent=`${rows.length} spillere`;$('playerStats').innerHTML=`<table class="results-table"><thead><tr><th>Spiller</th><th>Kamper</th><th>V</th><th>${chicago?'X01 snitt':'Snitt'}</th>${chicago?'<th>MPR</th>':''}<th>First 9</th><th>Beste kampsnitt</th><th>Høyeste utgang</th><th>${chicago?'Raskeste X01':'Raskeste leg'}</th><th>100+</th><th>140+</th><th>170+</th><th>180</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="results-player">${esc(r.name)}</td><td>${r.matches}</td><td>${r.wins}</td><td>${fmtAvg(r.avg)}</td>${chicago?`<td>${fmtAvg(r.mpr)}</td>`:''}<td>${fmtAvg(r.first9)}</td><td>${fmtAvg(r.bestAvg)}</td><td>${r.highCheckout||'–'}</td><td>${r.fast?`${r.fast} piler`:'–'}</td><td>${r.c100}</td><td>${r.c140}</td><td>${r.c170}</td><td>${r.c180}</td></tr>`).join('')}</tbody></table>`;
    const topMatch=[...matchAvgEntries].sort((a,b)=>b.avg-a.avg);$('topMatchAvg').innerHTML=topRows(topMatch,(x,i)=>`<div class="highlight-row clickable" data-match="${x.tmId}"><div class="highlight-rank">${i+1}</div><div><div class="highlight-name">${esc(names[x.pid]||'Spiller')}</div><div class="highlight-note">mot ${esc(names[x.opponent]||'Spiller')} • ${x.stage}</div></div><div class="highlight-value">${x.avg.toFixed(2)}</div></div>`);
    const topLeg=[...legEntries].sort((a,b)=>a.darts-b.darts||b.checkout-a.checkout);$('topFastLeg').innerHTML=topRows(topLeg,(x,i)=>{const m=byLive[x.liveId];return `<div class="highlight-row clickable" data-match="${m?.id||''}"><div class="highlight-rank">${i+1}</div><div><div class="highlight-name">${esc(names[x.pid]||'Spiller')}</div><div class="highlight-note">${stageLabel(m)}</div></div><div class="highlight-value">${x.darts} piler</div></div>`});
    const topCo=[...legEntries].filter(x=>x.checkout>0).sort((a,b)=>b.checkout-a.checkout||a.darts-b.darts);$('topCheckout').innerHTML=topRows(topCo,(x,i)=>{const m=byLive[x.liveId];return `<div class="highlight-row clickable" data-match="${m?.id||''}"><div class="highlight-rank">${i+1}</div><div><div class="highlight-name">${esc(names[x.pid]||'Spiller')}</div><div class="highlight-note">${stageLabel(m)}</div></div><div class="highlight-value">${x.checkout}</div></div>`});
    if(chicago){
      const topMpr=[...rows].sort((a,b)=>b.mpr-a.mpr||b.wins-a.wins).filter(x=>x.mpr>0);
      $('top180').innerHTML=topRows(topMpr,(x,i)=>`<div class="highlight-row"><div class="highlight-rank">${i+1}</div><div><div class="highlight-name">${esc(x.name)}</div><div class="highlight-note">Cricket • turneringen totalt</div></div><div class="highlight-value">${x.mpr.toFixed(2)}</div></div>`);
    }else{
      const top180=[...rows].sort((a,b)=>b.c180-a.c180||b.avg-a.avg).filter(x=>x.c180>0);
      $('top180').innerHTML=topRows(top180,(x,i)=>`<div class="highlight-row"><div class="highlight-rank">${i+1}</div><div><div class="highlight-name">${esc(x.name)}</div><div class="highlight-note">Turneringen totalt</div></div><div class="highlight-value">${x.c180}</div></div>`);
    }
    document.addEventListener('click',e=>{const row=e.target.closest('.highlight-row[data-match]');if(row?.dataset.match)openMatch(row.dataset.match)});
  }
  boot().catch(err=>{console.error('Tournament results failed',err);$('resultMeta').textContent='Kunne ikke laste resultater';$('playerStats').innerHTML=empty('Kunne ikke laste turneringsstatistikken.')});
})();