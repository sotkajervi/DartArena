// Extra local simulation sizes for tournament testing. Never writes test players to Supabase.
(()=>{
  let target=8;
  const EXTRA_NAMES=['Anders','Marius','Henrik','Thomas','Jonas','Kristian','Espen','Daniel','Martin','Stian','Rune','Aleksander','Kenneth','Tommy','Fredrik','Jørgen'];

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

  function setText(el,text){if(el&&el.textContent!==text)el.textContent=text}
  function setHidden(el,hidden){if(el&&el.classList.contains('hidden')!==hidden)el.classList.toggle('hidden',hidden)}

  function ensureButton(){
    const b8=document.getElementById('simulate8Btn');if(!b8)return false;
    let b16=document.getElementById('simulate16Btn');
    if(!b16){
      b16=document.createElement('button');
      b16.id='simulate16Btn';
      b16.className='small-btn hidden';
      b8.insertAdjacentElement('afterend',b16);
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
    return true;
  }

  function sync(){
    const b8=document.getElementById('simulate8Btn'),b16=document.getElementById('simulate16Btn');if(!b8||!b16)return;
    setHidden(b16,b8.classList.contains('hidden'));
    const active=typeof simulation!=='undefined'&&simulation;
    if(active&&target===16){setText(b8,'Bytt til 8 spillere');setText(b16,'Avslutt 16-simulering')}
    else if(active&&target===8){setText(b8,'Avslutt 8-simulering');setText(b16,'Bytt til 16 spillere')}
    else{setText(b8,'Simuler 8 spillere');setText(b16,'Simuler 16 spillere')}
  }

  const installTimer=setInterval(()=>{
    if(installGenerator()&&ensureButton()){
      clearInterval(installTimer);
      sync();
      // Lightweight polling avoids a MutationObserver feedback loop that can lock the page.
      setInterval(sync,500);
    }
  },100);
})();