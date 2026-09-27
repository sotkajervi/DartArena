// Keep the compact local simulation selector active after a pure cup enters cup_setup.
// Also notifies the pure-cup module whenever status/simulation state changes.
(()=>{
  let lastSetupKey='';

  function isPureCupSetup(){
    try{return !!tournament&&tournament.tournament_type==='cup'&&tournament.status==='cup_setup'&&tournament.owner_id===me}catch{return false}}
  }

  function syncRegistrationLabel(){
    const b=document.getElementById('closeRegistrationBtn');
    if(b&&b.textContent!=='Steng påmelding')b.textContent='Steng påmelding';
  }

  function syncByeLabels(){
    const cards=[...document.querySelectorAll('#cupBracket .cup-match')];
    cards.forEach(card=>{
      if(!card.querySelector('.cup-bye'))return;
      const score=card.querySelector('.cup-score');
      if(score&&score.textContent.trim()!=='BYE')score.textContent='BYE';
      card.dataset.bye='1';
    });

    const byeCards=cards.filter(card=>card.dataset.bye==='1');
    const progress=document.getElementById('cupProgress');
    if(!progress||!byeCards.length||progress.textContent.trim().startsWith('Vinner:'))return;
    const realCards=cards.filter(card=>card.dataset.bye!=='1');
    const finished=realCards.filter(card=>{
      const score=card.querySelector('.cup-score')?.textContent.trim().toLowerCase()||'';
      return score&&score!=='vs';
    }).length;
    const test=progress.textContent.includes('TESTMODUS')?' • TESTMODUS':'';
    progress.textContent=`${finished} / ${realCards.length} spilte kamper • ${byeCards.length} BYE${test}`;
  }

  function setupKey(){
    try{
      if(!isPureCupSetup())return'';
      const participantCount=typeof getParticipants==='function'?getParticipants().length:0;
      return `cup_setup:${simulation?'sim':'real'}:${participantCount}`;
    }catch{return''}
  }

  function sync(){
    syncRegistrationLabel();
    syncByeLabels();
    try{window.dartArenaSyncSimulationControl?.()}catch{}

    if(!isPureCupSetup()){
      lastSetupKey='';
      return;
    }

    const key=setupKey();
    if(key&&key!==lastSetupKey){
      lastSetupKey=key;
      setTimeout(()=>window.dispatchEvent(new Event('dartarena:tournament-loaded')),0);
    }
  }

  document.addEventListener('change',event=>{
    if(event.target?.id==='simulationSizeSelect')setTimeout(sync,0);
  },true);

  new MutationObserver(()=>setTimeout(sync,0)).observe(document.documentElement,{
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class']
  });

  window.addEventListener('focus',sync);
  setTimeout(sync,100);
  setTimeout(sync,900);
})();
