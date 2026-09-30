(()=>{
  if(window.__dartArenaStableNameUpdates)return;
  window.__dartArenaStableNameUpdates=true;

  const selector='.match-page .video-name,.match-page .match-name,.match-page .cricket-player-name,.match-page .half-player-name,.match-page .sixty-one-player-name';
  const desc=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  if(!desc?.get||!desc?.set)return;

  function patch(el){
    if(!el||el.dataset?.stableNamePatched==='1')return;
    try{
      Object.defineProperty(el,'textContent',{
        configurable:true,
        enumerable:false,
        get(){return desc.get.call(this)},
        set(value){
          const next=String(value??'');
          if(desc.get.call(this)===next)return;
          desc.set.call(this,next);
        }
      });
      el.dataset.stableNamePatched='1';
    }catch{}
  }

  function scan(root=document){
    if(root?.matches?.(selector))patch(root);
    root?.querySelectorAll?.(selector).forEach(patch);
  }

  scan();
  const observer=new MutationObserver(list=>{
    for(const m of list)for(const n of m.addedNodes)if(n.nodeType===1)scan(n);
  });
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
