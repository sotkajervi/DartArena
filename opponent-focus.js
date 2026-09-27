(()=>{
  if(window.__dartArenaOpponentFocus)return;
  window.__dartArenaOpponentFocus=true;

  const grid=document.getElementById('videoGrid');
  const localCard=document.getElementById('localVideoCard');
  const remoteCard=document.getElementById('remoteVideoCard');
  const matchInfo=document.querySelector('.match-info');
  if(!grid)return;

  function dockLocal(){
    if(!localCard||!matchInfo)return;
    if(localCard.parentElement!==matchInfo)matchInfo.appendChild(localCard);
    localCard.classList.add('focus-local-docked');
  }

  function restoreLocal(){
    if(!localCard||!remoteCard)return;
    localCard.classList.remove('focus-local-docked');
    if(localCard.parentElement!==grid)grid.insertBefore(localCard,remoteCard);
  }

  function sync(){
    const opponentThrowing=grid.classList.contains('opponent-throwing');
    document.body.classList.add('match-tv-layout');
    document.body.classList.toggle('opponent-focus',opponentThrowing);
    document.body.classList.toggle('own-turn-focus',!opponentThrowing);
    dockLocal();
  }

  const observer=new MutationObserver(sync);
  observer.observe(grid,{attributes:true,attributeFilter:['class']});
  sync();

  window.addEventListener('pagehide',()=>{
    observer.disconnect();
    document.body.classList.remove('match-tv-layout','opponent-focus','own-turn-focus');
    restoreLocal();
  });
})();
