/* Dedicated seamless Cricket actions. Use the shared DartArena modal
   and the same authenticated cancel_match RPC as normal matches. */
(()=>{
  'use strict';
  if(window.__dartArenaCricketSeamlessCancel)return;
  const engine=window.DartArenaMatchEngineState;
  const cancel=document.getElementById('cancelMatchBtn');
  const close=document.getElementById('closeMatchBtn');
  const message=document.getElementById('matchMessage');
  const db=engine?.client?.();
  const matchId=engine?.matchId?.();
  if(!cancel||!db||!matchId||engine?.match?.()?.game_variant!=='cricket')return;
  window.__dartArenaCricketSeamlessCancel=true;
  let busy=false;
  const note=text=>{if(message)message.textContent=text;};
  async function confirmAction(message,options){
    if(!window.DartArenaDialog?.confirm){
      note('Kunne ikke åpne bekreftelsesvinduet. Prøv på nytt.');
      return false;
    }
    return !!(await window.DartArenaDialog.confirm(message,options));
  }
  cancel.addEventListener('click',async event=>{
    event.preventDefault();
    event.stopImmediatePropagation();
    if(busy||engine.match?.()?.status!=='playing')return;
    const ok=await confirmAction('Vil du avbryte kampen?\n\nKampen avsluttes for begge spillere.',{
      title:'Avbryt kamp',tone:'danger',confirmText:'Avbryt kamp',cancelText:'Fortsett kampen'
    });
    if(!ok)return;
    busy=true;
    const original=cancel.textContent;
    cancel.disabled=true;cancel.textContent='Avbryter…';
    try{
      const {error}=await db.rpc('cancel_match',{p_match_id:matchId});
      if(error)throw error;
      window.__dartArenaOwnCancel=true;
      try{await engine.channel?.()?.send({type:'broadcast',event:'match-cancelled',
        payload:{matchId,from:engine.profile?.()?.id}})}catch(e){console.debug('[CRICKET] cancel broadcast',e)}
      window.DartArenaMediaTrace?.mark('CRICKET_CANCELLED',{matchId:matchId.slice(0,8)});
      location.replace('./');
    }catch(error){
      window.__dartArenaOwnCancel=false;
      note('Kunne ikke avbryte kampen: '+(error?.message||'Ukjent feil'));
      console.error('[CRICKET] Cancel failed',error);
      cancel.disabled=false;cancel.textContent=original;busy=false;
    }
  },true);
  if(close)close.addEventListener('click',async event=>{
    event.preventDefault();event.stopImmediatePropagation();
    if(busy)return;
    if(engine.match?.()?.status==='playing'){
      const ok=await confirmAction('Kampen pågår fortsatt. Vil du gå til hovedlobbyen uten å avbryte?',{
        title:'Forlat kamprom',tone:'warning',confirmText:'Til hovedlobby',cancelText:'Bli i kampen'
      });
      if(!ok)return;
    }
    location.replace('./');
  },true);
})();