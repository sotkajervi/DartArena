const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let requestNo=0,searchTimer=null,allRows=[],currentQuery='';

const SORTS={
  name:{label:'navn A–Å',field:'username',dir:'asc',format:v=>String(v||'')},
  x01_avg:{label:'X01 AVG',field:'x01_avg',dir:'desc',format:v=>metric(v,2)},
  first9_avg:{label:'First 9',field:'first9_avg',dir:'desc',format:v=>metric(v,2)},
  cricket_mpr:{label:'Cricket MPR',field:'cricket_mpr',dir:'desc',format:v=>metric(v,2)},
  win_pct:{label:'seiersprosent',field:'win_pct',dir:'desc',format:v=>`${Number(v||0).toFixed(1)}%`},
  matches:{label:'kamper',field:'matches',dir:'desc',format:v=>Number(v||0).toLocaleString('nb-NO')},
  c100:{label:'100+',field:'c100',dir:'desc',format:v=>Number(v||0).toLocaleString('nb-NO')},
  c140:{label:'140+',field:'c140',dir:'desc',format:v=>Number(v||0).toLocaleString('nb-NO')},
  c170:{label:'170+',field:'c170',dir:'desc',format:v=>Number(v||0).toLocaleString('nb-NO')},
  c180:{label:'180',field:'c180',dir:'desc',format:v=>Number(v||0).toLocaleString('nb-NO')},
  highest_checkout:{label:'høyeste checkout',field:'highest_checkout',dir:'desc',format:v=>Number(v||0)||'–'},
  fastest_leg:{label:'raskeste leg',field:'fastest_leg',dir:'asc',format:v=>Number(v||0)?`${Number(v)} piler`:'–'}
};

$('backBtn').onclick=()=>location.href='./';
$('clearSearch').onclick=()=>{$('playerSearch').value='';loadPlayers('')};
$('playerSearch').addEventListener('input',()=>{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>loadPlayers($('playerSearch').value.trim()),220);
});
$('playerSort').addEventListener('change',()=>render());

function fmtDate(value){
  if(!value)return'–';
  return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));
}
function pct(v){return `${Number(v||0).toFixed(1)}%`}
function metric(v,digits=2){return Number(v||0)>0?Number(v).toFixed(digits):'–'}
function openPlayer(id){location.href=`player.html?id=${encodeURIComponent(id)}`}
function sortValue(row,sort){
  if(sort.field==='username')return String(row.username||'').toLocaleLowerCase('nb-NO');
  const n=Number(row[sort.field]);
  if(sort.field==='fastest_leg'&&(!Number.isFinite(n)||n<=0))return Number.POSITIVE_INFINITY;
  return Number.isFinite(n)?n:0;
}
function sortedRows(){
  const sort=SORTS[$('playerSort').value]||SORTS.name;
  return [...allRows].sort((a,b)=>{
    const av=sortValue(a,sort),bv=sortValue(b,sort);
    let diff=0;
    if(typeof av==='string')diff=av.localeCompare(bv,'nb-NO',{sensitivity:'base'});
    else diff=av-bv;
    if(sort.dir==='desc')diff*=-1;
    return diff||String(a.username||'').localeCompare(String(b.username||''),'nb-NO',{sensitivity:'base'});
  });
}
function selectedMetric(){
  const key=$('playerSort').value;
  const sort=SORTS[key]||SORTS.name;
  if(key==='name')return{label:'X01 AVG',value:p=>metric(p.x01_avg,2)};
  return{label:sort.label.toUpperCase(),value:p=>sort.format(p[sort.field])};
}

function render(){
  const rows=sortedRows(),sort=SORTS[$('playerSort').value]||SORTS.name,selected=selectedMetric();
  $('playerCount').textContent=currentQuery?`${rows.length} treff`:`${rows.length} registrerte spillere`;
  $('sortSummary').textContent=`Sortert på ${sort.label}`;
  if(!rows.length){
    $('playerDirectory').innerHTML='<p class="muted directory-empty">Ingen spillere matcher søket.</p>';
    return;
  }
  $('playerDirectory').innerHTML=rows.map((p,index)=>`<article class="directory-row" role="link" tabindex="0" data-player-id="${p.user_id}">
    <div class="directory-player"><div class="directory-avatar">${esc((p.username||'?')[0].toUpperCase())}</div><div style="min-width:0"><div class="directory-name player-name">${esc(p.username||'Spiller')}</div><div class="directory-sub"><span class="directory-rank">#${index+1}</span>Registrert ${fmtDate(p.registered_at)}</div></div></div>
    <div class="directory-stat"><small>Kamper</small><strong>${Number(p.matches||0)}</strong></div>
    <div class="directory-stat directory-secondary"><small>Seier</small><strong>${pct(p.win_pct)}</strong></div>
    <div class="directory-stat avg directory-secondary"><small>X01 AVG</small><strong>${metric(p.x01_avg)}</strong></div>
    <div class="directory-stat directory-secondary"><small>180</small><strong>${Number(p.c180||0)}</strong></div>
    <div class="directory-stat avg"><small>${esc(selected.label)}</small><strong>${esc(selected.value(p))}</strong></div>
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
  currentQuery=query;
  $('playerCount').textContent='Laster…';
  const {data,error}=await db.rpc('get_player_directory_stats',{p_search:query,p_limit:500});
  if(request!==requestNo)return;
  if(error)throw error;
  allRows=data||[];
  render();
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