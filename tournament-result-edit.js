(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId||!window.supabase)return;

  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let isOwner=false,decorating=false;
  const nameCache={};

  function ensureStyles(){
    if(document.getElementById('admin-result-edit-styles'))return;
    const style=document.createElement('style');
    style.id='admin-result-edit-styles';
    style.textContent=`
      .edit-result-btn{position:relative;z-index:4;white-space:nowrap}
      .cup-match{position:relative}
      .cup-match .edit-result-btn{display:block;width:100%;margin-top:7px;padding:7px 9px;font-size:11px}
      .match-row .edit-result-btn{padding:7px 10px;font-size:11px}
      @media(max-width:850px){.match-row .edit-result-btn{padding:6px 8px;font-size:10px}}
    `;
    document.head.appendChild(style);
  }

  async function namesFor(ids){
    const missing=[...new Set(ids.filter(Boolean).filter(id=>!nameCache[id]))];
    if(missing.length){
      const {data}=await client.from('profiles').select('id,username').in('id',missing);
      (data||[]).forEach(p=>nameCache[p.id]=p.username||'Spiller');
    }
    return ids.map((id,i)=>nameCache[id]||`Spiller ${i+1}`);
  }

  function targetWins(best){return Math.floor(Number(best||5)/2)+1}

  async function refreshTournament(){
    try{if(typeof window.loadGroupLobby==='function')await window.loadGroupLobby()}catch(error){console.warn('Group refresh after correction failed',error)}
    try{if(typeof window.dartArenaLoadCup==='function')await window.dartArenaLoadCup()}catch(error){console.warn('Cup refresh after correction failed',error)}
  }

  async function correctResult(matchId,button){
    button.disabled=true;
    const oldText=button.textContent;
    button.textContent='Lagrer…';
    try{
      const {data:match,error}=await client
        .from('tournament_matches')
        .select('id,tournament_id,stage,round_no,match_no,status,best_of,player1_id,player2_id,player1_legs,player2_legs,winner_id')
        .eq('id',matchId)
        .single();

      if(error||!match)throw error||new Error('Kampen ble ikke funnet.');
      if(!['finished','wo'].includes(match.status))throw new Error('Kun ferdige kamper kan endres.');
      if(!match.player1_id||!match.player2_id)throw new Error('WO/BYE uten to spillere kan ikke endres til et vanlig kampresultat.');

      const [n1,n2]=await namesFor([match.player1_id,match.player2_id]);
      const needed=targetWins(match.best_of);
      const current=`${Number(match.player1_legs||0)}-${Number(match.player2_legs||0)}`;
      const input=prompt(
        `Korriger ferdig kamp\n${n1} vs ${n2}\nBest av ${match.best_of} • vinner må ha ${needed} legs\n\nSkriv nytt resultat (${n1}-${n2}):`,
        current
      );
      if(input===null)return;

      const parsed=input.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);
      if(!parsed){alert('Skriv resultatet som for eksempel 3-1.');return;}

      const p1=Number(parsed[1]),p2=Number(parsed[2]);
      if(!((p1===needed&&p2<needed)||(p2===needed&&p1<needed))){
        alert(`Ugyldig resultat. I Best av ${match.best_of} må vinneren ha ${needed} legs.`);
        return;
      }

      const newWinner=p1>p2?match.player1_id:match.player2_id;
      if(newWinner!==match.winner_id){
        const winnerName=newWinner===match.player1_id?n1:n2;
        const oldWinnerName=match.winner_id===match.player1_id?n1:n2;
        if(!confirm(`Dette endrer vinner fra ${oldWinnerName} til ${winnerName}.\n\nHvis dette er en cupkamp, oppdateres neste runde automatisk dersom den ikke har startet. Fortsette?`))return;
      }

      const {error:rpcError}=await client.rpc('correct_finished_tournament_result',{
        p_tournament_match_id:matchId,
        p_player1_legs:p1,
        p_player2_legs:p2
      });
      if(rpcError)throw rpcError;

      await refreshTournament();
      alert('Resultatet er korrigert.');
    }catch(error){
      const message=String(error?.message||'Kunne ikke endre resultatet.')
        .replace('Cannot change cup winner because the next match has already started','Kan ikke bytte vinner fordi neste cupkamp allerede har startet.')
        .replace('Next-round bracket slot no longer matches the old winner','Neste cuprunde er allerede endret og kan ikke overskrives automatisk.');
      alert(message);
    }finally{
      button.disabled=false;
      button.textContent=oldText;
    }
  }

  function attachButton(row){
    if(row.querySelector(':scope > .edit-result-btn'))return;
    const button=document.createElement('button');
    button.type='button';
    button.className='small-btn edit-result-btn';
    button.textContent='Rediger resultat';
    button.title='Turneringsleder: korriger ferdig kamp';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      correctResult(row.dataset.match,button);
    });
    if(row.classList.contains('match-row'))row.style.gridTemplateColumns='minmax(0,1fr) auto auto';
    row.appendChild(button);
  }

  async function decorateFinishedRows(){
    if(!isOwner||decorating)return;
    decorating=true;
    try{
      ensureStyles();
      const rows=[...document.querySelectorAll('.match-row[data-match]:not(.simulation-match),.cup-match[data-match]')];
      const undecorated=rows.filter(r=>!r.querySelector(':scope > .edit-result-btn'));
      if(!undecorated.length)return;
      const ids=[...new Set(undecorated.map(r=>r.dataset.match).filter(Boolean))];
      const {data,error}=await client.from('tournament_matches').select('id,status').in('id',ids);
      if(error)return console.error('Could not inspect finished matches for admin edit',error);
      const finished=new Set((data||[]).filter(m=>['finished','wo'].includes(m.status)).map(m=>m.id));
      undecorated.forEach(row=>{if(finished.has(row.dataset.match))attachButton(row)});
    }finally{decorating=false}
  }

  async function boot(){
    const {data:{session}}=await client.auth.getSession();
    if(!session)return;
    const {data:tournament}=await client.from('tournaments').select('owner_id').eq('id',tournamentId).single();
    isOwner=tournament?.owner_id===session.user.id;
    if(!isOwner)return;

    await decorateFinishedRows();
    let timer=null;
    new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(decorateFinishedRows,100)}).observe(document.documentElement,{subtree:true,childList:true});
  }

  boot().catch(error=>console.error('Tournament result editor init failed',error));
})();
