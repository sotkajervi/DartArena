(()=>{
  let profileChannel=null,refreshTimer=null,heartbeatTimer=null,idleCheckTimer=null,lastRefresh=0;
  let presenceUserId=null,lastActivity=Date.now(),idleOffline=false;
  const IDLE_MS=2*60*60*1000;
  const ONLINE_WINDOW_MS=5*60*1000;
  const idleStamp=()=>new Date(Date.now()-ONLINE_WINDOW_MS-1000).toISOString();
  const CHANGELOG_VERSION='2026-10-06-3';
  const lobbyVisible=()=>{const v=document.getElementById('lobbyView');return v&&!v.classList.contains('hidden')};
  const ready=()=>typeof db!=='undefined'&&typeof profile!=='undefined'&&profile?.id&&lobbyVisible();
  function installHelpLink(){
    if(document.getElementById('helpBtn'))return;
    const actions=document.querySelector('#lobbyView .lobby-top .top-actions');
    if(!actions)return;
    const btn=document.createElement('button');
    btn.id='helpBtn';btn.className='outline';btn.type='button';btn.title='Hjelp og informasjon';
    btn.textContent='Hjelp';
    btn.onclick=()=>{location.href='help.html?v=20261006-2'};
    actions.insertBefore(btn,actions.firstChild);
  }

  function installChangelogLink(){
    if(document.getElementById('changelogBtn'))return;
    const actions=document.querySelector('#lobbyView .lobby-top .top-actions');
    if(!actions)return;
    const btn=document.createElement('button');
    btn.id='changelogBtn';btn.className='outline';btn.type='button';btn.title='Se endringsloggen';
    let seen='';try{seen=localStorage.getItem('dartarena_changelog_seen')||''}catch{}
    btn.textContent=seen===CHANGELOG_VERSION?'Hva er nytt':'Hva er nytt • NY';
    btn.onclick=()=>{try{localStorage.setItem('dartarena_changelog_seen',CHANGELOG_VERSION)}catch{}location.href='changelog.html?v=20261006-3'};
    actions.insertBefore(btn,actions.firstChild);
  }
  function refreshPlayersSoon(delay=120){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(!ready()||typeof loadPlayers!=='function')return;const now=Date.now();if(now-lastRefresh<250){refreshPlayersSoon(300);return}lastRefresh=now;try{await loadPlayers()}catch(e){console.warn('Live player refresh failed',e)}},delay)}
  function inActiveMatch(){
    try{return (typeof activeMatch!=='undefined'&&!!activeMatch)||profile?.status==='in_game'}catch{return profile?.status==='in_game'}
  }
  async function stopPresenceChannel(){
    clearInterval(heartbeatTimer);heartbeatTimer=null;
    if(profileChannel&&typeof db!=='undefined'){
      const old=profileChannel;profileChannel=null;
      try{await db.removeChannel(old)}catch{}
    }
  }
  async function heartbeat(){
    if(!ready()||idleOffline)return;
    if(inActiveMatch())lastActivity=Date.now();
    try{await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',profile.id)}catch(e){console.warn('Presence heartbeat failed',e)}
  }
  async function goIdleOffline(){
    if(idleOffline||!ready()||inActiveMatch())return;
    idleOffline=true;
    await stopPresenceChannel();
    try{await db.from('profiles').update({last_seen:idleStamp()}).eq('id',profile.id)}catch(e){console.warn('Idle presence update failed',e)}
    refreshPlayersSoon(0);
  }
  async function resumePresence(){
    if(!ready())return;
    lastActivity=Date.now();
    if(!idleOffline)return;
    idleOffline=false;
    await start();
    await heartbeat();
    refreshPlayersSoon(0);
  }
  async function checkIdle(){
    if(!ready()||idleOffline)return;
    if(inActiveMatch()){lastActivity=Date.now();return}
    if(Date.now()-lastActivity>=IDLE_MS)await goIdleOffline();
  }
  function markActivity(){
    lastActivity=Date.now();
    if(idleOffline)resumePresence().catch(e=>console.warn('Presence resume failed',e));
  }
  async function start(){
    if(!ready())return false;
    installHelpLink();installChangelogLink();
    if(presenceUserId!==profile.id){
      presenceUserId=profile.id;
      lastActivity=Date.now();
      idleOffline=false;
      await stopPresenceChannel();
    }
    if(idleOffline)return true;
    if(profileChannel)return true;
    profileChannel=db.channel('lobby-profile-presence-'+profile.id).on('postgres_changes',{event:'*',schema:'public',table:'profiles'},payload=>{if(payload?.new?.id===profile.id||payload?.old?.id===profile.id)return;refreshPlayersSoon()}).subscribe(status=>{if(status==='SUBSCRIBED'){heartbeat();refreshPlayersSoon(0)}});
    clearInterval(heartbeatTimer);
    heartbeatTimer=setInterval(async()=>{await heartbeat();refreshPlayersSoon(0)},10000);
    if(!idleCheckTimer)idleCheckTimer=setInterval(()=>checkIdle().catch(e=>console.warn('Idle presence check failed',e)),60000);
    return true
  }
  const bootTimer=setInterval(async()=>{if(await start())clearInterval(bootTimer)},300);
  for(const eventName of ['pointerdown','keydown','touchstart'])document.addEventListener(eventName,markActivity,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){installHelpLink();installChangelogLink();markActivity();refreshPlayersSoon(0)}});
  window.addEventListener('focus',()=>{installHelpLink();installChangelogLink();markActivity();refreshPlayersSoon(0)});
  window.addEventListener('dartarena:lobby-left',()=>{presenceUserId=null;idleOffline=false;lastActivity=Date.now();stopPresenceChannel();});
  window.addEventListener('beforeunload',()=>{clearTimeout(refreshTimer);clearInterval(heartbeatTimer);clearInterval(idleCheckTimer);if(profileChannel&&typeof db!=='undefined')db.removeChannel(profileChannel)});
})();
