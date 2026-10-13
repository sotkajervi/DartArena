(()=>{
  const modal=document.getElementById('tournamentReadyModal');
  const name=document.getElementById('tournamentReadyName');
  const countdown=document.getElementById('tournamentReadyCountdown');
  const go=document.getElementById('tournamentReadyGo');
  const stay=document.getElementById('tournamentReadyStay');
  if(!modal||!name||!countdown||!go||!stay)return;

  const DELAY=8;
  let userId=null,initialized=false,previous=new Map(),handled=new Set();
  let pending=null,active=null,tickTimer=null,remaining=DELAY;

  const inLobby=()=>!document.getElementById('lobbyView')?.classList.contains('hidden')&&
    typeof profile!=='undefined'&&profile?.id===userId&&
    !(typeof activeMatch!=='undefined'&&activeMatch)&&
    profile?.status!=='in_game';

  function stopTimer(){
    if(tickTimer){clearInterval(tickTimer);tickTimer=null}
  }
  function hide(){
    stopTimer();
    active=null;
    modal.classList.add('hidden');
  }
  function reset(){
    hide();
    userId=null;
    initialized=false;
    previous=new Map();
    handled=new Set();
    pending=null;
  }
  function navigate(){
    if(!active||!inLobby())return hide();
    const target=active.id;
    hide();
    location.assign(`tournament.html?id=${encodeURIComponent(target)}`);
  }
  function dismiss(){
    pending=null;
    hide();
  }
  function maybeShow(){
    if(active||!pending||!inLobby()||document.hidden)return;
    active=pending;
    pending=null;
    remaining=DELAY;
    name.textContent=active.name;
    countdown.textContent=String(remaining);
    modal.classList.remove('hidden');
    go.focus();
    tickTimer=setInterval(()=>{
      if(!active)return stopTimer();
      if(!inLobby())return hide();
      if(document.hidden)return;
      remaining--;
      countdown.textContent=String(remaining);
      if(remaining<=0)navigate();
    },1000);
  }

  go.addEventListener('click',navigate);
  stay.addEventListener('click',dismiss);
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();dismiss()}
  });
  document.addEventListener('visibilitychange',maybeShow);
  window.addEventListener('dartarena:lobby-ready',maybeShow);
  window.addEventListener('dartarena:tournament-lobby-snapshot',event=>{
    const snapshot=event.detail;
    if(!snapshot?.userId){reset();return}
    if(userId!==snapshot.userId){reset();userId=snapshot.userId}
    const tournaments=(snapshot.tournaments||[]).filter(t=>t?.id);
    const next=new Map(tournaments.map(t=>[t.id,t.status]));

    // Initial lobby load is a baseline: never redirect to old tournaments.
    if(!initialized){
      previous=next;
      initialized=true;
      return;
    }

    // If a tournament was cancelled or finished while a prompt is visible,
    // the player must not be sent to that obsolete room.
    if(active&&!tournaments.some(t=>t.id===active.id&&t.status==='groups'&&t.eligible))hide();
    if(pending&&!tournaments.some(t=>t.id===pending.id&&t.status==='groups'&&t.eligible))pending=null;

    for(const t of tournaments){
      if(previous.get(t.id)!=='groups_setup'||t.status!=='groups'||!t.eligible||handled.has(t.id))continue;
      handled.add(t.id);
      // Only the signed-in player in the main lobby is eligible for transfer.
      if(!inLobby())continue;
      if(!pending&&!active)pending={id:t.id,name:t.name||'Turnering'};
    }
    previous=next;
    maybeShow();
  });
})();
