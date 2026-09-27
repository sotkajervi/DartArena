(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId||!window.supabase)return;

  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let refreshTimer=null;
  let reconcileTimer=null;
  let snapshot=null;
  let hiddenDirty=false;
  let refreshing=false;
  let reconciling=false;
  let reconcileAgain=false;

  const stableRows=(rows,fields)=>(rows||[])
    .map(row=>fields.map(field=>row?.[field]??null))
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));

  async function readSnapshot(){
    const [tournamentResult,membersResult,matchesResult]=await Promise.all([
      client.from('tournaments')
        .select('id,status,registration_open,updated_at')
        .eq('id',tournamentId)
        .single(),
      client.from('tournament_members')
        .select('user_id,role,joined_at')
        .eq('tournament_id',tournamentId),
      client.from('tournament_matches')
        .select('id,status,round_no,match_no,player1_id,player2_id,player1_legs,player2_legs,winner_id,live_match_id,updated_at')
        .eq('tournament_id',tournamentId)
    ]);

    if(tournamentResult.error)throw tournamentResult.error;
    if(membersResult.error)throw membersResult.error;
    if(matchesResult.error)throw matchesResult.error;

    return{
      tournament:JSON.stringify(tournamentResult.data||null),
      members:JSON.stringify(stableRows(membersResult.data,['user_id','role','joined_at'])),
      matches:JSON.stringify(stableRows(matchesResult.data,[
        'id','status','round_no','match_no','player1_id','player2_id',
        'player1_legs','player2_legs','winner_id','live_match_id','updated_at'
      ]))
    };
  }

  async function refreshMatchViews(){
    if(window.dartArenaSimulationViewActive)return;
    const jobs=[];
    if(typeof window.loadGroupLobby==='function')jobs.push(
      Promise.resolve(window.loadGroupLobby()).catch(err=>console.error('Tournament group refresh failed',err))
    );
    if(typeof window.dartArenaLoadCup==='function')jobs.push(
      Promise.resolve(window.dartArenaLoadCup()).catch(err=>console.error('Tournament cup refresh failed',err))
    );
    await Promise.all(jobs);
  }

  async function refreshWholeTournament(){
    if(window.dartArenaSimulationViewActive)return;
    if(typeof window.load==='function'){
      try{await window.load();return}catch(err){console.error('Tournament full refresh failed',err)}
    }
    await refreshMatchViews();
  }

  async function updateSnapshotAfterRefresh(){
    try{snapshot=await readSnapshot()}catch(err){console.warn('Tournament refresh snapshot failed',err)}
  }

  function scheduleRefresh(){
    if(window.dartArenaSimulationViewActive)return;
    if(document.visibilityState==='hidden'){
      hiddenDirty=true;
      return;
    }

    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      if(refreshing||window.dartArenaSimulationViewActive)return;
      refreshing=true;
      try{
        await refreshMatchViews();
        await updateSnapshotAfterRefresh();
        hiddenDirty=false;
      }finally{
        refreshing=false;
      }
    },120);
  }

  async function reconcileAfterFocus(){
    if(window.dartArenaSimulationViewActive||document.visibilityState==='hidden')return;
    if(reconciling){reconcileAgain=true;return}
    reconciling=true;

    try{
      if(hiddenDirty){
        hiddenDirty=false;
        await refreshMatchViews();
        await updateSnapshotAfterRefresh();
        return;
      }

      const current=await readSnapshot();
      if(!snapshot){
        snapshot=current;
        return;
      }

      const tournamentChanged=current.tournament!==snapshot.tournament;
      const membersChanged=current.members!==snapshot.members;
      const matchesChanged=current.matches!==snapshot.matches;

      if(!tournamentChanged&&!membersChanged&&!matchesChanged)return;

      if(tournamentChanged||membersChanged)await refreshWholeTournament();
      else if(matchesChanged)await refreshMatchViews();

      await updateSnapshotAfterRefresh();
    }catch(err){
      // A failed safety check must never blank/redraw a healthy bracket.
      console.warn('Tournament focus reconciliation failed',err);
    }finally{
      reconciling=false;
      if(reconcileAgain){
        reconcileAgain=false;
        setTimeout(reconcileAfterFocus,0);
      }
    }
  }

  function scheduleReconcile(){
    if(window.dartArenaSimulationViewActive||document.visibilityState==='hidden')return;
    clearTimeout(reconcileTimer);
    reconcileTimer=setTimeout(reconcileAfterFocus,100);
  }

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='dartarena-tournament-match-finished'||event.data?.type==='dartarena-tournament-match-cancelled')scheduleRefresh();
  });

  window.addEventListener('focus',scheduleReconcile);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')scheduleReconcile();
  });

  client.channel(`tournament-live-refresh-${tournamentId}`)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${tournamentId}`
    },()=>{
      if(document.visibilityState==='hidden')hiddenDirty=true;
      else scheduleRefresh();
    })
    .subscribe();

  // Baseline only: no redraw. This makes ordinary Alt-Tab a no-op when data is unchanged.
  setTimeout(async()=>{
    try{snapshot=await readSnapshot()}catch(err){console.warn('Tournament refresh baseline failed',err)}
  },500);
})();
