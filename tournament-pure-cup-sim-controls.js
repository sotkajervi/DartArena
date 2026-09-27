// Keep 8/16-player local simulation available after a pure cup has entered cup_setup.
(()=>{
  const $=id=>document.getElementById(id);
  function isPureCupSetup(){try{return !!tournament&&tournament.tournament_type==='cup'&&tournament.status==='cup_setup'&&tournament.owner_id===me}catch{return false}}
  function sync(){
    if(!isPureCupSetup())return;
    const b8=$('simulate8Btn');if(b8)b8.classList.remove('hidden');
    const b16=$('simulate16Btn');if(b16)b16.classList.remove('hidden');
  }
  document.addEventListener('click',e=>{if(e.target.closest?.('#simulate8Btn,#simulate16Btn'))setTimeout(sync,0)},true);
  window.addEventListener('dartarena:tournament-loaded',()=>setTimeout(sync,0));
  new MutationObserver(()=>setTimeout(sync,0)).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
  setTimeout(sync,900);
})();
