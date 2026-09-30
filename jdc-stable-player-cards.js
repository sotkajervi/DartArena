(()=>{
  if(!window.supabase)return;
  const id=new URLSearchParams(location.search).get('id');
  if(!id)return;
  const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  (async()=>{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.user)return;
    const {data:m}=await db.from('matches').select('player1_id,player2_id').eq('id',id).maybeSingle();
    if(!m)return;
    document.getElementById('player1Card')?.classList.toggle('is-local',m.player1_id===session.user.id);
    document.getElementById('player2Card')?.classList.toggle('is-local',m.player2_id===session.user.id);
  })().catch(()=>{});
})();
