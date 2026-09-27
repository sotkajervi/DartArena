// Keep automatic free rounds visually distinct from a real walkover (WO).
(()=>{
  function syncByeLabels(){
    document.querySelectorAll('#cupBracket .cup-match').forEach(card=>{
      const bye=card.querySelector('.cup-bye');
      const score=card.querySelector('.cup-score');
      if(bye&&score&&score.textContent.trim()!=='BYE')score.textContent='BYE';
    });
  }

  const bracket=document.getElementById('cupBracket');
  if(bracket){
    new MutationObserver(syncByeLabels).observe(bracket,{subtree:true,childList:true,characterData:true});
  }
  window.addEventListener('dartarena:tournament-loaded',()=>setTimeout(syncByeLabels,0));
  setTimeout(syncByeLabels,100);
  setTimeout(syncByeLabels,900);
})();
