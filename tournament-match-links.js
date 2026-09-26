// Tournament match routing:
// - Finished/WO matches open the dedicated statistics page.
// - A player in a pending match goes to the tournament waiting room.
// - A player in a live match goes to the normal scoring room.
// - Non-players watching an unfinished match get the read-only spectator view.

const tournamentLinkDb=window.supabase.createClient(
  'https://jqpxlbhwvskhjbqrbidk.supabase.co',
  'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
);

async function openTournamentMatch(row){
  const id=row?.dataset?.match;
  if(!id)return;

  row.style.pointerEvents='none';
  try{
    const {data:{session}}=await tournamentLinkDb.auth.getSession();
    const {data:match,error}=await tournamentLinkDb
      .from('tournament_matches')
      .select('id,player1_id,player2_id,status,live_match_id')
      .eq('id',id)
      .single();

    if(error||!match){
      window.open(`tournament-match-viewer.html?id=${encodeURIComponent(id)}`,'_blank','noopener');
      return;
    }

    if(['finished','wo'].includes(match.status)){
      window.open(`tournament-match-stats.html?id=${encodeURIComponent(id)}`,'_blank','noopener');
      return;
    }

    const uid=session?.user?.id;
    const isPlayer=uid&&[match.player1_id,match.player2_id].includes(uid);

    if(!isPlayer){
      window.open(`tournament-match-viewer.html?id=${encodeURIComponent(id)}`,'_blank','noopener');
      return;
    }

    if(match.status==='live'&&match.live_match_id){
      window.open(
        `match.html?id=${encodeURIComponent(match.live_match_id)}&tournamentMatch=${encodeURIComponent(id)}`,
        '_blank'
      );
      return;
    }

    if(match.status==='pending'){
      window.open(`tournament-match-room.html?id=${encodeURIComponent(id)}`,'_blank');
      return;
    }

    window.open(`tournament-match-viewer.html?id=${encodeURIComponent(id)}`,'_blank','noopener');
  }finally{
    row.style.pointerEvents='';
  }
}

document.addEventListener('click',e=>{
  const row=e.target.closest('.match-row[data-match]:not(.simulation-match)');
  if(!row)return;
  e.preventDefault();
  openTournamentMatch(row);
});

document.addEventListener('keydown',e=>{
  if(!['Enter',' '].includes(e.key))return;
  const row=e.target.closest('.match-row[data-match]:not(.simulation-match)');
  if(!row)return;
  e.preventDefault();
  openTournamentMatch(row);
});

function decorateTournamentMatchRows(){
  document.querySelectorAll('.match-row[data-match]:not(.simulation-match)').forEach(row=>{
    row.setAttribute('role','button');
    row.setAttribute('tabindex','0');
    row.style.cursor='pointer';
    const state=row.querySelector('.match-state')?.textContent?.trim();
    row.title=['Ferdig','WO'].includes(state)?'Se kampstatistikk':'Åpne kamp';
  });
}

new MutationObserver(decorateTournamentMatchRows).observe(document.documentElement,{subtree:true,childList:true});
decorateTournamentMatchRows();
