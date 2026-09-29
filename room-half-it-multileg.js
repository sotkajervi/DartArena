(()=>{
  if(typeof selectedGame!=='function'||typeof variantForGame!=='function')return;

  syncGameMode=function(){
    const g=selectedGame(),special=isSpecialGame(),sixty=g==='sixty_one';
    $('setsModeBtn').disabled=special;
    $('legsModeBtn').disabled=false;
    $('legsField').classList.remove('hidden');
    $('sixtyOneTimeField').classList.toggle('hidden',!sixty);
    if(special)setMatchMode('legs');
  };
  $('roomGame').onchange=syncGameMode;
  syncGameMode();

  $('proposalBtn').onclick=async()=>{
    const rawGame=selectedGame(),variant=variantForGame(rawGame),half=variant==='half_it',sixty=variant==='sixty_one',special=variant!=='x01',game=special?rawGame:Number(rawGame),mode=special?'legs':matchMode,legs=Number($('roomLegs').value),sets=special?1:(mode==='sets'?Number($('roomSets').value):1),durationMinutes=sixty?Number($('room61Time').value):null,choice=$('roomStarter').value;
    if(legs<1||legs%2===0||sets<1||sets%2===0){$('roomMessage').textContent='Best of må være et oddetall.';return}
    if(sixty&&![10,20,30,45,60].includes(durationMinutes)){$('roomMessage').textContent='Velg gyldig tid per leg.';return}
    const starter=choice==='me'?profile.id:choice==='opponent'?other:'random',payload={game,gameVariant:variant,legs,sets,mode,starter,durationMinutes};
    await send('proposal',payload);
    const label=gameLabel(game);
    $('roomMessage').textContent=half?`Forslag sendt: ${label} • Best of ${legs} legs • 12 runder/leg`:sixty?`Forslag sendt: 61 • Best of ${legs} legs • ${durationMinutes} min/leg`:mode==='sets'?`Forslag sendt: ${label} • Best of ${sets} sets • Best of ${legs} legs`:`Forslag sendt: ${label} • Best of ${legs} legs`;
  };

  showProposal=function(p){
    const variant=p.gameVariant==='sixty_one'||p.game==='sixty_one'?'sixty_one':p.gameVariant==='half_it'||p.game==='half_it'?'half_it':p.gameVariant==='cricket'||p.game==='cricket'?'cricket':'x01',special=variant!=='x01',half=variant==='half_it',sixty=variant==='sixty_one',durationMinutes=sixty&&[10,20,30,45,60].includes(Number(p.durationMinutes))?Number(p.durationMinutes):10;
    pendingProposal={...p,gameVariant:variant,mode:special?'legs':p.mode||'legs',sets:special?1:Number(p.sets)||1,legs:Number(p.legs)||1,durationMinutes};
    const who=p.starter==='random'?'Tilfeldig':p.starter===profile.id?'Du starter':`${names[other]} starter`;
    const label=sixty?'61':half?'Half-It':variant==='cricket'?'Cricket':p.game;
    const format=half?`${label} • Best of ${pendingProposal.legs} legs • 12 runder/leg`:sixty?`${label} • Best of ${pendingProposal.legs} legs • ${durationMinutes} min/leg`:pendingProposal.mode==='sets'?`${label} • Best of ${pendingProposal.sets} sets • Best of ${pendingProposal.legs} legs`:`${label} • Best of ${pendingProposal.legs} legs`;
    $('proposalTitle').textContent=format;
    $('proposalText').textContent=`${who}. Godta for å starte kampen.`;
    $('proposalActions').classList.remove('hidden');
  };

  $('acceptProposalBtn').onclick=async()=>{
    if(!pendingProposal)return;
    const b=$('acceptProposalBtn');b.disabled=true;b.textContent='Starter…';
    let first=pendingProposal.starter;if(first==='random')first=Math.random()<.5?profile.id:other;
    const variant=pendingProposal.gameVariant||'x01',special=variant!=='x01',sixty=variant==='sixty_one',numericGame=special?501:Number(pendingProposal.game),initialScore=sixty?61:special?0:numericGame;
    const row={player1_id:c.challenger_id,player2_id:c.challenged_id,game:numericGame,game_variant:variant,legs:pendingProposal.legs,status:'playing',turn_player_id:first,player1_score:initialScore,player2_score:initialScore,match_mode:special?'legs':pendingProposal.mode,best_of_sets:special?1:(pendingProposal.mode==='sets'?pendingProposal.sets:1),player1_sets:0,player2_sets:0,match_starter_id:first,current_set:1,current_leg:1,game_config:sixty?{duration_seconds:pendingProposal.durationMinutes*60}:{}};
    const{data:match,error}=await db.from('matches').insert(row).select().single();
    if(error){b.disabled=false;b.textContent='Godta og start kamp';$('roomMessage').textContent=error.message;return}
    await db.from('challenges').update({status:'accepted'}).eq('id',challengeId);
    await db.from('profiles').update({status:'in_game'}).in('id',[c.challenger_id,c.challenged_id]);
    await send('match-start',{matchId:match.id,gameVariant:variant});
    location.href=`${pageForVariant(variant)}?id=${encodeURIComponent(match.id)}`;
  };
})();
