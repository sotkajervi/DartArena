(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId||!window.supabase)return;

  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let syncTimer=null;
  let snapshot=null;
  let hiddenDirty=false;
  let syncing=false;
  let syncAgain=false;
  let nextSyncKnownChange=false;
  let reconcileTimer=null;
  let liveChannel=null;
  let authRecovery=null;

  async function ensureAuthenticated(){
    const {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(data?.session?.access_token)return true;
    return false;
  }

  async function recoverAuthentication(){
    if(authRecovery)return authRecovery;
    authRecovery=(async()=>{
      const {data,error}=await client.auth.refreshSession();
      if(error)throw error;
      return !!data?.session?.access_token;
    })().finally(()=>{authRecovery=null});
    return authRecovery;
  }

  const stableRows=(rows,fields)=>(rows||[])
    .map(row=>fields.map(field=>row?.[field]??null))
    .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));

  async function readSnapshot(){
    if(!await ensureAuthenticated())return null;
    const [tournamentResult,membersResult,matchesResult]=await Promise.all([
      client.from('tournaments')
        .select('id,status,registration_open,updated_at,game,game_variant,cup_game,cup_game_variant')
        .eq('id',tournamentId)
        .maybeSingle(),
      client.from('tournament_members')
        .select('user_id,role,joined_at')
        .eq('tournament_id',tournamentId),
      client.from('tournament_matches')
        .select('id,status,round_no,match_no,player1_id,player2_id,player1_legs,player2_legs,winner_id,live_match_id,updated_at')
        .eq('tournament_id',tournamentId)
    ]);

    if(tournamentResult.error){
      if(['401','42501'].includes(String(tournamentResult.error.code))){
        await recoverAuthentication().catch(error=>console.warn('Tournament session refresh failed',error));
      }
      throw tournamentResult.error;
    }
    if(membersResult.error)throw membersResult.error;
    if(matchesResult.error)throw matchesResult.error;

    const liveIds=[...new Set((matchesResult.data||[])
      .filter(row=>row.status==='live'&&row.live_match_id)
      .map(row=>row.live_match_id))];
    let liveScores=[];
    if(liveIds.length){
      const liveResult=await client.from('matches')
        .select('id,status,player1_legs,player2_legs,current_leg,updated_at')
        .in('id',liveIds);
      if(liveResult.error)throw liveResult.error;
      liveScores=liveResult.data||[];
    }

    return{
      tournament:JSON.stringify(tournamentResult.data||null),
      members:JSON.stringify(stableRows(membersResult.data,['user_id','role','joined_at'])),
      matches:JSON.stringify(stableRows(matchesResult.data,[
        'id','status','round_no','match_no','player1_id','player2_id',
        'player1_legs','player2_legs','winner_id','live_match_id','updated_at'
      ])),
      liveScores:JSON.stringify(stableRows(liveScores,[
        'id','status','player1_legs','player2_legs','current_leg','updated_at'
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
      try{
        await window.load();
      }catch(err){
        console.error('Tournament full refresh failed',err);
      }
    }
    await refreshMatchViews();
  }

  async function captureSnapshot(fallback=null){
    try{return await readSnapshot()}
    catch(err){
      console.warn('Tournament refresh snapshot failed',err);
      return fallback;
    }
  }

  async function syncFromDatabase(knownChange=false){
    if(window.dartArenaSimulationViewActive||document.visibilityState==='hidden')return;

    if(syncing){
      syncAgain=true;
      nextSyncKnownChange=nextSyncKnownChange||knownChange;
      return;
    }

    syncing=true;
    try{
      let current;
      try{
        current=await readSnapshot();
        if(!current)return;
      }catch(err){
        console.warn('Tournament reconciliation check failed',err);
        if(knownChange){
          await refreshWholeTournament();
          snapshot=await captureSnapshot(snapshot);
        }
        return;
      }

      if(!snapshot){
        if(knownChange){
          await refreshWholeTournament();
          snapshot=await captureSnapshot(current);
        }else{
          snapshot=current;
        }
        return;
      }

      const tournamentChanged=current.tournament!==snapshot.tournament;
      const membersChanged=current.members!==snapshot.members;
      const matchesChanged=current.matches!==snapshot.matches;
      const liveScoresChanged=current.liveScores!==snapshot.liveScores;
      if(!tournamentChanged&&!membersChanged&&!matchesChanged&&!liveScoresChanged)return;

      if(tournamentChanged||membersChanged)await refreshWholeTournament();
      else await refreshMatchViews();

      snapshot=await captureSnapshot(current);
    }finally{
      syncing=false;
      if(syncAgain){
        const rerunKnownChange=nextSyncKnownChange;
        syncAgain=false;
        nextSyncKnownChange=false;
        setTimeout(()=>syncFromDatabase(rerunKnownChange),0);
      }
    }
  }

  function scheduleSync(knownChange=false){
    if(window.dartArenaSimulationViewActive)return;
    if(document.visibilityState==='hidden'){
      if(knownChange)hiddenDirty=true;
      return;
    }

    nextSyncKnownChange=nextSyncKnownChange||knownChange;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>{
      const runKnownChange=nextSyncKnownChange;
      nextSyncKnownChange=false;
      syncFromDatabase(runKnownChange);
    },100);
  }

  function realtimeChange(){
    if(document.visibilityState==='hidden')hiddenDirty=true;
    else scheduleSync(true);
  }

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(
      event.data?.type==='dartarena-tournament-match-finished'||
      event.data?.type==='dartarena-tournament-match-cancelled'
    )scheduleSync(true);
  });

  window.addEventListener('focus',()=>scheduleSync(hiddenDirty));
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible')return;
    const hadHiddenChange=hiddenDirty;
    hiddenDirty=false;
    scheduleSync(hadHiddenChange);
  });

  liveChannel=client.channel(`tournament-live-refresh-${tournamentId}`)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'tournaments',filter:`id=eq.${tournamentId}`
    },realtimeChange)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'tournament_members',filter:`tournament_id=eq.${tournamentId}`
    },realtimeChange)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${tournamentId}`
    },realtimeChange)
    .subscribe((status,error)=>{
      if(status==='SUBSCRIBED')scheduleSync(true);
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('[TOURNAMENT REALTIME] tournament-live-refresh.js',status,{tournamentId,message:error?.message||null});
    });

  // Safety net for missed Realtime events. It only reloads the UI when the
  // database snapshot actually changed, so idle tournament pages stay quiet.
  reconcileTimer=setInterval(()=>scheduleSync(false),15000);

  setTimeout(async()=>{
    try{
      if(!snapshot)snapshot=await readSnapshot();
      scheduleSync(true);
    }catch(err){console.warn('Tournament refresh baseline failed',err)}
  },500);

  window.addEventListener('pagehide',()=>{
    clearTimeout(syncTimer);
    clearInterval(reconcileTimer);
    if(liveChannel)client.removeChannel(liveChannel).catch?.(()=>{});
  },{once:true});
})();