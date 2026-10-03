(()=>{
  if(!window.supabase)return;

  const tournamentId=new URLSearchParams(location.search).get('id');
  const participantList=document.getElementById('participantList');
  if(!tournamentId||!participantList)return;

  const db=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );

  let me=null;
  let tournament=null;
  let canManage=false;
  let observer=null;
  let channel=null;
  let decorating=false;
  let decorateQueued=false;

  function ensureStyles(){
    if(document.getElementById('tournament-player-removal-style'))return;
    const style=document.createElement('style');
    style.id='tournament-player-removal-style';
    style.textContent=`
      .tournament-remove-player{margin-left:auto;flex:0 0 auto;color:#ff9ba1!important;border-color:#743139!important;background:#35171a!important}
      .tournament-remove-player:hover{border-color:#a33f49!important;background:#491b20!important}
      .tournament-remove-player:disabled{opacity:.45;cursor:default}
      #participantList>.player-row{gap:10px}
    `;
    document.head.appendChild(style);
  }

  async function getDialog(){
    if(window.DartArenaDialog)return window.DartArenaDialog;
    for(let i=0;i<30&&!window.DartArenaDialog;i++)await new Promise(r=>setTimeout(r,50));
    return window.DartArenaDialog||null;
  }

  function scheduleDecorate(delay=60){
    if(decorateQueued)return;
    decorateQueued=true;
    setTimeout(()=>{
      decorateQueued=false;
      decorate().catch(error=>console.warn('Tournament player removal UI failed',error));
    },delay);
  }

  async function refreshPermission(){
    const [tResult,adminResult]=await Promise.all([
      db.from('tournaments').select('id,owner_id,status').eq('id',tournamentId).maybeSingle(),
      db.rpc('is_admin')
    ]);
    if(tResult.error)throw tResult.error;
    tournament=tResult.data||null;
    canManage=!!tournament&&(tournament.owner_id===me||adminResult.data===true);
  }

  async function decorate(){
    if(decorating)return;
    decorating=true;
    try{
      document.querySelectorAll('.tournament-remove-player').forEach(button=>button.remove());
      await refreshPermission();
      if(!canManage||tournament?.status!=='groups')return;

      const {data:members,error}=await db.from('tournament_members')
        .select('user_id,role,joined_at')
        .eq('tournament_id',tournamentId)
        .order('joined_at');
      if(error)throw error;

      const participants=(members||[]).filter(x=>x.role==='participant');
      const participantIds=new Set(participants.map(x=>x.user_id));
      const display=[
        {user_id:tournament.owner_id,is_owner:true},
        ...participants.filter(x=>x.user_id!==tournament.owner_id).map(x=>({user_id:x.user_id,is_owner:false}))
      ];

      const ids=[...new Set(display.map(x=>x.user_id).filter(Boolean))];
      let names={};
      if(ids.length){
        const {data:profiles,error:pError}=await db.from('profiles').select('id,username').in('id',ids);
        if(pError)throw pError;
        names=Object.fromEntries((profiles||[]).map(p=>[p.id,p.username]));
      }

      const rows=[...participantList.children].filter(el=>el.classList?.contains('player-row'));
      if(!rows.length)return;

      display.forEach((entry,index)=>{
        if(!participantIds.has(entry.user_id))return;
        const row=rows[index];
        if(!row)return;
        const button=document.createElement('button');
        button.type='button';
        button.className='small-btn tournament-remove-player';
        button.textContent='Fjern';
        button.title='Fjern spiller fra pågående puljespill';
        button.dataset.userId=entry.user_id;
        const playerName=names[entry.user_id]||'spilleren';
        button.addEventListener('click',event=>{
          event.preventDefault();
          event.stopPropagation();
          removePlayer(entry.user_id,playerName,button);
        });
        row.appendChild(button);
      });
    }finally{
      decorating=false;
    }
  }

  async function removePlayer(userId,playerName,button){
    if(button.disabled)return;
    const dialog=await getDialog();
    const message=`Fjerne ${playerName} fra turneringen?\n\nAlle puljekamper mot spilleren – også resultater som allerede er spilt – fjernes fra puljen og tabellen. En eventuell aktiv kamp stoppes.\n\nDette kan ikke angres.`;
    const ok=dialog
      ?await dialog.confirm(message,{title:'Fjern spiller',tone:'danger',confirmText:'Fjern'})
      :window.confirm(message);
    if(!ok)return;

    const old=button.textContent;
    button.disabled=true;
    button.textContent='Fjerner…';
    try{
      const {data,error}=await db.rpc('remove_tournament_group_player',{
        p_tournament_id:tournamentId,
        p_user_id:userId
      });
      if(error)throw error;
      const removedPlayed=Number(data?.removed_played_matches||0);
      const info=removedPlayed>0
        ?`${playerName} er fjernet. ${removedPlayed} allerede startet/ferdig puljekamp${removedPlayed===1?'':'er'} mot spilleren ble også fjernet.`
        :`${playerName} er fjernet fra turneringen.`;
      if(dialog)await dialog.alert(info,{title:'Spiller fjernet'});
      scheduleDecorate(80);
    }catch(error){
      const raw=String(error?.message||'Kunne ikke fjerne spilleren.');
      const msg=raw
        .replace('Players can only be removed while group play is active','Spillere kan bare fjernes mens puljespillet pågår.')
        .replace('Only admin, owner or tournament leader can remove a player','Kun Admin, Owner eller turneringsleder kan fjerne spillere.')
        .replace('Player is not a tournament participant','Spilleren er ikke lenger med i turneringen.')
        .replace('Tournament not found','Turneringen finnes ikke lenger.');
      if(dialog)await dialog.alert(msg,{title:'Kunne ikke fjerne spiller',tone:'danger'});
      else window.alert(msg);
      if(document.body.contains(button)){
        button.disabled=false;
        button.textContent=old;
      }
    }
  }

  async function boot(){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    me=session.user.id;
    ensureStyles();
    await decorate();

    observer=new MutationObserver(()=>scheduleDecorate());
    observer.observe(participantList,{childList:true});

    channel=db.channel(`tournament-player-removal-${tournamentId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'tournaments',filter:`id=eq.${tournamentId}`},()=>scheduleDecorate(80))
      .on('postgres_changes',{event:'*',schema:'public',table:'tournament_members',filter:`tournament_id=eq.${tournamentId}`},()=>scheduleDecorate(80))
      .subscribe();
  }

  boot().catch(error=>console.error('Tournament player removal init failed',error));
  window.addEventListener('pagehide',()=>{
    observer?.disconnect();
    if(channel){try{db.removeChannel(channel)}catch{}}
  },{once:true});
})();
