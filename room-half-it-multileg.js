(()=>{
  if(typeof selectedGame!=='function')return;
  const games=window.DartArenaGames;
  const isSpecial=g=>games?.isSpecial(g)??['chicago','cricket','half_it','half_it_standard','sixty_one'].includes(g);

  syncGameMode=function(){
    const g=selectedGame(),special=isSpecial(g),chicago=g==='chicago',sixty=g==='sixty_one';
    $('setsModeBtn').disabled=special;
    $('legsModeBtn').disabled=chicago;
    $('legsField').classList.toggle('hidden',chicago);
    $('sixtyOneTimeField').classList.toggle('hidden',!sixty);
    if(chicago)$('roomLegs').value='3';
    if(special)setMatchMode('legs');
  };
  $('roomGame').onchange=syncGameMode;
  syncGameMode();

  showProposal=function(p){
    const raw=String(p.game||''),chicago=!!p.isChicago||raw==='chicago'||String(p.gameConfig?.chicago??'false').toLowerCase()==='true',
      variant=chicago?'x01':p.gameVariant==='sixty_one'||raw==='sixty_one'?'sixty_one':p.gameVariant==='half_it'||raw==='half_it'||raw==='half_it_standard'?'half_it':p.gameVariant==='cricket'||raw==='cricket'?'cricket':'x01',
      special=variant!=='x01'||chicago,half=variant==='half_it',sixty=variant==='sixty_one',
      durationMinutes=sixty&&[10,20,30,45,60].includes(Number(p.durationMinutes))?Number(p.durationMinutes):10,
      hMode=half?(p.halfItMode==='standard'||raw==='half_it_standard'?'standard':'dartcounter'):null;
    pendingProposal={...p,isChicago:chicago,gameVariant:variant,halfItMode:hMode,mode:special?'legs':p.mode||'legs',sets:special?1:Number(p.sets)||1,legs:chicago?3:Number(p.legs)||1,durationMinutes};
    const who=p.starter==='random'?'Tilfeldig':p.starter===profile.id?'Du starter':`${names[other]} starter`;
    const label=chicago?'Chicago Style':half?(hMode==='standard'?'Half-It (Standard)':'Half-It (DartCounter)'):sixty?'61':variant==='cricket'?'Cricket':p.game;
    const format=chicago?`${label} • 301 DI/DO → Cricket → 501 DO`:half?`${label} • Best of ${pendingProposal.legs} legs • 12 runder/leg`:sixty?`${label} • Best of ${pendingProposal.legs} legs • ${durationMinutes} min/leg`:pendingProposal.mode==='sets'?`${label} • Best of ${pendingProposal.sets} sets • Best of ${pendingProposal.legs} legs`:`${label} • Best of ${pendingProposal.legs} legs`;
    $('proposalTitle').textContent=format;
    $('proposalText').textContent=`${who}. Godta for å starte kampen.`;
    $('proposalActions').classList.remove('hidden');
  };
})();
