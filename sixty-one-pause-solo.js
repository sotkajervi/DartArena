(()=>{
  const pauseBtn=document.getElementById('pauseBtn');
  const gameCard=document.getElementById('gameCard');
  if(!pauseBtn||typeof running==='undefined'||typeof deadline==='undefined')return;

  let paused=false;
  let pausedRemaining=0;

  function paint(){
    pauseBtn.disabled=!running;
    pauseBtn.textContent=paused?'▶ FORTSETT':'⏸ PAUSE';
    gameCard?.classList.toggle('is-paused',paused);
    document.getElementById('clock')?.classList.toggle('paused',paused);
    if(paused){
      document.getElementById('clock').textContent=fmt(pausedRemaining);
      document.getElementById('hitBtn').disabled=true;
      document.getElementById('missBtn').disabled=true;
      document.getElementById('undoBtn').disabled=true;
    }
  }

  function resetPause(){
    paused=false;
    pausedRemaining=0;
    gameCard?.classList.remove('is-paused');
    document.getElementById('clock')?.classList.remove('paused');
  }

  pauseBtn.onclick=()=>{
    if(!running)return;
    if(!paused){
      const left=deadline-Date.now();
      if(left<=0){finish();return}
      pausedRemaining=left;
      paused=true;
      clearInterval(timer);
      timer=null;
      document.getElementById('lastAction').textContent='PAUSET • tiden står stille';
      paint();
      return;
    }

    deadline=Date.now()+pausedRemaining;
    paused=false;
    clearInterval(timer);
    timer=setInterval(tick,250);
    document.getElementById('lastAction').textContent='Fortsetter økten';
    render();
    paint();
  };

  const baseFinish=finish;
  finish=function(){
    resetPause();
    baseFinish();
    pauseBtn.disabled=true;
    pauseBtn.textContent='⏸ PAUSE';
  };

  document.getElementById('startBtn')?.addEventListener('click',()=>{
    resetPause();
    pauseBtn.disabled=false;
    pauseBtn.textContent='⏸ PAUSE';
  });

  document.getElementById('restartBtn')?.addEventListener('click',()=>{
    resetPause();
    pauseBtn.disabled=true;
    pauseBtn.textContent='⏸ PAUSE';
  });

  pauseBtn.disabled=true;
})();