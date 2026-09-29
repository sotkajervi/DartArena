(()=>{
  const pauseBtn=document.getElementById('pauseBtn');
  const clock=document.getElementById('clock');
  if(!pauseBtn||typeof state==='undefined'||typeof db==='undefined')return;

  let pauseBusy=false;

  const baseCanAct=canAct;
  canAct=function(){
    if(state?.is_paused)return false;
    return baseCanAct();
  };

  const baseTryFinalize=tryFinalize;
  tryFinalize=async function(){
    if(state?.is_paused)return;
    return baseTryFinalize();
  };

  const baseTickClock=tickClock;
  tickClock=function(){
    if(state?.is_paused&&m?.status==='playing'&&!state?.sudden_death){
      const frozenAt=state.paused_at?new Date(state.paused_at).getTime():Date.now();
      const left=deadline()-frozenAt;
      clock.textContent=fmt(left);
      clock.classList.remove('done');
      clock.classList.add('paused');
      return;
    }
    clock?.classList.remove('paused');
    return baseTickClock();
  };

  function renderPauseState(){
    if(!state||!m)return;
    const active=m.status==='playing'&&!state.sudden_death;
    pauseBtn.disabled=!active||pauseBusy;
    pauseBtn.classList.toggle('active',!!state.is_paused);
    pauseBtn.textContent=state.is_paused?'▶ FORTSETT':'⏸ PAUSE';
    if(state.is_paused&&m.status==='playing'){
      const who=names?.[state.paused_by]||'En spiller';
      document.getElementById('matchStatus').textContent='Pauset';
      document.getElementById('turnText').textContent=`${who} pauset kampen`;
      document.getElementById('hitBtn').disabled=true;
      document.getElementById('missBtn').disabled=true;
      document.getElementById('undoBtn').disabled=true;
    }
  }

  const baseRender=render;
  render=function(){
    baseRender();
    renderPauseState();
  };

  pauseBtn.onclick=async()=>{
    if(pauseBusy||!state||!m||m.status!=='playing'||state.sudden_death)return;
    pauseBusy=true;
    renderPauseState();
    document.getElementById('matchMessage').textContent=state.is_paused?'Fortsetter kampen…':'Pauser kampen…';
    try{
      const{data,error}=await db.rpc('toggle_sixty_one_pause',{p_match_id:matchId});
      if(error)throw error;
      await refreshGame();
      document.getElementById('matchMessage').textContent=data?.paused?'Kampen er pauset. Tiden står stille.':'Kampen fortsetter.';
    }catch(e){
      const msg=String(e?.message||'Kunne ikke endre pause.');
      document.getElementById('matchMessage').textContent=msg.includes('Time is up')?'Tiden er ute – legen må avgjøres.':msg;
    }finally{
      pauseBusy=false;
      renderPauseState();
    }
  };

  // Ensure the interval uses the pause-aware clock even if the main script created it first.
  let attempts=0;
  const adoptClock=()=>{
    attempts++;
    if(typeof clockTimer!=='undefined'&&clockTimer){
      clearInterval(clockTimer);
      clockTimer=setInterval(tickClock,250);
      return;
    }
    if(attempts<80)setTimeout(adoptClock,250);
  };
  adoptClock();
})();