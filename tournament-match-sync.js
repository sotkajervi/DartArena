(()=>{
  const params=new URLSearchParams(location.search);
  const tournamentMatchId=params.get('tournamentMatch');
  const liveMatchId=params.get('id');
  if(!tournamentMatchId||!liveMatchId)return;

  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  const cancelBtn=document.getElementById('cancelMatchBtn');
  if(cancelBtn){
    cancelBtn.classList.add('hidden');
    cancelBtn.disabled=true;
    cancelBtn.title='Turneringskamper kan ikke avbrytes av en spiller';
  }

  let synced=false;
  async function syncIfFinished(row){
    if(synced||!row||row.status!=='finished')return;
    const {error}=await client.rpc('finish_tournament_match',{
      p_tournament_match_id:tournamentMatchId,
      p_live_match_id:liveMatchId
    });
    if(error){
      console.error('Tournament result sync failed',error);
      const msg=document.getElementById('matchMessage');
      if(msg)msg.textContent='Kampen er ferdig, men turneringsresultatet kunne ikke synkroniseres automatisk.';
      return;
    }
    synced=true;
    try{window.opener?.postMessage({type:'dartarena-tournament-match-finished',id:tournamentMatchId},location.origin);}catch{}
  }

  async function boot(){
    const {data}=await client.from('matches').select('id,status').eq('id',liveMatchId).single();
    await syncIfFinished(data);
    client.channel(`tournament-sync-${liveMatchId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${liveMatchId}`},payload=>syncIfFinished(payload.new))
      .subscribe();
  }

  boot().catch(error=>console.error('Tournament match sync init failed',error));
})();
