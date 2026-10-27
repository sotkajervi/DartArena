(()=>{
  if(!window.supabase)return;

  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const params=new URLSearchParams(location.search);
  const tournamentPage=!!document.getElementById('tName');
  const tournamentId=tournamentPage?params.get('id'):null;
  const roomId=tournamentPage?tournamentId:'main';
  if(tournamentPage&&!tournamentId)return;

  let me=null;
  let channel=null;
  let startedFor=null;
  let sending=false;
  let currentState='';
  let messages=new Map();
  const names={};
  const roles=new Map();
  const CHAT_PAGE=50;
  let roleCheckedAt=0, oldestAt=null, hasOlder=false, unread=0, loadingOlder=false;

  function ensureStyles(){
    if(document.querySelector('link[data-dartarena-chat-style]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='lobby-chat.css?v=20261027-roles1';
    link.dataset.dartarenaChatStyle='1';
    document.head.appendChild(link);
  }

  function ensureMainLobbyDashboard(){
    if(tournamentPage)return null;
    const lobby=document.getElementById('lobbyView');
    const topGrid=document.querySelector('#lobbyView > .lobby-grid');
    const tournamentSection=document.getElementById('tournamentList')?.closest('.tournament-section');
    if(!lobby||!topGrid||!tournamentSection)return null;

    let dashboard=document.getElementById('lobbyMainGrid');
    if(!dashboard){
      dashboard=document.createElement('div');
      dashboard.id='lobbyMainGrid';
      dashboard.className='lobby-main-grid';
      topGrid.insertAdjacentElement('afterend',dashboard);
    }
    if(tournamentSection.parentElement!==dashboard)dashboard.appendChild(tournamentSection);
    return dashboard;
  }

  function mount(){
    if(document.getElementById('dartArenaChat'))return document.getElementById('dartArenaChat');

    const section=document.createElement('section');
    section.id='dartArenaChat';
    section.className='card dart-chat-card';
    section.innerHTML=`
      <div class="heading dart-chat-heading">
        <div><small>CHAT</small><h2>${tournamentPage?'Turneringschat':'Lobbychat'}</h2></div>
        <div id="dartChatState" class="status">Kobler til…</div>
      </div>
      <div class="dart-chat-history">
        <button id="dartChatOlder" type="button" class="small-btn" hidden>Vis eldre meldinger</button>
      </div>
      <div id="dartChatMessages" class="dart-chat-messages" role="log" aria-live="off" aria-relevant="additions"></div>
      <button id="dartChatJumpNew" class="dart-chat-jump-new" type="button" hidden>↓ Nyeste meldinger</button>
      <form id="dartChatForm" class="dart-chat-form">
        <textarea id="dartChatInput" maxlength="500" rows="2" placeholder="Skriv en melding…" aria-label="Chatmelding"></textarea>
        <div class="dart-chat-actions">
          <span id="dartChatCount" class="status">0 / 500</span>
          <button id="dartChatSend" class="primary" type="submit">Send</button>
        </div>
      </form>`;

    if(tournamentPage){
      const anchor=document.querySelector('main.shell > .lobby-grid');
      if(!anchor)return null;
      anchor.insertAdjacentElement('afterend',section);
    }else{
      const dashboard=ensureMainLobbyDashboard();
      if(!dashboard)return null;
      dashboard.appendChild(section);
    }

    const input=document.getElementById('dartChatInput');
    input.addEventListener('input',()=>document.getElementById('dartChatCount').textContent=`${input.value.length} / 500`);
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.shiftKey){
        event.preventDefault();
        section.querySelector('#dartChatForm').requestSubmit();
      }
    });
    section.querySelector('#dartChatForm').addEventListener('submit',sendMessage);
    document.getElementById('dartChatOlder').addEventListener('click',loadOlder);
    document.getElementById('dartChatJumpNew').addEventListener('click',jumpToLatest);
    document.getElementById('dartChatMessages').addEventListener('scroll',()=>{
      if(nearBottom(document.getElementById('dartChatMessages')))resetUnread();
    },{passive:true});
    return section;
  }

  function setState(text){currentState=text;const el=document.getElementById('dartChatState');if(el)el.textContent=text}
  function setEnabled(enabled){
    const input=document.getElementById('dartChatInput'),send=document.getElementById('dartChatSend');
    if(input)input.disabled=!enabled;
    if(send)send.disabled=!enabled;
  }

  function nearBottom(el){return !el||el.scrollHeight-el.scrollTop-el.clientHeight<80}
  function formatTime(value){
    try{return new Intl.DateTimeFormat('nb-NO',{hour:'2-digit',minute:'2-digit'}).format(new Date(value))}catch{return''}
  }

  function messageBelongs(row){return String(row?.room_id||'')===String(roomId)}

  async function ensureNames(ids){
    const missing=[...new Set(ids.filter(Boolean).filter(id=>!names[id]))];
    if(!missing.length)return;
    const {data,error}=await db.from('profiles').select('id,username').in('id',missing);
    if(error)return console.warn('Chat profile lookup failed',error);
    (data||[]).forEach(p=>names[p.id]=p.username||'Spiller');
  }

  async function ensureRoles(force=false){
    if(!force&&Date.now()-roleCheckedAt<3*60*1000)return;
    roleCheckedAt=Date.now();
    try{
      const {data,error}=await db.rpc('get_public_user_roles');
      if(error)throw error;
      roles.clear();
      for(const item of data||[]){
        if(['owner','admin'].includes(item?.role)&&item?.user_id)
          roles.set(item.user_id,item.role);
      }
    }catch(error){
      // Role data must come from server, never from editable usernames
      // or chat payloads. Unknown role stays a standard user.
      console.warn('Chat role lookup unavailable',error);
    }
  }

  function dateLabel(value){
    try{
      return new Intl.DateTimeFormat('nb-NO',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));
    }catch{return ''}
  }
  function jumpToLatest(){
    const host=document.getElementById('dartChatMessages');
    if(host)host.scrollTop=host.scrollHeight;
    resetUnread();
  }
  function resetUnread(){
    unread=0;
    const button=document.getElementById('dartChatJumpNew');
    if(button)button.hidden=true;
  }
  function updateOlderButton(){
    const button=document.getElementById('dartChatOlder');
    if(button){
      button.hidden=!hasOlder;
      button.disabled=loadingOlder;
      button.textContent=loadingOlder?'Laster eldre meldinger…':'Vis eldre meldinger';
    }
  }

  function renderAll({forceBottom=false,preserveTop=false,live=false}={}){
    const host=document.getElementById('dartChatMessages');if(!host)return;
    const oldHeight=host.scrollHeight,oldTop=host.scrollTop;
    const stick=forceBottom||nearBottom(host);
    const feed=window.DartArenaChatFeed;
    const list=feed?.decorate
      ?feed.decorate(messages.values(),roles)
      :[...messages.values()].sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))
        .map(row=>({row,role:'user',grouped:false,dateChanged:false}));
    const fragment=document.createDocumentFragment();
    if(!list.length){
      const empty=document.createElement('p');
      empty.className='muted dart-chat-empty';
      empty.textContent='Ingen meldinger ennå.';
      fragment.appendChild(empty);
    }
    for(const {row,role,grouped,dateChanged} of list){
      if(dateChanged){
        const date=document.createElement('div');
        date.className='dart-chat-date';
        date.textContent=dateLabel(row.created_at);
        fragment.appendChild(date);
      }
      const item=document.createElement('div');
      item.className='dart-chat-message dart-chat-role-'+role+
        (row.sender_id===me?' own':'')+
        (grouped?' dart-chat-grouped':'');
      item.dataset.messageId=row.id;
      const label=(names[row.sender_id]||'Spiller')+' '+formatTime(row.created_at);
      if(grouped)item.setAttribute('aria-label',label);
      // Two fixed columns: name/role on the left, time/moderation on the right.
      // Reserve the moderator slot on every account so timestamps never move.
      const meta=document.createElement('div');meta.className='dart-chat-meta';
      const left=document.createElement('div');left.className='dart-chat-meta-left';
      const sender=document.createElement('strong');
      sender.className='dart-chat-author';
      sender.textContent=names[row.sender_id]||'Spiller';
      left.appendChild(sender);
      if(role==='owner'||role==='admin'){
        const badge=document.createElement('span');
        badge.className='dart-chat-role-badge';
        badge.textContent=role==='owner'?'OWNER':'ADMIN';
        left.appendChild(badge);
      }
      const right=document.createElement('div');right.className='dart-chat-meta-right';
      const time=document.createElement('time');time.className='dart-chat-time';
      time.dateTime=row.created_at;time.textContent=formatTime(row.created_at);
      const deleteSlot=document.createElement('span');
      deleteSlot.className='dart-chat-delete-slot';
      right.append(time,deleteSlot);
      meta.append(left,right);
      item.appendChild(meta);
      const body=document.createElement('div');body.className='dart-chat-body';
      body.textContent=row.body||'';
      item.appendChild(body);fragment.appendChild(item);
    }
    host.replaceChildren(fragment);
    if(preserveTop){
      host.scrollTop=oldTop+(host.scrollHeight-oldHeight);
    }else if(stick){
      jumpToLatest();
    }else if(live){
      const button=document.getElementById('dartChatJumpNew');
      if(button){unread+=1;button.textContent='↓ '+unread+' nye meldinger';button.hidden=false}
      host.scrollTop=oldTop;
    }else{
      host.scrollTop=oldTop;
    }
  }

  function addMessage(row,{own=false}={}){
    if(!messageBelongs(row)||messages.has(row.id))return;
    const host=document.getElementById('dartChatMessages');
    const atEnd=nearBottom(host);
    messages.set(row.id,row);
    renderAll({forceBottom:own||atEnd,live:!own&&!atEnd});
  }

  async function loadMessages(){
    const host=document.getElementById('dartChatMessages');if(!host)return false;
    setState('Laster…');setEnabled(false);
    const {data,error}=await db.from('lobby_messages')
      .select('id,room_id,tournament_id,sender_id,body,created_at')
      .eq('room_id',roomId)
      .order('created_at',{ascending:false})
      .limit(CHAT_PAGE);
    if(error){
      const missing=/lobby_messages|does not exist|relation/i.test(String(error.message||''));
      setState(missing?'Ikke aktivert':'Kunne ikke laste');
      host.textContent=missing?'Chatten blir tilgjengelig når databaseoppdateringen er kjørt.':'Kunne ikke laste chatten akkurat nå.';
      setEnabled(false);return false;
    }
    const rows=[...(data||[])].reverse();
    await ensureNames(rows.map(x=>x.sender_id));
    messages=new Map(rows.map(row=>[row.id,row]));
    oldestAt=rows[0]?.created_at||null;
    hasOlder=rows.length===CHAT_PAGE;
    updateOlderButton();
    renderAll({forceBottom:true});
    setState(tournamentPage?'Denne turneringen':'Hovedlobby');
    setEnabled(true);
    return true;
  }

  async function loadOlder(){
    if(loadingOlder||!hasOlder||!oldestAt)return;
    loadingOlder=true;updateOlderButton();
    try{
      const {data,error}=await db.from('lobby_messages')
        .select('id,room_id,tournament_id,sender_id,body,created_at')
        .eq('room_id',roomId)
        .lt('created_at',oldestAt)
        .order('created_at',{ascending:false})
        .limit(CHAT_PAGE);
      if(error)throw error;
      const rows=[...(data||[])].reverse();
      await ensureNames(rows.map(row=>row.sender_id));
      for(const row of rows)messages.set(row.id,row);
      oldestAt=rows[0]?.created_at||oldestAt;
      hasOlder=rows.length===CHAT_PAGE;
      renderAll({preserveTop:true});
    }catch(error){
      console.warn('Could not load older chat messages',error);
      setState('Kunne ikke laste eldre meldinger');
    }finally{
      loadingOlder=false;updateOlderButton();
    }
  }

  async function sendMessage(event){
    event.preventDefault();
    if(sending||!me)return;
    const input=document.getElementById('dartChatInput'),button=document.getElementById('dartChatSend');
    const body=String(input?.value||'').trim();
    if(!body||body.length>500)return;
    sending=true;if(button){button.disabled=true;button.textContent='Sender…'}
    try{
      const payload={
        room_id:roomId,
        tournament_id:tournamentPage?tournamentId:null,
        sender_id:me,
        body
      };
      const {data,error}=await db.from('lobby_messages').insert(payload).select('id,room_id,tournament_id,sender_id,body,created_at').single();
      if(error)throw error;
      await ensureNames([data.sender_id]);
      addMessage(data,{own:true});
      input.value='';document.getElementById('dartChatCount').textContent='0 / 500';input.focus();
    }catch(error){
      console.error('Chat send failed',error);
      setState('Kunne ikke sende');
    }finally{
      sending=false;if(button){button.disabled=false;button.textContent='Send'}
    }
  }

  async function subscribe(){
    if(channel)try{db.removeChannel(channel)}catch{}
    channel=db.channel(`lobby-chat-${roomId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',{
        event:'INSERT',schema:'public',table:'lobby_messages',filter:`room_id=eq.${roomId}`
      },async payload=>{
        const row=payload.new;if(!messageBelongs(row))return;
        await Promise.all([ensureNames([row.sender_id]),ensureRoles()]);
        addMessage(row);
      })
      .subscribe(status=>{
        if(status==='SUBSCRIBED'&&currentState==='Kobler til…')setState(tournamentPage?'Denne turneringen':'Hovedlobby');
      });
  }

  async function start(session){
    if(!session?.user)return;
    if(startedFor===session.user.id)return;
    stop(false);
    me=session.user.id;startedFor=me;
    ensureStyles();
    const host=mount();if(!host)return;
    await ensureRoles(true);
    const ok=await loadMessages();
    if(ok)await subscribe();
  }

  function stop(clear=true){
    if(channel){try{db.removeChannel(channel)}catch{}channel=null}
    startedFor=null;me=null;messages=new Map();roles.clear();
    roleCheckedAt=0;oldestAt=null;hasOlder=false;loadingOlder=false;
    resetUnread();updateOlderButton();
    if(clear){const host=document.getElementById('dartChatMessages');if(host)host.textContent='Logg inn for å bruke chatten.';setEnabled(false);setState('Ikke innlogget')}
  }

  db.auth.getSession().then(({data:{session}})=>{if(session)start(session)});
  db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>session?start(session):stop(true),0));
  window.addEventListener('pagehide',()=>stop(false));
})();
