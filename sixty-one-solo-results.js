(()=>{
  if(typeof finish!=='function')return;
  const fallback=finish;
  function resetToSetup(){
    $('gameCard').classList.add('hidden');
    $('setupCard').classList.remove('hidden');
    $('finishedBox').classList.add('hidden');
    $('clock').classList.remove('done');
    $('lastAction').textContent='Start på 61';
  }
  window.finish=function(){
    if(!window.DartArenaResults?.showSolo)return fallback();
    running=false;clearInterval(timer);timer=null;
    $('clock').textContent='0:00';$('clock').classList.add('done');
    $('hitBtn').disabled=true;$('missBtn').disabled=true;$('undoBtn').disabled=true;
    if($('pauseBtn'))$('pauseBtn').disabled=true;
    $('lastAction').textContent=`Tiden er ute • sluttmål ${target}`;
    const hits=history.filter(h=>h.result==='hit'),misses=history.filter(h=>h.result==='miss'),total=history.length||1;
    const high=hits.reduce((mx,h)=>Math.max(mx,Number(h.before)||0),0);
    window.DartArenaResults.showSolo({
      title:'61',
      subtitle:`${selectedMinutes} minutter`,
      score:target,
      playerName:'Treningsøkt',
      stats:[
        {label:'HØYESTE UT',value:high},
        {label:'TREFF',value:hits.length},
        {label:'BOM',value:misses.length},
        {label:'TREFFPROSENT',value:`${Math.round(hits.length/total*100)} %`}
      ],
      actions:[
        {label:'Ny økt',primary:true,onClick:resetToSetup},
        {label:'Til lobby',onClick:()=>location.href='./'}
      ]
    });
  };
})();
