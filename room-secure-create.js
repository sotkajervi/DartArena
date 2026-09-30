(()=>{
  const wait=setInterval(()=>{
    const propose=document.getElementById('proposalBtn');
    const accept=document.getElementById('acceptProposalBtn');
    const reject=document.getElementById('rejectProposalBtn');
    if(!propose||!accept||!reject||!window.supabase||typeof pendingProposal==='undefined'||typeof db==='undefined'||typeof selectedGame!=='function')return;
    clearInterval(wait);
    install(propose,accept,reject);
  },100);

  function resolveVariant(raw){
    return window.DartArenaGames?.variantFor?.(raw)||(raw==='cricket'?'cricket':raw==='half_it'||raw==='half_it_standard'?'half_it':raw==='sixty_one'?'sixty_one':'x01');
  }
  function labelFor(raw){
    return window.DartArenaGames?.labelForRaw?.(raw)||(raw==='half_it_standard'?'Half-It (Standard)':raw==='half_it'?'Half-It (DartCounter)':raw==='cricket'?'Cricket':raw==='sixty_one'?'61':String(raw));
  }
  function halfModeFor(raw){return raw==='half_it_standard'?'standard':raw==='half_it'?'dartcounter':null}

  function install(propose,accept,reject){
    propose.onclick=async()=>{
      const raw=selectedGame();
      const variant=resolveVariant(raw),special=variant!=='x01',half=variant==='half_it',sixty=variant==='sixty_one';
      const legs=Number(document.getElementById('roomLegs').value),mode=special?'legs':matchMode;
      const sets=special?1:(mode==='sets'?Number(document.getElementById('roomSets').value):1);
      const durationMinutes=sixty?Number(document.getElementById('room61Time').value):null;
      if(legs<1||legs>21||legs%2===0||sets<1||sets>11||sets%2===0){document.getElementById('roomMessage').textContent='Best of må være et gyldig oddetall.';return}
      if(sixty&&![10,20,30,45,60].includes(durationMinutes)){document.getElementById('roomMessage').textContent='Velg gyldig tid per leg.';return}
      const starterChoice=document.getElementById('roomStarter').value;
      const starterId=starterChoice==='me'?profile.id:starterChoice==='opponent'?other:null;
      const gameConfig=sixty?{duration_seconds:durationMinutes*60}:half?{half_it_mode:halfModeFor(raw)}:{};
      const game=special?501:Number(raw);
      propose.disabled=true;propose.textContent='Sender…';
      try{
        const {data,error}=await db.rpc('propose_challenge_match',{
          p_challenge_id:challengeId,p_game_variant:variant,p_game:game,p_legs:legs,
          p_match_mode:mode,p_best_of_sets:sets,p_starter_id:starterId,p_game_config:gameConfig
        });
        if(error||!data)throw error||new Error('Forslaget kunne ikke lagres.');
        const payload={proposalId:data.id,game:raw,gameVariant:variant,halfItMode:half?halfModeFor(raw):null,legs:Number(data.legs),sets:Number(data.best_of_sets),mode:data.match_mode,starter:data.starter_id||'random',durationMinutes};
        await send('proposal',payload);
        const label=labelFor(raw);
        document.getElementById('roomMessage').textContent=half
          ?`Forslag sendt: ${label} • Best of ${legs} legs • 12 runder/leg`
          :sixty?`Forslag sendt: 61 • Best of ${legs} legs • ${durationMinutes} min/leg`
          :mode==='sets'?`Forslag sendt: ${label} • Best of ${sets} sets • Best of ${legs} legs`
          :`Forslag sendt: ${label} • Best of ${legs} legs`;
      }catch(error){document.getElementById('roomMessage').textContent=error?.message||'Forslaget kunne ikke sendes.'}
      finally{propose.disabled=false;propose.textContent='Send kampforslag'}
    };

    accept.onclick=async()=>{
      if(!pendingProposal?.proposalId){document.getElementById('roomMessage').textContent='Forslaget mangler serverbekreftelse. Be motstanderen sende det på nytt.';return}
      accept.disabled=true;accept.textContent='Starter…';
      try{
        const {data:match,error}=await db.rpc('accept_challenge_match_proposal',{p_proposal_id:pendingProposal.proposalId});
        if(error||!match)throw error||new Error('Kampen kunne ikke opprettes.');
        const variant=match.game_variant||pendingProposal.gameVariant||'x01';
        await send('match-start',{matchId:match.id,gameVariant:variant});
        const page=window.DartArenaGames?.pageForVariant?.(variant)||pageForVariant(variant);
        location.href=`${page}?id=${encodeURIComponent(match.id)}`;
      }catch(error){document.getElementById('roomMessage').textContent=error?.message||'Kampen kunne ikke startes.';accept.disabled=false;accept.textContent='Godta og start kamp'}
    };

    reject.onclick=async()=>{
      const p=pendingProposal;if(!p)return;
      reject.disabled=true;
      try{
        if(p.proposalId){const {error}=await db.rpc('reject_challenge_match_proposal',{p_proposal_id:p.proposalId});if(error)throw error}
        pendingProposal=null;
        document.getElementById('proposalActions').classList.add('hidden');
        document.getElementById('proposalTitle').textContent='Ingen forslag ennå';
        document.getElementById('proposalText').textContent='Dere kan avtale et nytt oppsett.';
        await send('proposal-rejected');
      }catch(error){document.getElementById('roomMessage').textContent=error?.message||'Kunne ikke avslå forslaget.'}
      finally{reject.disabled=false}
    };
  }
})();
