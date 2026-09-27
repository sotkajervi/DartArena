// Tournament match routing and access states for group rows and cup bracket cards.
const tournamentLinkDb=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
let tournamentLinkUid=null,tournamentDecorateTimer=null,tournamentDecorating=false;

function ensureTournamentMatchStyles(){
  if(document.getElementById('tournament-match-access-styles'))return;
  const s=document.createElement('style');s.id='tournament-match-access-styles';s.textContent=`
    .match-row.my-tournament-match,.cup-match.my-tournament-match{outline:2px solid var(--cyan);outline-offset:2px;box-shadow:0 0 0 1px rgba(35,226,209,.10),0 0 22px rgba(35,226,209,.08)}
    .match-row.match-locked,.cup-match.match-locked{cursor:default!important}
    .match-row.match-locked:hover,.cup-match.match-locked:hover{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.025)}
    .cup-match .match-access-label{display:block;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.06);text-align:center;color:var(--muted);font-size:10px;font-weight:850;letter-spacing:.05em;text-transform:uppercase}
    .cup-match.my-tournament-match .match-access-label{color:var(--cyan)}
    .match-row.my-tournament-match .match-state{color:var(--cyan);font-weight:850}
    .match-row.match-locked .match-state{color:var(--muted)}
  `;document.head.appendChild(s);
}

async function getTournamentLinkUid(){
  if(tournamentLinkUid)return tournamentLinkUid;
  const {data:{session}}=await tournamentLinkDb.auth.getSession();
  tournamentLinkUid=session?.user?.id||null;return tournamentLinkUid;
}

async function openTournamentMatch(row){
  const id=row?.dataset?.match;if(!id||row.classList.contains('match-locked'))return;
  row.style.pointerEvents='none';
  try{
    const uid=await getTournamentLinkUid();
    const {data:match,error}=await tournamentLinkDb.from('tournament_matches').select('id,player1_id,player2_id,status,live_match_id').eq('id',id).single();
    if(error||!match)return;
    const isPlayer=uid&&[match.player1_id,match.player2_id].includes(uid);
    if(['finished','wo'].includes(match.status)){window.open(`tournament-match-stats.html?id=${encodeURIComponent(id)}`,'_blank','noopener');return}
    if(match.status==='live'){
      if(isPlayer&&match.live_match_id)window.open(`match.html?id=${encodeURIComponent(match.live_match_id)}&tournamentMatch=${encodeURIComponent(id)}`,'_blank');
      else window.open(`tournament-match-viewer.html?id=${encodeURIComponent(id)}`,'_blank','noopener');
      return;
    }
    if(match.status==='pending'&&isPlayer&&match.player1_id&&match.player2_id){window.open(`tournament-match-room.html?id=${encodeURIComponent(id)}`,'_blank');return}
  }finally{row.style.pointerEvents=''}
}

function tournamentTarget(e){return e.target.closest('.match-row[data-match]:not(.simulation-match),.cup-match[data-match]')}
document.addEventListener('click',e=>{const row=tournamentTarget(e);if(!row||row.classList.contains('match-locked'))return;e.preventDefault();openTournamentMatch(row)});
document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const row=tournamentTarget(e);if(!row||row.classList.contains('match-locked'))return;e.preventDefault();openTournamentMatch(row)});

function setCupAccessLabel(row,text){
  let el=row.querySelector('.match-access-label');
  if(!el){el=document.createElement('div');el.className='match-access-label';row.appendChild(el)}
  if(el.textContent!==text)el.textContent=text;
}
function setGroupAccessLabel(row,text){const el=row.querySelector('.match-state');if(el&&el.textContent!==text)el.textContent=text}
function applyMatchAccess(row,match,uid){
  const isPlayer=!!uid&&[match.player1_id,match.player2_id].includes(uid),finished=['finished','wo'].includes(match.status),live=match.status==='live',pending=match.status==='pending',ready=!!(match.player1_id&&match.player2_id);
  row.classList.toggle('my-tournament-match',isPlayer);
  let label,title,clickable=true;
  if(finished){label='Se statistikk';title='Åpne kampstatistikk'}
  else if(live&&isPlayer){label='Gå til kamp';title='Gå tilbake til din kamp'}
  else if(live){label='Se kamp';title='Se kampen live'}
  else if(pending&&isPlayer&&ready){label='Min kamp';title='Åpne venterom for din kamp'}
  else if(pending&&isPlayer){label='Venter på motstander';title='Kampen er ikke klar ennå';clickable=false}
  else{label='Ikke startet';title='Kampen kan sees når den har startet';clickable=false}
  row.classList.toggle('match-locked',!clickable);
  row.setAttribute('aria-disabled',clickable?'false':'true');
  if(clickable){row.setAttribute('role','button');row.setAttribute('tabindex','0');row.style.cursor='pointer'}
  else{row.removeAttribute('role');row.removeAttribute('tabindex');row.style.cursor='default'}
  row.title=title;
  if(row.classList.contains('match-row'))setGroupAccessLabel(row,label);else setCupAccessLabel(row,label);
}

async function decorateTournamentMatches(){
  if(tournamentDecorating)return;tournamentDecorating=true;
  try{
    ensureTournamentMatchStyles();
    const rows=[...document.querySelectorAll('.match-row[data-match]:not(.simulation-match),.cup-match[data-match]')];if(!rows.length)return;
    const uid=await getTournamentLinkUid(),ids=[...new Set(rows.map(r=>r.dataset.match).filter(Boolean))];if(!ids.length)return;
    const {data,error}=await tournamentLinkDb.from('tournament_matches').select('id,player1_id,player2_id,status,live_match_id').in('id',ids);if(error)return console.error('Tournament match access failed',error);
    const byId=new Map((data||[]).map(m=>[m.id,m]));rows.forEach(row=>{const m=byId.get(row.dataset.match);if(m)applyMatchAccess(row,m,uid)});
  }finally{tournamentDecorating=false}
}
function scheduleTournamentDecorate(){clearTimeout(tournamentDecorateTimer);tournamentDecorateTimer=setTimeout(decorateTournamentMatches,80)}
new MutationObserver(scheduleTournamentDecorate).observe(document.documentElement,{subtree:true,childList:true});
window.addEventListener('dartarena:tournament-loaded',scheduleTournamentDecorate);
scheduleTournamentDecorate();