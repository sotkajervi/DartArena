(()=>{
  if(window.__dartArenaOpponentFocus)return;
  window.__dartArenaOpponentFocus=true;

  const grid=document.getElementById('videoGrid');
  if(!grid)return;

  function sync(){
    const active=grid.classList.contains('opponent-throwing');
    document.body.classList.toggle('opponent-focus',active);
  }

  const observer=new MutationObserver(sync);
  observer.observe(grid,{attributes:true,attributeFilter:['class']});
  sync();

  window.addEventListener('pagehide',()=>{
    observer.disconnect();
    document.body.classList.remove('opponent-focus');
  });
})();
