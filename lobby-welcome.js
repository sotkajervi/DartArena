(()=>{
  if(window.__dartArenaLobbyWelcomeSplit)return;
  window.__dartArenaLobbyWelcomeSplit=true;
  let revision=0;
  function splitWelcome(){
    const title=document.getElementById('welcomeName');
    if(!title)return null;
    let user=title.querySelector('.da-welcome-user');
    if(user)return user;
    const match=title.textContent.trim().match(/^Hei,\s*(.+)$/i);
    if(!match)return null;
    const greeting=document.createElement('span');
    greeting.className='da-welcome-greeting';greeting.textContent='Hei,';
    user=document.createElement('span');user.className='da-welcome-user';
    user.textContent=match[1].trim();user.setAttribute('data-no-i18n','');
    title.replaceChildren(greeting,document.createTextNode(' '),user);
    return user;
  }
  async function refresh(fresh=false){
    const title=document.getElementById('welcomeName'),user=splitWelcome(),id=title?.dataset.userId;
    const link=window.DartArenaProfileLink,db=window.DartArenaSupabaseClient;
    if(!user||!link?.valid(id)||!db)return;
    user.setAttribute('data-no-i18n','');
    const token=++revision;
    let nickname=title.dataset.nickname||user.textContent.trim();
    try{
      if(fresh){
        const {data,error}=await db.from('profiles').select('id,username').eq('id',id).maybeSingle();
        if(!error&&data?.username)nickname=data.username;
      }
      const names=await link.resolve(db,[{id,username:nickname}],{fresh});
      if(token!==revision||title.dataset.userId!==id||!user.isConnected)return;
      title.dataset.nickname=nickname;user.textContent=names[id]||nickname;
    }catch(error){console.warn('Welcome display name refresh failed',error)}
  }
  window.addEventListener('dartarena:lobby-entered',()=>void refresh());
  window.addEventListener('focus',()=>{const lobby=document.getElementById('lobbyView');if(lobby&&!lobby.classList.contains('hidden'))void refresh(true)});
  window.addEventListener('dartarena:lobby-left',()=>{revision++;const title=document.getElementById('welcomeName');if(title){delete title.dataset.userId;delete title.dataset.nickname}});
  // Also cover sessions that entered the lobby before this script loaded.
  if(document.getElementById('welcomeName')?.dataset.userId)void refresh();
})();
