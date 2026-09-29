const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=id=>document.getElementById(id);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

$('backBtn').onclick=()=>location.href='./';

function fmtDate(value){
  if(!value)return'–';
  return new Intl.DateTimeFormat('nb-NO',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
}

function matchResult(m,me){
  const sets=m.match_mode==='sets';
  const a=sets?Number(m.player1_sets||0):Number(m.player1_legs||0);
  const b=sets?Number(m.player2_sets||0):Number(m.player2_legs||0);
  const mine=me===m.player1_id?a:b,other=me===m.player1_id?b:a;
  return `${mine}–${other}`;
}

async function boot(){
  const {data:{session}}=await db.auth.getSession();
  if(!session)return location.replace('./');
  const me=session.user.id;
  const {data:matches,error}=await db.from('matches')
    .select('*')
    .or(`player1_id.eq.${me},player2_id.eq.${me}`)
    .eq('status','finished')
    .eq('game_variant','x01')
    .order('finished_at',{ascending:false,nullsFirst:false})
    .limit(100);
  if(error)throw error;
  if(!matches?.length){$('historyList').innerHTML='<p class="muted history-empty">Ingen ferdige X01-kamper ennå.</p>';return}

  const playerIds=[...new Set(matches.flatMap(m=>[m.player1_id,m.player2_id]).filter(Boolean))];
  const {data:profiles}=await db.from('profiles').select('id,username').in('id',playerIds);
  const names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
  const matchIds=matches.map(m=>m.id);
  const {data:tournamentMatches}=await db.from('tournament_matches').select('live_match_id,tournament_id,stage').in('live_match_id',matchIds);
  const tournamentByMatch=new Map((tournamentMatches||[]).map(tm=>[tm.live_match_id,tm]));
  const tournamentIds=[...new Set((tournamentMatches||[]).map(tm=>tm.tournament_id).filter(Boolean))];
  let tournamentNames={};
  if(tournamentIds.length){
    const {data:tournaments}=await db.from('tournaments').select('id,name').in('id',tournamentIds);
    tournamentNames=Object.fromEntries((tournaments||[]).map(t=>[t.id,t.name]));
  }

  $('historyList').innerHTML=matches.map(m=>{
    const opponent=m.player1_id===me?m.player2_id:m.player1_id;
    const tm=tournamentByMatch.get(m.id);
    const tournamentLabel=tm?`${tournamentNames[tm.tournament_id]||'Turnering'} • ${tm.stage==='group'?'Pulje':'Cup'}`:null;
    const format=m.match_mode==='sets'?`Best of ${m.best_of_sets||1} sets • Best of ${m.legs} legs`:`Best of ${m.legs} legs`;
    return `<article class="history-row"><div class="history-main"><div class="history-title">${esc(names[me]||'Du')} <span class="history-result">${matchResult(m,me)}</span> ${esc(names[opponent]||'Motstander')}</div><div class="history-meta"><span>${fmtDate(m.finished_at||m.updated_at||m.created_at)}</span><span>${esc(String(m.game||501))}</span><span>${esc(format)}</span>${tournamentLabel?`<span class="history-tag">${esc(tournamentLabel)}</span>`:'<span>Onlinekamp</span>'}</div></div><div class="history-actions"><button class="small-btn" data-match-id="${m.id}">Se statistikk</button></div></article>`;
  }).join('');

  document.querySelectorAll('[data-match-id]').forEach(button=>button.onclick=()=>{
    window.open(`match-stats.html?id=${encodeURIComponent(button.dataset.matchId)}`,`dartarena-match-stats-${button.dataset.matchId}`);
  });
}

boot().catch(error=>{
  console.error('Match history failed',error);
  $('historyList').innerHTML='<p class="muted history-empty">Kunne ikke laste kamphistorikken.</p>';
});
