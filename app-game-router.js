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
  },50);
  setTimeout(()=>clearInterval(boot),5000);
})();
