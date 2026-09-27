// Keep automatic free rounds visually distinct from a real walkover (WO).
// A BYE is rendered like a normal matchup: "Player vs BYE" and does not count
// as a played match in the cup progress counter.
(()=>{
  function syncByeLabels(){
    const cards=[...document.querySelectorAll('#cupBracket .cup-match')];
    cards.forEach(card=>{
      const bye=card.querySelector('.cup-bye');
      const score=card.querySelector('.cup-score');
      card.dataset.bye=bye?'1':'0';
      if(bye&&score&&score.textContent.trim().toLowerCase()!=='vs')score.textContent='vs';
    });

    const byeCards=cards.filter(card=>card.dataset.bye==='1');
    const progress=document.getElementById('cupProgress');
    if(!progress||!byeCards.length||progress.textContent.trim().startsWith('Vinner:'))return;

    const playedCards=cards.filter(card=>card.dataset.bye!=='1');
    const finished=playedCards.filter(card=>{
      const score=card.querySelector('.cup-score')?.textContent.trim().toLowerCase()||'';
      return score&&score!=='vs';
    }).length;
    const test=progress.textContent.includes('TESTMODUS')?' • TESTMODUS':'';
    progress.textContent=`${finished} / ${playedCards.length} kamper ferdig${test}`;
  }

  const bracket=document.getElementById('cupBracket');
  if(bracket){
    let timer=null;
    new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(syncByeLabels,20)}).observe(bracket,{subtree:true,childList:true,characterData:true});
  }
  window.addEventListener('dartarena:tournament-loaded',()=>setTimeout(syncByeLabels,0));
  window.addEventListener('focus',syncByeLabels);
  setTimeout(syncByeLabels,100);
  setTimeout(syncByeLabels,900);
})();
