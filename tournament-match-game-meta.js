(()=>{
  if(!window.supabase)return;
  const tournamentMatchId=new URLSearchParams(location.search).get('id');
  if(!tournamentMatchId)return;

  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  let observer=null;

  async function boot(){
    const {data:{session}}=await client.auth.getSession();
    if(!session)return;
    const {data:tm,error}=await client.from('tournament_matches')
      .select('tournament_id,stage,best_of')
      .eq('id',tournamentMatchId)
      .maybeSingle();
    if(error||!tm)return;
    const {data:t}=await client.from('tournaments')
      .select('game')
      .eq('id',tm.tournament_id)
      .maybeSingle();
    const game=[170,301,501,1001].includes(Number(t?.game))?Number(t.game):501;
    const stage=tm.stage==='group'?'Puljespill':'Cup';
    const labels=new Map();
    const roomMeta=document.getElementById('roomMeta');
    const viewerMeta=document.getElementById('meta');
    const statsMeta=document.getElementById('statsMeta');
    if(roomMeta)labels.set(roomMeta,`${game} • Best av ${tm.best_of} legs`);
    if(viewerMeta)labels.set(viewerMeta,`${game} • Best av ${tm.best_of} • ${stage}`);
    if(statsMeta)labels.set(statsMeta,`${stage} • ${game} • Best av ${tm.best_of}`);
    if(!labels.size)return;

    const apply=()=>{
      for(const [node,text] of labels){
        if(node.textContent!==text)node.textContent=text;
      }
    };
    apply();
    observer=new MutationObserver(apply);
    for(const node of labels.keys())observer.observe(node,{childList:true,characterData:true,subtree:true});
  }

  boot().catch(error=>console.warn('Tournament game label failed',error));
  window.addEventListener('pagehide',()=>observer?.disconnect());
})();
