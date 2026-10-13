(()=>{
  let startedFor=null,sentChannel=null,pendingSentIds=new Set(),acceptedRoomId=null;
  const observedPendingChallengeIds=new Set();
  let autoOpeningRoomId=null,navigatingRoomId=null,lastRenderedAcceptedRoomId=null;

  function ensureUi(){
    let host=document.getElementById('sentChallengeList');
    if(host)return host;
    const incoming=document.getElementById('challengeList');
    if(!incoming)return null;
    const section=incoming.closest('.card');
    const heading=section?.querySelector('.heading h2');
    if(heading)heading.textContent='Utfordringer';

    const roomPrompt=document.createElement('div');
    roomPrompt.id='acceptedRoomPrompt';
    roomPrompt.className='challenge-list';
    roomPrompt.style.marginBottom='14px';
    roomPrompt.hidden=true;
    incoming.insertAdjacentElement('beforebegin',roomPrompt);

    const incomingLabel=document.createElement('small');
    incomingLabel.textContent='INNKOMMENDE';
    incoming.insertAdjacentElement('beforebegin',incomingLabel);

    const label=document.createElement('div');
    label.style.marginTop='18px';
    label.innerHTML='<small>SENDTE</small>';
    host=document.createElement('div');
    host.id='sentChallengeList';
    host.className='challenge-list';
    host.innerHTML='<p class="muted">Ingen sendte utfordringer.</p>';
    incoming.insertAdjacentElement('afterend',label);
    label.insertAdjacentElement('afterend',host);
    return host;
  }

  function renderAcceptedRoomPrompt(){
    ensureUi();
    const box=document.getElementById('acceptedRoomPrompt');
    if(!box)return;
    if(!acceptedRoomId){box.hidden=true;box.innerHTML='';lastRenderedAcceptedRoomId=null;return}
    if(!box.hidden&&lastRenderedAcceptedRoomId===acceptedRoomId)return;
    box.hidden=false;
    lastRenderedAcceptedRoomId=acceptedRoomId;
    box.innerHTML=`<div class="da-room-ready"><div class="da-room-ready-copy"><small>VENTEROM KLART</small><strong>Utfordringen er godtatt!</strong><p>Gå til venterommet for å bli med i kampen.</p></div><button id="openAcceptedRoomBtn" class="primary da-room-ready-button" type="button">Gå til venterom</button></div>`;
    box.querySelector('#openAcceptedRoomBtn').onclick=()=>openAcceptedRoom(acceptedRoomId);
  }

  function openAcceptedRoom(id){
    if(!id)return false;
    if(navigatingRoomId===id)return true;
    const url=`room.html?id=${encodeURIComponent(id)}`;
    navigatingRoomId=id;
    acceptedRoomId=null;
    renderAcceptedRoomPrompt();
    try{
      window.location.assign(url);
      return true;
    }catch(error){
      navigatingRoomId=null;
      acceptedRoomId=id;
      renderAcceptedRoomPrompt();
      console.warn('Could not navigate to the waiting room',error);
      return false;
    }
  }

  // Keep the lobby visible until a verified pending invitation becomes accepted.
  // Then navigate to the existing waiting room in the current tab (no popups).
  async function autoEnterAcceptedRoom(id){
    if(!id||!profile||!observedPendingChallengeIds.has(id)||autoOpeningRoomId||navigatingRoomId)return;
    const userId=profile.id;
    autoOpeningRoomId=id;
    try{
      const{data,error}=await db.from('challenges')
        .select('id')
        .eq('id',id)
        .eq('challenger_id',userId)
        .eq('status','room')
        .maybeSingle();
      if(error)throw error;
      if(!data||profile?.id!==userId||activeMatch)return;
      observedPendingChallengeIds.delete(id);
      openAcceptedRoom(id);
    }catch(error){
      navigatingRoomId=null;
      console.warn('Automatic waiting-room navigation failed',error);
      acceptedRoomId=id;
      renderAcceptedRoomPrompt();
    }finally{
      autoOpeningRoomId=null;
    }
  }

  enterAcceptedRoom=function(id){
    if(id&&observedPendingChallengeIds.has(id))void autoEnterAcceptedRoom(id);
  };

  function applySentButtonState(){
    document.querySelectorAll('.challenge-btn').forEach(b=>{
      if(pendingSentIds.has(b.dataset.id)){
        b.disabled=true;
        b.textContent='Sendt';
      }
    });
  }

  async function loadSentChallenges(){
    const host=ensureUi();
    renderAcceptedRoomPrompt();
    if(!host||!profile)return;
    const userId=profile.id;
    if(activeMatch){pendingSentIds=new Set();acceptedRoomId=null;renderAcceptedRoomPrompt();host.innerHTML='<p class="muted">Du er i kamp.</p>';return}
    const{data,error}=await db.from('challenges')
      .select('id,challenged_id,status,created_at')
      .eq('challenger_id',profile.id)
      .in('status',['pending','room'])
      .order('created_at',{ascending:false});
    if(error){host.innerHTML=`<p class="muted">${esc(error.message)}</p>`;return}
    if(profile?.id!==userId)return;
    const currentIds=new Set((data||[]).map(c=>c.id));
    for(const id of observedPendingChallengeIds){
      if(!currentIds.has(id))observedPendingChallengeIds.delete(id);
    }
    // Compare with previously seen pending challenges before recording new ones.
    // This also recovers missed Realtime events through the lobby refresh.
    for(const c of data||[]){
      if(c.status==='room'&&observedPendingChallengeIds.has(c.id))enterAcceptedRoom(c.id);
    }
    for(const c of data||[]){
      if(c.status==='pending')observedPendingChallengeIds.add(c.id);
    }
    // Do not auto-open historical accepted invitations on login or after F5.
    // Keep a manual entry point if the accepted room is still active.
    const readyRooms=(data||[]).filter(c=>c.status==='room'&&c.id!==navigatingRoomId);
    if(!readyRooms.some(c=>c.id===acceptedRoomId)){
      acceptedRoomId=readyRooms[0]?.id||null;
    }
    renderAcceptedRoomPrompt();
    pendingSentIds=new Set((data||[]).map(c=>c.challenged_id));
    applySentButtonState();
    if(!data?.length){host.innerHTML='<p class="muted">Ingen sendte utfordringer.</p>';return}
    const ids=[...new Set((data||[]).map(c=>c.challenged_id))],{data:people}=await db.from('profiles').select('id,username').in('id',ids),names=Object.fromEntries((people||[]).map(p=>[p.id,p.username]));
    host.innerHTML=data.map(c=>{
      const name=esc(names[c.challenged_id]||'Spiller');
      if(c.status==='room')return `<div class="challenge-row"><div><div class="player-name">${name}</div><div class="status">Godtatt · venterom klart</div></div><div class="challenge-actions"><button class="small-btn accept open-room-challenge" data-id="${c.id}">Åpne</button></div></div>`;
      return `<div class="challenge-row"><div><div class="player-name">${name}</div><div class="status">Venter på svar</div></div><div class="challenge-actions"><button class="small-btn decline withdraw-challenge" data-id="${c.id}">Trekk tilbake</button></div></div>`;
    }).join('');
    host.querySelectorAll('.withdraw-challenge').forEach(b=>b.onclick=()=>withdrawChallenge(b));
    host.querySelectorAll('.open-room-challenge').forEach(b=>b.onclick=()=>openAcceptedRoom(b.dataset.id));
  }

  async function withdrawChallenge(button){
    if(!profile||button.disabled)return;
    const id=button.dataset.id,old=button.textContent;
    button.disabled=true;button.textContent='Trekker tilbake…';
    const{error}=await db.from('challenges').update({status:'cancelled'}).eq('id',id).eq('challenger_id',profile.id).eq('status','pending');
    if(error){button.disabled=false;button.textContent=old;alert(error.message);return}
    await Promise.all([loadSentChallenges(),loadPlayers()]);
  }

  const baseLoadChallenges=loadChallenges;
  loadChallenges=async function(){const result=await baseLoadChallenges();await loadSentChallenges();return result};

  const baseLoadPlayers=loadPlayers;
  loadPlayers=async function(){const result=await baseLoadPlayers();applySentButtonState();return result};

  sendInvite=async function(button){
    if(activeMatch||!button||button.disabled)return;
    const id=button.dataset.id,old=button.textContent;
    button.disabled=true;button.textContent='Sjekker…';

    const{data:incoming,error:incomingError}=await db.from('challenges')
      .select('id')
      .eq('challenger_id',id)
      .eq('challenged_id',profile.id)
      .eq('status','pending')
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle();

    if(incomingError){button.disabled=false;button.textContent=old;alert(incomingError.message);return}

    if(incoming?.id){
      button.textContent='Kobler til…';
      const{data:accepted,error:acceptError}=await db.from('challenges')
        .update({status:'room'})
        .eq('id',incoming.id)
        .eq('challenged_id',profile.id)
        .eq('status','pending')
        .select('id')
        .maybeSingle();
      if(acceptError){button.disabled=false;button.textContent=old;alert(acceptError.message);return}
      if(!accepted?.id){button.disabled=false;button.textContent=old;await Promise.all([loadChallenges(),loadPlayers()]);return}
      openAcceptedRoom(accepted.id);
      return;
    }

    button.textContent='Sender…';
    const{data,error}=await db.from('challenges').insert({challenger_id:profile.id,challenged_id:id,game:501,legs:5,allow_draw:false,starter:'me',status:'pending'}).select('id').single();
    if(error){button.disabled=false;button.textContent=old;alert(error.message);return}
    pendingSentIds.add(id);
    observedPendingChallengeIds.add(data.id);
    button.textContent='Sendt';
    await loadSentChallenges();
  };

  async function startForProfile(){
    if(!profile||startedFor===profile.id)return;
    if(sentChannel)try{await db.removeChannel(sentChannel)}catch{}
    if(startedFor&&startedFor!==profile.id)observedPendingChallengeIds.clear();
    startedFor=profile.id;
    autoOpeningRoomId=null;
    navigatingRoomId=null;
    ensureUi();
    await loadSentChallenges();
    sentChannel=db.channel('lobby-sent-challenges-'+profile.id)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'challenges',filter:`challenger_id=eq.${profile.id}`},payload=>{
        const row=payload.new;
        if(row.status==='room')enterAcceptedRoom(row.id);
        if(row.status!=='room'){
          if(row.status!=='pending'){
            observedPendingChallengeIds.delete(row.id);

          }
          if(acceptedRoomId===row.id){
            acceptedRoomId=null;
            renderAcceptedRoomPrompt();
          }
        }
        loadSentChallenges();
        loadPlayers();
      }).subscribe();
  }

  window.addEventListener('message',e=>{
    if(e.origin!==location.origin)return;
    if(e.data?.type==='dartarena-room-cancelled'){
      observedPendingChallengeIds.delete(e.data.id);

      if(acceptedRoomId===e.data.id)acceptedRoomId=null;
      renderAcceptedRoomPrompt();
      Promise.all([loadLobby(),loadSentChallenges(),loadPlayers()]).catch(()=>{});
    }
  });

  setInterval(()=>{if(profile)startForProfile();else{startedFor=null;pendingSentIds=new Set();observedPendingChallengeIds.clear();autoOpeningRoomId=null;navigatingRoomId=null;acceptedRoomId=null}},600);
})();