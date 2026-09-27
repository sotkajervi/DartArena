// Remove automatic BYEs from local simulation match/win totals on the final results page.
(()=>{
  if(new URLSearchParams(location.search).get('simulation')!=='1')return;
  let running=false;

  function byeCounts(){
    try{
      const raw=sessionStorage.getItem('dartarena-sim-results');if(!raw)return null;
      const s=JSON.parse(raw),counts={};let total=0;
      for(const m of s?.matches||[]){
        if(!!m.a===!!m.b)continue;
        const name=m.a||m.b;if(!name)continue;
        counts[name]=(counts[name]||0)+1;total++;
      }
      return{counts,total};
    }catch{return null}
  }

  function apply(){
    if(running)return;running=true;
    try{
      const info=byeCounts();if(!info)return;
      const table=document.querySelector('#playerStats .results-table');
      if(table){
        const heads=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim().toLowerCase());
        const matchIndex=heads.indexOf('kamper'),winsIndex=heads.indexOf('v');
        table.querySelectorAll('tbody tr').forEach(row=>{
          if(row.dataset.byeAdjusted==='1')return;
          const cells=[...row.cells],name=cells[0]?.textContent.trim()||'',n=Number(info.counts[name]||0);
          if(n&&matchIndex>=0&&winsIndex>=0){
            cells[matchIndex].textContent=String(Math.max(0,Number(cells[matchIndex].textContent||0)-n));
            cells[winsIndex].textContent=String(Math.max(0,Number(cells[winsIndex].textContent||0)-n));
          }
          row.dataset.byeAdjusted='1';
        });
      }
      const meta=document.getElementById('resultMeta');
      if(meta&&info.total&&!meta.dataset.byeAdjusted){
        const m=meta.textContent.match(/TESTMODUS\s*•\s*(\d+)\s+simulerte kamper/i);
        if(m){meta.textContent=meta.textContent.replace(m[1],String(Math.max(0,Number(m[1])-info.total)));meta.dataset.byeAdjusted='1'}
      }
      const note=document.getElementById('playerStats')?.closest('.section-card')?.querySelector('p.muted');
      if(note)note.textContent='WO teller som kampresultat. BYE/frirunde teller ikke som kamp eller seier. Kastdata finnes ikke i lokal simulering.';
    }finally{running=false}
  }

  let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(apply,40)};
  new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(apply,100);setTimeout(apply,600);
})();
