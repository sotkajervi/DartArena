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
      try{
        await window.load();
        return;
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
      }catch(err){
        console.warn('Tournament reconciliation check failed',err);
        // A confirmed realtime/message change must still be reflected even if
        // the lightweight safety query temporarily fails.
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

      // Normal Alt-Tab/focus with unchanged data ends here: no DOM redraw.
      if(!tournamentChanged&&!membersChanged&&!matchesChanged)return;

      // Tournament/member changes can affect status, controls and participant
      // lists, so use the authoritative full loader. Match-only changes redraw
      // only groups/cup to minimize DOM churn.
      if(tournamentChanged||membersChanged)await refreshWholeTournament();
      else await refreshMatchViews();

      // Re-read after rendering because cup advancement/finalization can update
      // additional rows while the refresh is running.
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

  client.channel(`tournament-live-refresh-${tournamentId}`)
    .on('postgres_changes',{
      event:'*',schema:'public',table:'tournament_matches',filter:`tournament_id=eq.${tournamentId}`
    },()=>{
      if(document.visibilityState==='hidden')hiddenDirty=true;
      else scheduleSync(true);
    })
    .subscribe();

  // Baseline only. It never redraws the page.
  setTimeout(async()=>{
    try{snapshot=await readSnapshot()}
    catch(err){console.warn('Tournament refresh baseline failed',err)}
  },500);
})();
