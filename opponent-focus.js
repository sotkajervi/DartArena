(()=>{
  if(window.__dartArenaOpponentFocus)return;
  window.__dartArenaOpponentFocus=true;

  const grid=document.getElementById('videoGrid');
  const localCard=document.getElementById('localVideoCard');
  const remoteCard=document.getElementById('remoteVideoCard');
  const matchInfo=document.querySelector('.match-info');
  const cricketBoard=document.getElementById('cricketBoard');
  const cricketEntry=document.querySelector('.cricket-entry-card');
  const scoreEntry=document.querySelector('.score-entry');
  const matchView=document.getElementById('matchView');
  const isCricket=!!cricketBoard;
  if(!grid)return;

  const dockedEntry=isCricket?cricketEntry:scoreEntry;
  const entryParent=dockedEntry?.parentElement||null;
  const entryNext=dockedEntry?.nextSibling||null;
  let inputDock=null;

  if(dockedEntry&&matchView){
    inputDock=document.createElement('div');
    inputDock.id='focusInputDock';
    inputDock.className='focus-input-dock';
    matchView.appendChild(inputDock);
    inputDock.appendChild(dockedEntry);
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
    if(!dockedEntry||!entryParent)return;
    if(entryNext&&entryNext.parentElement===entryParent)entryParent.insertBefore(dockedEntry,entryNext);
    else entryParent.appendChild(dockedEntry);
    inputDock?.remove();
    inputDock=null;
  }

  function sync(){
    const opponentThrowing=grid.classList.contains('opponent-throwing');

    document.body.classList.add('match-tv-layout');
    document.body.classList.toggle('opponent-focus',opponentThrowing);
    document.body.classList.toggle('own-turn-focus',!opponentThrowing);
    document.body.classList.toggle('cricket-tv-layout',isCricket);
    document.body.classList.toggle('standard-tv-layout',!isCricket);
    dockLocal();
  }

  const observer=new MutationObserver(sync);
  observer.observe(grid,{attributes:true,attributeFilter:['class']});
  sync();

  window.addEventListener('pagehide',()=>{
    observer.disconnect();
    document.body.classList.remove('match-tv-layout','cricket-tv-layout','standard-tv-layout','opponent-focus','own-turn-focus');
    restoreLocal();
    restoreEntry();
  });
})();
