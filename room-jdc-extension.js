(()=>{
  if(typeof pageForVariant!=='function'||typeof showProposal!=='function'||typeof syncGameMode!=='function')return;

  const basePageForVariant=pageForVariant;
  pageForVariant=variant=>variant==='jdc'?'jdc-match.html':basePageForVariant(variant);

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
})();