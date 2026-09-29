(()=>{
  let startedFor=null,sentChannel=null,pendingSentIds=new Set(),acceptedRoomId=null;

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
    if(!acceptedRoomId){box.hidden=true;box.innerHTML='';return}
    box.hidden=false;
    box.innerHTML=`<div class="challenge-row"><div><div class="player-name">Utfordringen er godtatt</div><div class="status">Venterommet er klart i egen fane.</div></div><div class="challenge-actions"><button id="openAcceptedRoomBtn" class="small-btn accept">Åpne venterom</button></div></div>`;
    box.querySelector('#openAcceptedRoomBtn').onclick=()=>openAcceptedRoom(acceptedRoomId);
  }

  function openAcceptedRoom(id){
    if(!id)return false;
    const url=`room.html?id=${encodeURIComponent(id)}`;
    const tab=window.open(url,`dartarena-room-${id}`);
    if(tab){
      acceptedRoomId=null;
      renderAcceptedRoomPrompt();
      try{tab.focus()}catch{}
      return true;
    }
    acceptedRoomId=id;
    renderAcceptedRoomPrompt();
    return false;
  }

  enterAcceptedRoom=function(id){openAcceptedRoom(id)};

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
    if(activeMatch){pendingSentIds=new Set();host.innerHTML='<p class="muted">Du er i kamp.</p>';return}
    const{data,error}=await db.from('challenges').select('id,challenged_id,status,created_at').eq('challenger_id',profile.id).eq('status','pending').order('created_at',{ascending:false});
    if(error){host.innerHTML=`<p class="muted">${esc(error.message)}</p>`;return}
    pendingSentIds=new Set((data||[]).map(c=>c.challenged_id));
    applySentButtonState();
    if(!data?.length){host.innerHTML='<p class="muted">Ingen sendte utfordringer.</p>';return}
    const ids=[...pendingSentIds],{data:people}=await db.from('profiles').select('id,username').in('id',ids),names=Object.fromEntries((people||[]).map(p=>[p.id,p.username]));
    host.innerHTML=data.map(c=>`<div class="challenge-row"><div><div class="player-name">${esc(names[c.challenged_id]||'Spiller')}</div><div class="status">Venter på svar</div></div><div class="challenge-actions"><button class="small-btn decline withdraw-challenge" data-id="${c.id}">Trekk tilbake</button></div></div>`).join('');
    host.querySelectorAll('.withdraw-challenge').forEach(b=>b.onclick=()=>withdrawChallenge(b));
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
    button.textContent='Sendt';
    await loadSentChallenges();
  };

  async function startForProfile(){
    if(!profile||startedFor===profile.id)return;
    if(sentChannel)try{await db.removeChannel(sentChannel)}catch{}
    startedFor=profile.id;
    ensureUi();
    await loadSentChallenges();
    sentChannel=db.channel('lobby-sent-challenges-'+profile.id)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'challenges',filter:`challenger_id=eq.${profile.id}`},payload=>{
        const row=payload.new;
        if(row.status==='room'){
          openAcceptedRoom(row.id);
          loadSentChallenges();
          loadPlayers();
          return;
        }
        if((row.status==='declined'||row.status==='cancelled'||row.status==='accepted')&&acceptedRoomId===row.id){
          acceptedRoomId=null;
          renderAcceptedRoomPrompt();
        }
        loadSentChallenges();
        loadPlayers();
      }).subscribe();
  }

  window.addEventListener('message',e=>{
    if(e.origin!==location.origin)return;
    if(e.data?.type==='dartarena-room-cancelled'){
      if(acceptedRoomId===e.data.id)acceptedRoomId=null;
      renderAcceptedRoomPrompt();
      Promise.all([loadLobby(),loadSentChallenges(),loadPlayers()]).catch(()=>{});
    }
  });

  setInterval(()=>{if(profile)startForProfile();else{startedFor=null;pendingSentIds=new Set();acceptedRoomId=null}},600);
})();