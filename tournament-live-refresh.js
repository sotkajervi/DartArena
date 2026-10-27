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
  let scoreChannel=null;
  let scoreChannelKey='';
  let scoreChannelVersion=0;
  let scorePollTimer=null;
  let scorePollBusy=false;
  let liveMatchLinks=new Map();

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

  function renderLiveLegs(liveRows){
    if(window.dartArenaSimulationViewActive)return;
    for(const row of liveRows||[]){
      const link=liveMatchLinks.get(row.id);
      if(!link)continue;
      const left=Number(row.player1_legs),right=Number(row.player2_legs);
      if(!Number.isFinite(left)||!Number.isFinite(right))continue;
      const score=`${left}–${right}`;
      // Update the small score field only. Rebuilding cup/group cards during
      // each leg would replace event handlers, badges and scroll position.
      const selector=link.stage==='cup'?'#cupBracket .cup-match':'#liveGroups .match-row';
      const card=[...document.querySelectorAll(`${selector}[data-match]`)]
        .find(node=>node.dataset.match===link.tournamentMatchId);
      const scoreEl=card?.querySelector(link.stage==='cup'?'.cup-score':'.match-score');
      if(scoreEl&&scoreEl.textContent!==score)scoreEl.textContent=score;
    }
  }

  async function pollLiveLegs(){
    if(scorePollBusy||!liveMatchLinks.size||window.dartArenaSimulationViewActive||
      document.visibilityState==='hidden')return;
    scorePollBusy=true;
    try{
      const {data,error}=await client.from('matches')
        .select('id,player1_legs,player2_legs')
        .in('id',[...liveMatchLinks.keys()]);
      if(error)throw error;
      renderLiveLegs(data||[]);
    }catch(error){console.warn('Tournament live leg refresh failed',error)}
    finally{scorePollBusy=false}
  }

  function syncLiveMatchLinks(tournamentMatches){
    const next=new Map((tournamentMatches||[])
      .filter(row=>row.status==='live'&&row.live_match_id)
      .map(row=>[row.live_match_id,{tournamentMatchId:row.id,stage:row.stage}]));
    const key=[...next].map(([liveId,link])=>`${liveId}:${link.tournamentMatchId}:${link.stage}`).sort().join('|');
    liveMatchLinks=next;
    if(key===scoreChannelKey)return;
    scoreChannelKey=key;
    scoreChannelVersion++;
    const generation=scoreChannelVersion;
    if(scoreChannel){
      client.removeChannel(scoreChannel).catch(()=>{});
      scoreChannel=null;
    }
    if(!next.size)return;
    // Filter per match: do not subscribe to every score update on the server.
    const channel=client.channel(`tournament-leg-scores-${tournamentId}-${generation}`);
    for(const liveId of next.keys()){
      channel.on('postgres_changes',{
        event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${liveId}`
      },payload=>{
        if(generation!==scoreChannelVersion)return;
        renderLiveLegs(payload.new?[payload.new]:[]);
      });
    }
    scoreChannel=channel;
    channel.subscribe(status=>{
      if(status==='SUBSCRIBED'&&generation===scoreChannelVersion)pollLiveLegs();
    });
    // Polling remains a fallback when Realtime isn't enabled for a match.
    pollLiveLegs();
  }

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
        .select('id,stage,status,round_no,match_no,player1_id,player2_id,player1_legs,player2_legs,winner_id,live_match_id,updated_at')
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
    // Both bracket and group scores reference these live match IDs.
    syncLiveMatchLinks(matchesResult.data||[]);

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

    renderLiveLegs(liveScores);

    return{
      tournament:JSON.stringify(tournamentResult.data||null),
      members:JSON.stringify(stableRows(membersResult.data,['user_id','role','joined_at'])),
      matches:JSON.stringify(stableRows(matchesResult.data,[
        'id','stage','status','round_no','match_no','player1_id','player2_id',
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

  async function startAuthenticatedRealtime(){
    // Realtime treats a column without SELECT privilege as an invalid filter.
    // An anonymous join therefore raises "invalid column for filter tournament_id".
    // Do not open any filtered subscription until the client's JWT is ready.
    if(!await ensureAuthenticated())return;
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
    .subscribe(status=>{
      if(status==='SUBSCRIBED')scheduleSync(true);
    });

  // Safety net for missed Realtime events. It only reloads the UI when the
  // database snapshot actually changed, so idle tournament pages stay quiet.
  reconcileTimer=setInterval(()=>scheduleSync(false),15000);
  // Cheap, score-only safety polling while tournament matches are in progress.
  scorePollTimer=setInterval(pollLiveLegs,3000);

  setTimeout(async()=>{
    try{
      if(!snapshot)snapshot=await readSnapshot();
      scheduleSync(true);
    }catch(err){console.warn('Tournament refresh baseline failed',err)}
  },500);
  }

  startAuthenticatedRealtime().catch(error=>
    console.warn('Tournament authenticated Realtime startup failed',error)
  );

  window.addEventListener('pagehide',()=>{
    clearTimeout(syncTimer);
    clearInterval(reconcileTimer);
    clearInterval(scorePollTimer);
    if(scoreChannel)client.removeChannel(scoreChannel).catch(()=>{});
    if(liveChannel)client.removeChannel(liveChannel).catch?.(()=>{});
  },{once:true});
})();