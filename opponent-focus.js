(()=>{
  if(window.__dartArenaOpponentFocus)return;
  window.__dartArenaOpponentFocus=true;

  const grid=document.getElementById('videoGrid');
  const localCard=document.getElementById('localVideoCard');
  const remoteCard=document.getElementById('remoteVideoCard');
  const matchInfo=document.querySelector('.match-info');
  const cricketBoard=document.getElementById('cricketBoard');
  const cricketEntry=document.querySelector('.cricket-entry-card');
  const matchView=document.getElementById('matchView');
  const isCricket=!!cricketBoard;
  if(!grid)return;

  const entryParent=cricketEntry?.parentElement||null;
  const entryNext=cricketEntry?.nextSibling||null;
  let inputDock=null;

  if(isCricket&&cricketEntry&&matchView){
    inputDock=document.createElement('div');
    inputDock.id='focusInputDock';
    inputDock.className='focus-input-dock';
    matchView.appendChild(inputDock);
    inputDock.appendChild(cricketEntry);
  }

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

  function restoreEntry(){
    if(!cricketEntry||!entryParent)return;
    if(entryNext&&entryNext.parentElement===entryParent)entryParent.insertBefore(cricketEntry,entryNext);
    else entryParent.appendChild(cricketEntry);
    inputDock?.remove();
    inputDock=null;
  }

  function sync(){
    const opponentThrowing=grid.classList.contains('opponent-throwing');

    if(isCricket){
      document.body.classList.add('match-tv-layout','cricket-tv-layout');
      document.body.classList.toggle('opponent-focus',opponentThrowing);
      document.body.classList.toggle('own-turn-focus',!opponentThrowing);
      dockLocal();
      return;
    }

    document.body.classList.toggle('match-tv-layout',opponentThrowing);
    document.body.classList.toggle('opponent-focus',opponentThrowing);
    document.body.classList.remove('own-turn-focus','cricket-tv-layout');
    if(opponentThrowing)dockLocal();
    else restoreLocal();
  }

  const observer=new MutationObserver(sync);
  observer.observe(grid,{attributes:true,attributeFilter:['class']});
  sync();

  window.addEventListener('pagehide',()=>{
    observer.disconnect();
    document.body.classList.remove('match-tv-layout','cricket-tv-layout','opponent-focus','own-turn-focus');
    restoreLocal();
    restoreEntry();
  });
})();
