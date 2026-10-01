(()=>{
  if(!window.supabase||window.__dartArenaRoleVisuals)return;
  window.__dartArenaRoleVisuals=true;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  const OWNER='#23e2d1',ADMIN='#ff9f43',LEADER='#4da3ff';
  const roleByName=new Map();
  const NAME_SELECTOR='.player-name,.video-name,.match-name,.cricket-player-name,.half-player-name,.sixty-one-player-name,.spectate-name,.spectator-name,.history-player,.results-player,.highlight-name,.jdc-online-player span';

  function revealWelcome(){
    const title=document.getElementById('welcomeName');
    if(title)title.style.visibility='visible';
    document.documentElement.classList.remove('da-role-pending');
  }

  function ensureStyles(){
    if(document.getElementById('dartarena-role-visuals-style'))return;
    const style=document.createElement('style');
    style.id='dartarena-role-visuals-style';
    style.textContent=`
      .da-role-owner{color:${OWNER}!important;font-weight:850}
      .da-role-admin{color:${ADMIN}!important;font-weight:850}
      .da-role-leader,.role-leader,.role-leader-label{color:${LEADER}!important;font-weight:850}
      .admin-badge,.owner-badge{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:950;letter-spacing:.1em;vertical-align:middle}
      .admin-badge{color:${ADMIN}!important;border:1px solid rgba(255,159,67,.5)!important;background:rgba(255,159,67,.1)!important}
      .owner-badge{color:${OWNER}!important;border:1px solid rgba(35,226,209,.55)!important;background:rgba(35,226,209,.1)!important}
    `;
    document.head.appendChild(style);
  }

  function ensureLobbyNavButtons(){
    const host=document.getElementById('lobbyStatsActions');
    if(!host)return;
    const add=(id,label,href)=>{
      let button=document.getElementById(id);
      if(!button){
        button=document.createElement('button');
        button.id=id;
        button.type='button';
        button.textContent=label;
        button.onclick=()=>location.href=href;
      }
      button.className='small-btn lobby-utility-btn';
      if(button.parentElement!==host)host.appendChild(button);
    };
    add('formStatsBtn','Form stats','form-stats.html');
    add('matchHistoryBtn','Kamphistorikk','match-history.html');
  }

  function roleFor(text){
    const clean=String(text||'').trim();
    for(const [name,role] of roleByName){
      if(clean===name||clean.includes(name))return role;
    }
    return null;
  }

  function applyRole(el){
    if(!el)return;
    const role=roleFor(el.textContent);
    el.classList.toggle('da-role-owner',role==='owner');
    el.classList.toggle('da-role-admin',role==='admin');
    el.classList.toggle('da-role-leader',role==='leader');
  }

  function syncWelcome(){
    const title=document.getElementById('welcomeName');
    if(!title){revealWelcome();return true;}
    const text=title.textContent.trim();
    if(!text||text==='Lobby')return false;

    const role=roleFor(text);
    title.classList.toggle('da-role-owner',role==='owner');
    title.classList.toggle('da-role-admin',role==='admin');
    title.classList.toggle('da-role-leader',role==='leader');

    title.querySelectorAll('.admin-badge,.owner-badge').forEach(el=>el.remove());
    if(role==='owner'||role==='admin'){
      const badge=document.createElement('span');
      badge.className=role==='owner'?'owner-badge':'admin-badge';
      badge.textContent=role==='owner'?'OWNER':'ADMIN';
      badge.title=role==='owner'?'DartArena Owner':'DartArena Admin';
      title.appendChild(badge);
    }

    revealWelcome();
    return true;
  }

  function scanNames(){
    document.querySelectorAll(NAME_SELECTOR).forEach(applyRole);
    if(document.getElementById('tName')){
      document.querySelectorAll('#participantList .player-name').forEach(name=>{
        const status=name.parentElement?.querySelector('.status');
        if(status?.textContent.includes('Turneringsleder')){
          name.classList.add('da-role-leader');
          status.classList.add('role-leader-label');
        }
      });
    }
  }

  async function loadRoles(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return false;
    const {data:roles,error}=await db.rpc('get_public_user_roles');
    if(error)throw error;
    const privileged=(roles||[]).filter(r=>['owner','admin'].includes(r.role));
    const ids=privileged.map(r=>r.user_id);
    if(ids.length){
      const {data:profiles}=await db.from('profiles').select('id,username').in('id',ids);
      const roleById=new Map(privileged.map(r=>[r.user_id,r.role]));
      (profiles||[]).forEach(p=>{if(p.username)roleByName.set(p.username,roleById.get(p.id)||'admin')});
    }
    const params=new URLSearchParams(location.search);
    const tournamentId=params.get('id');
    if(tournamentId&&location.pathname.toLowerCase().includes('tournament')){
      const {data:t}=await db.from('tournaments').select('owner_id').eq('id',tournamentId).maybeSingle();
      if(t?.owner_id){
        const {data:p}=await db.from('profiles').select('username').eq('id',t.owner_id).maybeSingle();
        if(p?.username&&!roleByName.has(p.username))roleByName.set(p.username,'leader');
      }
    }
    return true;
  }

  async function boot(){
    ensureStyles();
    ensureLobbyNavButtons();

    let loaded=false;
    for(let i=0;i<12&&!loaded;i++){
      loaded=await loadRoles();
      if(!loaded)await new Promise(resolve=>setTimeout(resolve,150));
    }

    scanNames();
    let attempts=0;
    const timer=setInterval(()=>{
      ensureLobbyNavButtons();
      scanNames();
      attempts+=1;
      if(syncWelcome()||attempts>=20){
        clearInterval(timer);
        revealWelcome();
      }
    },100);
  }

  boot().catch(error=>{
    revealWelcome();
    console.warn('Role visuals init failed',error);
  });
})();
