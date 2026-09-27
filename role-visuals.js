(()=>{
  if(!window.supabase||window.__dartArenaRoleVisuals)return;
  window.__dartArenaRoleVisuals=true;

  const SUPABASE_URL='https://jqpxlbhwvskhjbqrbidk.supabase.co';
  const SUPABASE_KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const ADMIN='#ff9f43';
  const LEADER='#4da3ff';
  let roleMap=new Map();
  let observer=null;
  let scanTimer=null;

  function ensureTheme(){
    if(!document.querySelector('link[data-dartarena-global-bg]')&&!document.querySelector('link[href*="dartboard-background.css"]')){
      const link=document.createElement('link');
      link.rel='stylesheet';
      link.href='dartboard-background.css?v=20260928-global1';
      link.dataset.dartarenaGlobalBg='1';
      document.head.appendChild(link);
    }
    if(document.getElementById('dartarena-role-visuals-style'))return;
    const style=document.createElement('style');
    style.id='dartarena-role-visuals-style';
    style.textContent=`
      .da-role-name{font-weight:850}
      .da-role-admin-name,.role-admin{color:${ADMIN}!important}
      .da-role-leader-name,.role-leader,.role-leader-label{color:${LEADER}!important}
      .admin-badge{color:${ADMIN}!important;border-color:rgba(255,159,67,.5)!important;background:rgba(255,159,67,.1)!important}
    `;
    document.head.appendChild(style);
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
  function scan(root=document.body){
    if(!root||!roleMap.size)return;
    if(root.nodeType===Node.TEXT_NODE){decorateText(root);return}
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];let n;
    while((n=walker.nextNode()))nodes.push(n);
    nodes.forEach(decorateText);
  }
  function scheduleScan(root=document.body){
    clearTimeout(scanTimer);
    scanTimer=setTimeout(()=>scan(root),50);
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
      const {data:t}=await db.from('tournaments').select('owner_id').eq('id',tournamentId).maybeSingle();
      if(t?.owner_id){
        const {data:p}=await db.from('profiles').select('username').eq('id',t.owner_id).maybeSingle();
        if(p?.username&&!roleMap.has(p.username))roleMap.set(p.username,'leader');
      }
    }
  }

  async function boot(){
    ensureTheme();
    await loadRoles();
    scan();
    observer=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node.nodeType===Node.TEXT_NODE)decorateText(node);
          else if(node.nodeType===Node.ELEMENT_NODE)scheduleScan(node);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  boot().catch(e=>console.warn('Role visuals init failed',e));
  window.addEventListener('pagehide',()=>{observer?.disconnect();clearTimeout(scanTimer)});
})();
