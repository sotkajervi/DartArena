// Local simulation sizes for tournament testing. Never writes test players to Supabase.
(()=>{
  let target=8;
  const SIZES=[5,7,8,16];
  const EXTRA_NAMES=['Anders','Marius','Henrik','Thomas','Jonas','Kristian','Espen','Daniel','Martin','Stian','Rune','Aleksander','Kenneth','Tommy','Fredrik','Jørgen'];

  function installGenerator(){
    if(typeof members==='undefined'||typeof names==='undefined'||typeof simulatedPlayers!=='function')return false;
    simulatedPlayers=function(){
      const out=[];
      for(let i=0;i<target;i++){
        const uid=`test-${i+1}`;
        names[uid]=EXTRA_NAMES[i]||`Testspiller ${i+1}`;
        out.push({user_id:uid,role:'participant',test:true});
      }
      return out;
    };
    return true;
  }

  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
  function setHidden(el,hidden){if(el&&el.classList.contains('hidden')!==hidden)el.classList.toggle('hidden',hidden)}

  function resetSetupState(){
    if(typeof drawnGroups!=='undefined')drawnGroups=null;
    const g=document.getElementById('groupCount');if(g)g.innerHTML='';
  }

  function announceChange(){
    setTimeout(()=>{
      sync();
      try{window.dispatchEvent(new Event('dartarena:tournament-loaded'))}catch{}
    },0);
  }

  function chooseSize(size,event){
    event?.preventDefault();
    event?.stopImmediatePropagation();
    if(typeof simulation==='undefined')return;

    if(simulation&&target===size){
      simulation=false;
      target=8;
    }else{
      target=size;
      simulation=true;
    }

    resetSetupState();
    if(typeof renderPage==='function')renderPage();
    announceChange();
  }

  function makeButton(size,b8){
    if(size===8)return b8;
    let btn=document.getElementById(`simulate${size}Btn`);
    if(btn)return btn;
    btn=document.createElement('button');
    btn.id=`simulate${size}Btn`;
    btn.className='small-btn hidden';
    btn.type='button';
    btn.dataset.simSize=String(size);
    if(size<8)b8.insertAdjacentElement('beforebegin',btn);
    else b8.insertAdjacentElement('afterend',btn);
    return btn;
  }

  function bindButton(btn,size){
    if(!btn||btn.dataset.simSizeBound==='1')return;
    btn.dataset.simSizeBound='1';
    btn.dataset.simSize=String(size);
    // Capture + stopImmediatePropagation intentionally replaces tournament.js' old
    // simulate8 onclick, so switching size never toggles simulation off by mistake.
    btn.addEventListener('click',event=>chooseSize(size,event),true);
  }

  function ensureButtons(){
    const b8=document.getElementById('simulate8Btn');if(!b8)return false;
    SIZES.forEach(size=>bindButton(makeButton(size,b8),size));
    return true;
  }

  function sync(){
    const b8=document.getElementById('simulate8Btn');if(!b8)return;
    const active=typeof simulation!=='undefined'&&simulation;
    const baseHidden=b8.classList.contains('hidden');

    for(const size of SIZES){
      const btn=document.getElementById(`simulate${size}Btn`);if(!btn)continue;
      if(size!==8)setHidden(btn,baseHidden);
      if(active&&target===size)setText(btn,`Avslutt ${size}-simulering`);
      else if(active)setText(btn,`Bytt til ${size} spillere`);
      else setText(btn,`Simuler ${size} spillere`);
    }
  }

  // Expose the current local size for pure-cup helpers/debugging without storing it.
  window.dartArenaSimulationSize=()=>target;

  const installTimer=setInterval(()=>{
    if(installGenerator()&&ensureButtons()){
      clearInterval(installTimer);
      sync();
      setInterval(()=>{ensureButtons();sync()},300);
    }
  },100);
})();
