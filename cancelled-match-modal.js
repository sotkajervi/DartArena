(()=>{
  if(window.DartArenaCancelledMatchModal)return;
  let shown=false,ownCancel=false,watchTimer=null;

  function tournamentMatchId(){
    const params=new URLSearchParams(location.search);
    if(params.has('tournamentMatch'))return params.get('tournamentMatch');
    const path=location.pathname;
    if((path.endsWith('/tournament-match-room')||path.endsWith('/tournament-match-room.html'))&&params.get('samePageDev')==='1')return params.get('id');
    return null;
  }

  async function goLobby(){
    const activeMatchId=window.DartArenaMatchEngineState?.matchId?.()||new URLSearchParams(location.search).get('id');
    const tmId=tournamentMatchId();
    const button=document.getElementById('cancelledLobbyBtn');
    if(button)button.disabled=true;
    try{
      if(tmId){
        const known=window.DartArenaTournamentReturnUrl;
        if(known){location.assign(known);return}
        const client=window.DartArenaMatchEngineState?.client?.()||
          window.DartArenaTournamentRoomState?.client?.()||null;
        if(!client)throw Error('Kunne ikke koble til turneringen.');
        const {data,error}=await client.from('tournament_matches')
          .select('tournament_id').eq('id',tmId).single();
        if(error||!data?.tournament_id)throw error||new Error('Fant ikke turneringen.');
        location.assign('tournament.html?id='+encodeURIComponent(data.tournament_id));
        return;
      }
      try{window.opener?.postMessage({type:'dartarena-match-ended',id:activeMatchId},location.origin)}catch{}
      clearInterval(watchTimer);
      location.assign('./');
    }catch(error){
      const message=document.getElementById('cancelledMatchText');
      if(message)message.textContent='Kunne ikke åpne turneringslobbyen: '+(error?.message||error);
      if(button)button.disabled=false;
    }
  }

  function ensureStyle(){
    if(document.getElementById('dartarena-cancelled-modal-style'))return;
    const style=document.createElement('style');
    style.id='dartarena-cancelled-modal-style';
    style.textContent=`
      .da-cancelled-modal{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px}
      .da-cancelled-modal.hidden{display:none!important}
      .da-cancelled-backdrop{position:absolute;inset:0;background:rgba(1,7,9,.78);backdrop-filter:blur(7px)}
      .da-cancelled-card{position:relative;z-index:1;width:min(430px,calc(100vw - 32px));padding:24px;border:1px solid rgba(0,234,244,.38);border-radius:18px;background:linear-gradient(180deg,rgba(11,29,32,.98),rgba(5,16,18,.98));box-shadow:0 24px 80px rgba(0,0,0,.55),0 0 34px rgba(0,234,244,.08);text-align:center}
      .da-cancelled-card small{display:block;color:var(--cyan,#00eaf4);font-weight:950;letter-spacing:.12em;margin-bottom:8px}
      .da-cancelled-card h2{margin:0 0 10px;font-size:28px}
      .da-cancelled-card p{margin:0 0 20px;line-height:1.5}
      .da-cancelled-card button{min-height:48px}
    `;
    document.head.appendChild(style);
  }

  function ensureModal(){
    ensureStyle();
    let modal=document.getElementById('cancelledMatchModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='cancelledMatchModal';
      modal.className='da-cancelled-modal hidden';
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      modal.setAttribute('aria-labelledby','cancelledMatchTitle');
      modal.innerHTML='<div class="da-cancelled-backdrop"></div><section class="card da-cancelled-card"><small>KAMP AVBRUTT</small><h2 id="cancelledMatchTitle">Kampen er avbrutt</h2><p id="cancelledMatchText" class="muted">Motstanderen har avbrutt kampen.</p><button id="cancelledLobbyBtn" class="primary wide" type="button">Til lobby</button></section>';
      document.body.appendChild(modal);
    }else{
      modal.classList.add('da-cancelled-modal');
      modal.querySelector('.jdc-cancel-backdrop')?.classList.add('da-cancelled-backdrop');
      modal.querySelector('.jdc-cancel-card')?.classList.add('da-cancelled-card');
    }
    const button=document.getElementById('cancelledLobbyBtn');
    if(button&&!button.dataset.cancelLobbyReady){
      button.dataset.cancelLobbyReady='1';
      button.addEventListener('click',goLobby);
    }
    return modal;
  }

  function show(){
    if(shown||ownCancel||window.__dartArenaOwnCancel)return;
    shown=true;
    const modal=ensureModal();
    const text=document.getElementById('cancelledMatchText');
    if(text)text.textContent='Motstanderen har avbrutt kampen.';
    const lobbyButton=modal.querySelector('#cancelledLobbyBtn');
    if(lobbyButton)lobbyButton.textContent=tournamentMatchId()?'Til turneringen':'Til lobby';
    modal.classList.remove('hidden');
    try{document.getElementById('cancelledLobbyBtn')?.focus({preventScroll:true})}catch{}
  }

  function looksCancelled(){
    const ids=['matchStatus','turnText','phaseTitle','halfRoundLabel'];
    return ids.some(id=>{
      const text=(document.getElementById(id)?.textContent||'').trim().toLowerCase();
      return text==='avbrutt'||text==='kampen er avbrutt.'||text==='kampen er avbrutt';
    });
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#cancelMatchBtn');
    if(!button)return;
    setTimeout(()=>{
      if(button.disabled||/avbryter/i.test(button.textContent||'')){
        ownCancel=true;
        window.__dartArenaOwnCancel=true;
      }
    },0);
  },true);

  window.DartArenaCancelledMatchModal={show};
  ensureModal();
  watchTimer=setInterval(()=>{if(!shown&&!ownCancel&&looksCancelled())show()},250);
  window.addEventListener('pagehide',()=>clearInterval(watchTimer));
})();