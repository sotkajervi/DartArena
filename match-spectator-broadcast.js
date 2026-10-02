// Publish each player's local camera to Cloudflare SFU only when a spectator is present.
(()=>{
  const params=new URLSearchParams(location.search),liveMatchId=params.get('id');
  if(!liveMatchId||!window.supabase)return;
  const client=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
  let sfu=null,publication=null,publishedTrackId=null,ch=null,heartbeat=null,viewerWatch=null,publishing=false,stopped=false,spectatorRequested=false;

  async function announce(){
    if(!ch||!publication||typeof profile==='undefined'||!profile?.id)return;
    await ch.send({type:'broadcast',event:'spectator-publication',payload:{from:profile.id,publication}}).catch(()=>{});
  }

  async function publishIfReady(){
    if(stopped||!spectatorRequested||publishing||!window.DartArenaSFU||!window.DARTARENA_SFU)return;
    if(typeof stream==='undefined'||typeof profile==='undefined'||typeof m==='undefined'||!profile?.id||!m?.id||!stream?.active)return;
    const video=stream.getVideoTracks().find(t=>t.readyState==='live');
    if(!video)return;
    if(publication&&publishedTrackId===video.id){await announce();return}
    publishing=true;
    try{
      sfu?.close();
      sfu=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);
      publication=await sfu.publish(new MediaStream([video]));
      publishedTrackId=video.id;
      await announce();
    }catch(e){
      console.error('Spectator video publish failed',e);
      publication=null;
      publishedTrackId=null;
    }finally{
      publishing=false;
    }
  }

  function armSpectatorPublishing(){
    if(stopped)return;
    spectatorRequested=true;
    publishIfReady();
    if(!heartbeat)heartbeat=setInterval(publishIfReady,2500);
  }

  async function boot(){
    ch=client.channel(`match-spectator-media-${liveMatchId}`)
      .on('broadcast',{event:'spectator-request'},armSpectatorPublishing)
      .subscribe();

    // Also observe the existing Presence counter. This covers the tiny race where
    // a spectator requests video before this media channel has finished subscribing.
    viewerWatch=setInterval(()=>{
      const viewers=Number(document.getElementById('viewerCountNumber')?.textContent||0);
      if(viewers>0)armSpectatorPublishing();
    },1000);
  }

  function cleanup(){
    stopped=true;
    clearInterval(heartbeat);
    clearInterval(viewerWatch);
    heartbeat=null;
    viewerWatch=null;
    try{sfu?.close()}catch{}
    sfu=null;
    publication=null;
    try{if(ch)client.removeChannel(ch)}catch{}
    ch=null;
  }

  window.addEventListener('pagehide',cleanup);
  boot();
})();
