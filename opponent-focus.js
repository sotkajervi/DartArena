(()=>{
  if(window.__dartArenaOpponentFocus)return;
  window.__dartArenaOpponentFocus=true;

  const grid=document.getElementById('videoGrid');
  const localCard=document.getElementById('localVideoCard');
  const remoteCard=document.getElementById('remoteVideoCard');
  const matchInfo=document.querySelector('.match-info');
  if(!grid)return;

  function dockLocal(active){
    if(!localCard||!remoteCard||!matchInfo)return;
    if(active){
      if(localCard.parentElement!==matchInfo)matchInfo.appendChild(localCard);
      localCard.classList.add('focus-local-docked');
    }else{
      localCard.classList.remove('focus-local-docked');
      if(localCard.parentElement!==grid)grid.insertBefore(localCard,remoteCard);
    }
  }

  function sync(){
    const active=grid.classList.contains('opponent-throwing');
    document.body.classList.toggle('opponent-focus',active);
    dockLocal(active);
  }

  const observer=new MutationObserver(sync);
  observer.observe(grid,{attributes:true,attributeFilter:['class']});
  sync();

  window.addEventListener('pagehide',()=>{
    observer.disconnect();
    document.body.classList.remove('opponent-focus');
    dockLocal(false);
  });
})();
