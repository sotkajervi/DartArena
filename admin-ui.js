(()=>{
  if(!window.supabase)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let isAdmin=false;
  let observer=null;
  let deleteChannel=null;
  const deleteModeCache=new Map();

  function ensureStyles(){
    if(document.getElementById('dartarena-admin-styles'))return;
    const style=document.createElement('style');
    style.id='dartarena-admin-styles';
    style.textContent=`
      .admin-badge{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border:1px solid rgba(244,196,93,.45);border-radius:999px;background:rgba(244,196,93,.09);color:var(--amber);font-size:10px;font-weight:950;letter-spacing:.1em;vertical-align:middle}
      .admin-delete-tournament{color:#ff9ba1!important;border-color:#743139!important;background:#35171a!important}
      .admin-delete-tournament.admin-force-delete{font-weight:900;border-color:#a33f49!important;background:#491b20!important}
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

  async function inspectTournament(id,{fresh=false}={}){
    if(!fresh&&deleteModeCache.has(id))return deleteModeCache.get(id);

    const [tResult,mResult]=await Promise.all([
      db.from('tournaments').select('id,name,status').eq('id',id).single(),
      db.from('tournament_matches').select('status,live_match_id').eq('tournament_id',id)
    ]);
    if(tResult.error)throw tResult.error;
    if(mResult.error)throw mResult.error;

    const matches=mResult.data||[];
    const hasPlayed=matches.some(m=>m.live_match_id||['live','finished','wo'].includes(m.status));
    const info={
      id,
      name:tResult.data.name,
      status:tResult.data.status,
      force:tResult.data.status==='finished'||hasPlayed
    };
    deleteModeCache.set(id,info);
    return info;
  }

  async function setDeleteButtonMode(button,id){
    try{
      const info=await inspectTournament(id);
      button.textContent=info.force?'Tvangsslett':'Slett';
      button.classList.toggle('admin-force-delete',info.force);
      button.title=info.force
        ?'Admin: tvangsslett turnering og tilknyttet kampdata'
        :'Admin: slett oppsatt turnering';
    }catch(error){
      console.warn('Could not inspect tournament delete mode',error);
    }
  }

  async function deleteTournament(id,button,row=null,afterDelete=null){
    const old=button.textContent;
    button.disabled=true;
    try{
      const info=await inspectTournament(id,{fresh:true});
      button.textContent=info.force?'Tvangssletter…':'Sletter…';

      if(info.force){
        const typed=prompt(
          `TVANGSSLETT TURNERING\n\nDette sletter ${info.name} permanent, inkludert turneringsdata og tilknyttede live-kamper/statistikk.\n\nSkriv turneringsnavnet nøyaktig for å bekrefte:\n${info.name}`,
          ''
        );
        if(typed===null)return;
        if(typed!==info.name){
          alert('Navnet stemmer ikke. Turneringen ble ikke slettet.');
          return;
        }

        const {error}=await db.rpc('admin_force_delete_tournament',{
          p_tournament_id:id,
          p_confirm_name:typed
        });
        if(error)throw error;
      }else{
        if(!confirm(`Slette ${info.name}?\n\nDette kan ikke angres.`))return;
        const {error}=await db.rpc('admin_delete_tournament',{p_tournament_id:id});
        if(error){
          if(String(error.message||'').includes('Tournament requires force delete')){
            deleteModeCache.delete(id);
            button.disabled=false;
            button.textContent=old;
            return deleteTournament(id,button,row,afterDelete);
          }
          throw error;
        }
      }

      deleteModeCache.delete(id);
      row?.remove();
      if(typeof afterDelete==='function')afterDelete();
    }catch(error){
      const msg=String(error?.message||'Kunne ikke slette turneringen.')
        .replace('Tournament requires force delete','Turneringen inneholder kampdata og må tvangsslettes.')
        .replace('Tournament name confirmation does not match','Turneringsnavnet stemmer ikke.')
        .replace('Tournament not found','Turneringen finnes ikke lenger.')
        .replace('Admin access required','Adminrettigheter kreves.');
      alert(msg);
    }finally{
      if(document.body.contains(button)){
        button.disabled=false;
        setDeleteButtonMode(button,id);
      }
    }
  }

  function decorateTournamentRows(){
    if(!isAdmin)return;
    document.querySelectorAll('.tournament-row').forEach(row=>{
      if(row.querySelector('.admin-delete-tournament'))return;
      const open=row.querySelector('[data-open],[data-history-open]');
      const id=open?.dataset.open||open?.dataset.historyOpen;
      if(!id)return;
      const actions=open.closest('.challenge-actions');
      if(!actions)return;

      const button=document.createElement('button');
      button.type='button';
      button.className='small-btn admin-delete-tournament';
      button.textContent='Slett';
      button.title='Admin: slett turnering';
      button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        deleteTournament(id,button,row);
      });
      actions.appendChild(button);
      setDeleteButtonMode(button,id);
    });
  }

  function decorateCurrentTournament(){
    if(!isAdmin||!document.getElementById('tName'))return;
    if(document.getElementById('adminDeleteCurrentTournament'))return;
    const id=new URLSearchParams(location.search).get('id');
    const actions=document.querySelector('.lobby-top .top-actions');
    if(!id||!actions)return;

    const button=document.createElement('button');
    button.id='adminDeleteCurrentTournament';
    button.type='button';
    button.className='outline admin-delete-tournament';
    button.textContent='Slett';
    button.addEventListener('click',()=>deleteTournament(id,button,null,()=>location.href='index.html'));
    actions.insertBefore(button,actions.firstChild);
    setDeleteButtonMode(button,id);
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

  function decorate(){
    addBadge();
    decorateTournamentRows();
    decorateCurrentTournament();
    decorateChat();
  }

  function observe(){
    if(observer)return;
    let timer=null;
    observer=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(decorate,60);
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;

    const {data,error}=await db.rpc('is_admin');
    if(error){console.warn('Admin role check failed',error);return;}
    isAdmin=data===true;
    if(!isAdmin)return;

    ensureStyles();
    subscribeChatDeletes();
    decorate();
    observe();
  }

  boot().catch(error=>console.error('Admin UI init failed',error));
  window.addEventListener('pagehide',()=>{
    if(observer){observer.disconnect();observer=null;}
    if(deleteChannel){try{db.removeChannel(deleteChannel)}catch{}deleteChannel=null;}
  });
})();
