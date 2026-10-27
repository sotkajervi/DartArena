/* DartArena social lobby: presentation, filterable online users and safe paging.
 * The existing chat, invitations, tournaments and match handlers remain owners
 * of their data. Main lobby only; tournament chats keep their own placement.
 */
(function(root){
  'use strict';
  const doc=root.document;
  const lobby=doc.getElementById('lobbyView');
  const topGrid=lobby?.querySelector(':scope > .lobby-grid');
  const players=doc.getElementById('daOnlinePlayers');
  if(!lobby||!topGrid||!players)return;

  const PAGE_SIZE=60;
  const ONLINE_MS=5*60*1000;
  const hiddenIds=new Set(['d32a4234-68fa-4c94-a0b0-2aff4831344a','049fdb78-ee46-41cb-a25f-a48d90a028e5']);
  const state={filter:'all',term:'',page:1,token:0,lastContext:null,tab:'chat',total:0};
  const esc=(value)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[char]));
  const safeSearch=(text)=>String(text||'').trim().slice(0,60).replace(/[\\%_]/g,c=>'\\'+c);
  const online=(p,now=Date.now())=>
    p.status==='in_game'||(Number.isFinite(Date.parse(p.last_seen))&&now-Date.parse(p.last_seen)<ONLINE_MS);
  const available=p=>p.status==='available'&&Number.isFinite(Date.parse(p.last_seen))&&Date.now()-Date.parse(p.last_seen)<ONLINE_MS;

  const layout=doc.createElement('section');
  layout.id='daSocialLobby';
  layout.className='da-social-lobby';
  layout.setAttribute('aria-label','Lobbychat og påloggede spillere');
  layout.dataset.tab='chat';
  const tabs=doc.createElement('div');
  tabs.className='da-social-tabs';
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Velg lobbyvisning');
  tabs.innerHTML='<button type="button" class="da-social-tab active" id="daSocialChatTab" role="tab" aria-selected="true" aria-controls="dartArenaChat" data-social-tab="chat">Chat</button>'+
    '<button type="button" class="da-social-tab" id="daSocialPlayersTab" role="tab" aria-selected="false" aria-controls="daOnlinePlayers" data-social-tab="players">Spillere</button>';
  layout.appendChild(tabs);
  topGrid.insertAdjacentElement('beforebegin',layout);
  layout.appendChild(players);
  topGrid.classList.add('da-challenge-grid');
  const challenge=doc.getElementById('challengeList')?.closest('.card');
  if(challenge)challenge.classList.add('da-incoming-challenges');

  players.setAttribute('role','tabpanel');
  players.setAttribute('aria-labelledby','daSocialPlayersTab');
  const heading=players.querySelector('.heading');
  const count=doc.createElement('span');
  count.id='daPlayerCount';
  count.className='da-player-count';
  count.setAttribute('aria-live','polite');
  count.textContent='Oppdaterer spillere…';
  heading?.insertAdjacentElement('afterend',count);

  const help=players.querySelector('p.muted.compact');
  if(help)help.textContent='Utfordre ledige spillere. Spillere i kamp eller med Unavailable kan ikke utfordres.';

  const controls=doc.createElement('div');
  controls.className='da-player-controls';
  controls.innerHTML='<label class="da-player-search-label" for="daPlayerSearch">Søk spiller</label>'+
    '<input type="search" id="daPlayerSearch" class="da-player-search" maxlength="60" autocomplete="off" placeholder="Søk blant påloggede…" aria-label="Søk etter pålogget spiller">'+
    '<div class="da-player-filters" role="group" aria-label="Filtrer spillere">'+
    '<button type="button" class="da-player-filter active" data-player-filter="all" aria-pressed="true">Alle</button>'+
    '<button type="button" class="da-player-filter" data-player-filter="available" aria-pressed="false">Available</button>'+
    '<button type="button" class="da-player-filter" data-player-filter="unavailable" aria-pressed="false">Unavailable</button>'+
    '<button type="button" class="da-player-filter" data-player-filter="in_game" aria-pressed="false">I kamp</button>'+
    '</div>';
  players.insertBefore(controls,doc.getElementById('playerList'));
  const pager=doc.createElement('div');pager.className='da-player-pager';
  const previous=doc.createElement('button');
  previous.id='daPlayerPrev';previous.type='button';previous.className='small-btn da-player-prev';previous.textContent='Forrige';previous.disabled=true;
  const pageLabel=doc.createElement('span');pageLabel.id='daPlayerPage';pageLabel.className='da-player-page';pageLabel.textContent='Side 1';
  const more=doc.createElement('button');
  more.id='daPlayerMore';more.type='button';more.className='small-btn da-player-more';more.textContent='Neste';more.hidden=true;
  pager.append(previous,pageLabel,more);
  doc.getElementById('playerList')?.insertAdjacentElement('afterend',pager);

  function setTab(name){
    state.tab=name==='players'?'players':'chat';
    layout.dataset.tab=state.tab;
    for(const button of tabs.querySelectorAll('[data-social-tab]')){
      const active=button.dataset.socialTab===state.tab;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
      button.tabIndex=active?0:-1;
    }
  }
  tabs.addEventListener('click',e=>{const button=e.target.closest('[data-social-tab]');if(button)setTab(button.dataset.socialTab)});
  tabs.addEventListener('keydown',e=>{
    if(!['ArrowRight','ArrowLeft'].includes(e.key))return;
    e.preventDefault();
    setTab(state.tab==='chat'?'players':'chat');
    doc.getElementById(state.tab==='chat'?'daSocialChatTab':'daSocialPlayersTab')?.focus();
  });

  function placeChat(){
    const chat=doc.getElementById('dartArenaChat');
    if(!chat||!lobby.contains(chat))return false;
    if(chat.parentElement!==layout)layout.insertBefore(chat,players);
    chat.setAttribute('role','tabpanel');
    chat.setAttribute('aria-labelledby','daSocialChatTab');
    if(!doc.querySelector('link[data-dartarena-social-css]')){
      const style=doc.createElement('link');
      style.rel='stylesheet';style.href='lobby-social.css?v=20261027-social1';
      style.dataset.dartarenaSocialCss='1';
      doc.head.appendChild(style);
    }
    return true;
  }
  if(!placeChat()){
    const observer=new MutationObserver(()=>{
      if(placeChat())observer.disconnect();
    });
    observer.observe(lobby,{childList:true,subtree:true});
    root.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
  }
  // Social panels have no minimum required message count. Empty chat remains
  // a usable, full-sized room instead of collapsing to a 108px widget.

  function setFilter(filter){
    if(!['all','available','unavailable','in_game'].includes(filter))return;
    state.filter=filter;state.page=1;
    for(const button of controls.querySelectorAll('[data-player-filter]')){
      const active=button.dataset.playerFilter===filter;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    }
    refreshCurrent();
  }
  controls.addEventListener('click',e=>{
    const button=e.target.closest('[data-player-filter]');
    if(button)setFilter(button.dataset.playerFilter);
  });
  let debounce=null;
  const search=doc.getElementById('daPlayerSearch');
  search?.addEventListener('input',()=>{
    root.clearTimeout(debounce);
    debounce=root.setTimeout(()=>{
      state.term=search.value.trim().slice(0,60);state.page=1;refreshCurrent();
    },280);
  });

  function refreshCurrent(){
    if(state.lastContext)refreshPlayers(state.lastContext);
  }
  more.onclick=()=>{state.page++;refreshCurrent()};
  previous.onclick=()=>{if(state.page>1){state.page--;refreshCurrent()}};

  async function refreshPlayers(context){
    if(!context?.db||!context?.profileId)return;
    state.lastContext=context;
    const token=++state.token;
    const target=doc.getElementById('playerList');
    if(!target)return;
    const now=Date.now();
    const since=new Date(now-ONLINE_MS).toISOString();
    let query=context.db.from('profiles')
      .select('id,username,status,last_seen',{count:'exact'})
      .neq('id',context.profileId)
      .or('status.eq.in_game,last_seen.gte.'+since);
    if(state.filter!=='all')query=query.eq('status',state.filter);
    if(state.term)query=query.ilike('username','%'+safeSearch(state.term)+'%');
    const from=PAGE_SIZE*(state.page-1),last=from+PAGE_SIZE-1;
    const {data,error,count}=await query.order('status',{ascending:true})
      .order('username',{ascending:true}).range(from,last);
    if(token!==state.token||context.profileId!==state.lastContext?.profileId)return;
    const countEl=doc.getElementById('daPlayerCount');
    const list=Array.isArray(data)?data.filter(p=>!hiddenIds.has(p.id)&&online(p,now)):[];
    if(error){
      target.innerHTML='<p class="muted">Kunne ikke hente spillerlisten. Trykk Oppdater og prøv igjen.</p>';
      if(countEl)countEl.textContent='Tilkoblingsproblem';
      more.hidden=true;
      console.warn('Online players unavailable',error);
      return;
    }
    state.total=Number.isInteger(count)?count:list.length;
    const label={all:'påloggede',available:'ledige',unavailable:'utilgjengelige',in_game:'i kamp'}[state.filter];
    if(countEl)countEl.textContent=state.total+' '+label;
    const escapeName=context.esc||esc;
    target.innerHTML=list.length?list.map(p=>{
      const inGame=p.status==='in_game';
      const can=!context.activeMatch&&available(p);
      const rawStatus=inGame?'I kamp':p.status==='available'?'Available':'Unavailable';
      const action=can?'Utfordre':inGame?'I kamp':'Ikke ledig';
      return '<div class="player-row da-social-player" data-player-status="'+esc(p.status)+'">'+
        '<div class="player-main"><div class="avatar">'+escapeName((p.username||'?').slice(0,1).toUpperCase())+'</div>'+
        '<div><a class="player-name da-player-profile-link" href="player.html?id='+encodeURIComponent(p.id)+'" target="_blank" rel="noopener" title="Se spillerprofil">'+escapeName(p.username||'Spiller')+'</a>'+
        '<div class="status"><span class="dot '+esc(p.status)+'"></span>'+rawStatus+'</div></div></div>'+
        '<button type="button" class="small-btn challenge-btn" data-id="'+esc(p.id)+'" '+(can?'':'disabled')+'>'+action+'</button></div>';
    }).join(''):'<p class="muted">Ingen spillere passer dette søket eller filteret.</p>';
    target.querySelectorAll('.challenge-btn:not([disabled])').forEach(button=>
      button.addEventListener('click',()=>{
        const latest=typeof root.sendInvite==='function'?root.sendInvite:context.sendInvite;
        if(typeof latest==='function')latest(button);
      }));
    previous.disabled=state.page<=1;
    pageLabel.textContent='Side '+state.page+' av '+Math.max(1,Math.ceil(state.total/PAGE_SIZE));
    more.hidden=!(Number.isInteger(count)&&count>PAGE_SIZE*state.page);
    if(!more.hidden)more.textContent='Neste';
  }
  root.addEventListener('dartarena:lobby-left',()=>{
    ++state.token;state.lastContext=null;state.page=1;state.term='';state.filter='all';
    if(search)search.value='';
    const list=doc.getElementById('playerList');if(list)list.innerHTML='';
    more.hidden=true;previous.disabled=true;pageLabel.textContent='Side 1';
  });
  root.DartArenaSocialLobby=Object.freeze({
    refreshPlayers,setFilter,setTab,
    getState:()=>({filter:state.filter,term:state.term,page:state.page,tab:state.tab})
  });
})(window);
