(()=>{
  if(typeof showProposal!=='function'||typeof syncGameMode!=='function'||typeof send!=='function')return;

  const baseShowProposal=showProposal;
  showProposal=proposal=>{
    const isJdc=proposal?.gameVariant==='jdc'||proposal?.game==='jdc';
    if(!isJdc)return baseShowProposal(proposal);
    pendingProposal={
      ...proposal,
      gameVariant:'jdc',
      mode:'legs',
      sets:1,
      legs:1
    };
    const who=proposal.starter==='random'?'Tilfeldig':proposal.starter===profile.id?'Du starter':`${names[other]||'Motstander'} starter`;
    $('proposalTitle').textContent='JDC Challenge • 57 piler hver';
    $('proposalText').textContent=`${who}. Resultatet teller på offisiell Top 10 og JDC-tier.`;
    $('proposalActions').classList.remove('hidden');
  };

  const baseSyncGameMode=syncGameMode;
  const syncJdcMode=()=>{
    if(selectedGame()!=='jdc')return baseSyncGameMode();
    matchMode='legs';
    $('legsModeBtn').classList.add('active');
    $('setsModeBtn').classList.remove('active');
    $('legsModeBtn').disabled=true;
    $('setsModeBtn').disabled=true;
    $('setsField').classList.add('hidden');
    $('legsField').classList.add('hidden');
    $('sixtyOneTimeField').classList.add('hidden');
    $('roomLegs').value='1';
  };

  const gameSelect=$('roomGame');
  if(gameSelect){
    gameSelect.onchange=syncJdcMode;
    syncJdcMode();
  }

  // room.js predates JDC and routes every unknown variant to match.html.
  // Keep the legacy router untouched for existing games, but send JDC starts on
  // a dedicated event so the other player is always sent to jdc-match.html.
  const baseSend=send;
  send=async function(event,payload={}){
    if(event==='match-start'&&payload?.gameVariant==='jdc'){
      if(channel){
        await channel.send({
          type:'broadcast',
          event:'jdc-match-start',
          payload:{...payload,from:profile.id}
        });
      }
      return;
    }
    return baseSend(event,payload);
  };

  let routeChannel=null;
  const installRouteChannel=()=>{
    if(routeChannel||typeof db==='undefined'||typeof challengeId==='undefined'||!challengeId||!profile?.id)return false;
    routeChannel=db.channel(`room-${challengeId}`)
      .on('broadcast',{event:'jdc-match-start'},({payload})=>{
        if(!payload?.matchId||payload.from===profile.id)return;
        location.href=`jdc-match.html?id=${encodeURIComponent(payload.matchId)}`;
      })
      .subscribe();
    return true;
  };

  const routeWait=setInterval(()=>{
    if(installRouteChannel())clearInterval(routeWait);
  },100);
  setTimeout(()=>clearInterval(routeWait),15000);

  window.addEventListener('pagehide',()=>{
    clearInterval(routeWait);
    if(routeChannel){try{db.removeChannel(routeChannel)}catch{}}
    routeChannel=null;
  },{once:true});
})();
