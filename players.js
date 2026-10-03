const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let requestNo=0,searchTimer=null;

$('backBtn').onclick=()=>location.href='./';
$('clearSearch').onclick=()=>{$('playerSearch').value='';loadPlayers('')};
$('playerSearch').addEventListener('input',()=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>loadPlayers($('playerSearch').value.trim()),220);
});

function fmtDate(value){
  if(!value)return'–';
  return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));
}
function pct(v){return `${Number(v||0).toFixed(1)}%`}
function avg(v){return Number(v||0)>0?Number(v).toFixed(2):'–'}
function openPlayer(id){location.href=`player.html?id=${encodeURIComponent(id)}`}

function render(rows,query){
  $('playerCount').textContent=query?`${rows.length} treff`:`${rows.length} registrerte spillere`;
  if(!rows.length){
    $('playerDirectory').innerHTML='<p class="muted directory-empty">Ingen spillere matcher søket.</p>';
    return;
  }
  $('playerDirectory').innerHTML=rows.map(p=>`<article class="directory-row" role="link" tabindex="0" data-player-id="${p.user_id}">
    <div class="directory-player"><div class="directory-avatar">${esc((p.username||'?')[0].toUpperCase())}</div><div style="min-width:0"><div class="directory-name player-name">${esc(p.username||'Spiller')}</div><div class="directory-sub">Registrert ${fmtDate(p.registered_at)}</div></div></div>
    <div class="directory-stat"><small>Kamper</small><strong>${Number(p.matches||0)}</strong></div>
    <div class="directory-stat"><small>Seier</small><strong>${pct(p.win_pct)}</strong></div>
    <div class="directory-stat avg"><small>X01 AVG</small><strong>${avg(p.x01_avg)}</strong></div>
    <div class="directory-stat"><small>180</small><strong>${Number(p.c180||0)}</strong></div>
    <div class="directory-open">›</div>
  </article>`).join('');

  document.querySelectorAll('[data-player-id]').forEach(row=>{
    row.addEventListener('click',()=>openPlayer(row.dataset.playerId));
    row.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();openPlayer(row.dataset.playerId)}
    });
  });
  window.DartArenaRoleVisuals?.scan?.();
}

async function loadPlayers(query=''){
  const request=++requestNo;
  $('playerCount').textContent='Laster…';
  const {data,error}=await db.rpc('get_player_directory',{p_search:query,p_limit:500});
  if(request!==requestNo)return;
  if(error)throw error;
  render(data||[],query);
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session)return location.replace('./');
  await loadPlayers('');
}

boot().catch(error=>{
  console.error('Player directory failed',error);
  $('playerCount').textContent='Kunne ikke laste';
  $('playerDirectory').innerHTML='<p class="muted directory-empty">Kunne ikke laste spillerlisten.</p>';
});