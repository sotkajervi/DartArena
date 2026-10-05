// DartArena live spectator counter using Supabase Realtime Presence.
// Players in the match are deliberately excluded from the viewer count.
(function(){
  const params=new URLSearchParams(location.search),matchId=params.get('id');
  if(!matchId||!window.supabase)return;
  const URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const presenceDb=window.supabase.createClient(URL,KEY),number=document.getElementById('viewerCountNumber'),pill=document.getElementById('viewerCount');
  let ch=null,myId=null,isPlayer=false,myName='Gjest';

  function spectators(){
    if(!ch)return[];
    const unique=new Map();
    Object.values(ch.presenceState()).flat().forEach(p=>{
      if(p?.role!=='spectator')return;
      const key=p.user_id||p.presence_ref||crypto.randomUUID();
      if(!unique.has(key))unique.set(key,{id:key,name:String(p.username||'Gjest')});
    });
    return [...unique.values()];
  }

  function render(){
    if(!ch)return;
    const viewers=spectators();
    if(number)number.textContent=String(viewers.length);
    if(!pill)return;
    const names=viewers.map(v=>v.name).sort((a,b)=>a.localeCompare(b,'nb'));
    const description=!names.length
      ?'Ingen tilskuere akkurat nå'
      :`Ser på: ${names.join(', ')}`;
    pill.removeAttribute('title');
    pill.setAttribute('aria-label',`${viewers.length} tilskuere ser på kampen. ${description}`);
  }

  (async()=>{
    const {data:{session}}=await presenceDb.auth.getSession();
    myId=session?.user?.id||`guest-${crypto.randomUUID()}`;
    if(session?.user?.id){
      const [{data:m},{data:p}]=await Promise.all([
        presenceDb.from('matches').select('player1_id,player2_id').eq('id',matchId).maybeSingle(),
        presenceDb.from('profiles').select('username').eq('id',session.user.id).maybeSingle()
      ]);
      isPlayer=!!m&&[m.player1_id,m.player2_id].includes(session.user.id);
      myName=p?.username||'Tilskuer';
    }
    ch=presenceDb.channel(`match-viewers-${matchId}`,{config:{presence:{key:myId}}})
      .on('presence',{event:'sync'},render)
      .on('presence',{event:'join'},render)
      .on('presence',{event:'leave'},render)
      .subscribe(async status=>{
        if(status!=='SUBSCRIBED')return;
        await ch.track({
          user_id:myId,
          username:myName,
          role:isPlayer?'player':'spectator',
          online_at:new Date().toISOString()
        });
        render();
      });
  })();

  window.addEventListener('pagehide',()=>{try{ch?.untrack()}catch{}});
})();