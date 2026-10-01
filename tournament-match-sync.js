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
  const message=text=>{const el=document.getElementById('matchMessage');if(el)el.textContent=text};
  let synced=false,tournamentId=null,cancelling=false;

  async function cancelTournamentMatch(){
    if(cancelling)return;
    const text='Vil du avbryte denne turneringskampen?\n\nKampen nullstilles og kan startes på nytt.';
    const ok=window.DartArenaDialog
      ?await window.DartArenaDialog.confirm(text,{title:'Avbryt turneringskamp',tone:'danger',confirmText:'Avbryt kamp'})
      :confirm(text);
    if(!ok)return;
    cancelling=true;
    if(cancelBtn){cancelBtn.disabled=true;cancelBtn.textContent='Avbryter…'}
    const {data,error}=await client.rpc('cancel_tournament_match',{
      p_tournament_match_id:tournamentMatchId,
      p_live_match_id:liveMatchId
    });
    if(error){
      message('Kunne ikke avbryte turneringskampen: '+error.message);
      cancelling=false;
      if(cancelBtn){cancelBtn.disabled=false;cancelBtn.textContent='Avbryt kamp'}
      return;
    }
    tournamentId=data||tournamentId;
    try{
      window.opener?.postMessage({type:'dartarena-tournament-match-cancelled',id:tournamentMatchId},location.origin);
      window.opener?.focus();
    }catch{}
    window.close();
    setTimeout(()=>{if(!window.closed&&tournamentId)location.href=`tournament.html?id=${encodeURIComponent(tournamentId)}`},150);
  }

  if(cancelBtn){
    cancelBtn.classList.remove('hidden');
    cancelBtn.disabled=false;
    cancelBtn.title='Avbryt denne turneringskampen og gjør den klar til omstart';
    cancelBtn.onclick=cancelTournamentMatch;
  }

  async function advanceCupIfNeeded(){
    if(!tournamentId)return;
    try{
      const {data:t}=await client.from('tournaments').select('status').eq('id',tournamentId).single();
      if(t?.status!=='cup')return;
      const {error}=await client.rpc('advance_tournament_cup',{p_tournament_id:tournamentId});
      if(error)console.warn('Cup winner advancement failed after match sync',error);
    }catch(error){console.warn('Cup winner advancement failed after match sync',error)}
  }

  async function syncIfFinished(row){
    if(synced||!row||row.status!=='finished')return;
    const {error}=await client.rpc('finish_tournament_match',{
      p_tournament_match_id:tournamentMatchId,
      p_live_match_id:liveMatchId
    });
    if(error){
      console.error('Tournament result sync failed',error);
      message('Kampen er ferdig, men turneringsresultatet kunne ikke synkroniseres automatisk.');
      return;
    }
    synced=true;
    await advanceCupIfNeeded();
    try{window.opener?.postMessage({type:'dartarena-tournament-match-finished',id:tournamentMatchId},location.origin)}catch{}
  }

  async function boot(){
    const [{data:tm},{data:live}]=await Promise.all([
      client.from('tournament_matches').select('tournament_id').eq('id',tournamentMatchId).single(),
      client.from('matches').select('id,status').eq('id',liveMatchId).single()
    ]);
    tournamentId=tm?.tournament_id||null;
    await syncIfFinished(live);
    client.channel(`tournament-sync-${liveMatchId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${liveMatchId}`},payload=>syncIfFinished(payload.new))
      .subscribe();
  }

  boot().catch(error=>console.error('Tournament match sync init failed',error));
})();