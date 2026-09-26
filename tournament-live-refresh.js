(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId||!window.supabase)return;

  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let refreshTimer=null;
  function refreshSoon(){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(()=>{
      if(typeof window.loadGroupLobby==='function'){
        window.loadGroupLobby().catch(err=>console.error('Tournament live refresh failed',err));
      }
    },120);
  }

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='dartarena-tournament-match-finished')refreshSoon();
  });

  window.addEventListener('focus',refreshSoon);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshSoon();
  });

  client.channel(`tournament-live-refresh-${tournamentId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'tournament_matches',
      filter:`tournament_id=eq.${tournamentId}`
    },refreshSoon)
    .subscribe();
})();
