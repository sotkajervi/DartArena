// Extra local simulation sizes for tournament testing. Never writes test players to Supabase.
(()=>{
  let target=8;
  const EXTRA_NAMES=['Anders','Marius','Henrik','Thomas','Jonas','Kristian','Espen','Daniel','Martin','Stian','Rune','Aleksander','Kenneth','Tommy','Fredrik','Jørgen'];

  // tournament.js exposes these bindings in the page's classic-script global scope.
  // Replace only the player generator; the existing draw/group/cup simulation stays unchanged.
  function installGenerator(){
    if(typeof members==='undefined'||typeof names==='undefined'||typeof simulatedPlayers!=='function')return false;
    simulatedPlayers=function(){
      const real=members.filter(x=>x.role==='participant').map(x=>({...x,test:false})),out=[...real];
      let i=0;
      while(out.length<target){
        const uid=`test-${i+1}`;
        if(!out.some(x=>x.user_id===uid))out.push({user_id:uid,role:'participant',test:true});
        names[uid]=EXTRA_NAMES[i]||`Testspiller ${i+1}`;
        i++;
      }
      return out.slice(0,target);
    };
    return true;
  }

  function ensureButton(){
    const b8=document.getElementById('simulate8Btn');if(!b8)return;
    let b16=document.getElementById('simulate16Btn');
    if(!b16){
      b16=document.createElement('button');b16.id='simulate16Btn';b16.className='small-btn';b8.insertAdjacentElement('afterend',b16);
      b16.addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        if(typeof simulation==='undefined')return;
        if(simulation&&target===16){simulation=false;target=8}else{target=16;simulation=true}
        if(typeof drawnGroups!=='undefined')drawnGroups=null;
        const g=document.getElementById('groupCount');if(g)g.innerHTML='';
        if(typeof renderPage==='function')renderPage();
        sync();
      });
      b8.addEventListener('click',()=>{target=8;setTimeout(sync,0)},true);
    }
    sync();
  }

  function sync(){
    const b8=document.getElementById('simulate8Btn'),b16=document.getElementById('simulate16Btn');if(!b8||!b16)return;
    const canShow=!b8.classList.contains('hidden');b16.classList.toggle('hidden',!canShow);
    const active=typeof simulation!=='undefined'&&simulation;
    if(active&&target===16){b8.textContent='Bytt til 8 spillere';b16.textContent='Avslutt 16-simulering'}
    else if(active&&target===8){b8.textContent='Avslutt 8-simulering';b16.textContent='Bytt til 16 spillere'}
    else{b8.textContent='Simuler 8 spillere';b16.textContent='Simuler 16 spillere'}
  }

  const timer=setInterval(()=>{if(installGenerator()){ensureButton();clearInterval(timer)}},100);
  new MutationObserver(()=>{ensureButton();sync()}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();