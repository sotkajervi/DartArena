(()=>{
  const wait=setInterval(()=>{
    const button=document.getElementById('acceptProposalBtn');
    if(!button||!window.supabase||typeof pendingProposal==='undefined'||typeof db==='undefined')return;
    clearInterval(wait);
    button.onclick=secureStartMatch;
  },100);

  async function secureStartMatch(){
    if(!pendingProposal)return;
    const b=document.getElementById('acceptProposalBtn');
    b.disabled=true;b.textContent='Starter…';
    try{
      const variant=pendingProposal.gameVariant||'x01';
      const special=variant!=='x01';
      const half=variant==='half_it';
      const sixty=variant==='sixty_one';
      const numericGame=special?501:Number(pendingProposal.game);
      const gameConfig=sixty
        ?{duration_seconds:Number(pendingProposal.durationMinutes)*60}
        :half
          ?{half_it_mode:pendingProposal.halfItMode==='standard'?'standard':'dartcounter'}
          :{};
      const starter=pendingProposal.starter==='random'?null:pendingProposal.starter;
      const {data:match,error}=await db.rpc('create_match_from_challenge',{
        p_challenge_id:challengeId,
        p_game_variant:variant,
        p_game:numericGame,
        p_legs:Number(pendingProposal.legs)||1,
        p_match_mode:special?'legs':(pendingProposal.mode||'legs'),
        p_best_of_sets:special?1:(Number(pendingProposal.sets)||1),
        p_starter_id:starter,
        p_game_config:gameConfig
      });
      if(error||!match)throw error||new Error('Kampen kunne ikke opprettes.');
      await send('match-start',{matchId:match.id,gameVariant:variant});
      const page=window.DartArenaGames?.pageForVariant?.(variant)||pageForVariant(variant);
      location.href=`${page}?id=${encodeURIComponent(match.id)}`;
    }catch(error){
      document.getElementById('roomMessage').textContent=error?.message||'Kampen kunne ikke startes.';
      b.disabled=false;b.textContent='Godta og start kamp';
    }
  }
})();
