const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let me=null;
let isAdmin=false;
let allMatches=[];
let deletedMatches=[];
let activeFilter='all';
let trashMode=false;
let dialogPromise=null;

function ensureDialog(){
  if(window.DartArenaDialog)return Promise.resolve(window.DartArenaDialog);
  if(dialogPromise)return dialogPromise;
  dialogPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='dartarena-dialog.js?v=20261002-dialog1';
    script.onload=()=>resolve(window.DartArenaDialog);
    script.onerror=()=>reject(new Error('Kunne ikke laste DartArena-dialog.'));
    document.head.appendChild(script);
  });
  return dialogPromise;
}
ensureDialog().catch(error=>console.warn('DartArena dialog preload failed',error));

$('backBtn').onclick=()=>location.href='./';

function fmtDate(value){
  if(!value)return'–';
  return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

function variantOf(m){return m.game_variant||'x01'}
function isChicago(m){return String(m?.game_config?.chicago??'false').toLowerCase()==='true'}
function halfItMode(m){return m.game_config?.half_it_mode==='standard'?'standard':'dartcounter'}
function filterKey(m){
  if(isChicago(m))return'chicago';
  const v=variantOf(m);
  if(v==='half_it')return `half_it_${halfItMode(m)}`;
  return v;
}
function gameLabel(m){
  if(isChicago(m))return'Chicago Style';
  const v=variantOf(m);
  if(v==='cricket')return'Cricket';
  if(v==='half_it')return halfItMode(m)==='standard'?'Half-It (Standard)':'Half-It (DartCounter)';
  if(v==='sixty_one')return'61';
  if(v==='jdc')return'JDC Challenge';
  if(v==='x01')return String(m.game||501);
  return v;
}
function hasHalfItLegResult(m){
  return variantOf(m)==='half_it'&&(Number(m.player1_legs||0)+Number(m.player2_legs||0)>0);
}
function scorePair(m){
  const v=variantOf(m);
  if(v==='jdc')return [Number(m.player1_score||0),Number(m.player2_score||0)];
  if(v==='half_it'){
    if(hasHalfItLegResult(m))return [Number(m.player1_legs||0),Number(m.player2_legs||0)];
    return [Number(m.player1_score||0),Number(m.player2_score||0)];
  }
  if(v==='x01'&&m.match_mode==='sets')return [Number(m.player1_sets||0),Number(m.player2_sets||0)];
  return [Number(m.player1_legs||0),Number(m.player2_legs||0)];
}
function formatLabel(m){
  if(isChicago(m))return'301 DI/DO • Cricket • 501 DO • teller ikke i spillerstatistikk';
  const v=variantOf(m);
  if(v==='jdc')return'57 piler hver • offisiell online-score';
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
  if(v==='jdc')return'Poengsummen teller på JDC Top 10 og tier';
  if(v==='half_it'&&hasHalfItLegResult(m))return `Siste leg ${Number(m.player1_score||0)}–${Number(m.player2_score||0)} poeng`;
  if(v==='sixty_one')return `Sluttmål ${Number(m.player1_score||0)}–${Number(m.player2_score||0)}`;
  if(v==='cricket'&&(Number(m.player1_score||0)||Number(m.player2_score||0)))return `Siste leg ${Number(m.player1_score||0)}–${Number(m.player2_score||0)} poeng`;
  return'';
}
function contextLabel(m){
  if(m.is_warmup)return'Oppvarming';
  if(!m.tournament_id)return'Onlinekamp';
  const stage=m.tournament_stage==='group'?'Pulje':'Cup';
  return `${m.tournament_name||'Turnering'} • ${stage}`;
}
function canOpenStats(m){
  if(isChicago(m)||variantOf(m)!=='x01')return false;
  return !!m.tournament_id||m.player1_id===me||m.player2_id===me;
}

async function deleteMatch(id){
  if(!isAdmin||!id)return;
  const match=allMatches.find(m=>m.id===id);
  if(!match)return;
  const [a,b]=scorePair(match);
  const label=`${match.player1_name||'Spiller 1'} ${a}–${b} ${match.player2_name||'Spiller 2'}`;
  const dialog=await ensureDialog().catch(()=>null);
  const text=`Slette denne kampen fra kamphistorikken?\n\n${label}\n\nKampen blir også utelatt fra spillerstatistikk og avg.`;
  const ok=dialog
    ?await dialog.confirm(text,{title:'Slett kamp',tone:'danger',confirmText:'Slett kamp'})
    :confirm(text);
  if(!ok)return;

  const button=document.querySelector(`[data-delete-id="${CSS.escape(id)}"]`);
  if(button){button.disabled=true;button.textContent='Sletter…'}
  const {data,error}=await db.rpc('admin_delete_match',{p_match_id:id});
  if(error){
    if(button){button.disabled=false;button.textContent='Slett'}
    alert('Kunne ikke slette kampen: '+(error.message||error));
    return;
  }
  if(data!==true){
    if(button){button.disabled=false;button.textContent='Slett'}
    alert('Kampen kunne ikke slettes. Den kan allerede være slettet.');
    return;
  }
  allMatches=allMatches.filter(m=>m.id!==id);
  deletedMatches=[];
  render();
}

async function restoreMatch(id){
  if(!isAdmin||!id)return;
  const match=deletedMatches.find(m=>m.id===id);
  if(!match)return;
  const [a,b]=scorePair(match);
  const label=`${match.player1_name||'Spiller 1'} ${a}–${b} ${match.player2_name||'Spiller 2'}`;
  const dialog=await ensureDialog().catch(()=>null);
  const text=`Gjenopprette denne kampen?\n\n${label}\n\nKampen blir synlig igjen og teller i statistikk dersom den ikke er Oppvarming.`;
  const ok=dialog
    ?await dialog.confirm(text,{title:'Gjenopprett kamp',confirmText:'Gjenopprett'})
    :confirm(text);
  if(!ok)return;

  const button=document.querySelector(`[data-restore-id="${CSS.escape(id)}"]`);
  if(button){button.disabled=true;button.textContent='Gjenoppretter…'}
  const {data,error}=await db.rpc('admin_restore_match',{p_match_id:id});
  if(error){
    if(button){button.disabled=false;button.textContent='Gjenopprett'}
    alert('Kunne ikke gjenopprette kampen: '+(error.message||error));
    return;
  }
  if(data!==true){
    if(button){button.disabled=false;button.textContent='Gjenopprett'}
    alert('Kampen kunne ikke gjenopprettes.');
    return;
  }
  deletedMatches=deletedMatches.filter(m=>m.id!==id);
  if(!match.is_warmup&&!allMatches.some(m=>m.id===id)){
    const restored={...match,deleted_at:null,deleted_by:null};
    allMatches.push(restored);
    allMatches.sort((a,b)=>new Date(b.finished_at||b.created_at)-new Date(a.finished_at||a.created_at));
  }
  render();
}

async function loadTrash(){
  const {data,error}=await db.rpc('admin_get_deleted_matches',{p_limit:300});
  if(error)throw error;
  deletedMatches=data||[];
}

async function toggleTrash(){
  if(!isAdmin)return;
  const button=$('historyTrashBtn');
  if(button){button.disabled=true;button.textContent='Laster…'}
  try{
    trashMode=!trashMode;
    activeFilter='all';
    document.querySelectorAll('.history-filter[data-filter]').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));
    if(trashMode)await loadTrash();
    if(button){button.classList.toggle('active',trashMode);button.textContent=trashMode?'Til historikk':'Papirkurv'}
    render();
  }catch(error){
    trashMode=false;
    if(button){button.classList.remove('active');button.textContent='Papirkurv'}
    alert('Kunne ikke laste papirkurven: '+(error.message||error));
  }finally{
    if(button)button.disabled=false;
  }
}

function render(){
  const mineOnly=$('mineOnly').checked;
  const source=trashMode?deletedMatches:allMatches;
  const visible=source.filter(m=>{
    if(activeFilter!=='all'&&filterKey(m)!==activeFilter)return false;
    if(mineOnly&&m.player1_id!==me&&m.player2_id!==me)return false;
    return true;
  });
  $('historyCount').textContent=trashMode
    ?`${visible.length} ${visible.length===1?'slettet kamp':'slettede kamper'}`
    :`${visible.length} ${visible.length===1?'kamp':'kamper'}`;
  if(!visible.length){
    $('historyList').innerHTML=`<p class="muted history-empty">${trashMode?'Papirkurven er tom.':'Ingen ferdige kamper i dette utvalget ennå.'}</p>`;
    return;
  }

  $('historyList').innerHTML=visible.map(m=>{
    const [a,b]=scorePair(m);
    const p1Winner=m.winner_id&&m.winner_id===m.player1_id;
    const p2Winner=m.winner_id&&m.winner_id===m.player2_id;
    const draw=!m.winner_id&&a===b;
    const extra=extraLabel(m);
    const stats=!trashMode&&canOpenStats(m)?`<button class="small-btn" data-stats-id="${m.id}">Se statistikk</button>`:'';
    const del=!trashMode&&isAdmin?`<button class="small-btn danger" data-delete-id="${m.id}">Slett</button>`:'';
    const restore=trashMode&&isAdmin?`<button class="small-btn primary" data-restore-id="${m.id}">Gjenopprett</button>`:'';
    const deleted=trashMode?`<span class="history-tag">Slettet ${fmtDate(m.deleted_at)}</span>`:'';
    return `<article class="history-row">
      <div class="history-main">
        <div class="history-title">
          <span class="history-game">${esc(gameLabel(m))}</span>
          <span class="history-player${p1Winner?' winner':''}">${esc(m.player1_name||'Spiller 1')}</span>
          <span class="history-result">${a}–${b}</span>
          <span class="history-player${p2Winner?' winner':''}">${esc(m.player2_name||'Spiller 2')}</span>
          ${draw?'<span class="history-tag">Uavgjort</span>':''}
          ${m.is_warmup?'<span class="history-tag">OPPVARMING</span>':''}
        </div>
        <div class="history-meta">
          <span>${fmtDate(m.finished_at||m.created_at)}</span>
          <span>${esc(formatLabel(m))}</span>
          <span class="history-tag">${esc(contextLabel(m))}</span>
          ${deleted}
          ${extra?`<span class="history-extra">${esc(extra)}</span>`:''}
        </div>
      </div>
      <div class="history-actions">${stats}${del}${restore}</div>
    </article>`;
  }).join('');

  document.querySelectorAll('[data-stats-id]').forEach(button=>button.onclick=()=>{
    window.open(`match-stats.html?id=${encodeURIComponent(button.dataset.statsId)}`,`dartarena-match-stats-${button.dataset.statsId}`);
  });
  document.querySelectorAll('[data-delete-id]').forEach(button=>button.onclick=()=>deleteMatch(button.dataset.deleteId));
  document.querySelectorAll('[data-restore-id]').forEach(button=>button.onclick=()=>restoreMatch(button.dataset.restoreId));
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session)return location.replace('./');
  me=session.user.id;

  const {data:adminFlag,error:adminError}=await db.rpc('is_admin');
  if(adminError)console.warn('Could not check admin role',adminError);
  isAdmin=adminFlag===true;

  document.querySelectorAll('.history-filter[data-filter]').forEach(button=>button.onclick=()=>{
    activeFilter=button.dataset.filter;
    document.querySelectorAll('.history-filter[data-filter]').forEach(x=>x.classList.toggle('active',x===button));
    render();
  });
  $('mineOnly').onchange=render;

  if(isAdmin&&!$('historyTrashBtn')){
    const trash=document.createElement('button');
    trash.id='historyTrashBtn';
    trash.className='outline history-filter';
    trash.type='button';
    trash.textContent='Papirkurv';
    trash.onclick=toggleTrash;
    $('historyFilters')?.appendChild(trash);
  }

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