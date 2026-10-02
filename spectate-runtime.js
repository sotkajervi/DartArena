(()=>{
  const $=id=>document.getElementById(id);
  const title=$('spectateTitle');
  if(title)title.textContent='Starter Spectate…';

  async function waitForSupabase(){
    for(let i=0;i<80;i++){
      if(window.supabase?.createClient)return true;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return false;
  }

  async function start(){
    const ready=await waitForSupabase();
    if(!ready){if(title)title.textContent='Kunne ikke starte Spectate • Supabase mangler';return}

    const db=window.supabase.createClient('https://jqpxlbhwvskhjbqrbidk.supabase.co','sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK');
    const matchId=new URLSearchParams(location.search).get('id');
    let match=null,names={},timer=null,channel=null,leaving=false,clients=new Map(),publications=new Map();
    if(title)title.textContent='Kobler til kamp…';

    const isX01=m=>!['jdc','cricket','half_it','sixty_one'].includes(m?.game_variant||'x01');
    function gameLabel(m){if(m.game_variant==='jdc')return'JDC Challenge';if(m.game_variant==='cricket')return'Cricket';if(m.game_variant==='half_it')return'Half-It';if(m.game_variant==='sixty_one')return'61';return String(m.game||501)}
    function formatLabel(m){if(m.game_variant==='jdc')return'57 piler hver';if(m.game_variant==='half_it')return'12 runder';return`Best of ${Number(m.legs||1)}`}
    function setText(id,value){const el=$(id);if(el)el.textContent=String(value)}
    function setX01Stats(index,m){
      setText(`spectateAvg${index}`,Number(m[`player${index}_avg`]||0).toFixed(2));
      setText(`spectate100P${index}`,Number(m[`player${index}_100`]||0));
      setText(`spectate140P${index}`,Number(m[`player${index}_140`]||0));
      setText(`spectate180P${index}`,Number(m[`player${index}_180`]||0));
      setText(`spectateCheckout${index}`,Number(m[`player${index}_high_checkout`]||0));
      $(`spectateStats${index}`)?.classList.remove('hidden');
    }
    function render(){
      if(!match)return;
      const p1=names[match.player1_id]||'Spiller 1',p2=names[match.player2_id]||'Spiller 2';
      setText('spectateTitle',`${p1} vs ${p2}`);
      setText('spectateName1',p1);setText('spectateName2',p2);
      setText('spectatePlayer1',p1);setText('spectatePlayer2',p2);
      setText('spectateGame',gameLabel(match));
      setText('spectateFormat',(match.is_warmup?'Oppvarming • ':'')+formatLabel(match));
      setText('spectateStatus',match.status==='playing'?(match.is_warmup?'Pågår • Oppvarming':'Pågår'):match.status==='finished'?'Ferdig':'Avbrutt');

      if(isX01(match)){
        setText('spectateResult1',Number(match.player1_score||0));
        setText('spectateResult2',Number(match.player2_score||0));
        setText('spectateSub1',`${Number(match.player1_legs||0)} LEGS`);
        setText('spectateSub2',`${Number(match.player2_legs||0)} LEGS`);
        setX01Stats(1,match);setX01Stats(2,match);
      }else if(match.game_variant==='jdc'){
        setText('spectateResult1',Number(match.player1_score||0));
        setText('spectateResult2',Number(match.player2_score||0));
        setText('spectateSub1','POENG');setText('spectateSub2','POENG');
        $('spectateStats1')?.classList.add('hidden');$('spectateStats2')?.classList.add('hidden');
      }else{
        setText('spectateResult1',Number(match.player1_legs||0));
        setText('spectateResult2',Number(match.player2_legs||0));
        setText('spectateSub1','LEGS');setText('spectateSub2','LEGS');
        $('spectateStats1')?.classList.add('hidden');$('spectateStats2')?.classList.add('hidden');
      }

      if(!isX01(match)){
        [$('spectatePlaceholder1'),$('spectatePlaceholder2')].forEach(el=>{if(el){el.textContent='Live video er foreløpig ikke koblet til denne spilltypen.';el.classList.remove('hidden')}});
      }
    }
    function stopVideo(){clients.forEach(c=>{try{c.close()}catch{}});clients.clear();publications.clear();if(channel){db.removeChannel(channel).catch(()=>{});channel=null}}
    function blockPrivate(){match=null;stopVideo();setText('spectateTitle','Kampen finnes ikke eller er ikke offentlig live');document.querySelectorAll('.spectate-grid,.spectate-meta').forEach(el=>el.style.display='none')}
    async function refresh(){
      if(!matchId){setText('spectateTitle','Mangler kamp-ID');return false}
      const {data,error}=await db.rpc('get_spectate_match',{p_match_id:matchId});
      if(error){console.error('Spectate match load failed',error);setText('spectateTitle',`Kunne ikke laste kampen • ${error.code||'RPC-feil'}`);return false}
      const m=Array.isArray(data)?data[0]:data;
      if(!m){blockPrivate();return false}
      match=m;
      names={[m.player1_id]:m.player1_name||'Spiller 1',[m.player2_id]:m.player2_name||'Spiller 2'};
      document.querySelectorAll('.spectate-grid,.spectate-meta').forEach(el=>el.style.removeProperty('display'));
      render();
      return true;
    }
    async function subscribePlayer(playerId,pub){
      if(!isX01(match)||!playerId||!pub?.sessionId||!window.DartArenaSFU||!window.DARTARENA_SFU)return;
      const index=playerId===match.player1_id?1:playerId===match.player2_id?2:0;if(!index)return;
      const old=publications.get(playerId);if(old===pub.sessionId)return;
      publications.set(playerId,pub.sessionId);
      try{clients.get(playerId)?.close()}catch{}
      const client=new window.DartArenaSFU(window.DARTARENA_SFU.workerUrl);clients.set(playerId,client);
      const video=$(`spectateVideo${index}`),placeholder=$(`spectatePlaceholder${index}`);video.srcObject=new MediaStream();
      try{
        await client.subscribe(pub,async event=>{
          if(leaving)return;
          let rs=video.srcObject;if(!(rs instanceof MediaStream)){rs=new MediaStream();video.srcObject=rs}
          const tracks=event.streams?.[0]?.getTracks?.()||[event.track];
          tracks.forEach(track=>{if(track&&!rs.getTracks().some(t=>t.id===track.id))rs.addTrack(track)});
          video.muted=true;await video.play().catch(()=>{});
          if(rs.getVideoTracks().some(t=>t.readyState==='live'))placeholder?.classList.add('hidden');
        });
      }catch(e){console.warn('Spectator subscribe failed',e);publications.delete(playerId)}
    }
    async function setupVideo(){
      if(!isX01(match)||channel)return;
      channel=db.channel(`match-spectator-media-${matchId}`)
        .on('broadcast',{event:'spectator-publication'},({payload})=>{if(payload?.from&&payload?.publication)subscribePlayer(payload.from,payload.publication)})
        .subscribe(async status=>{if(status==='SUBSCRIBED')await channel.send({type:'broadcast',event:'spectator-request',payload:{from:'spectator'}}).catch(()=>{})});
    }
    async function boot(){
      const{data:{session},error}=await db.auth.getSession();
      if(error){setText('spectateTitle','Kunne ikke lese innlogging');return}
      if(!session){setText('spectateTitle','Du må være innlogget');return}
      const allowed=await refresh();if(!allowed)return;
      await setupVideo();
      timer=setInterval(async()=>{const ok=await refresh();if(ok&&!channel)await setupVideo()},1500);
    }
    function cleanup(){leaving=true;clearInterval(timer);stopVideo()}
    window.addEventListener('pagehide',cleanup,{once:true});
    await boot();
  }

  start().catch(e=>{
    console.error('Spectate fatal startup error',e);
    const t=document.getElementById('spectateTitle');
    if(t)t.textContent=`Spectate-feil • ${e?.name||'ukjent feil'}`;
  });
})();
