(()=>{
  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId||!window.supabase)return;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  const loadScript=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});
  (async()=>{
    const{data:{session}}=await db.auth.getSession();if(!session)return location.replace('./');
    const{data:m,error}=await db.from('matches').select('game_variant,game_config').eq('id',matchId).single();
    if(error||!m||m.game_variant!=='half_it')return location.replace('./');
    const mode=m.game_config?.half_it_mode==='standard'?'standard':'dartcounter';
    if(mode==='standard'){
      document.body.dataset.halfItMode='standard';
      await loadScript('half-it-standard.js?v=20260930-standard1');
      await loadScript('half-it-standard-audio.js?v=20260930-standard1');
      await loadScript('role-visuals.js?v=20261002-matchrooms1');
      await loadScript('match-room-polish.js?v=20261002-matchrooms2');
      return;
    }
    document.body.dataset.halfItMode='dartcounter';
    await loadScript('sfu-config.js?v=20260929-halfit1');
    await loadScript('sfu-client.js?v=20260929-halfit1');
    await loadScript('half-it.js?v=20260929-online1');
    await loadScript('half-it-multileg.js?v=20260930-halfitlegs2');
    await loadScript('half-it-exact-choice.js?v=20260930-exact3');
    await loadScript('half-it-ui.js?v=20260929-halfit3');
    await loadScript('role-visuals.js?v=20261002-matchrooms1');
    await loadScript('match-room-polish.js?v=20261002-matchrooms2');
    await loadScript('match-controls.js?v=20260930-cam2');
  })().catch(e=>{const m=document.getElementById('matchMessage');if(m)m.textContent=e?.message||'Kunne ikke laste Half-It.';console.error(e)});
})();
