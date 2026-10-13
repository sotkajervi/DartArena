(()=>{
  if(window.__dartArenaSecureCancel)return;
  window.__dartArenaSecureCancel=true;

  let dialogPromise=null;
  function ensureDialog(){
    if(window.DartArenaDialog)return Promise.resolve(window.DartArenaDialog);
    if(dialogPromise)return dialogPromise;
    dialogPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='dartarena-dialog.js?v=20261002-dialog1';
      script.onload=()=>resolve(window.DartArenaDialog);
      script.onerror=()=>reject(new Error('Kunne ikke laste DartArena-dialog.'));
      document.head.appendChild(script);
    });
    return dialogPromise;
  }
  ensureDialog().catch(()=>{});

  const brand=document.querySelector('header .brand');
  if(brand&&brand.dataset.homeLinkReady!=='1'){
    brand.dataset.homeLinkReady='1';
    brand.setAttribute('role','link');
    brand.setAttribute('tabindex','0');
    brand.setAttribute('aria-label','Til hovedlobby');
    brand.setAttribute('title','Til hovedlobby');
    brand.style.cursor='pointer';
    const goHome=()=>{location.href='./'};
    brand.addEventListener('click',goHome);
    brand.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();goHome()}
    });
  }

  function installCloseGuard(){
    const close=document.getElementById('closeMatchBtn');
    const cancel=document.getElementById('cancelMatchBtn');
    if(!close||close.dataset.dartArenaCloseGuard==='1')return !!close;
    close.dataset.dartArenaCloseGuard='1';
    close.addEventListener('click',async event=>{
      const isTournament=new URLSearchParams(location.search).has('tournamentMatch');
      // Tournament room navigation retains its existing separate-window behavior.
      if(isTournament&&(!cancel||cancel.classList.contains('hidden')))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const active=!!cancel&&!cancel.classList.contains('hidden');
      if(!active){location.href='./';return}
      const dialog=await ensureDialog().catch(()=>null);
      const ok=dialog
        ?await dialog.confirm('Kampen pågår fortsatt.\n\nVil du gå tilbake til lobbyen uten å avbryte kampen?',{title:'Til lobby?',tone:'warning',confirmText:'Til lobby'})
        :confirm('Kampen pågår fortsatt. Gå til lobbyen?');
      if(ok){
        if(isTournament)window.close();
        else location.href='./';
      }
    },true);
    return true;
  }
  if(!installCloseGuard()){
    const closeTimer=setInterval(()=>{if(installCloseGuard())clearInterval(closeTimer)},80);
    setTimeout(()=>clearInterval(closeTimer),10000);
  }

  const params=new URLSearchParams(location.search);
  // Tournament matches have their own RPC that resets the bracket match for restart.
  if(params.get('tournamentMatch'))return;
  const matchId=params.get('id');
  if(!matchId)return;

  const install=()=>{
    const button=document.getElementById('cancelMatchBtn');
    if(!button||!window.supabase)return false;
    if(button.dataset.secureCancel==='1')return true;
    button.dataset.secureCancel='1';

    const db=window.supabase.createClient(
      'https://jqpxlbhwvskhjbqrbidk.supabase.co',
      'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
    );
    let busy=false;

    button.addEventListener('click',async event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      if(busy)return;
      const dialog=await ensureDialog().catch(()=>null);
      const ok=dialog
        ?await dialog.confirm('Vil du avbryte kampen?\n\nKampen avsluttes for begge spillere.',{title:'Avbryt kamp',tone:'danger',confirmText:'Avbryt kamp'})
        :confirm('Vil du avbryte kampen?');
      if(!ok)return;
      busy=true;
      const old=button.textContent;
      button.disabled=true;
      button.textContent='Avbryter…';
      try{
        const {data,error}=await db.rpc('cancel_match',{p_match_id:matchId});
        if(error)throw error;
        button.classList.add('hidden');
        const msg=document.getElementById('matchMessage');
        if(msg)msg.textContent='Kampen er avbrutt.';
        try{window.opener?.postMessage({type:'dartarena-match-ended',id:matchId},location.origin)}catch{}
        if(data)location.href='./';
      }catch(error){
        const msg=document.getElementById('matchMessage');
        if(msg)msg.textContent='Kunne ikke avbryte: '+(error?.message||'ukjent feil');
        button.disabled=false;
        button.textContent=old;
        busy=false;
      }
    },true);
    return true;
  };

  if(!install()){
    const timer=setInterval(()=>{if(install())clearInterval(timer)},80);
    setTimeout(()=>clearInterval(timer),10000);
  }
})();