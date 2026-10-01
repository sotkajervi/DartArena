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
    if(!title)return;
    const role=roleFor(title.textContent);
    applyRole(title);
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
  }

  function scan(){
    document.querySelectorAll(NAME_SELECTOR).forEach(applyRole);
    syncWelcome();
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
    if(!session?.user)return;
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
  }

  async function boot(){
    ensureStyles();
    await loadRoles();
    scan();
    let runs=0;
    const timer=setInterval(()=>{
      scan();
      runs+=1;
      if(runs>=8)clearInterval(timer);
    },500);
  }

  boot().catch(error=>console.warn('Role visuals init failed',error));
})();
