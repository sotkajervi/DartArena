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
  let messages=new Map();
  const names={};

  function ensureStyles(){
    if(document.querySelector('link[data-dartarena-chat-style]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='lobby-chat.css?v=20260927-layout2';
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
      <div id="dartChatMessages" class="dart-chat-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
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
    return section;
  }

  function setState(text){const el=document.getElementById('dartChatState');if(el)el.textContent=text}
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

  function renderMessage(row){
    if(!messageBelongs(row)||messages.has(row.id))return;
    const host=document.getElementById('dartChatMessages');if(!host)return;
    const stick=nearBottom(host);
    messages.set(row.id,row);

    const item=document.createElement('div');
    item.className='dart-chat-message'+(row.sender_id===me?' own':'');
    item.dataset.messageId=row.id;

    const meta=document.createElement('div');meta.className='dart-chat-meta';
    const sender=document.createElement('strong');sender.textContent=names[row.sender_id]||'Spiller';
    const time=document.createElement('span');time.textContent=formatTime(row.created_at);
    meta.append(sender,time);

    const body=document.createElement('div');body.className='dart-chat-body';body.textContent=row.body||'';
    item.append(meta,body);host.appendChild(item);
    if(stick)host.scrollTop=host.scrollHeight;
  }

  async function loadMessages(){
    const host=document.getElementById('dartChatMessages');if(!host)return false;
    setState('Laster…');setEnabled(false);
    let query=db.from('lobby_messages')
      .select('id,room_id,tournament_id,sender_id,body,created_at')
      .eq('room_id',roomId)
      .order('created_at',{ascending:false})
      .limit(50);
    const {data,error}=await query;
    if(error){
      const missing=/lobby_messages|does not exist|relation/i.test(String(error.message||''));
      setState(missing?'Ikke aktivert':'Kunne ikke laste');
      host.innerHTML=`<p class="muted">${missing?'Chatten blir tilgjengelig når databaseoppdateringen er kjørt.':'Kunne ikke laste chatten akkurat nå.'}</p>`;
      setEnabled(false);
      return false;
    }

    const rows=[...(data||[])].reverse();
    await ensureNames(rows.map(x=>x.sender_id));
    messages=new Map();host.innerHTML='';
    if(!rows.length)host.innerHTML='<p class="muted dart-chat-empty">Ingen meldinger ennå.</p>';
    rows.forEach(renderMessage);
    host.scrollTop=host.scrollHeight;
    setState(tournamentPage?'Denne turneringen':'Hovedlobby');
    setEnabled(true);
    return true;
  }

  function removeEmptyState(){document.querySelector('#dartChatMessages .dart-chat-empty')?.remove()}

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
      removeEmptyState();
      await ensureNames([data.sender_id]);
      renderMessage(data);
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
        await ensureNames([row.sender_id]);removeEmptyState();renderMessage(row);
      })
      .subscribe(status=>{
        if(status==='SUBSCRIBED'&&document.getElementById('dartChatState')?.textContent==='Kobler til…')setState(tournamentPage?'Denne turneringen':'Hovedlobby');
      });
  }

  async function start(session){
    if(!session?.user)return;
    if(startedFor===session.user.id)return;
    stop(false);
    me=session.user.id;startedFor=me;
    ensureStyles();
    const host=mount();if(!host)return;
    const ok=await loadMessages();
    if(ok)await subscribe();
  }

  function stop(clear=true){
    if(channel){try{db.removeChannel(channel)}catch{}channel=null}
    startedFor=null;me=null;messages=new Map();
    if(clear){const host=document.getElementById('dartChatMessages');if(host)host.innerHTML='<p class="muted">Logg inn for å bruke chatten.</p>';setEnabled(false);setState('Ikke innlogget')}
  }

  db.auth.getSession().then(({data:{session}})=>{if(session)start(session)});
  db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>session?start(session):stop(true),0));
  window.addEventListener('pagehide',()=>stop(false));
})();
