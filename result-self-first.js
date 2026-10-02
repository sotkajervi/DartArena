(()=>{
  if(window.__dartArenaResultSelfFirst)return;
  window.__dartArenaResultSelfFirst=true;

  const matchId=new URLSearchParams(location.search).get('id');
  if(!matchId||!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let selfId=null;
  let selfName='';
  let match=null;
  let channel=null;
  let retryTimer=null;

  function applyOrder(){
    const overlay=document.getElementById('dartArenaResultOverlay');
    const host=overlay?.querySelector('.da-result-stats:not(.solo)');
    const cards=host?[...host.querySelectorAll(':scope > .da-result-statcard')]:[];
    if(!overlay||cards.length<2)return false;

    let selfIndex=-1;
    if(match&&selfId===match.player1_id)selfIndex=0;
    else if(match&&selfId===match.player2_id)selfIndex=1;
    else if(selfName){
      selfIndex=cards.findIndex(card=>card.querySelector('.da-result-stat-name')?.textContent?.trim()===selfName);
    }
    if(selfIndex<0)return false;

    cards.forEach((card,index)=>{
      const mine=index===selfIndex;
      card.style.order=mine?'1':'2';
      card.classList.toggle('da-result-self-card',mine);
      card.classList.toggle('da-result-opponent-card',!mine);
    });
    overlay.dataset.selfFirstCards='1';
    return true;
  }

  function scheduleApply(){
    clearTimeout(retryTimer);
    let tries=0;
    const tick=()=>{
      if(applyOrder()||tries++>=50)return;
      retryTimer=setTimeout(tick,100);
    };
    tick();
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session)return;
    selfId=session.user.id;

    const [{data:profile},{data:row}]=await Promise.all([
      db.from('profiles').select('username').eq('id',selfId).maybeSingle(),
      db.from('matches').select('id,player1_id,player2_id,status').eq('id',matchId).maybeSingle()
    ]);
    selfName=profile?.username||'';
    match=row||null;

    if(match?.status==='finished'||document.getElementById('dartArenaResultOverlay'))scheduleApply();

    channel=db.channel(`result-self-first-${matchId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'matches',filter:`id=eq.${matchId}`},payload=>{
        match=payload.new||match;
        if(payload.new?.status==='finished')scheduleApply();
      })
      .subscribe();
  }

  window.addEventListener('pagehide',()=>{
    clearTimeout(retryTimer);
    if(channel)db.removeChannel(channel);
  });

  boot().catch(error=>console.warn('Result self-first ordering failed',error));
})();
