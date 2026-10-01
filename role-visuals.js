(()=>{
  if(!window.supabase||window.__dartArenaRoleVisuals)return;
  window.__dartArenaRoleVisuals=true;

  const ROLE_PENDING_CLASS='da-role-visuals-pending';
  document.documentElement.classList.add(ROLE_PENDING_CLASS);

  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const BUILD='20261001-ownercolor2';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const OWNER='#23e2d1';
  const ADMIN='#ff9f43';
  const LEADER='#4da3ff';
  const NAME_SELECTOR='.player-name,.video-name,.match-name,.cricket-player-name,.half-player-name,.sixty-one-player-name,.spectate-name,.spectator-name,.history-player,.results-player,.highlight-name,.jdc-online-player span';
  let roleMap=new Map();
  let observer=null;
  let scanTimer=null;
  let rolesLoaded=false;
  window.DARTARENA_BUILD=BUILD;

  function ensureSharedUi(){
    let buttonTheme=document.querySelector('link[href*="button-theme.css"]');
    if(!buttonTheme){buttonTheme=document.createElement('link');buttonTheme.rel='stylesheet';document.head.appendChild(buttonTheme)}
    const buttonHref=`button-theme.css?v=${BUILD}`;
    if(!buttonTheme.href.endsWith(buttonHref))buttonTheme.href=buttonHref;

    let bg=document.querySelector('link[data-dartarena-global-bg],link[href*="dartboard-background.css"]');
    if(!bg){bg=document.createElement('link');bg.rel='stylesheet';bg.dataset.dartarenaGlobalBg='1';document.head.appendChild(bg)}
    const bgHref=`dartboard-background.css?v=${BUILD}`;
    if(!bg.href.endsWith(bgHref))bg.href=bgHref;

    if(!document.querySelector('script[data-dartarena-ui-feedback]')){
      const script=document.createElement('script');script.src=`ui-feedback.js?v=${BUILD}`;script.dataset.dartarenaUiFeedback='1';document.head.appendChild(script)
    }
  }

  function ensureTheme(){
    ensureSharedUi();
    if(document.getElementById('dartarena-role-visuals-style'))return;
    const style=document.createElement('style');
    style.id='dartarena-role-visuals-style';
    style.textContent=`
      html.${ROLE_PENDING_CLASS} #welcomeName{visibility:hidden}
      .da-role-owner{color:${OWNER}!important;font-weight:850}
      .da-role-admin{color:${ADMIN}!important;font-weight:850}
      .da-role-leader,.role-leader,.role-leader-label{color:${LEADER}!important;font-weight:850}
      .admin-badge,.owner-badge{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:950;letter-spacing:.1em;vertical-align:middle}
      .admin-badge{color:${ADMIN}!important;border:1px solid rgba(255,159,67,.5)!important;background:rgba(255,159,67,.1)!important}
      .owner-badge{color:${OWNER}!important;border:1px solid rgba(35,226,209,.55)!important;background:rgba(35,226,209,.1)!important}
      .form-stats-badge{display:inline-flex;align-items:center;padding:3px 7px;border:1px solid rgba(35,226,209,.45);border-radius:999px;background:rgba(35,226,209,.08);color:var(--cyan);font-size:10px;font-weight:950;line-height:1;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap}
      .form-stats-badge.off{border-color:rgba(142,159,163,.32);background:rgba(142,159,163,.07);color:#8e9fa3}
    `;
    document.head.appendChild(style);
  }

  function ensureLobbyNavButtons(){
    if(!document.getElementById('lobbyView'))return;
    const actions=document.querySelector('#lobbyView .lobby-top .top-actions');
    const host=document.getElementById('lobbyStatsActions')||actions;
    if(!host)return;
    const add=(id,label,href)=>{
      let button=document.getElementById(id);
      if(!button){button=document.createElement('button');button.id=id;button.type='button';button.textContent=label;button.onclick=()=>location.href=href}
      button.className=host.id==='lobbyStatsActions'?'small-btn lobby-utility-btn':'outline';
      if(button.parentElement!==host)host.appendChild(button)
    };
    add('formStatsBtn','Form stats','form-stats.html');
    add('matchHistoryBtn','Kamphistorikk','match-history.html');
  }

  function ensureSoloHalfItCards(){
    const grid=document.querySelector('#lobbyView .training-games-grid');
    if(!grid)return;
    const insert=(id,title,description,mode)=>{
      if(document.getElementById(id))return;
      const card=document.createElement('article');card.className='training-game-card';card.id=id;
      card.innerHTML=`<div class="training-game-main"><div class="training-icon">½</div><div><h3>${title}</h3><p>${description}</p></div></div><button class="primary" type="button">Spill Half-It</button>`;
      card.querySelector('button').onclick=()=>window.open(`half-it-solo.html?mode=${mode}`,`dartarena-training-half-it-${mode}`);
      const disabled=grid.querySelector('.training-game-card.is-disabled');grid.insertBefore(card,disabled||null)
    };
    insert('soloHalfItDartCounterCard','Half-It (DartCounter)','12 runder med farger, eksakt-score og tre valg på eksakt-runden.','dartcounter');
    insert('soloHalfItStandardCard','Half-It (Standard)','13, 14, Dobbel, 15, 16, Trippel, 17, 18, 41, 19, 20 og Bull.','standard');
  }

  function showTournamentFormStatsBadge(enabled){
    const participantList=document.getElementById('participantList');
    const heading=participantList?.closest('.card')?.querySelector('.heading');
    if(!heading)return;
    let badge=document.getElementById('tournamentFormStatsBadge');
    if(!badge){badge=document.createElement('span');badge.id='tournamentFormStatsBadge';heading.appendChild(badge)}
    const on=enabled!==false;
    const wantedClass=`form-stats-badge${on?'':' off'}`;
    const wantedText=on?'FORM STATS':'FORM STATS AV';
    if(badge.className!==wantedClass)badge.className=wantedClass;
    if(badge.textContent!==wantedText)badge.textContent=wantedText;
    badge.title=on?'501-kamper teller i Form stats':'Denne turneringen teller ikke i Form stats';
  }

  function roleForText(text){
    const clean=String(text||'').trim();
    if(roleMap.has(clean))return roleMap.get(clean);
    for(const [name,role] of roleMap){if(clean===name||clean.includes(name))return role}
    return null;
  }

  function applyRoleClass(el){
    if(!el)return;
    const role=roleForText(el.textContent);
    el.classList.toggle('da-role-owner',role==='owner');
    el.classList.toggle('da-role-admin',role==='admin');
    el.classList.toggle('da-role-leader',role==='leader');
  }

  function markTournamentLeaderLabels(){
    if(!document.getElementById('tName'))return;
    document.querySelectorAll('#participantList .player-name').forEach(name=>{
      const status=name.parentElement?.querySelector('.status');
      if(status?.textContent.includes('Turneringsleder')){
        name.classList.add('da-role-leader');
        status.classList.add('role-leader-label');
      }
    });
  }

  function syncWelcomeName(){
    if(!rolesLoaded)return false;
    const title=document.getElementById('welcomeName');
    if(!title)return false;
    const plain=title.childNodes.length?Array.from(title.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.nodeValue).join(' ').trim():title.textContent.trim();
    if(!plain||plain==='Lobby')return false;
    const role=roleForText(title.textContent);
    title.classList.toggle('da-role-owner',role==='owner');
    title.classList.toggle('da-role-admin',role==='admin');
    title.classList.toggle('da-role-leader',role==='leader');

    let badge=title.querySelector('.admin-badge,.owner-badge');
    if(role==='owner'||role==='admin'){
      const wantedClass=role==='owner'?'owner-badge':'admin-badge';
      const wantedText=role==='owner'?'OWNER':'ADMIN';
      if(!badge){badge=document.createElement('span');title.appendChild(badge)}
      if(badge.className!==wantedClass)badge.className=wantedClass;
      if(badge.textContent!==wantedText)badge.textContent=wantedText;
      badge.title=role==='owner'?'DartArena Owner':'DartArena Admin';
    }else if(badge){
      badge.remove();
    }
    document.documentElement.classList.remove(ROLE_PENDING_CLASS);
    return true;
  }

  function scan(root=document){
    markTournamentLeaderLabels();
    const nodes=[];
    if(root?.matches?.(NAME_SELECTOR))nodes.push(root);
    root?.querySelectorAll?.(NAME_SELECTOR).forEach(el=>nodes.push(el));
    nodes.forEach(applyRoleClass);
    syncWelcomeName();
  }

  function scheduleScan(){
    clearTimeout(scanTimer);
    scanTimer=setTimeout(()=>scan(document),60);
  }

  async function loadRoles(){
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
    const {data:roles,error}=await db.rpc('get_public_user_roles');if(error){console.warn('Role visuals: role lookup failed',error);return}
    const privileged=(roles||[]).filter(r=>['owner','admin'].includes(r.role));
    const ids=privileged.map(r=>r.user_id);
    if(ids.length){
      const {data:profiles}=await db.from('profiles').select('id,username').in('id',ids);
      const roleById=new Map(privileged.map(r=>[r.user_id,r.role]));
      (profiles||[]).forEach(p=>{if(p.username)roleMap.set(p.username,roleById.get(p.id)||'admin')})
    }
    const params=new URLSearchParams(location.search);const tournamentId=params.get('id');
    if(tournamentId&&location.pathname.toLowerCase().includes('tournament')){
      const {data:t}=await db.from('tournaments').select('owner_id,stats_enabled').eq('id',tournamentId).maybeSingle();
      if(t)showTournamentFormStatsBadge(t.stats_enabled);
      if(t?.owner_id){
        const {data:p}=await db.from('profiles').select('username').eq('id',t.owner_id).maybeSingle();
        if(p?.username&&!roleMap.has(p.username))roleMap.set(p.username,'leader');
      }
    }
  }

  async function boot(){
    ensureTheme();
    ensureLobbyNavButtons();
    ensureSoloHalfItCards();
    await loadRoles();
    rolesLoaded=true;
    scan(document);
    document.documentElement.classList.remove(ROLE_PENDING_CLASS);

    observer=new MutationObserver(mutations=>{
      if(!mutations.some(m=>m.addedNodes.length||m.removedNodes.length||m.type==='characterData'))return;
      ensureSoloHalfItCards();
      scheduleScan();
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  boot().catch(e=>{document.documentElement.classList.remove(ROLE_PENDING_CLASS);console.warn('Role visuals init failed',e)});
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(scanTimer)});
})();
