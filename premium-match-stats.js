(()=>{
  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const source=document.body.dataset.statsSource==='tournament'?'tournament':'match';
  const sourceId=params.get('id');
  const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>Number(v||0);
  const byTime=(a,b)=>new Date(a.created_at||0)-new Date(b.created_at||0);
  let tournamentId=null;

  function fmtDate(value){
    if(!value)return'';
    try{return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
    catch{return''}
  }
  function formatLabel(match){
    if(!match)return'';
    return match.match_mode==='sets'
      ?`Best of ${num(match.best_of_sets)||1} sets • Best of ${num(match.legs)||1} legs`
      :`Best of ${num(match.legs)||1} legs`;
  }
  function gameLabel(match){return String(match?.game||'X01')}
  function initial(name){return String(name||'?').trim().slice(0,1).toUpperCase()||'?'}
  function inferredWinner(p1,p2,a,b){if(a===b)return null;return a>b?p1:p2}
  function resultScore(match,tm){
    if(!match)return[tm?.player1_legs??0,tm?.player2_legs??0];
    if(match.match_mode==='sets')return[num(match.player1_sets),num(match.player2_sets)];
    if(tm)return[num(tm.player1_legs),num(tm.player2_legs)];
    return[num(match.player1_legs),num(match.player2_legs)];
  }
  function displayOrder(match,winnerId){
    if(winnerId===match?.player2_id)return[match.player2_id,match.player1_id];
    return[match?.player1_id,match?.player2_id];
  }
  function orderedPair(match,winnerId,a,b){
    const[leftId]=displayOrder(match,winnerId);
    return leftId===match.player2_id?[b,a]:[a,b];
  }
  function dartsFor(row){
    if(window.DartArenaX01Stats?.dartsFor)return window.DartArenaX01Stats.dartsFor(row);
    return row?.is_checkout?(Math.max(1,num(row.darts_used)||3)):3;
  }
  async function profilesFor(ids){
    const unique=[...new Set((ids||[]).filter(Boolean))];
    if(!unique.length)return{};
    const {data,error}=await db.from('profiles').select('id,username').in('id',unique);
    if(error)throw error;
    return Object.fromEntries((data||[]).map(p=>[p.id,p.username]));
  }
  async function tournamentFor(id){
    if(!id)return null;
    const {data}=await db.from('tournaments').select('id,name').eq('id',id).maybeSingle();
    return data||null;
  }
  async function loadContext(){
    if(!sourceId)throw new Error('Mangler kamp-ID.');
    if(source==='tournament'){
      const {data:tm,error}=await db.from('tournament_matches').select('*').eq('id',sourceId).single();
      if(error||!tm)throw error||new Error('Turneringskampen finnes ikke.');
      tournamentId=tm.tournament_id||null;
      const tournament=await tournamentFor(tournamentId);
      if(!tm.live_match_id)return{tm,tournament,match:null};
      const {data:match,error:matchError}=await db.from('matches').select('*').eq('id',tm.live_match_id).maybeSingle();
      if(matchError)throw matchError;
      return{tm,tournament,match:match||null};
    }
    const {data:match,error}=await db.from('matches').select('*').eq('id',sourceId).single();
    if(error||!match)throw error||new Error('Kampen finnes ikke.');
    const {data:tm}=await db.from('tournament_matches').select('*').eq('live_match_id',sourceId).maybeSingle();
    tournamentId=tm?.tournament_id||null;
    const tournament=await tournamentFor(tournamentId);
    return{match,tm:tm||null,tournament};
  }
  function configureBack(){
    const button=$('backBtn');
    if(!button)return;
    if(source==='tournament'){
      button.textContent='Tilbake til turnering';
      button.onclick=()=>{
        try{window.opener?.focus()}catch{}
        window.close();
        setTimeout(()=>{if(!window.closed&&tournamentId)location.href=`tournament.html?id=${encodeURIComponent(tournamentId)}`},120);
      };
    }else{
      button.textContent='Til kamphistorikk';
      button.onclick=()=>location.href='match-history.html';
    }
  }
  function statRows(stats,hasData){
    if(!stats)return[
      ['3-DART AVG','–'],['FIRST 9 AVG','–'],['HØYESTE UT','–'],['RASKESTE LEG','–'],
      ['100+','–'],['140+','–'],['170+','–'],['180','–']
    ];
    return[
      ['3-DART AVG',hasData?stats.avg.toFixed(2):'–'],
      ['FIRST 9 AVG',hasData&&stats.first9Darts?stats.first9.toFixed(2):'–'],
      ['HØYESTE UT',hasData?(stats.high||'–'):'–'],
      ['RASKESTE LEG',hasData&&stats.fast?`${stats.fast} piler`:'–'],
      ['100+',hasData?stats.c100:'–'],
      ['140+',hasData?stats.c140:'–'],
      ['170+',hasData?stats.c170:'–'],
      ['180',hasData?stats.c180:'–']
    ];
  }
  function playerCard(id,name,winnerId,stats,hasData){
    const winner=id===winnerId;
    return `<article class="premium-player-card${winner?' winner':''}" data-player-id="${esc(id)}">
      <div class="premium-player-head"><div class="premium-player-icon">${winner?'♛':esc(initial(name))}</div><div style="min-width:0"><div class="premium-player-name">${esc(name)}</div>${winner?'<span class="premium-winner-badge">VINNER</span>':''}</div></div>
      <div class="premium-stat-grid">${statRows(stats,hasData).map(([label,value])=>`<div class="premium-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</div>
    </article>`;
  }
  function completedLegs(all){
    const rows=[...(all||[])].sort(byTime),seen=new Set(),legs=[];
    for(const checkout of rows.filter(r=>r.is_checkout)){
      const setNo=num(checkout.set_no)||1,legNo=num(checkout.leg_no)||1,key=`${setNo}:${legNo}`;
      if(seen.has(key))continue;
      seen.add(key);
      const winnerRows=rows.filter(r=>(num(r.set_no)||1)===setNo&&(num(r.leg_no)||1)===legNo&&r.player_id===checkout.player_id);
      const darts=winnerRows.reduce((sum,row)=>sum+dartsFor(row),0);
      legs.push({setNo,legNo,winnerId:checkout.player_id,darts,checkout:num(checkout.score),createdAt:checkout.created_at||''});
    }
    return legs.sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0));
  }
  function legRows(legs,names,leftId,rightId,matchWinnerId){
    let left=0,right=0;
    return legs.map((leg,index)=>{
      if(leg.winnerId===leftId)left++;
      else if(leg.winnerId===rightId)right++;
      const winnerName=names[leg.winnerId]||'Vinner';
      return `<div class="premium-leg-row">
        <span class="premium-leg-label">Leg ${num(leg.legNo)||index+1}</span>
        <span class="premium-leg-score">${left}–${right}</span>
        <span class="premium-leg-winner${leg.winnerId===matchWinnerId?' match-winner':''}">${esc(winnerName)}</span>
        <span class="premium-leg-meta">${leg.darts} piler · checkout ${leg.checkout}</span>
      </div>`;
    }).join('');
  }
  function legSection(all,names,match,matchWinnerId){
    const legs=completedLegs(all),[leftId,rightId]=displayOrder(match,matchWinnerId);
    if(!legs.length)return'<section class="premium-leg-section"><div class="premium-leg-title">LEG-OVERSIKT</div><div class="premium-empty">Ingen ferdige legs registrert.</div></section>';
    if(match.match_mode!=='sets'){
      return `<section class="premium-leg-section"><div class="premium-leg-title">LEG-OVERSIKT</div><div class="premium-leg-list">${legRows(legs,names,leftId,rightId,matchWinnerId)}</div></section>`;
    }
    const setMap=new Map();
    for(const leg of legs){if(!setMap.has(leg.setNo))setMap.set(leg.setNo,[]);setMap.get(leg.setNo).push(leg)}
    const blocks=[...setMap.entries()].map(([setNo,setLegs])=>{
      let left=0,right=0;
      for(const leg of setLegs){if(leg.winnerId===leftId)left++;else if(leg.winnerId===rightId)right++}
      const setWinnerId=left===right?null:left>right?leftId:rightId;
      const setWinner=setWinnerId?names[setWinnerId]||'Vinner':'Uavgjort';
      return `<div class="premium-set-block">
        <div class="premium-set-head"><strong>SETT ${setNo}</strong><span><span class="set-winner">${esc(setWinner)}</span> · ${left}–${right}</span></div>
        <div class="premium-leg-list">${legRows(setLegs,names,leftId,rightId,matchWinnerId)}</div>
      </div>`;
    }).join('');
    return `<section class="premium-leg-section"><div class="premium-leg-title">SETT FOR SETT · LEGS</div>${blocks}</section>`;
  }
  function chicagoStageAvg(rows,stage,pid){
    const visits=(rows||[]).filter(r=>r.player_id===pid&&(num(r.leg_no)||1)===stage);
    const darts=visits.reduce((sum,row)=>sum+dartsFor(row),0);
    const score=visits.reduce((sum,row)=>sum+num(row.score),0);
    return darts?(score/darts*3).toFixed(2):'–';
  }
  function chicagoMpr(rows,pid){
    let marks=0,rounds=0;
    for(const row of rows||[]){
      if(row.player_id!==pid||(num(row.leg_no)||1)!==2)continue;
      rounds++;
      const visit=Array.isArray(row.darts)?row.darts:[];
      for(const dart of visit)marks+=Math.max(0,Math.min(3,num(dart?.mult)));
    }
    return rounds?(marks/rounds).toFixed(2):'–';
  }
  function chicagoMetricCard(id,name,winnerId,games,avg301,mpr,avg501){
    const winner=id===winnerId;
    const rows=[
      ['GAMES',games],
      ['301 DIDO AVG',avg301],
      ['CRICKET MPR',mpr],
      ['501 SIDO AVG',avg501]
    ];
    return `<article class="premium-player-card${winner?' winner':''}" data-player-id="${esc(id)}">
      <div class="premium-player-head"><div class="premium-player-icon">${winner?'♛':esc(initial(name))}</div><div style="min-width:0"><div class="premium-player-name">${esc(name)}</div>${winner?'<span class="premium-winner-badge">VINNER</span>':''}</div></div>
      <div class="premium-stat-grid">${rows.map(([label,value])=>`<div class="premium-stat"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</div>
    </article>`;
  }
  async function renderChicago(match,tm,tournament,names){
    const [{data:x01Rows,error:x01Error},{data:cricketRows,error:cricketError}]=await Promise.all([
      db.from('match_throws').select('player_id,leg_no,score,darts_used,is_checkout,created_at').eq('match_id',match.id).order('created_at',{ascending:true}),
      db.from('cricket_visits').select('player_id,leg_no,darts,points_scored,created_at').eq('match_id',match.id).order('created_at',{ascending:true})
    ]);
    if(x01Error)throw x01Error;
    if(cricketError)throw cricketError;

    const winnerId=tm?.winner_id||match.winner_id;
    const[leftId,rightId]=displayOrder(match,winnerId);
    const leftName=names[leftId]||'Spiller 1',rightName=names[rightId]||'Spiller 2';
    const scoreById={
      [match.player1_id]:num(tm?.player1_legs??match.player1_legs),
      [match.player2_id]:num(tm?.player2_legs??match.player2_legs)
    };
    const raw=Array.isArray(match?.game_config?.chicago_results)?match.game_config.chicago_results:[];
    const labels={1:'301 DIDO',2:'CRICKET',3:'501 SIDO'};
    let left=0,right=0;
    const games=raw.slice().sort((a,b)=>num(a?.stage)-num(b?.stage)).map(item=>{
      const stage=num(item?.stage),gameWinner=item?.winner_id||null;
      if(gameWinner===leftId)left++;
      else if(gameWinner===rightId)right++;
      const metricLabel=stage===2?'MPR':'AVG';
      const leftMetric=stage===2?chicagoMpr(cricketRows,leftId):chicagoStageAvg(x01Rows,stage,leftId);
      const rightMetric=stage===2?chicagoMpr(cricketRows,rightId):chicagoStageAvg(x01Rows,stage,rightId);
      return `<div class="premium-leg-row">
        <span class="premium-leg-label">${esc(labels[stage]||`GAME ${stage||'?'}`)}</span>
        <span class="premium-leg-score">${left}–${right}</span>
        <span class="premium-leg-winner${gameWinner===winnerId?' match-winner':''}">${esc(gameWinner?names[gameWinner]||'Vinner':'–')}</span>
        <span class="premium-leg-meta">${metricLabel} • ${esc(leftName)} ${esc(leftMetric)} • ${esc(rightName)} ${esc(rightMetric)}</span>
      </div>`;
    }).join('');

    const winnerName=winnerId?names[winnerId]||'Vinner':'Kampen';
    $('statsTitle').textContent=`${leftName} vs ${rightName}`;
    $('statsMeta').textContent=contextText(match,tm,tournament);
    $('statsView').innerHTML=`<section class="premium-result-card">
      <div class="premium-result-kicker">KAMP FERDIG</div>
      <h2 class="premium-result-title"><span class="winner-name">${esc(winnerName)}</span>${winnerId?' vant!':' er ferdig'}</h2>
      <div class="premium-result-sub">Chicago Style • 301 DIDO • Cricket • 501 SIDO</div>
      <div class="premium-result-score">${scoreById[leftId]}<span>–</span>${scoreById[rightId]}</div>
      <div class="premium-player-grid">${chicagoMetricCard(leftId,leftName,winnerId,scoreById[leftId],chicagoStageAvg(x01Rows,1,leftId),chicagoMpr(cricketRows,leftId),chicagoStageAvg(x01Rows,3,leftId))}${chicagoMetricCard(rightId,rightName,winnerId,scoreById[rightId],chicagoStageAvg(x01Rows,1,rightId),chicagoMpr(cricketRows,rightId),chicagoStageAvg(x01Rows,3,rightId))}</div>
      <section class="premium-leg-section"><div class="premium-leg-title">GAME-OVERSIKT</div><div class="premium-leg-list">${games||'<div class="premium-empty">Ingen game-data registrert.</div>'}</div></section>
    </section>`;
  }

  function contextText(match,tm,tournament){
    const parts=[];
    const date=fmtDate(match?.finished_at||match?.updated_at||match?.created_at);
    if(date)parts.push(date);
    if(tournament)parts.push(`${tournament.name||'Turnering'} · ${tm?.stage==='group'?'Puljespill':'Cup'}`);
    else parts.push('Onlinekamp');
    return parts.join(' • ');
  }
  function renderWo(tm,tournament,names){
    const rawA=num(tm.player1_legs),rawB=num(tm.player2_legs);
    const winnerId=tm.winner_id||inferredWinner(tm.player1_id,tm.player2_id,rawA,rawB);
    const pseudo={player1_id:tm.player1_id,player2_id:tm.player2_id};
    const[leftId,rightId]=displayOrder(pseudo,winnerId),leftName=names[leftId]||'Spiller 1',rightName=names[rightId]||'Spiller 2';
    const winnerName=winnerId?names[winnerId]||'Vinner':'Kampen';
    $('statsTitle').textContent=`${leftName} vs ${rightName}`;
    $('statsMeta').textContent=tournament?`${tournament.name||'Turnering'} • ${tm.stage==='group'?'Puljespill':'Cup'}`:'Turneringskamp';
    $('statsView').innerHTML=`<section class="premium-result-card"><div class="premium-result-kicker">KAMP FERDIG</div><h2 class="premium-result-title"><span class="winner-name">${esc(winnerName)}</span>${winnerId?' vant!':' er ferdig'}</h2><div class="premium-result-sub">Kampen ble avgjort uten registrerte kast</div><div class="premium-result-score">WO</div><div class="premium-empty">Det finnes derfor ingen kast- eller legstatistikk for denne kampen.</div></section>`;
  }
  async function render(ctx){
    const {match,tm,tournament}=ctx;
    const ids=match?[match.player1_id,match.player2_id]:[tm?.player1_id,tm?.player2_id];
    const names=await profilesFor(ids);
    if(!match){renderWo(tm,tournament,names);return}
    const n1=names[match.player1_id]||'Spiller 1',n2=names[match.player2_id]||'Spiller 2';
    $('statsMeta').textContent=contextText(match,tm,tournament);
    if(String(match?.game_config?.chicago??'false').toLowerCase()==='true'){
      await renderChicago(match,tm,tournament,names);
      return;
    }
    if((match.game_variant||'x01')!=='x01'){
      const[a,b]=resultScore(match,tm),winnerId=tm?.winner_id||match.winner_id||inferredWinner(match.player1_id,match.player2_id,a,b),winnerName=winnerId?names[winnerId]||'Vinner':'Kampen';
      const[leftId,rightId]=displayOrder(match,winnerId),[leftScore,rightScore]=orderedPair(match,winnerId,a,b);
      $('statsTitle').textContent=`${names[leftId]||n1} vs ${names[rightId]||n2}`;
      $('statsView').innerHTML=`<section class="premium-result-card"><div class="premium-result-kicker">KAMP FERDIG</div><h2 class="premium-result-title"><span class="winner-name">${esc(winnerName)}</span>${winnerId?' vant!':' er ferdig'}</h2><div class="premium-result-sub">${esc(gameLabel(match))} • ${esc(formatLabel(match))}</div><div class="premium-result-score">${leftScore}<span>–</span>${rightScore}</div><div class="premium-empty">Denne detaljvisningen viser foreløpig full kaststatistikk for X01. Resultatet er lagret.</div></section>`;
      return;
    }
    const {data:throws,error}=await db.from('match_throws').select('player_id,set_no,leg_no,visit_no,score,darts_used,is_checkout,created_at').eq('match_id',match.id).order('created_at',{ascending:true});
    if(error)throw error;
    const all=throws||[],stats=window.DartArenaX01Stats;
    const statsById={
      [match.player1_id]:stats?.statsFor?stats.statsFor(all,match.player1_id):null,
      [match.player2_id]:stats?.statsFor?stats.statsFor(all,match.player2_id):null
    };
    const hasById={
      [match.player1_id]:all.some(r=>r.player_id===match.player1_id),
      [match.player2_id]:all.some(r=>r.player_id===match.player2_id)
    };
    const[a,b]=resultScore(match,tm);
    const winnerId=tm?.winner_id||match.winner_id||inferredWinner(match.player1_id,match.player2_id,a,b);
    const winnerName=winnerId?names[winnerId]||'Vinner':'Kampen';
    const[leftId,rightId]=displayOrder(match,winnerId),[leftScore,rightScore]=orderedPair(match,winnerId,a,b);
    const leftName=names[leftId]||'Spiller 1',rightName=names[rightId]||'Spiller 2';
    $('statsTitle').textContent=`${leftName} vs ${rightName}`;
    const corrected=tm?.result_corrected_at?'<div class="premium-note">Resultatet er korrigert av turneringsleder. Kast- og legstatistikken viser de registrerte kastene fra kampen.</div>':'';
    const scoreLabel=match.match_mode==='sets'?'<div class="premium-result-score-label">SETS</div>':'';
    $('statsView').innerHTML=`<section class="premium-result-card">
      <div class="premium-result-kicker">KAMP FERDIG</div>
      <h2 class="premium-result-title"><span class="winner-name">${esc(winnerName)}</span>${winnerId?' vant!':' er ferdig'}</h2>
      <div class="premium-result-sub">${esc(gameLabel(match))} • ${esc(formatLabel(match))}</div>
      <div class="premium-result-score">${leftScore}<span>–</span>${rightScore}</div>${scoreLabel}
      <div class="premium-player-grid">${playerCard(leftId,leftName,winnerId,statsById[leftId],hasById[leftId])}${playerCard(rightId,rightName,winnerId,statsById[rightId],hasById[rightId])}</div>
      ${legSection(all,names,match,winnerId)}${corrected}
    </section>`;
  }
  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session)return location.replace('./');
    configureBack();
    const ctx=await loadContext();
    await render(ctx);
  }
  boot().catch(error=>{
    console.error('Premium match stats failed',error);
    const view=$('statsView');
    if(view)view.innerHTML='<div class="premium-error">Kunne ikke laste kampstatistikken.</div>';
  });
})();