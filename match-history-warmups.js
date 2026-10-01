(()=>{
  const wait=setInterval(()=>{
    if(typeof db==='undefined'||typeof allMatches==='undefined'||typeof render!=='function'||!document.getElementById('showWarmups'))return;
    clearInterval(wait);
    install();
  },50);
  setTimeout(()=>clearInterval(wait),5000);

  async function load(includeWarmups){
    const box=document.getElementById('showWarmups');
    const label=document.getElementById('showWarmupsLabel');
    if(box)box.disabled=true;
    if(label)label.classList.add('is-loading');
    try{
      const rpc=includeWarmups?'get_match_history_with_warmups':'get_global_match_history';
      const {data,error}=await db.rpc(rpc,{p_limit:300});
      if(error)throw error;
      allMatches=data||[];
      render();
    }catch(error){
      console.error('Warmup history filter failed',error);
      if(box)box.checked=!includeWarmups;
      alert('Kunne ikke laste '+(includeWarmups?'oppvarmingskamper.':'kamphistorikken.'));
    }finally{
      if(box)box.disabled=false;
      if(label)label.classList.remove('is-loading');
    }
  }

  function install(){
    const box=document.getElementById('showWarmups');
    if(!box||box.dataset.ready==='1')return;
    box.dataset.ready='1';
    box.checked=false;
    box.addEventListener('change',()=>load(box.checked));

    if(typeof extraLabel==='function'&&!window.__dartArenaWarmupExtraPatched){
      window.__dartArenaWarmupExtraPatched=true;
      const baseExtra=extraLabel;
      extraLabel=function(m){
        if(m?.is_warmup)return'Teller ikke i statistikk, AVG, ranking eller Top 10';
        return baseExtra(m);
      };
    }
  }
})();
