(()=>{
  if(!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let isAdmin=false;
  let observer=null;
  let deleteChannel=null;

  function ensureStyles(){
    if(document.getElementById('dartarena-admin-styles'))return;
    const style=document.createElement('style');
    style.id='dartarena-admin-styles';
    style.textContent=`
      .admin-badge{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border:1px solid rgba(244,196,93,.45);border-radius:999px;background:rgba(244,196,93,.09);color:var(--amber);font-size:10px;font-weight:950;letter-spacing:.1em;vertical-align:middle}
      .admin-delete-tournament{color:#ff9ba1!important;border-color:#743139!important;background:#35171a!important}
      .dart-chat-delete{margin-left:auto;border:0;background:transparent;color:#ff8f96;padding:0 2px;font-size:15px;line-height:1;cursor:pointer;opacity:.78}
      .dart-chat-delete:hover{opacity:1}
      .dart-chat-delete:disabled{opacity:.3;cursor:default}
    `;
    document.head.appendChild(style);
  }

  function addBadge(){
    const title=document.getElementById('welcomeName')||document.getElementById('tName');
    if(!title||title.querySelector('.admin-badge'))return;
    const badge=document.createElement('span');
    badge.className='admin-badge';
    badge.textContent='ADMIN';
    title.appendChild(badge);
  }

  async function deleteTournament(id,button){
    const row=button.closest('.tournament-row');
    const name=row?.querySelector('.player-name')?.textContent?.trim()||'denne turneringen';
    if(!confirm(`Slette ${name}?\n\nDette kan ikke angres. Ferdige turneringer og turneringer der en kamp har startet er beskyttet.`))return;

    const old=button.textContent;
    button.disabled=true;
    button.textContent='Sletter…';
    try{
      const {error}=await db.rpc('admin_delete_tournament',{p_tournament_id:id});
      if(error)throw error;
      row?.remove();
    }catch(error){
      const msg=String(error?.message||'Kunne ikke slette turneringen.')
        .replace('Finished tournaments cannot be deleted','Ferdige turneringer kan ikke slettes.')
        .replace('Tournament cannot be deleted after a match has started','Turneringen kan ikke slettes etter at en kamp har startet.')
        .replace('Admin access required','Adminrettigheter kreves.');
      alert(msg);
      button.disabled=false;
      button.textContent=old;
    }
  }

  function decorateTournamentRows(){
    if(!isAdmin)return;
    document.querySelectorAll('.tournament-row').forEach(row=>{
      if(row.querySelector('.admin-delete-tournament'))return;
      const open=row.querySelector('[data-open]');
      if(!open?.dataset.open)return;
      const actions=open.closest('.challenge-actions');
      if(!actions)return;
      const button=document.createElement('button');
      button.type='button';
      button.className='small-btn admin-delete-tournament';
      button.textContent='Slett';
      button.title='Admin: slett oppsatt turnering';
      button.addEventListener('click',()=>deleteTournament(open.dataset.open,button));
      actions.appendChild(button);
    });
  }

  function ensureChatEmpty(){
    const host=document.getElementById('dartChatMessages');
    if(!host||host.querySelector('.dart-chat-message'))return;
    if(host.querySelector('.dart-chat-empty'))return;
    const empty=document.createElement('p');
    empty.className='muted dart-chat-empty';
    empty.textContent='Ingen meldinger ennå.';
    host.appendChild(empty);
  }

  function removeChatMessage(id){
    if(!id)return;
    document.querySelector(`.dart-chat-message[data-message-id="${CSS.escape(String(id))}"]`)?.remove();
    ensureChatEmpty();
  }

  async function deleteChatMessage(id,item,button){
    if(!confirm('Slette denne chatmeldingen?'))return;
    button.disabled=true;
    try{
      const {error}=await db.rpc('admin_delete_chat_message',{p_message_id:id});
      if(error)throw error;
      item.remove();
      ensureChatEmpty();
    }catch(error){
      alert(String(error?.message||'Kunne ikke slette meldingen.').replace('Admin access required','Adminrettigheter kreves.'));
      button.disabled=false;
    }
  }

  function decorateChat(){
    if(!isAdmin)return;
    document.querySelectorAll('.dart-chat-message[data-message-id]').forEach(item=>{
      if(item.querySelector('.dart-chat-delete'))return;
      const meta=item.querySelector('.dart-chat-meta');
      if(!meta)return;
      const button=document.createElement('button');
      button.type='button';
      button.className='dart-chat-delete';
      button.textContent='×';
      button.title='Admin: slett melding';
      button.setAttribute('aria-label','Slett chatmelding');
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        deleteChatMessage(item.dataset.messageId,item,button);
      });
      meta.appendChild(button);
    });
  }

  function subscribeChatDeletes(){
    if(deleteChannel)return;
    deleteChannel=db.channel('dartarena-chat-deletes-'+Math.random().toString(36).slice(2))
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'lobby_messages'},payload=>{
        const id=payload?.old?.id;
        if(id)removeChatMessage(id);
      })
      .subscribe();
  }

  function observe(){
    if(observer)return;
    let timer=null;
    observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        addBadge();
        decorateTournamentRows();
        decorateChat();
      },60);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;

    subscribeChatDeletes();
    const {data,error}=await db.rpc('is_admin');
    if(error){console.warn('Admin role check failed',error);return;}
    isAdmin=data===true;
    if(!isAdmin)return;

    ensureStyles();
    addBadge();
    decorateTournamentRows();
    decorateChat();
    observe();
  }

  boot().catch(error=>console.error('Admin UI init failed',error));
  window.addEventListener('pagehide',()=>{
    if(observer){observer.disconnect();observer=null;}
    if(deleteChannel){try{db.removeChannel(deleteChannel)}catch{}deleteChannel=null;}
  });
})();
