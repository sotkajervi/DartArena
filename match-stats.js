const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const matchId=new URLSearchParams(location.search).get('id');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('backBtn').onclick=()=>location.href='match-history.html';

function fmtDate(value){
  if(!value)return'';
  return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

function legSummary(all,names){
  const dartsFor=window.DartArenaX01Stats.dartsFor;
  const keys=[...new Set((all||[]).map(v=>`${Number(v.set_no||1)}:${Number(v.leg_no||1)}`))];
  if(!keys.length)return'<p class="muted">Ingen leg-data tilgjengelig.</p>';
  return `<div class="leg-list">${keys.map((key,index)=>{
    const [setNo,legNo]=key.split(':').map(Number);
    const visits=all.filter(v=>Number(v.set_no||1)===setNo&&Number(v.leg_no||1)===legNo);
    const checkout=visits.find(v=>v.is_checkout);
    if(!checkout)return `<div class="leg-row"><strong>Leg ${index+1}</strong><span class="leg-winner">Ikke avgjort</span><span class="leg-meta">–</span></div>`;
    const winnerVisits=visits.filter(v=>v.player_id===checkout.player_id);
    const darts=winnerVisits.reduce((sum,v)=>sum+dartsFor(v),0);
    return `<div class="leg-row"><strong>Leg ${index+1}</strong><span class="leg-winner">${esc(names[checkout.player_id]||'Spiller')}</span><span class="leg-meta">${darts} piler • checkout ${Number(checkout.score||0)}</span></div>`;
  }).join('')}</div>`;
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session||!matchId)return location.replace('./');

  const {data:match,error}=await db.from('matches').select('*').eq('id',matchId).single();
  if(error||!match){$('statsBody').innerHTML='<p class="muted stats-note">Kampen finnes ikke, eller du har ikke tilgang.</p>';return}
  if((match.game_variant||'x01')!=='x01'){
    $('statsTitle').textContent='Statistikk ikke tilgjengelig';
    $('statsBody').innerHTML='<p class="muted stats-note">Denne statistikksiden er foreløpig laget for X01-kamper.</p>';
    return;
  }

  const {data:profiles}=await db.from('profiles').select('id,username').in('id',[match.player1_id,match.player2_id]);
  const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
  const n1=names[match.player1_id]||'Spiller 1',n2=names[match.player2_id]||'Spiller 2';

  const {data:tm}=await db.from('tournament_matches').select('id,tournament_id,stage,player1_legs,player2_legs,result_corrected_at').eq('live_match_id',matchId).maybeSingle();
  let tournamentName='';
  if(tm?.tournament_id){
    const {data:t}=await db.from('tournaments').select('name').eq('id',tm.tournament_id).maybeSingle();
    tournamentName=t?.name||'Turnering';
  }

  $('statsTitle').textContent=`${n1} vs ${n2}`;
  const format=match.match_mode==='sets'?`Best of ${match.best_of_sets||1} sets • Best of ${match.legs} legs`:`Best of ${match.legs} legs`;
  const context=tm?`${tournamentName} • ${tm.stage==='group'?'Puljespill':'Cup'}`:'Onlinekamp';
  $('statsMeta').textContent=`${fmtDate(match.finished_at||match.updated_at||match.created_at)} • ${match.game} • ${format} • ${context}`;

  let r1=match.match_mode==='sets'?Number(match.player1_sets||0):Number(match.player1_legs||0);
  let r2=match.match_mode==='sets'?Number(match.player2_sets||0):Number(match.player2_legs||0);
  if(tm?.result_corrected_at&&match.match_mode!=='sets'){
    r1=Number(tm.player1_legs||0);r2=Number(tm.player2_legs||0);
  }
  $('statsResult').textContent=`${r1} – ${r2}`;

  const {data:throws,error:throwError}=await db.from('match_throws').select('*').eq('match_id',matchId).order('created_at',{ascending:true});
  if(throwError)throw throwError;
  const all=throws||[];
  if(!all.length){$('statsBody').innerHTML='<p class="muted stats-note">Ingen registrerte kast tilgjengelig for denne kampen.</p>';return}

  const stats=window.DartArenaX01Stats;
  const a=stats.statsFor(all,match.player1_id),b=stats.statsFor(all,match.player2_id);
  const rows=[
    ['3-dart AVG',a.avg?a.avg.toFixed(2):'–',b.avg?b.avg.toFixed(2):'–'],
    ['First 9 AVG',a.first9?a.first9.toFixed(2):'–',b.first9?b.first9.toFixed(2):'–'],
    ['Høyeste checkout',a.high||'–',b.high||'–'],
    ['Raskeste leg',a.fast?`${a.fast} piler`:'–',b.fast?`${b.fast} piler`:'–'],
    ['100+',a.c100,b.c100],
    ['140+',a.c140,b.c140],
    ['170+',a.c170,b.c170],
    ['180',a.c180,b.c180]
  ];
  const corrected=tm?.result_corrected_at?'<p class="stats-note" style="color:var(--amber);font-weight:750">Resultatet er korrigert av turneringsleder. Kaststatistikken viser de registrerte kastene.</p>':'';
  $('statsBody').innerHTML=`${corrected}<div class="match-stats-grid"><div></div><div class="head">${esc(n1)}</div><div class="head">${esc(n2)}</div>${rows.map(r=>`<div class="label">${r[0]}</div><div class="value">${r[1]}</div><div class="value">${r[2]}</div>`).join('')}</div><div class="stats-section"><small>LEG FOR LEG</small>${legSummary(all,names)}</div>`;
}

boot().catch(error=>{
  console.error('Permanent match stats failed',error);
  $('statsBody').innerHTML='<p class="muted stats-note">Kunne ikke laste kampstatistikken.</p>';
});
