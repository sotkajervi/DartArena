const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const tournamentMatchId=new URLSearchParams(location.search).get('id');
let tournamentId=null;
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dartsFor=t=>window.DartArenaX01Stats.dartsFor(t);

function legSummary(all,names){
  const keys=[...new Set(all.map(t=>`${Number(t.set_no||1)}:${Number(t.leg_no||1)}`))];
  if(!keys.length)return'';
  return `<div style="margin-top:22px"><small>LEGS</small><div style="margin-top:8px">${keys.map((k,i)=>{
    const [s,l]=k.split(':').map(Number);
    const lt=all.filter(t=>Number(t.set_no||1)===s&&Number(t.leg_no||1)===l);
    const co=lt.find(t=>t.is_checkout);
    const winner=co?names[co.player_id]||'Spiller':'–';
    const d=co?lt.filter(t=>t.player_id===co.player_id).reduce((x,t)=>x+dartsFor(t),0):0;
    return `<div class="player-row"><div><strong>Leg ${i+1}</strong><div class="status">${esc(winner)}${d?` • ${d} piler`:''}</div></div></div>`;
  }).join('')}</div></div>`;
}

function correctionNote(tm){
  if(!tm.result_corrected_at)return'';
  return '<p class="stats-note" style="color:var(--amber);font-weight:750">Resultatet er korrigert av turneringsleder. Kaststatistikken under viser de registrerte kastene fra kampen.</p>';
}

function returnToTournament(){
  try{window.opener?.focus()}catch{}
  window.close();
  setTimeout(()=>{if(!window.closed&&tournamentId)location.href=`tournament.html?id=${encodeURIComponent(tournamentId)}`},120);
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||!tournamentMatchId)return location.replace('./');

  const {data:tm,error}=await db.from('tournament_matches').select('*').eq('id',tournamentMatchId).single();
  if(error||!tm)return location.replace('./');

  tournamentId=tm.tournament_id;
  $('backBtn').onclick=returnToTournament;

  const ids=[tm.player1_id,tm.player2_id].filter(Boolean);
  const {data:profiles}=await db.from('profiles').select('id,username').in('id',ids);
  const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
  const n1=names[tm.player1_id]||'Spiller 1';
  const n2=names[tm.player2_id]||'Spiller 2';

  $('statsTitle').textContent=`${n1} vs ${n2}`;
  $('statsMeta').textContent=`${tm.stage==='group'?'Puljespill':'Cup'} • Best av ${tm.best_of}`;
  $('statsResult').textContent=tm.status==='wo'?'WO':`${Number(tm.player1_legs||0)} – ${Number(tm.player2_legs||0)}`;

  const corrected=correctionNote(tm);

  if(tm.status==='wo'||!tm.live_match_id){
    $('statsBody').innerHTML=`${corrected}<p class="muted stats-note">Kampen ble avgjort uten registrerte kast.</p>`;
    return;
  }

  const {data:throws,error:throwError}=await db.from('match_throws').select('*').eq('match_id',tm.live_match_id).order('created_at',{ascending:true});
  if(throwError){
    console.error('Match throws unavailable',throwError);
    $('statsBody').innerHTML=`${corrected}<p class="muted stats-note">Kampresultatet er tilgjengelig, men kaststatistikken kunne ikke leses. Tilskuertilgang til kampstatistikk må være aktivert i databasen.</p>`;
    return;
  }

  const all=throws||[];
  const a=window.DartArenaX01Stats.statsFor(all,tm.player1_id),b=window.DartArenaX01Stats.statsFor(all,tm.player2_id);
  const rows=[
    ['3-dart avg',a.avg?a.avg.toFixed(2):'–',b.avg?b.avg.toFixed(2):'–'],
    ['First 9 AVG',a.first9Darts?a.first9.toFixed(2):'–',b.first9Darts?b.first9.toFixed(2):'–'],
    ['Høyeste checkout',a.high||'–',b.high||'–'],
    ['Raskeste leg',a.fast?`${a.fast} piler`:'–',b.fast?`${b.fast} piler`:'–'],
    ['100+',a.c100,b.c100],
    ['140+',a.c140,b.c140],
    ['170+',a.c170,b.c170],
    ['180',a.c180,b.c180]
  ];

  $('statsBody').innerHTML=`${corrected}<div class="match-stats-grid"><div></div><div class="head">${esc(n1)}</div><div class="head">${esc(n2)}</div>${rows.map(r=>`<div class="label">${r[0]}</div><div class="value">${r[1]}</div><div class="value">${r[2]}</div>`).join('')}</div>${legSummary(all,names)}`;
}

boot().catch(error=>{
  console.error('Match stats failed',error);
  $('statsBody').innerHTML='<p class="muted stats-note">Kunne ikke laste kampstatistikken.</p>';
});
