const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const tournamentMatchId=new URLSearchParams(location.search).get('id');
let tournamentId=null;

const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dartsFor=t=>Number(t.is_checkout?t.darts_used:3)||3;
function statsFor(throws,pid){
  const pt=throws.filter(t=>t.player_id===pid);
  const score=pt.reduce((s,t)=>s+Number(t.score||0),0);
  const darts=pt.reduce((s,t)=>s+dartsFor(t),0);
  const checkouts=pt.filter(t=>t.is_checkout);
  let fastest=null;
  for(const co of checkouts){
    const leg=pt.filter(t=>Number(t.set_no||1)===Number(co.set_no||1)&&Number(t.leg_no||1)===Number(co.leg_no||1));
    const used=leg.reduce((s,t)=>s+dartsFor(t),0);
    if(used>0&&(fastest===null||used<fastest))fastest=used;
  }
  return{
    avg:darts?score/darts*3:0,
    fast:fastest,
    c100:pt.filter(t=>Number(t.score)>=100&&Number(t.score)<=139).length,
    c140:pt.filter(t=>Number(t.score)>=140&&Number(t.score)<=169).length,
    c170:pt.filter(t=>Number(t.score)>=170&&Number(t.score)<=179).length,
    c180:pt.filter(t=>Number(t.score)===180).length
  };
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||!tournamentMatchId)return location.replace('./');

  const {data:tm,error}=await db.from('tournament_matches').select('*').eq('id',tournamentMatchId).single();
  if(error||!tm)return location.replace('./');
  tournamentId=tm.tournament_id;
  $('backBtn').onclick=()=>location.href=`tournament.html?id=${encodeURIComponent(tournamentId)}`;

  const ids=[tm.player1_id,tm.player2_id].filter(Boolean);
  const {data:profiles}=await db.from('profiles').select('id,username').in('id',ids);
  const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
  const n1=names[tm.player1_id]||'Spiller 1',n2=names[tm.player2_id]||'Spiller 2';
  $('statsTitle').textContent=`${n1} vs ${n2}`;
  $('statsMeta').textContent=`${tm.stage==='group'?'Puljespill':'Cup'} • Best av ${tm.best_of}`;
  $('statsResult').textContent=`${Number(tm.player1_legs||0)} – ${Number(tm.player2_legs||0)}`;

  if(tm.status==='wo'||!tm.live_match_id){
    $('statsBody').innerHTML='<p class="muted stats-note">Kampen ble avgjort uten registrerte kast, så det finnes ingen kaststatistikk.</p>';
    return;
  }

  const {data:throws,error:throwError}=await db.from('match_throws').select('*').eq('match_id',tm.live_match_id).order('created_at',{ascending:true});
  if(throwError){
    console.error(throwError);
    $('statsBody').innerHTML='<p class="muted stats-note">Kunne ikke laste kaststatistikken.</p>';
    return;
  }

  const all=throws||[],a=statsFor(all,tm.player1_id),b=statsFor(all,tm.player2_id);
  const rows=[
    ['3-dart avg',a.avg?a.avg.toFixed(2):'–',b.avg?b.avg.toFixed(2):'–'],
    ['Raskeste leg',a.fast?`${a.fast} piler`:'–',b.fast?`${b.fast} piler`:'–'],
    ['100+',a.c100,b.c100],
    ['140+',a.c140,b.c140],
    ['170+',a.c170,b.c170],
    ['180',a.c180,b.c180]
  ];
  $('statsBody').innerHTML=`<div class="match-stats-grid"><div></div><div class="head">${esc(n1)}</div><div class="head">${esc(n2)}</div>${rows.map(r=>`<div class="label">${r[0]}</div><div class="value">${r[1]}</div><div class="value">${r[2]}</div>`).join('')}</div>`;
}

boot().catch(error=>{console.error('Match stats failed',error);$('statsBody').innerHTML='<p class="muted stats-note">Kunne ikke laste kampstatistikken.</p>'});