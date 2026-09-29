(()=>{
  let profileChannel=null;
  let refreshTimer=null;
  let heartbeatTimer=null;
  let lastRefresh=0;

  function lobbyVisible(){
    const view=document.getElementById('lobbyView');
    return view && !view.classList.contains('hidden');
  }

  function refreshPlayersSoon(delay=120){
    clearTimeout(refreshTimer);
    refreshTimer=setTimeout(async()=>{
      if(!lobbyVisible() || typeof loadPlayers!=='function') return;
      const now=Date.now();
      if(now-lastRefresh<250){
        refreshPlayersSoon(300);
        return;
      }
      lastRefresh=now;
      try{ await loadPlayers(); }catch(e){ console.warn('Live player refresh failed',e); }
    },delay);
  }

  async function heartbeat(){
    if(!window.db || !window.profile || !profile.id || !lobbyVisible()) return;
    try{
      await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',profile.id);
    }catch(e){ console.warn('Presence heartbeat failed',e); }
  }

  async function start(){
    if(!window.db || !window.profile || !profile.id || !lobbyVisible()) return false;
    if(profileChannel) return true;

    profileChannel=db.channel('lobby-profile-presence-'+profile.id)
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},payload=>{
        if(payload?.new?.id===profile.id || payload?.old?.id===profile.id) return;
        refreshPlayersSoon();
      })
      .subscribe(status=>{
        if(status==='SUBSCRIBED'){
          heartbeat();
          refreshPlayersSoon(0);
        }
      });

    clearInterval(heartbeatTimer);
    heartbeatTimer=setInterval(async()=>{
      await heartbeat();
      refreshPlayersSoon(0);
    },10000);
    return true;
  }

  const bootTimer=setInterval(async()=>{
    if(await start()) clearInterval(bootTimer);
  },300);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      heartbeat();
      refreshPlayersSoon(0);
    }
  });

  window.addEventListener('focus',()=>{
    heartbeat();
    refreshPlayersSoon(0);
  });

  window.addEventListener('beforeunload',()=>{
    clearTimeout(refreshTimer);
    clearInterval(heartbeatTimer);
    if(profileChannel && window.db) db.removeChannel(profileChannel);
  });
})();
