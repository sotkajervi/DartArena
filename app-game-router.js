(()=>{
  const boot=setInterval(()=>{
    if(!window.DartArenaGames||typeof openMatch!=='function')return;
    clearInterval(boot);
    openMatch=function(id,manual,variant='x01'){
      const page=window.DartArenaGames.pageForVariant(variant);
      const w=window.open(`${page}?id=${encodeURIComponent(id)}`,`dartarena-match-${id}`);
      if(!w&&manual)alert('Nettleseren blokkerte kampfanen.');
      return w;
    };

    if(typeof loadLobby==='function'&&!window.__dartArenaJdcLobbyLabel){
      window.__dartArenaJdcLobbyLabel=true;
      const baseLoadLobby=loadLobby;
      loadLobby=async function(){
        const result=await baseLoadLobby();
        if(activeMatch?.game_variant==='jdc'){
          const text=document.getElementById('activeMatchText');
          if(text)text.textContent=text.textContent.replace(/•\s*501\s*•\s*Best of 1\s*$/,'• JDC Challenge • 57 piler hver');
        }
        return result;
      };
    }

    const jdcCard=document.getElementById('soloJdcChallengeCard');
    const description=jdcCard?.querySelector('.training-game-main p');
    if(description)description.textContent='57 piler i tre faser. Solo er trening; Top 10 og JDC-tier teller kun fra online-kamper.';
  },50);
  setTimeout(()=>clearInterval(boot),5000);
})();