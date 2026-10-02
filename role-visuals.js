(()=>{
  if(!window.supabase||window.__dartArenaRoleVisuals)return;
  window.__dartArenaRoleVisuals=true;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  const OWNER='#23e2d1',ADMIN='#ff9f43',LEADER='#4da3ff';
  const roleByName=new Map();
  const NAME_SELECTOR='.player-name,.video-name,.match-name,.cricket-player-name,.half-player-name,.sixty-one-player-name,.spectate-name,.spectator-name,.history-player,.results-player,.highlight-name,.jdc-online-player span,#matchPlayer1Name,#matchPlayer2Name,.da-result-stat-name,.da-result-winner-name,.da-result-legwinner';

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
      #welcomeName{display:inline-block;vertical-align:middle}
      #welcomeRoleBadge{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:950;letter-spacing:.1em;vertical-align:middle}
      #welcomeRoleBadge.admin-badge{color:${ADMIN}!important;border:1px solid rgba(255,159,67,.5)!important;background:rgba(255,159,67,.1)!important}
      #welcomeRoleBadge.owner-badge{color:${OWNER}!important;border:1px solid rgba(35,226,209,.55)!important;background:rgba(35,226,209,.1)!important}
      .admin-badge,.owner-badge{display:inline-flex;align-items:center;margin-left:9px;padding:3px 7px;border-radius:999px;font-size:10px;font-weight:950;letter-spacing:.1em;vertical-align:middle}
      .admin-badge{color:${ADMIN}!important;border:1px solid rgba(255,159,67,.5)!important;background:rgba(255,159,67,.1)!important}
      .owner-badge{color:${OWNER}!important;border:1px solid rgba(35,226,209,.55)!important;background:rgba(35,226,209,.1)!important}
      .player-role-badge{display:inline-flex;align-items:center;margin-left:7px;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:950;letter-spacing:.08em;vertical-align:middle;line-height:1.25}
      .player-role-badge.owner{color:${OWNER};border:1px solid rgba(35,226,209,.5);background:rgba(35,226,209,.09)}
      .player-role-badge.admin{color:${ADMIN};border:1px solid rgba(255,159,67,.5);background:rgba(255,159,67,.09)}
      #matchTitle .player-role-badge{transform:translateY(-1px)}
      .da-result-title .player-role-badge{font-size:10px;padding:3px 7px;margin-left:10px;transform:translateY(-5px)}
      .da-result-playerhead .player-role-badge{margin-left:6px}
      .jdc-online-player span.da-jdc-owner::after,.jdc-online-player span.da-jdc-admin::after{display:inline-block;margin-left:7px;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:950;letter-spacing:.08em;vertical-align:2px;line-height:1.25}
      .jdc-online-player span.da-jdc-owner::after{content:'OWNER';color:${OWNER};border:1px solid rgba(35,226,209,.5);background:rgba(35,226,209,.09)}
      .jdc-online-player span.da-jdc-admin::after{content:'ADMIN';color:${ADMIN};border:1px solid rgba(255,159,67,.5);background:rgba(255,159,67,.09)}
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

  function syncPlayerBadge(el,role){
    const isPlayerName=el?.classList?.contains('player-name');
    const isMatchHeader=el?.id==='matchPlayer1Name'||el?.id==='matchPlayer2Name';
    const isResultName=el?.classList?.contains('da-result-stat-name')||el?.classList?.contains('da-result-winner-name');
    if(!isPlayerName&&!isMatchHeader&&!isResultName)return;
    const host=el.parentElement;
    if(!host)return;
    let badge=el.nextElementSibling?.classList?.contains('player-role-badge')?el.nextElementSibling:null;
    if(role==='owner'||role==='admin'){
      if(!badge){
        badge=document.createElement('span');
        badge.className='player-role-badge';
        el.insertAdjacentElement('afterend',badge);
      }
      badge.className=`player-role-badge ${role}`;
      badge.textContent=role==='owner'?'OWNER':'ADMIN';
      badge.title=role==='owner'?'DartArena Owner':'DartArena Admin';
    }else if(badge){
      badge.remove();
    }
  }

  function applyRole(el){
    if(!el)return;
    const role=roleFor(el.textContent);
    el.classList.toggle('da-role-owner',role==='owner');
    el.classList.toggle('da-role-admin',role==='admin');
    el.classList.toggle('da-role-leader',role==='leader');
    const isJdcScore=!!el.closest?.('.jdc-online-player');
    el.classList.toggle('da-jdc-owner',isJdcScore&&role==='owner');
    el.classList.toggle('da-jdc-admin',isJdcScore&&role==='admin');
    syncPlayerBadge(el,role);
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
    let badge=document.getElementById('welcomeRoleBadge');
    if(role==='owner'||role==='admin'){
      if(!badge){
        badge=document.createElement('span');
        badge.id='welcomeRoleBadge';
        title.insertAdjacentElement('afterend',badge);
      }
      badge.className=role==='owner'?'owner-badge':'admin-badge';
      badge.textContent=role==='owner'?'OWNER':'ADMIN';
      badge.title=role==='owner'?'DartArena Owner':'DartArena Admin';
    }else if(badge){
      badge.remove();
    }

    revealWelcome();
    return true;
  }

  function scanNames(root=document){
    root.querySelectorAll(NAME_SELECTOR).forEach(applyRole);
    if(root===document&&document.getElementById('tName')){
      document.querySelectorAll('#participantList .player-name').forEach(name=>{
        const status=name.parentElement?.querySelector('.status');
        if(status?.textContent.includes('Turneringsleder')){
          name.classList.add('da-role-leader');
          status.classList.add('role-leader-label');
        }
      });
    }
  }

  function hookPlayerRendering(){
    if(window.__dartArenaRolePlayerHook||typeof loadPlayers!=='function')return;
    window.__dartArenaRolePlayerHook=true;
    const baseLoadPlayers=loadPlayers;
    loadPlayers=async function(...args){
      const result=await baseLoadPlayers.apply(this,args);
      scanNames();
      return result;
    };
  }

  function makeChallengeStage(id){
    const live=document.getElementById(id);
    if(!live||live.dataset.daRoleStage==='1')return null;
    const stage=live.cloneNode(false);
    const liveId=`${id}-role-live`;
    live.id=liveId;
    stage.id=id;
    stage.dataset.daRoleStage='1';
    stage.style.display='none';
    live.insertAdjacentElement('afterend',stage);
    return{live,stage,id};
  }

  function commitChallengeStage(state){
    if(!state)return;
    const{live,stage}=state;
    if(!stage.isConnected){
      live.id=state.id;
      return;
    }
    scanNames(stage);
    stage.style.removeProperty('display');
    delete stage.dataset.daRoleStage;
    live.replaceWith(stage);
  }

  function hookChallengeRendering(){
    if(window.__dartArenaRoleChallengeHook||typeof loadChallenges!=='function')return;
    window.__dartArenaRoleChallengeHook=true;
    const baseLoadChallenges=loadChallenges;
    loadChallenges=async function(...args){
      const incomingStage=makeChallengeStage('challengeList');
      const sentStage=makeChallengeStage('sentChallengeList');
      try{
        const result=await baseLoadChallenges.apply(this,args);
        commitChallengeStage(incomingStage);
        commitChallengeStage(sentStage);
        scanNames();
        return result;
      }catch(error){
        commitChallengeStage(incomingStage);
        commitChallengeStage(sentStage);
        throw error;
      }
    };
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

    hookPlayerRendering();
    hookChallengeRendering();
    scanNames();
    window.DartArenaRoleVisuals={scan:scanNames,apply:applyRole,roleFor};
    let attempts=0;
    const timer=setInterval(()=>{
      ensureLobbyNavButtons();
      hookPlayerRendering();
      hookChallengeRendering();
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
