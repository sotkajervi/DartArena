(()=>{
  if(!window.supabase||window.__dartArenaRoleVisuals)return;
  window.__dartArenaRoleVisuals=true;

  const ROLE_PENDING_CLASS='da-role-visuals-pending';
  document.documentElement.classList.add(ROLE_PENDING_CLASS);

  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const BUILD='20261001-ownercolor1';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const OWNER='#23e2d1';
  const ADMIN='#ff9f43';
  const LEADER='#4da3ff';
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
      .da-role-name{font-weight:850}
      .da-role-owner-name,.da-role-owner-static{color:${OWNER}!important}
      .da-role-admin-name,.da-role-admin-static{color:${ADMIN}!important}
      .da-role-leader-name,.da-role-leader-static,.role-leader,.role-leader-label{color:${LEADER}!important}
      .admin-badge{color:${ADMIN}!important;border-color:rgba(255,159,67,.5)!important;background:rgba(255,159,67,.1)!important}
      .owner-badge{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border:1px solid rgba(35,226,209,.55);border-radius:999px;background:rgba(35,226,209,.1);color:${OWNER};font-size:10px;font-weight:950;letter-spacing:.1em;vertical-align:middle}
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
    const on=enabled!==false;badge.className=`form-stats-badge${on?'':' off'}`;badge.textContent=on?'FORM STATS':'FORM STATS AV';badge.title=on?'501-kamper teller i Form stats':'Denne turneringen teller ikke i Form stats';
  }

  const STATIC_MATCH_NAME_SELECTOR='.match-page .video-name,.match-page .match-name,.match-page .cricket-player-name,.match-page .half-player-name,.match-page .sixty-one-player-name';
  function roleForText(text){
    const clean=String(text||'').trim();
    if(roleMap.has(clean))return roleMap.get(clean);
    for(const [name,role] of roleMap){if(clean===name||clean.includes(name))return role}
    return null;
  }
  function markStaticMatchNames(root=document){
    if(!roleMap.size)return;
    const nodes=[];
    if(root?.matches?.(STATIC_MATCH_NAME_SELECTOR))nodes.push(root);
    root?.querySelectorAll?.(STATIC_MATCH_NAME_SELECTOR).forEach(el=>nodes.push(el));
    for(const el of nodes){
      const role=roleForText(el.textContent);
      el.classList.toggle('da-role-owner-static',role==='owner');
      el.classList.toggle('da-role-admin-static',role==='admin');
      el.classList.toggle('da-role-leader-static',role==='leader');
    }
  }

  function escRegex(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function shouldSkip(parent){
    return !parent||!!parent.closest(`script,style,noscript,textarea,input,select,option,kbd,.da-role-name,[contenteditable="true"],${STATIC_MATCH_NAME_SELECTOR}`);
  }
  function decorateText(node){
    if(!node?.nodeValue||!roleMap.size||shouldSkip(node.parentElement))return;
    const text=node.nodeValue;
    const names=[...roleMap.keys()].filter(Boolean).sort((a,b)=>b.length-a.length);
    if(!names.some(n=>text.includes(n)))return;
    const re=new RegExp(`(${names.map(escRegex).join('|')})`,'g');
    const parts=text.split(re);if(parts.length<2)return;
    const frag=document.createDocumentFragment();
    for(const part of parts){
      const role=roleMap.get(part);
      if(!role){frag.appendChild(document.createTextNode(part));continue}
      const span=document.createElement('span');
      span.className=`da-role-name ${role==='owner'?'da-role-owner-name':role==='admin'?'da-role-admin-name':'da-role-leader-name'}`;
      span.textContent=part;
      span.title=role==='owner'?'Owner':role==='admin'?'Admin':'Turneringsleder';
      frag.appendChild(span)
    }
    node.replaceWith(frag);
  }
  function markTournamentLeaderLabels(){
    if(!document.getElementById('tName'))return;
    document.querySelectorAll('#participantList .player-name.role-admin').forEach(name=>{
      name.classList.remove('role-admin');name.classList.add('role-leader');
      const status=name.parentElement?.querySelector('.status');if(status?.textContent.includes('Turneringsleder'))status.classList.add('role-leader-label')
    });
  }
  function scan(root=document.body){
    if(!root)return;
    markTournamentLeaderLabels();
    markStaticMatchNames(root);
    if(!roleMap.size)return;
    if(root.nodeType===Node.TEXT_NODE){decorateText(root);return}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];let n;while((n=walker.nextNode()))nodes.push(n);nodes.forEach(decorateText);
  }
  function syncWelcomeName(){
    if(!rolesLoaded)return false;
    const title=document.getElementById('welcomeName');if(!title)return false;
    const text=title.textContent.trim();if(!text||text==='Lobby')return false;
    scan(title);
    title.querySelector('.admin-badge,.owner-badge')?.remove();
    const current=[...roleMap.entries()].find(([name])=>title.textContent.includes(name));
    if(current){
      const [,role]=current;
      if(role==='owner'||role==='admin'){
        const badge=document.createElement('span');
        badge.className=role==='owner'?'owner-badge':'admin-badge';
        badge.textContent=role==='owner'?'OWNER':'ADMIN';
        title.appendChild(badge)
      }
    }
    document.documentElement.classList.remove(ROLE_PENDING_CLASS);return true;
  }
  function scheduleScan(){clearTimeout(scanTimer);scanTimer=setTimeout(()=>scan(document.body),50)}

  async function loadRoles(){
    const {data:{session}}=await db.auth.getSession();if(!session?.user)return;
    const {data:roles,error}=await db.rpc('get_public_user_roles');if(error){console.warn('Role visuals: role lookup failed',error);return}
    const privileged=(roles||[]).filter(r=>r.role==='owner'||r.role==='admin');
    const ids=privileged.map(r=>r.user_id);
    if(ids.length){
      const {data:profiles}=await db.from('profiles').select('id,username').in('id',ids);
      const roleById=new Map(privileged.map(r=>[r.user_id,r.role]));
      (profiles||[]).forEach(p=>{if(p.username)roleMap.set(p.username,roleById.get(p.id)||'admin')})
    }
    const params=new URLSearchParams(location.search);const tournamentId=params.get('id');
    if(tournamentId&&location.pathname.toLowerCase().includes('tournament')){
      const {data:t}=await db.from('tournaments').select('owner_id,stats_enabled').eq('id',tournamentId).maybeSingle();if(t)showTournamentFormStatsBadge(t.stats_enabled);
      if(t?.owner_id){const {data:p}=await db.from('profiles').select('username').eq('id',t.owner_id).maybeSingle();if(p?.username&&!roleMap.has(p.username))roleMap.set(p.username,'leader')}
    }
  }

  async function boot(){
    ensureTheme();ensureLobbyNavButtons();ensureSoloHalfItCards();await loadRoles();rolesLoaded=true;scan();syncWelcomeName();
    observer=new MutationObserver(mutations=>{
      const title=document.getElementById('welcomeName');
      const welcomeChanged=!!title&&mutations.some(m=>m.target===title||title.contains(m.target));
      if(welcomeChanged)syncWelcomeName();
      ensureSoloHalfItCards();scheduleScan();
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  boot().catch(e=>{document.documentElement.classList.remove(ROLE_PENDING_CLASS);console.warn('Role visuals init failed',e)});
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(scanTimer)});
})();
