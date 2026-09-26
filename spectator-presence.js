// DartArena live spectator counter using Supabase Realtime Presence.
// Players in the match are deliberately excluded from the viewer count.
(function(){
  const params=new URLSearchParams(location.search),matchId=params.get('id');
  if(!matchId||!window.supabase)return;
  const URL='https://jqpxlbhwvskhjbqrbidk.supabase.co',KEY='sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK';
  const presenceDb=window.supabase.createClient(URL,KEY),number=document.getElementById('viewerCountNumber'),pill=document.getElementById('viewerCount');
  let ch=null,myId=null,isPlayer=false;
  function render(){if(!ch||!number)return;const state=ch.presenceState();let viewers=0;Object.values(state).flat().forEach(p=>{if(p.role==='spectator')viewers++});number.textContent=String(viewers);pill?.setAttribute('aria-label',`${viewers} tilskuere ser på kampen`)}
  (async()=>{
    const {data:{session}}=await presenceDb.auth.getSession();myId=session?.user?.id||`guest-${crypto.randomUUID()}`;
    if(session?.user?.id){const {data:m}=await presenceDb.from('matches').select('player1_id,player2_id').eq('id',matchId).maybeSingle();isPlayer=!!m&&[m.player1_id,m.player2_id].includes(session.user.id)}
    ch=presenceDb.channel(`match-viewers-${matchId}`,{config:{presence:{key:myId}}})
      .on('presence',{event:'sync'},render)
      .on('presence',{event:'join'},render)
      .on('presence',{event:'leave'},render)
      .subscribe(async status=>{if(status==='SUBSCRIBED'){await ch.track({user_id:myId,role:isPlayer?'player':'spectator',online_at:new Date().toISOString()});render()}});
  })();
  window.addEventListener('pagehide',()=>{try{ch?.untrack()}catch{}});
})();