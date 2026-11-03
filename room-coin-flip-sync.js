(()=>{
  if(window.DartArenaCoinFlipSync)return;
  const id=new URLSearchParams(location.search).get('id');
  if(!id||typeof db==='undefined')return;

  let running=false;
  const coinChannel=db.channel('room-coinflip-'+id)
    .on('broadcast',{event:'coin-flip-start'},({payload})=>run(payload))
    .subscribe();

  function pageFor(v){return window.DartArenaGames?.pageForVariant?.(v)||(typeof pageForVariant==='function'?pageForVariant(v):v==='jdc'?'jdc-match.html':v==='cricket'?'cricket.html':v==='half_it'?'half-it.html':v==='sixty_one'?'61-match.html':'match.html')}

  async function resolveNames(payload){
    const player1Id=payload?.player1Id,player2Id=payload?.player2Id;
    let player1Name=payload?.player1Name||'Spiller 1';
    let player2Name=payload?.player2Name||'Spiller 2';
    const ids=[...new Set([player1Id,player2Id].filter(Boolean))];
    if(ids.length){
      const{data,error}=await db.from('profiles').select('id,username').in('id',ids);
      if(!error&&data?.length){
        const byId=Object.fromEntries(data.map(p=>[p.id,p.username]));
        player1Name=byId[player1Id]||player1Name;
        player2Name=byId[player2Id]||player2Name;
      }
    }
    return{player1Name,player2Name};
  }

  async function run(payload){
    if(running||!payload?.matchId||!payload?.starterId)return;
    running=true;
    try{
      const{player1Name,player2Name}=await resolveNames(payload);
      if(payload.skipFlip===true){
        // Match the proven coin-flip start path: both clients listen to the
        // same room-coinflip channel and begin in the same document.
        // Keep the waiting-room media running while both clients synchronize.
        const delay=Math.max(0,Math.min(6000,Number(payload.startAt||0)-Date.now()));
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      }else{
        await window.DartArenaCoinFlip?.play({
          player1Id:payload.player1Id,
          player2Id:payload.player2Id,
          player1Name,
          player2Name,
          winnerId:payload.starterId,
          duration:3300
        });
      }
    }finally{
      if(!window.DartArenaChallengeStart?.open?.(payload.matchId,payload.gameVariant))location.href=`${pageFor(payload.gameVariant)}?id=${encodeURIComponent(payload.matchId)}`;
    }
  }

  async function start(payload){
    if(running)return;
    await coinChannel.send({type:'broadcast',event:'coin-flip-start',payload});
    await run(payload);
  }

  async function startDirect(payload){
    if(running)return;
    const direct={...payload,skipFlip:true,startAt:Date.now()+4500};
    await coinChannel.send({type:'broadcast',event:'coin-flip-start',payload:direct});
    await run(direct);
  }
  window.DartArenaCoinFlipSync={start,startDirect};
  window.addEventListener('pagehide',()=>{try{db.removeChannel(coinChannel)}catch{}});
})();
