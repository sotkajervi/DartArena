(()=>{
  let profileChannel=null,refreshTimer=null,heartbeatTimer=null,lastRefresh=0;
  const CHANGELOG_VERSION='2026-10-04';
  const lobbyVisible=()=>{const v=document.getElementById('lobbyView');return v&&!v.classList.contains('hidden')};
  const ready=()=>typeof db!=='undefined'&&typeof profile!=='undefined'&&profile?.id&&lobbyVisible();
  function installChangelogLink(){
    if(document.getElementById('changelogBtn'))return;
    const actions=document.querySelector('#lobbyView .lobby-top .top-actions');
    if(!actions)return;
    const btn=document.createElement('button');
    btn.id='changelogBtn';btn.className='outline';btn.type='button';btn.title='Se endringsloggen';
    let seen='';try{seen=localStorage.getItem('dartarena_changelog_seen')||''}catch{}
    btn.textContent=seen===CHANGELOG_VERSION?'Hva er nytt':'Hva er nytt • NY';
    btn.onclick=()=>{try{localStorage.setItem('dartarena_changelog_seen',CHANGELOG_VERSION)}catch{}location.href='changelog.html'};
    actions.insertBefore(btn,actions.firstChild);
  }
  function refreshPlayersSoon(delay=120){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{if(!ready()||typeof loadPlayers!=='function')return;const now=Date.now();if(now-lastRefresh<250){refreshPlayersSoon(300);return}lastRefresh=now;try{await loadPlayers()}catch(e){console.warn('Live player refresh failed',e)}},delay)}
  async function heartbeat(){if(!ready())return;try{await db.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',profile.id)}catch(e){console.warn('Presence heartbeat failed',e)}}
  async function start(){if(!ready())return false;installChangelogLink();if(profileChannel)return true;profileChannel=db.channel('lobby-profile-presence-'+profile.id).on('postgres_changes',{event:'*',schema:'public',table:'profiles'},payload=>{if(payload?.new?.id===profile.id||payload?.old?.id===profile.id)return;refreshPlayersSoon()}).subscribe(status=>{if(status==='SUBSCRIBED'){heartbeat();refreshPlayersSoon(0)}});clearInterval(heartbeatTimer);heartbeatTimer=setInterval(async()=>{await heartbeat();refreshPlayersSoon(0)},10000);return true}
  const bootTimer=setInterval(async()=>{if(await start())clearInterval(bootTimer)},300);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){installChangelogLink();heartbeat();refreshPlayersSoon(0)}});
  window.addEventListener('focus',()=>{installChangelogLink();heartbeat();refreshPlayersSoon(0)});
  window.addEventListener('beforeunload',()=>{clearTimeout(refreshTimer);clearInterval(heartbeatTimer);if(profileChannel&&typeof db!=='undefined')db.removeChannel(profileChannel)});
})();
