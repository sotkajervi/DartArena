(()=>{
  const html=document.documentElement;
  const loading=document.getElementById('sessionLoadingView');
  const auth=document.getElementById('authView');
  const lobby=document.getElementById('lobbyView');
  if(!window.supabase||!auth||!lobby)return;

  const style=document.createElement('style');
  style.textContent='html.da-session-probing #authView{display:none!important}';
  document.head.appendChild(style);
  html.classList.add('da-session-probing');

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let resolved=false;

  function keepLoading(){
    if(resolved)return;
    loading?.classList.remove('hidden');
    auth.classList.add('hidden');
  }

  const guardObserver=new MutationObserver(()=>keepLoading());
  guardObserver.observe(auth,{attributes:true,attributeFilter:['class']});
  if(loading)guardObserver.observe(loading,{attributes:true,attributeFilter:['class']});

  function finishToAuth(){
    if(resolved)return;
    resolved=true;
    guardObserver.disconnect();
    html.classList.remove('da-session-probing');
    loading?.classList.add('hidden');
    lobby.classList.add('hidden');
    auth.classList.remove('hidden');
  }

  function finishToLobby(){
    if(resolved)return;
    resolved=true;
    guardObserver.disconnect();
    loading?.classList.add('hidden');
    auth.classList.add('hidden');
    html.classList.remove('da-session-probing');
  }

  function kickLobbyRestore(){
    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      if(!lobby.classList.contains('hidden')){
        clearInterval(timer);
        finishToLobby();
        return;
      }
      if(typeof window.enterLobby==='function'){
        Promise.resolve(window.enterLobby()).catch(error=>console.warn('Lobby restore retry failed',error));
      }
      if(tries>=20)clearInterval(timer);
    },75);
  }

  async function probe(){
    let current=null;
    for(let i=0;i<5;i++){
      const {data}=await db.auth.getSession();
      current=data?.session||null;
      if(current)break;
      if(i<4)await sleep(120);
    }

    if(!current){
      finishToAuth();
      return;
    }

    keepLoading();
    kickLobbyRestore();

    if(!lobby.classList.contains('hidden')){
      finishToLobby();
      return;
    }

    const lobbyObserver=new MutationObserver(()=>{
      if(!lobby.classList.contains('hidden')){
        lobbyObserver.disconnect();
        finishToLobby();
      }
    });
    lobbyObserver.observe(lobby,{attributes:true,attributeFilter:['class']});

    setTimeout(()=>{
      if(!lobby.classList.contains('hidden')){
        lobbyObserver.disconnect();
        finishToLobby();
      }
    },3000);
  }

  probe().catch(error=>{
    console.warn('Session bootstrap failed',error);
    finishToAuth();
  });
})();
