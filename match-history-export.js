(()=>{
  if(window.__dartArenaHistoryExport)return;
  window.__dartArenaHistoryExport=true;
  const csv=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  function boot(){
    const host=document.querySelector('.history-options');if(!host||document.getElementById('historyExportBtn'))return;
    const btn=document.createElement('button');btn.id='historyExportBtn';btn.type='button';btn.className='outline history-filter';btn.textContent='Eksporter CSV';
    btn.onclick=()=>{
      try{
        const mineOnly=document.getElementById('mineOnly')?.checked;
        const source=(typeof trashMode!=='undefined'&&trashMode)?deletedMatches:allMatches;
        const rows=source.filter(m=>{
          if(typeof activeFilter!=='undefined'&&activeFilter!=='all'&&filterKey(m)!==activeFilter)return false;
          if(mineOnly&&m.player1_id!==me&&m.player2_id!==me)return false;
          return true;
        });
        if(!rows.length){alert('Ingen kamper i dette utvalget.');return}
        const header=['Dato','Spill','Spiller 1','Spiller 2','Resultat','Format','Kontekst','Oppvarming','Status'];
        const lines=[header.map(csv).join(';')];
        rows.forEach(m=>{
          const [a,b]=scorePair(m);
          lines.push([
            fmtDate(m.finished_at||m.created_at),gameLabel(m),m.player1_name||'Spiller 1',m.player2_name||'Spiller 2',`${a}-${b}`,formatLabel(m),contextLabel(m),m.is_warmup?'Ja':'Nei',m.deleted_at?'Slettet':'Ferdig'
          ].map(csv).join(';'));
        });
        const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=`dartarena-kamphistorikk-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }catch(e){console.error(e);alert('Kunne ikke eksportere kamphistorikken.')}
    };
    host.appendChild(btn);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
