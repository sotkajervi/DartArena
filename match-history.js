const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let me=null;
let allMatches=[];
let activeFilter='all';

$('backBtn').onclick=()=>location.href='./';

function fmtDate(value){
  if(!value)return'–';
  return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

function variantOf(m){return m.game_variant||'x01'}
function halfItMode(m){return m.game_config?.half_it_mode==='standard'?'standard':'dartcounter'}
function filterKey(m){
  const v=variantOf(m);
  if(v==='half_it')return `half_it_${halfItMode(m)}`;
  return v;
}
function gameLabel(m){
  const v=variantOf(m);
  if(v==='cricket')return'Cricket';
  if(v==='half_it')return halfItMode(m)==='standard'?'Half-It (Standard)':'Half-It (DartCounter)';
  if(v==='sixty_one')return'61';
  if(v==='x01')return String(m.game||501);
  return v;
}
function hasHalfItLegResult(m){
  return variantOf(m)==='half_it'&&(Number(m.player1_legs||0)+Number(m.player2_legs||0)>0);
}
function scorePair(m){
  const v=variantOf(m);
  if(v==='half_it'){
    if(hasHalfItLegResult(m))return [Number(m.player1_legs||0),Number(m.player2_legs||0)];
    return [Number(m.player1_score||0),Number(m.player2_score||0)];
  }
  if(v==='x01'&&m.match_mode==='sets')return [Number(m.player1_sets||0),Number(m.player2_sets||0)];
  return [Number(m.player1_legs||0),Number(m.player2_legs||0)];
}
function formatLabel(m){
  const v=variantOf(m);
  if(v==='half_it'){
    if(!hasHalfItLegResult(m))return'12 runder • eldre kampformat';
    return `Best of ${m.legs||1} legs • 12 runder/leg`;
  }
  if(v==='sixty_one'){
    const mins=Math.round(Number(m.game_config?.duration_seconds||600)/60);
    return `Best of ${m.legs||1} legs • ${mins} min/leg`;
  }
  if(v==='cricket')return `Best of ${m.legs||1} legs`;
  return m.match_mode==='sets'
    ? `Best of ${m.best_of_sets||1} sets • Best of ${m.legs||1} legs`
    : `Best of ${m.legs||1} legs`;
}
function extraLabel(m){
  const v=variantOf(m);
  if(v==='half_it'&&hasHalfItLegResult(m))return `Siste leg ${Number(m.player1_score||0)}–${Number(m.player2_score||0)} poeng`;
  if(v==='sixty_one')return `Sluttmål ${Number(m.player1_score||0)}–${Number(m.player2_score||0)}`;
  if(v==='cricket'&&(Number(m.player1_score||0)||Number(m.player2_score||0)))return `Siste leg ${Number(m.player1_score||0)}–${Number(m.player2_score||0)} poeng`;
  return'';
}
function contextLabel(m){
  if(!m.tournament_id)return'Onlinekamp';
  const stage=m.tournament_stage==='group'?'Pulje':'Cup';
  return `${m.tournament_name||'Turnering'} • ${stage}`;
}
function canOpenStats(m){
  if(variantOf(m)!=='x01')return false;
  return !!m.tournament_id||m.player1_id===me||m.player2_id===me;
}

function render(){
  const mineOnly=$('mineOnly').checked;
  const visible=allMatches.filter(m=>{
    if(activeFilter!=='all'&&filterKey(m)!==activeFilter)return false;
    if(mineOnly&&m.player1_id!==me&&m.player2_id!==me)return false;
    return true;
  });
  $('historyCount').textContent=`${visible.length} ${visible.length===1?'kamp':'kamper'}`;
  if(!visible.length){
    $('historyList').innerHTML='<p class="muted history-empty">Ingen ferdige kamper i dette utvalget ennå.</p>';
    return;
  }

  $('historyList').innerHTML=visible.map(m=>{
    const [a,b]=scorePair(m);
    const p1Winner=m.winner_id&&m.winner_id===m.player1_id;
    const p2Winner=m.winner_id&&m.winner_id===m.player2_id;
    const draw=!m.winner_id&&a===b;
    const extra=extraLabel(m);
    const stats=canOpenStats(m)?`<button class="small-btn" data-match-id="${m.id}">Se statistikk</button>`:'';
    return `<article class="history-row">
      <div class="history-main">
        <div class="history-title">
          <span class="history-game">${esc(gameLabel(m))}</span>
          <span class="history-player${p1Winner?' winner':''}">${esc(m.player1_name||'Spiller 1')}</span>
          <span class="history-result">${a}–${b}</span>
          <span class="history-player${p2Winner?' winner':''}">${esc(m.player2_name||'Spiller 2')}</span>
          ${draw?'<span class="history-tag">Uavgjort</span>':''}
        </div>
        <div class="history-meta">
          <span>${fmtDate(m.finished_at||m.created_at)}</span>
          <span>${esc(formatLabel(m))}</span>
          <span class="history-tag">${esc(contextLabel(m))}</span>
          ${extra?`<span class="history-extra">${esc(extra)}</span>`:''}
        </div>
      </div>
      <div class="history-actions">${stats}</div>
    </article>`;
  }).join('');

  document.querySelectorAll('[data-match-id]').forEach(button=>button.onclick=()=>{
    window.open(`match-stats.html?id=${encodeURIComponent(button.dataset.matchId)}`,`dartarena-match-stats-${button.dataset.matchId}`);
  });
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session)return location.replace('./');
  me=session.user.id;

  document.querySelectorAll('.history-filter').forEach(button=>button.onclick=()=>{
    activeFilter=button.dataset.filter;
    document.querySelectorAll('.history-filter').forEach(x=>x.classList.toggle('active',x===button));
    render();
  });
  $('mineOnly').onchange=render;

  const {data,error}=await db.rpc('get_global_match_history',{p_limit:300});
  if(error)throw error;
  allMatches=data||[];
  render();
}

boot().catch(error=>{
  console.error('Global match history failed',error);
  $('historyCount').textContent='Kunne ikke laste';
  $('historyList').innerHTML='<p class="muted history-empty">Kunne ikke laste kamphistorikken.</p>';
});
