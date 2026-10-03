const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const userId=new URLSearchParams(location.search).get('id');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,allMatches=[],activeFilter='all';

$('backBtn').onclick=()=>location.href='players.html';

function fmtDate(value,withTime=false){
  if(!value)return'–';
  const options=withTime?{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'2-digit',year:'numeric'};
  return new Intl.DateTimeFormat('nb-NO',options).format(new Date(value));
}
function num(v){return Number(v||0)}
function avg(v){return num(v)>0?num(v).toFixed(2):'–'}
function pct(v){return `${num(v).toFixed(1)}%`}
function variantOf(m){return m.game_variant||'x01'}
function halfItMode(m){return m.game_config?.half_it_mode==='standard'?'standard':'dartcounter'}
function gameLabel(m){
  const v=variantOf(m);
  if(v==='cricket')return'Cricket';
  if(v==='half_it')return halfItMode(m)==='standard'?'Half-It Standard':'Half-It DartCounter';
  if(v==='sixty_one')return'61';
  if(v==='jdc')return'JDC Challenge';
  if(v==='x01')return String(m.game||501);
  return v;
}
function scorePair(m){
  const v=variantOf(m);
  if(v==='jdc')return [num(m.player1_score),num(m.player2_score)];
  if(v==='half_it'){
    if(num(m.player1_legs)+num(m.player2_legs)>0)return[num(m.player1_legs),num(m.player2_legs)];
    return[num(m.player1_score),num(m.player2_score)];
  }
  if(v==='x01'&&m.match_mode==='sets')return[num(m.player1_sets),num(m.player2_sets)];
  return[num(m.player1_legs),num(m.player2_legs)];
}
function formatLabel(m){
  const v=variantOf(m);
  if(v==='jdc')return'57 piler hver';
  if(v==='half_it')return num(m.player1_legs)+num(m.player2_legs)>0?`Best of ${m.legs||1} legs`:'12 runder';
  if(v==='sixty_one')return `Best of ${m.legs||1} legs`;
  if(v==='cricket')return `Best of ${m.legs||1} legs`;
  return m.match_mode==='sets'?`Best of ${m.best_of_sets||1} sets • Bo${m.legs||1} legs`:`Best of ${m.legs||1} legs`;
}
function contextLabel(m){return m.tournament_id?`${m.tournament_name||'Turnering'} • ${m.tournament_stage==='group'?'Pulje':'Cup'}`:'Onlinekamp'}
function canOpenStats(m){return variantOf(m)==='x01'&&(!!m.tournament_id||m.player1_id===me||m.player2_id===me)}

function renderStats(s){
  $('playerName').textContent=s.username||'Spiller';
  $('playerMeta').textContent=`Registrert ${fmtDate(s.registered_at)} • ${num(s.total_matches)} ferdige onlinekamper`;
  document.title=`DartArena • ${s.username||'Spiller'}`;
  $('statMatches').textContent=num(s.total_matches);
  $('statWins').textContent=num(s.wins);
  $('statWinPct').textContent=pct(s.win_pct);
  $('statAvg').textContent=avg(s.three_dart_avg);
  $('statFirst9').textContent=avg(s.first9_avg);
  $('statBestAvg').textContent=avg(s.best_match_avg);
  $('statCheckout').textContent=num(s.highest_checkout)||'–';
  $('statFastLeg').textContent=s.fastest_leg?`${num(s.fastest_leg)} piler`:'–';
  $('stat180').textContent=num(s.c180);
  $('statWld').textContent=`${num(s.wins)} / ${num(s.losses)} / ${num(s.draws)}`;
  $('detailX01').textContent=num(s.x01_matches);
  $('detailLegs').textContent=`${num(s.x01_legs_for)}–${num(s.x01_legs_against)}`;
  $('detail60').textContent=num(s.c60);
  $('detail100').textContent=num(s.c100);
  $('detail140').textContent=num(s.c140);
  $('detail170').textContent=num(s.c170);
  $('detail180').textContent=num(s.c180);
  $('detailScore').textContent=num(s.total_score).toLocaleString('nb-NO');
  $('detailDarts').textContent=num(s.total_darts).toLocaleString('nb-NO');
  $('profileState').classList.add('hidden');
  $('profileStats').classList.remove('hidden');
  window.DartArenaRoleVisuals?.scan?.();
}

function visibleMatches(){
  return allMatches.filter(m=>{
    if(activeFilter==='x01')return variantOf(m)==='x01';
    if(activeFilter==='tournament')return !!m.tournament_id;
    if(activeFilter==='online')return !m.tournament_id;
    return true;
  });
}

function renderMatches(){
  const visible=visibleMatches();
  $('matchCount').textContent=`${visible.length} ${visible.length===1?'kamp':'kamper'} • nyeste først`;
  if(!visible.length){$('matchList').innerHTML='<p class="muted history-empty">Ingen kamper i dette utvalget.</p>';return}
  $('matchList').innerHTML=visible.map(m=>{
    const [a,b]=scorePair(m),isP1=m.player1_id===userId,own=isP1?a:b,opp=isP1?b:a;
    const opponent=isP1?(m.player2_name||'Spiller'):(m.player1_name||'Spiller');
    const won=m.winner_id===userId,lost=!!m.winner_id&&!won,draw=!m.winner_id&&a===b;
    const stats=variantOf(m)==='x01'&&m.player_avg!==null?`<div class="profile-match-stats"><span class="mini-stat">AVG <b>${num(m.player_avg).toFixed(2)}</b></span><span class="mini-stat">First 9 <b>${m.player_first9!==null?num(m.player_first9).toFixed(2):'–'}</b></span><span class="mini-stat">CO <b>${num(m.player_high_checkout)||'–'}</b></span><span class="mini-stat">Raskeste <b>${m.player_fastest_leg?`${num(m.player_fastest_leg)}p`:'–'}</b></span><span class="mini-stat">100+ <b>${num(m.player_c100)}</b></span><span class="mini-stat">140+ <b>${num(m.player_c140)}</b></span><span class="mini-stat">180 <b>${num(m.player_c180)}</b></span></div>`:'';
    const action=canOpenStats(m)?`<button class="small-btn" data-stats-id="${m.id}">Se statistikk</button>`:'';
    return `<article class="profile-match"><div><div class="profile-match-title"><span class="match-tag">${esc(gameLabel(m))}</span><span>vs</span><span class="history-player player-name">${esc(opponent)}</span><span class="profile-match-result ${won?'winner':''}">${own}–${opp}</span>${won?'<span class="match-tag">SEIER</span>':lost?'<span class="match-tag" style="color:var(--muted);border-color:rgba(255,255,255,.12)">TAP</span>':draw?'<span class="match-tag">UAVGJORT</span>':''}</div><div class="profile-match-meta"><span>${fmtDate(m.finished_at||m.created_at,true)}</span><span>${esc(formatLabel(m))}</span><span>${esc(contextLabel(m))}</span></div>${stats}</div><div class="profile-actions">${action}</div></article>`;
  }).join('');
  document.querySelectorAll('[data-stats-id]').forEach(button=>button.onclick=()=>window.open(`match-stats.html?id=${encodeURIComponent(button.dataset.statsId)}`,`dartarena-match-stats-${button.dataset.statsId}`));
  window.DartArenaRoleVisuals?.scan?.();
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||!userId)return location.replace('./');
  me=session.user.id;
  document.querySelectorAll('.history-filter').forEach(button=>button.onclick=()=>{
    activeFilter=button.dataset.filter;
    document.querySelectorAll('.history-filter').forEach(x=>x.classList.toggle('active',x===button));
    renderMatches();
  });

  const [{data:stats,error:statsError},{data:matches,error:matchesError}]=await Promise.all([
    db.rpc('get_player_career_stats',{p_user_id:userId}),
    db.rpc('get_player_profile_matches',{p_user_id:userId,p_limit:1000})
  ]);
  if(statsError)throw statsError;
  if(matchesError)throw matchesError;
  const row=stats?.[0];
  if(!row){
    $('playerName').textContent='Spiller ikke funnet';
    $('profileState').textContent='Denne spillerprofilen finnes ikke.';
    $('matchCount').textContent='';
    $('matchList').innerHTML='';
    return;
  }
  allMatches=matches||[];
  renderStats(row);
  renderMatches();
}

boot().catch(error=>{
  console.error('Player profile failed',error);
  $('profileState').textContent='Kunne ikke laste spillerstatistikken.';
  $('matchCount').textContent='Kunne ikke laste';
  $('matchList').innerHTML='<p class="muted history-empty">Kunne ikke laste kamphistorikken.</p>';
});