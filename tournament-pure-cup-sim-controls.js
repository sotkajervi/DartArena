// Keep the compact local simulation selector active after a pure cup enters cup_setup.
// Also makes sure the pure-cup setup is rendered even when real tournament data loads slowly.
(()=>{
  let lastSetupKey='';
  let renderQueued=false;

  function isPureCupSetup(){
    try{return !!tournament&&tournament.tournament_type==='cup'&&tournament.status==='cup_setup'&&tournament.owner_id===me}catch{return false}
  }

  function syncRegistrationLabel(){
    const b=document.getElementById('closeRegistrationBtn');
    if(b&&b.textContent!=='Steng påmelding')b.textContent='Steng påmelding';
  }

  function setupKey(){
    try{
      if(!isPureCupSetup())return'';
      const participantCount=typeof getParticipants==='function'?getParticipants().length:0;
      return `cup_setup:${simulation?'sim':'real'}:${participantCount}`;
    }catch{return''}
  }

  function setupNeedsRender(){
    if(!isPureCupSetup())return false;
    const setup=document.getElementById('cupSetup');
    const button=document.getElementById('buildCupBtn');
    if(!setup||!button)return false;
    return setup.classList.contains('hidden')||!document.getElementById('pureCupFormatSettings');
  }

  function requestPureCupRender(){
    if(renderQueued)return;
    renderQueued=true;
    setTimeout(()=>{
      renderQueued=false;
      window.dispatchEvent(new Event('dartarena:tournament-loaded'));
    },0);
  }

  function sync(){
    syncRegistrationLabel();
    try{window.dartArenaSyncSimulationControl?.()}catch{}

    if(!isPureCupSetup()){
      lastSetupKey='';
      return;
    }

    const key=setupKey();
    if((key&&key!==lastSetupKey)||setupNeedsRender()){
      lastSetupKey=key;
      requestPureCupRender();
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
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync()});
  setInterval(sync,300);
  setTimeout(sync,100);
  setTimeout(sync,900);
})();
