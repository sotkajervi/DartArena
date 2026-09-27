// Compact local simulation-size selector. Never writes test players to Supabase.
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

  function ownerCanSimulate(){
    try{
      return !!tournament&&tournament.owner_id===me&&['registration','groups_setup','cup_setup'].includes(tournament.status);
    }catch{return false}
  }

  function resetSetupState(){
    try{if(typeof drawnGroups!=='undefined')drawnGroups=null}catch{}
    const g=document.getElementById('groupCount');if(g)g.innerHTML='';
  }

  function notifyModules(){
    setTimeout(()=>{
      sync();
      try{window.dispatchEvent(new Event('dartarena:tournament-loaded'))}catch{}
    },0);
  }

  function setSimulationSize(value){
    if(typeof simulation==='undefined')return;
    if(value==='off'){
      simulation=false;
      target=8;
    }else{
      const size=Number(value);
      if(!SIZES.includes(size))return;
      target=size;
      simulation=true;
    }
    resetSetupState();
    if(typeof renderPage==='function')renderPage();
    notifyModules();
  }

  function ensureControl(){
    const oldButton=document.getElementById('simulate8Btn');
    if(!oldButton)return false;

    // tournament.js still owns this legacy button. Keep it in the DOM for compatibility,
    // but remove it from the UI so the dropdown is the only simulation control.
    oldButton.style.display='none';
    ['simulate5Btn','simulate7Btn','simulate16Btn'].forEach(id=>document.getElementById(id)?.remove());

    let wrap=document.getElementById('simulationSizeControl');
    if(!wrap){
      wrap=document.createElement('label');
      wrap.id='simulationSizeControl';
      wrap.className='simulation-size-control hidden';
      wrap.style.cssText='display:flex;align-items:center;gap:8px;min-width:190px';
      wrap.innerHTML=`<span class="status" style="white-space:nowrap">Testspillere</span><select id="simulationSizeSelect" style="margin:0;padding:8px 10px;min-width:128px"><option value="">Velg antall</option>${SIZES.map(n=>`<option value="${n}">${n} spillere</option>`).join('')}</select>`;
      oldButton.insertAdjacentElement('afterend',wrap);
      wrap.querySelector('select').addEventListener('change',event=>{
        const value=event.target.value;
        if(!value)return;
        setSimulationSize(value);
      });
    }
    return true;
  }

  function sync(){
    const wrap=document.getElementById('simulationSizeControl'),select=document.getElementById('simulationSizeSelect');
    if(!wrap||!select)return;

    const visible=ownerCanSimulate();
    wrap.classList.toggle('hidden',!visible);
    wrap.style.display=visible?'flex':'none';

    const active=typeof simulation!=='undefined'&&simulation;
    const current=String(target);
    let off=select.querySelector('option[value="off"]');
    if(active&&!off){
      off=document.createElement('option');
      off.value='off';
      off.textContent='Avslutt simulering';
      select.appendChild(off);
    }else if(!active&&off){
      off.remove();
    }

    select.value=active?current:'';
    select.title=active?`Simulerer med ${target} spillere`:'Velg antall fiktive spillere';
  }

  window.dartArenaSimulationSize=()=>target;
  window.dartArenaSyncSimulationControl=sync;

  const installTimer=setInterval(()=>{
    if(installGenerator()&&ensureControl()){
      clearInterval(installTimer);
      sync();
      setInterval(()=>{ensureControl();sync()},300);
    }
  },100);
})();
