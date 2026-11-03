(()=>{
  const params=new URLSearchParams(location.search);
  const samePage=params.get('samePageDev')==='1';
  const tournamentMatchId=samePage?params.get('id'):params.get('tournamentMatch');
  const liveMatchId=samePage?window.DartArenaMatchEngineState?.matchId?.():params.get('id');
  if(!tournamentMatchId||!liveMatchId)return;

  // Tournament matches have their own close/cancel controls. Lobby access must
  // not end the live match or replace this tab.
  document.getElementById('openLobbyTabBtn')?.classList.remove('hidden');

  const client=window.DartArenaMatchDb||window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  const cancelBtn=document.getElementById('cancelMatchBtn');
  const message=text=>{const el=document.getElementById('matchMessage');if(el)el.textContent=text};
  let synced=false,syncing=false,tournamentId=null,cancelling=false,syncChannel=null;

  async function cancelTournamentMatch(){
    if(cancelling)return;
    const text='Vil du avbryte denne turneringskampen?\n\nKampen nullstilles og kan startes på nytt.';
    const ok=window.DartArenaDialog
      ?await window.DartArenaDialog.confirm(text,{title:'Avbryt turneringskamp',tone:'danger',confirmText:'Avbryt kamp'})
      :confirm(text);
    if(!ok)return;
    cancelling=true;
    window.__dartArenaOwnCancel=true;
    if(cancelBtn){cancelBtn.disabled=true;cancelBtn.textContent='Avbryter…'}
    const {data,error}=await client.rpc('cancel_tournament_match',{
      p_tournament_match_id:tournamentMatchId,
      p_live_match_id:liveMatchId
    });
    if(error){
      window.__dartArenaOwnCancel=false;
      message('Kunne ikke avbryte turneringskampen: '+error.message);
      cancelling=false;
      if(cancelBtn){cancelBtn.disabled=false;cancelBtn.textContent='Avbryt kamp'}
      return;
    }
    tournamentId=data||tournamentId;
    try{
      await window.DartArenaMatchEngineState?.channel?.()?.send({
        type:'broadcast',event:'match-cancelled',
        payload:{matchId:liveMatchId,from:window.DartArenaMatchEngineState?.profile?.()?.id}
      });
    }catch(error){console.debug('Tournament cancel broadcast fallback: postgres changes',error)}
    try{
      window.opener?.postMessage({type:'dartarena-tournament-match-cancelled',id:tournamentMatchId},location.origin);
      window.opener?.focus();
    }catch{}
    // Do not close this tab: the cancelling player must always land in the tournament lobby.
    if(!tournamentId){
      message('Kampen er avbrutt, men turneringsadressen mangler. Bruk Til turneringen.');
      if(cancelBtn){cancelBtn.disabled=false;cancelBtn.textContent='Til turneringen';cancelBtn.onclick=()=>location.assign(window.DartArenaTournamentReturnUrl||'./')}
      return;
    }
    window.DartArenaMediaTrace?.mark('OWN_CANCEL_GO_TOURNAMENT',{tournament:String(tournamentId).slice(0,8)});
    location.replace(`tournament.html?id=${encodeURIComponent(tournamentId)}`);
  }

  if(cancelBtn){
    cancelBtn.classList.remove('hidden');
    cancelBtn.disabled=false;
    cancelBtn.title='Avbryt denne turneringskampen og gjør den klar til omstart';
    // The match engine also owns onclick and may overwrite it during bootstrap.
    // Capture the click before its generic cancellation handler runs.
    cancelBtn.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelTournamentMatch().catch(error=>{
        message('Kunne ikke avbryte turneringskampen: '+(error?.message||error));
        cancelling=false;
        cancelBtn.disabled=false;
        cancelBtn.textContent='Avbryt kamp';
      });
    },{capture:true});
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
    if(synced||syncing||!row||row.status!=='finished')return;
    syncing=true;
    try{
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
    }finally{syncing=false}
  }

  async function boot(){
    const [{data:tm},{data:live}]=await Promise.all([
      client.from('tournament_matches').select('tournament_id').eq('id',tournamentMatchId).single(),
      client.from('matches').select('id,status').eq('id',liveMatchId).single()
    ]);
    tournamentId=tm?.tournament_id||null;
    if(tournamentId)window.DartArenaTournamentReturnUrl='tournament.html?id='+encodeURIComponent(tournamentId);
    await syncIfFinished(live);
    syncChannel=client.channel(`tournament-sync-${liveMatchId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${liveMatchId}`},payload=>syncIfFinished(payload.new))
      .subscribe();
  }

  window.addEventListener('pagehide',()=>{if(syncChannel)client.removeChannel(syncChannel).catch(()=>{})},{once:true});
  boot().catch(error=>console.error('Tournament match sync init failed',error));
})();