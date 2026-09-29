(()=>{
  const row=document.getElementById('exactStatusRow');
  const roundLabel=document.getElementById('halfRoundLabel');
  const matchStatus=document.getElementById('matchStatus');
  if(!row||!roundLabel)return;

  function syncExactVisibility(){
    const text=roundLabel.textContent||'';
    const match=text.match(/RUNDE\s+(\d+)\s+AV\s+12/i);
    const round=match?Number(match[1]):0;
    const finished=(matchStatus?.textContent||'').trim()==='Ferdig';
    row.classList.toggle('hidden',!finished&&round<8);
  }

  new MutationObserver(syncExactVisibility).observe(roundLabel,{childList:true,characterData:true,subtree:true});
  if(matchStatus)new MutationObserver(syncExactVisibility).observe(matchStatus,{childList:true,characterData:true,subtree:true});
  syncExactVisibility();
})();
