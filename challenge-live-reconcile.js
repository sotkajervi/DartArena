(()=>{
  if(window.__dartArenaChallengeLiveReconcile)return;
  window.__dartArenaChallengeLiveReconcile=true;

  let busy=false,lastSignature=null;

  async function reconcile(force=false){
    if(busy||document.hidden)return;
    if(typeof db==='undefined'||typeof profile==='undefined'||!profile?.id||typeof loadChallenges!=='function')return;
    if(typeof activeMatch!=='undefined'&&activeMatch){lastSignature=null;return}

    busy=true;
    try{
      const{data,error}=await db.from('challenges')
        .select('id,challenger_id,challenged_id,status,created_at')
        .or(`challenger_id.eq.${profile.id},challenged_id.eq.${profile.id}`)
        .in('status',['pending','room'])
        .order('created_at',{ascending:false});
      if(error)return;

      const signature=(data||[])
        .map(c=>`${c.id}:${c.challenger_id}:${c.challenged_id}:${c.status}`)
        .join('|');

      if(force||signature!==lastSignature){
        lastSignature=signature;
        await loadChallenges();
      }
    }catch(e){
      console.warn('Challenge live reconcile failed',e);
    }finally{
      busy=false;
    }
  }

  setInterval(()=>reconcile(false),1000);
  window.addEventListener('focus',()=>reconcile(true));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcile(true)});
  setTimeout(()=>reconcile(true),250);
})();
