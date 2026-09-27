// Keep 8/16-player local simulation available after a pure cup has entered cup_setup.
// Also notifies the pure-cup module whenever status/simulation state changes.
(()=>{
  const $=id=>document.getElementById(id);
  let lastSetupKey='';

  function isPureCupSetup(){
    try{return !!tournament&&tournament.tournament_type==='cup'&&tournament.status==='cup_setup'&&tournament.owner_id===me}catch{return false}
  }

  function syncRegistrationLabel(){
    const b=$('closeRegistrationBtn');
    if(b&&b.textContent!=='Steng påmelding')b.textContent='Steng påmelding';
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

    if(!isPureCupSetup()){
      lastSetupKey='';
      return;
    }

    const b8=$('simulate8Btn');if(b8)b8.classList.remove('hidden');
    const b16=$('simulate16Btn');if(b16)b16.classList.remove('hidden');

    const key=setupKey();
    if(key&&key!==lastSetupKey){
      lastSetupKey=key;
      setTimeout(()=>window.dispatchEvent(new Event('dartarena:tournament-loaded')),0);
    }
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#simulate8Btn,#simulate16Btn'))setTimeout(sync,0);
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
