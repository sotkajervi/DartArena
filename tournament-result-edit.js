(()=>{
  const tournamentId=new URLSearchParams(location.search).get('id');
  if(!tournamentId)return;

  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let isOwner=false;

  async function correctResult(matchId,button){
    button.disabled=true;
    try{
      const {data:match,error}=await client
        .from('tournament_matches')
        .select('id,status,best_of,player1_legs,player2_legs')
        .eq('id',matchId)
        .single();

      if(error||!match)throw error||new Error('Kampen ble ikke funnet.');
      if(match.status!=='finished')throw new Error('Kun ferdige kamper kan endres.');

      const current=`${Number(match.player1_legs||0)}-${Number(match.player2_legs||0)}`;
      const input=prompt(`Nytt resultat (Best av ${match.best_of})\nFormat: spiller 1 - spiller 2`,current);
      if(input===null)return;

      const parsed=input.trim().match(/^(\d+)\s*[-–:]\s*(\d+)$/);
      if(!parsed){alert('Skriv resultatet som for eksempel 3-1.');return;}

      const p1=Number(parsed[1]),p2=Number(parsed[2]);
      const {error:rpcError}=await client.rpc('correct_finished_tournament_result',{
        p_tournament_match_id:matchId,
        p_player1_legs:p1,
        p_player2_legs:p2
      });
      if(rpcError)throw rpcError;
    }catch(error){
      alert(error?.message||'Kunne ikke endre resultatet.');
    }finally{
      button.disabled=false;
    }
  }

  function decorateFinishedRows(){
    if(!isOwner)return;
    document.querySelectorAll('.match-row[data-match]:not(.simulation-match)').forEach(row=>{
      if(row.querySelector('.edit-result-btn'))return;
      const state=row.querySelector('.match-state')?.textContent?.trim();
      if(state!=='Ferdig')return;

      row.style.gridTemplateColumns='minmax(0,1fr) auto auto';
      const button=document.createElement('button');
      button.type='button';
      button.className='small-btn edit-result-btn';
      button.textContent='Rediger resultat';
      button.title='Endre resultat på ferdig kamp';
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        correctResult(row.dataset.match,button);
      });
      row.appendChild(button);
    });
  }

  async function boot(){
    const {data:{session}}=await client.auth.getSession();
    if(!session)return;
    const {data:tournament}=await client.from('tournaments').select('owner_id').eq('id',tournamentId).single();
    isOwner=tournament?.owner_id===session.user.id;
    if(!isOwner)return;

    decorateFinishedRows();
    new MutationObserver(decorateFinishedRows).observe(document.documentElement,{subtree:true,childList:true});
  }

  boot().catch(error=>console.error('Tournament result editor init failed',error));
})();
