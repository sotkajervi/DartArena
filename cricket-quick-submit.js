// Make partial Cricket visits explicit: after 1–2 registered darts, the player may send the visit immediately.
(()=>{
  const btn=document.getElementById('cricketSubmitBtn');
  if(!btn)return;

  function sync(){
    try{
      const count=Array.isArray(selectedDarts)?selectedDarts.length:0;
      const editing=typeof editingVisitId!=='undefined'&&editingVisitId!==null;
      const active=typeof canThrow==='function'?canThrow():true;
      if(!editing&&count>0&&active)btn.disabled=false;
      if(editing)return;
      btn.textContent=count>0&&count<3?'Send videre':'Registrer kast';
      btn.title=count>0&&count<3?'Send turen nå – du trenger ikke registrere resten som miss':'';
    }catch{}
  }

  const observer=new MutationObserver(sync);
  const host=document.getElementById('cricketDarts');
  if(host)observer.observe(host,{childList:true,subtree:true,characterData:true});
  document.addEventListener('click',()=>setTimeout(sync,0));
  document.addEventListener('keydown',()=>setTimeout(sync,0));
  setInterval(sync,500);
  sync();
})();
