(()=>{
  if(typeof showFinished!=='function')return;
  const fallback=showFinished;
  window.showFinished=function(){
    if(!window.DartArenaResults?.showSolo)return fallback();
    renderHistory();
    $('soloScore').textContent=String(score);
    const ok=history.filter(h=>h.success).length,fail=history.length-ok,total=history.length||1;
    const title=mode==='dartcounter'?'Half-It (DartCounter)':'Half-It (Standard)';
    window.DartArenaResults.showSolo({
      title,
      subtitle:'12 runder',
      score,
      playerName:'Resultat',
      stats:[
        {label:'TREFFRUNDER',value:ok},
        {label:'HALVERINGER',value:fail},
        {label:'SUKSESS',value:`${Math.round(ok/total*100)} %`},
        {label:'SLUTTSCORE',value:score}
      ],
      actions:[
        {label:'Spill igjen',primary:true,onClick:()=>restart()},
        {label:'Bytt variant',onClick:()=>location.href=`half-it-solo.html?mode=${mode==='standard'?'dartcounter':'standard'}`},
        {label:'Til lobby',onClick:()=>location.href='./'}
      ]
    });
  };
})();
