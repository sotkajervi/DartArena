(()=>{
  let startedFor=null,sentChannel=null;
  const closePendingTab=id=>{try{const tab=pendingRoomTabs.get(id);if(tab&&!tab.closed)tab.close();pendingRoomTabs.delete(id)}catch{}};

  const originalEnterAcceptedRoom=enterAcceptedRoom;
  enterAcceptedRoom=function(id){
    const url=`room.html?id=${encodeURIComponent(id)}`;
    try{
      const pending=pendingRoomTabs.get(id);
      if(pending&&!pending.closed){pending.location.href=url;pendingRoomTabs.delete(id);return}
    }catch{}
    const tab=window.open(url,`dartarena-room-${id}`);
    try{pendingRoomTabs.delete(id)}catch{}
    if(!tab)location.href=url;
  };

  function ensureUi(){
    let host=document.getElementById('sentChallengeList');
    if(host)return host;
    const incoming=document.getElementById('challengeList');
    if(!incoming)return null;
    const section=incoming.closest('.card');
    const heading=section?.querySelector('.heading h2');
    if(heading)heading.textContent='Utfordringer';
    const label=document.createElement('div');
    label.style.marginTop='18px';
    label.innerHTML='<small>SENDTE</small>';
    host=document.createElement('div');
    host.id='sentChallengeList';
    host.className='challenge-list';
    host.innerHTML='<p class="muted">Ingen sendte utfordringer.</p>';
    incoming.insertAdjacentElement('afterend',label);
    label.insertAdjacentElement('afterend',host);
    const incomingLabel=document.createElement('small');
    incomingLabel.textContent='INNKOMMENDE';
    incoming.insertAdjacentElement('beforebegin',incomingLabel);
    return host;
  }

  async function loadSentChallenges(){
    const host=ensureUi();
    if(!host||!profile)return;
    if(activeMatch){host.innerHTML='<p class="muted">Du er i kamp.</p>';return}
    const{data,error}=await db.from('challenges').select('id,challenged_id,status,created_at').eq('challenger_id',profile.id).eq('status','pending').order('created_at',{ascending:false});
    if(error){host.innerHTML=`<p class="muted">${esc(error.message)}</p>`;return}
    if(!data?.length){host.innerHTML='<p class="muted">Ingen sendte utfordringer.</p>';return}
    const ids=[...new Set(data.map(c=>c.challenged_id))],{data:people}=await db.from('profiles').select('id,username').in('id',ids),names=Object.fromEntries((people||[]).map(p=>[p.id,p.username]));
    host.innerHTML=data.map(c=>`<div class="challenge-row"><div><div class="player-name">${esc(names[c.challenged_id]||'Spiller')}</div><div class="status">Venter på svar</div></div><div class="challenge-actions"><button class="small-btn decline withdraw-challenge" data-id="${c.id}">Trekk tilbake</button></div></div>`).join('');
    host.querySelectorAll('.withdraw-challenge').forEach(b=>b.onclick=()=>withdrawChallenge(b));
  }

  async function withdrawChallenge(button){
    if(!profile||button.disabled)return;
    const id=button.dataset.id,old=button.textContent;
    button.disabled=true;button.textContent='Trekker tilbake…';
    const{error}=await db.from('challenges').update({status:'cancelled'}).eq('id',id).eq('challenger_id',profile.id).eq('status','pending');
    if(error){button.disabled=false;button.textContent=old;alert(error.message);return}
    closePendingTab(id);
    await Promise.all([loadSentChallenges(),loadPlayers()]);
  }

  const baseLoadChallenges=loadChallenges;
  loadChallenges=async function(){const result=await baseLoadChallenges();await loadSentChallenges();return result};
  const baseSendInvite=sendInvite;
  sendInvite=async function(button){const result=await baseSendInvite(button);await loadSentChallenges();return result};

  async function startForProfile(){
    if(!profile||startedFor===profile.id)return;
    if(sentChannel)try{await db.removeChannel(sentChannel)}catch{}
    startedFor=profile.id;
    ensureUi();
    await loadSentChallenges();
    sentChannel=db.channel('lobby-sent-challenges-'+profile.id)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'challenges',filter:`challenger_id=eq.${profile.id}`},payload=>{
        const row=payload.new;
        if(row.status==='declined'||row.status==='cancelled')closePendingTab(row.id);
        loadSentChallenges();
      }).subscribe();
  }

  setInterval(()=>{if(profile)startForProfile();else startedFor=null},600);
})();