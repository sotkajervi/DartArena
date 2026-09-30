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

  // room.js predates JDC and routes unknown variants to match.html.
  // Reuse the existing waiting-room realtime channel instead of opening a second
  // channel with the same topic. A duplicate room channel could interfere with
  // the normal room subscription that starts camera/media.
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

  let routeBound=false;
  const bindJdcRoute=()=>{
    if(routeBound||!channel||!profile?.id)return false;
    channel.on('broadcast',{event:'jdc-match-start'},({payload})=>{
      if(!payload?.matchId||payload.from===profile.id)return;
      location.href=`jdc-match.html?id=${encodeURIComponent(payload.matchId)}`;
    });
    routeBound=true;
    return true;
  };

  const routeWait=setInterval(()=>{
    if(bindJdcRoute())clearInterval(routeWait);
  },100);
  setTimeout(()=>clearInterval(routeWait),15000);
  window.addEventListener('pagehide',()=>clearInterval(routeWait),{once:true});
})();
