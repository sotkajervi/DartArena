// Reliable room-presence handshake.
// Supabase broadcast messages are transient, so a player who subscribes a moment
// later can miss the other player's initial "ready" message. This small heartbeat
// keeps announcing presence until the normal room.js WebRTC handshake catches it.
(async()=>{
  const id=new URLSearchParams(location.search).get('id');
  if(!id||!window.supabase)return;
  const client=window.supabase.createClient(
    'https://jqpxlbhwvskhjbqrbidk.supabase.co',
    'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
  );
  const {data:{session}}=await client.auth.getSession();
  if(!session)return;
  const from=session.user.id;
  const heartbeat=client.channel('room-'+id);
  let timer=null;
  const announce=()=>heartbeat.send({type:'broadcast',event:'ready',payload:{from,generation:Date.now()}}).catch(()=>{});
  heartbeat.subscribe(status=>{
    if(status!=='SUBSCRIBED')return;
    announce();
    timer=setInterval(announce,1500);
  });
  addEventListener('beforeunload',()=>{if(timer)clearInterval(timer);client.removeChannel(heartbeat)});
})();