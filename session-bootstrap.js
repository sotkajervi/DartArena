(()=>{
  const html=document.documentElement;
  const loading=document.getElementById('sessionLoadingView');
  const auth=document.getElementById('authView');
  const lobby=document.getElementById('lobbyView');
  if(!window.supabase||!auth||!lobby)return;

  html.classList.add('da-session-probing');

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function finishToAuth(){
    html.classList.remove('da-session-probing');
    loading?.classList.add('hidden');
    lobby.classList.add('hidden');
    auth.classList.remove('hidden');
  }

  function finishToLobby(){
    loading?.classList.add('hidden');
    auth.classList.add('hidden');
    html.classList.remove('da-session-probing');
  }

  async function probe(){
    let current=null;
    for(let i=0;i<4;i++){
      const {data}=await db.auth.getSession();
      current=data?.session||null;
      if(current)break;
      if(i<3)await sleep(120);
    }

    if(!current){
      finishToAuth();
      return;
    }

    if(!lobby.classList.contains('hidden')){
      finishToLobby();
      return;
    }

    const observer=new MutationObserver(()=>{
      if(!lobby.classList.contains('hidden')){
        observer.disconnect();
        finishToLobby();
      }
    });
    observer.observe(lobby,{attributes:true,attributeFilter:['class']});

    // Keep the login view suppressed while app.js restores the valid session.
    setTimeout(()=>{
      if(!lobby.classList.contains('hidden')){
        observer.disconnect();
        finishToLobby();
      }
    },2500);
  }

  probe().catch(error=>{
    console.warn('Session bootstrap failed',error);
    finishToAuth();
  });
})();
