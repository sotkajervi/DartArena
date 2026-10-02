(()=>{
  if(window.__dartArenaLobbyWelcomeSplit)return;
  window.__dartArenaLobbyWelcomeSplit=true;

  function splitWelcome(){
    const title=document.getElementById('welcomeName');
    if(!title)return false;
    if(title.querySelector('.da-welcome-user'))return true;

    const text=title.textContent.trim();
    const match=text.match(/^Hei,\s*(.+)$/i);
    if(!match)return false;

    const greeting=document.createElement('span');
    greeting.className='da-welcome-greeting';
    greeting.textContent='Hei,';

    const user=document.createElement('span');
    user.className='da-welcome-user';
    user.textContent=match[1].trim();

    title.replaceChildren(greeting,document.createTextNode(' '),user);
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    if(splitWelcome()||tries>=30)clearInterval(timer);
  },100);

  setTimeout(splitWelcome,0);

  if(typeof enterLobby==='function'&&!window.__dartArenaWelcomeEnterLobbyHook){
    window.__dartArenaWelcomeEnterLobbyHook=true;
    const baseEnterLobby=enterLobby;
    enterLobby=async function(...args){
      const result=await baseEnterLobby.apply(this,args);
      splitWelcome();
      return result;
    };
  }
})();
