// Safety rules for correcting simulated tournament results.
// Simulation data is local only; this mirrors the real admin correction rules.
(()=>{
  function cupExists(){
    const lobby=document.getElementById('cupLobby');
    return !!lobby&&!lobby.classList.contains('hidden')&&!!document.querySelector('#cupBracket .simulation-cup-match');
  }

  function scoreOf(card){return card?.querySelector('.cup-score')?.textContent?.trim().toLowerCase()||''}

  window.addEventListener('click',event=>{
    const groupMatch=event.target.closest?.('.simulation-match');
    if(groupMatch&&cupExists()){
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('Puljeresultater er låst etter at cupen er opprettet. Nullstill cupen først hvis du vil endre puljespillet i testmodus.');
      return;
    }

    const cupMatch=event.target.closest?.('.simulation-cup-match');
    if(!cupMatch)return;

    const currentScore=scoreOf(cupMatch);
    if(!currentScore||currentScore==='vs'||currentScore==='wo')return;

    const round=cupMatch.closest('.cup-round');
    const bracket=document.getElementById('cupBracket');
    if(!round||!bracket)return;
    const rounds=[...bracket.querySelectorAll(':scope > .cup-round')];
    const roundIndex=rounds.indexOf(round);
    if(roundIndex<0||roundIndex>=rounds.length-1)return;

    const sourceCards=[...round.querySelectorAll('.simulation-cup-match')];
    const sourceIndex=sourceCards.indexOf(cupMatch);
    const targetCards=[...rounds[roundIndex+1].querySelectorAll('.simulation-cup-match')];
    const target=targetCards[Math.floor(sourceIndex/2)];
    const targetScore=scoreOf(target);

    // In simulation there is no separate live state. A result other than "vs"
    // means the next match is already completed, so changing the feeder is unsafe.
    if(target&&targetScore&&targetScore!=='vs'){
      event.preventDefault();
      event.stopImmediatePropagation();
      alert('Vinneren kan ikke endres fordi neste cuprunde allerede er ferdig i simuleringen. Nullstill cupen hvis du vil teste en annen vei gjennom bracketen.');
    }
  },true);
})();
