(()=>{
  if(!window.supabase||window.__dartArenaRoleVisuals)return;
  window.__dartArenaRoleVisuals=true;

  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const BUILD='20260929-tournamentbadge1';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const ADMIN='#ff9f43';
  const LEADER='#4da3ff';
  let roleMap=new Map();
  let observer=null;
  let scanTimer=null;
  window.DARTARENA_BUILD=BUILD;

  function ensureSharedUi(){
    let buttonTheme=document.querySelector('link[href*="button-theme.css"]');
    if(!buttonTheme){
      buttonTheme=document.createElement('link');
      buttonTheme.rel='stylesheet';
      document.head.appendChild(buttonTheme);
    }
    const buttonHref=`button-theme.css?v=${BUILD}`;
    if(!buttonTheme.href.endsWith(buttonHref))buttonTheme.href=buttonHref;

    let bg=document.querySelector('link[data-dartarena-global-bg],link[href*="dartboard-background.css"]');
    if(!bg){
      bg=document.createElement('link');
      bg.rel='stylesheet';
      bg.dataset.dartarenaGlobalBg='1';
      document.head.appendChild(bg);
    }
    const bgHref=`dartboard-background.css?v=${BUILD}`;
    if(!bg.href.endsWith(bgHref))bg.href=bgHref;

    if(!document.querySelector('script[data-dartarena-ui-feedback]')){
      const script=document.createElement('script');
      script.src=`ui-feedback.js?v=${BUILD}`;
      script.dataset.dartarenaUiFeedback='1';
      document.head.appendChild(script);
    }
  }

  function ensureTheme(){
    ensureSharedUi();
    if(document.getElementById('dartarena-role-visuals-style'))return;
    const style=document.createElement('style');
    style.id='dartarena-role-visuals-style';
    style.textContent=`
      .da-role-name{font-weight:850}
      .da-role-admin-name{color:${ADMIN}!important}
      .da-role-leader-name,.role-leader,.role-leader-label{color:${LEADER}!important}
      .admin-badge{color:${ADMIN}!important;border-color:rgba(255,159,67,.5)!important;background:rgba(255,159,67,.1)!important}
      .form-stats-badge{display:inline-flex;align-items:center;padding:3px 7px;border:1px solid rgba(35,226,209,.45);border-radius:999px;background:rgba(35,226,209,.08);color:var(--cyan);font-size:10px;font-weight:950;line-height:1;letter-spacing:.055em;text-transform:uppercase;white-space:nowrap}
      .form-stats-badge.off{border-color:rgba(142,159,163,.32);background:rgba(142,159,163,.07);color:#8e9fa3}
    `;
    document.head.appendChild(style);
  }

  function ensureLobbyNavButtons(){
    if(!document.getElementById('lobbyView'))return;
    const actions=document.querySelector('#lobbyView .lobby-top .top-actions');
    if(!actions)return;
    const add=(id,label,href)=>{
      if(document.getElementById(id))return;
      const button=document.createElement('button');
      button.id=id;
      button.className='outline';
      button.type='button';
      button.textContent=label;
      button.onclick=()=>location.href=href;
      actions.prepend(button);
    };
    add('matchHistoryBtn','Kamphistorikk','match-history.html');
    add('formStatsBtn','Form stats','form-stats.html');
  }

  function showTournamentFormStatsBadge(enabled){
    const participantList=document.getElementById('participantList');
    const heading=participantList?.closest('.card')?.querySelector('.heading');
    if(!heading)return;
    let badge=document.getElementById('tournamentFormStatsBadge');
    if(!badge){
      badge=document.createElement('span');
      badge.id='tournamentFormStatsBadge';
      heading.appendChild(badge);
    }
    const on=enabled!==false;
    badge.className=`form-stats-badge${on?'':' off'}`;
    badge.textContent=on?'FORM STATS':'FORM STATS AV';
    badge.title=on?'501-kamper teller i Form stats':'Denne turneringen teller ikke i Form stats';
  }

  function escRegex(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
  function shouldSkip(parent){
    return !parent||!!parent.closest('script,style,noscript,textarea,input,select,option,kbd,.da-role-name,[contenteditable="true"]');
  }
  function decorateText(node){
    if(!node?.nodeValue||!roleMap.size||shouldSkip(node.parentElement))return;
    const text=node.nodeValue;
    const names=[...roleMap.keys()].filter(Boolean).sort((a,b)=>b.length-a.length);
    if(!names.some(n=>text.includes(n)))return;
    const re=new RegExp(`(${names.map(escRegex).join('|')})`,'g');
    const parts=text.split(re);
    if(parts.length<2)return;
    const frag=document.createDocumentFragment();
    for(const part of parts){
      const role=roleMap.get(part);
      if(!role){frag.appendChild(document.createTextNode(part));continue}
      const span=document.createElement('span');
      span.className=`da-role-name ${role==='admin'?'da-role-admin-name':'da-role-leader-name'}`;
      span.textContent=part;
      span.title=role==='admin'?'Admin':'Turneringsleder';
      frag.appendChild(span);
    }
    node.replaceWith(frag);
  }
  function markTournamentLeaderLabels(){
    if(!document.getElementById('tName'))return;
    document.querySelectorAll('#participantList .player-name.role-admin').forEach(name=>{
      name.classList.remove('role-admin');
      name.classList.add('role-leader');
      const status=name.parentElement?.querySelector('.status');
      if(status?.textContent.includes('Turneringsleder'))status.classList.add('role-leader-label');
    });
  }
  function scan(root=document.body){
    if(!root)return;
    markTournamentLeaderLabels();
    if(!roleMap.size)return;
    if(root.nodeType===Node.TEXT_NODE){decorateText(root);return}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];let n;
    while((n=walker.nextNode()))nodes.push(n);
    nodes.forEach(decorateText);
  }
  function scheduleScan(){
    clearTimeout(scanTimer);
    scanTimer=setTimeout(()=>scan(document.body),50);
  }

  async function loadRoles(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    const {data:roles,error}=await db.rpc('get_public_user_roles');
    if(error){console.warn('Role visuals: role lookup failed',error);return}
    const admins=(roles||[]).filter(r=>r.role==='admin').map(r=>r.user_id);
    if(admins.length){
      const {data:profiles}=await db.from('profiles').select('id,username').in('id',admins);
      (profiles||[]).forEach(p=>{if(p.username)roleMap.set(p.username,'admin')});
    }

    const params=new URLSearchParams(location.search);
    const tournamentId=params.get('id');
    if(tournamentId&&location.pathname.toLowerCase().includes('tournament')){
      const {data:t}=await db.from('tournaments').select('owner_id,stats_enabled').eq('id',tournamentId).maybeSingle();
      if(t){
        showTournamentFormStatsBadge(t.stats_enabled);
      }
      if(t?.owner_id){
        const {data:p}=await db.from('profiles').select('username').eq('id',t.owner_id).maybeSingle();
        if(p?.username&&!roleMap.has(p.username))roleMap.set(p.username,'leader');
      }
    }
  }

  async function boot(){
    ensureTheme();
    ensureLobbyNavButtons();
    await loadRoles();
    scan();
    observer=new MutationObserver(()=>scheduleScan());
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }

  boot().catch(e=>console.warn('Role visuals init failed',e));
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(scanTimer)});
})();
