(()=>{
  if(typeof pageForVariant!=='function'||typeof showProposal!=='function'||typeof syncGameMode!=='function')return;

  const basePageForVariant=pageForVariant;
  pageForVariant=variant=>variant==='jdc'?'jdc-match.html':basePageForVariant(variant);

  const baseShowProposal=showProposal;
  showProposal=proposal=>{
    const isJdc=proposal?.gameVariant==='jdc'||proposal?.game==='jdc';
    if(!isJdc)return baseShowProposal(proposal);
    pendingProposal={
      ...proposal,
      gameVariant:'jdc',
      mode:'legs',
      sets:1,
      legs:1
    };
    const who=proposal.starter==='random'?'Tilfeldig':proposal.starter===profile.id?'Du starter':`${names[other]||'Motstander'} starter`;
    $('proposalTitle').textContent='JDC Challenge • 57 piler hver';
    $('proposalText').textContent=`${who}. Resultatet teller på offisiell Top 10 og JDC-tier.`;
    $('proposalActions').classList.remove('hidden');
  };

  const baseSyncGameMode=syncGameMode;
  const syncJdcMode=()=>{
    if(selectedGame()!=='jdc')return baseSyncGameMode();
    matchMode='legs';
    $('legsModeBtn').classList.add('active');
    $('setsModeBtn').classList.remove('active');
    $('legsModeBtn').disabled=true;
    $('setsModeBtn').disabled=true;
    $('setsField').classList.add('hidden');
    $('legsField').classList.add('hidden');
    $('sixtyOneTimeField').classList.add('hidden');
    $('roomLegs').value='1';
  };

  const gameSelect=$('roomGame');
  if(gameSelect){
    gameSelect.onchange=syncJdcMode;
    syncJdcMode();
  }
})();

// Waiting-room WebRTC stability guard.
// The old flow could lose an offer while the answering side was still opening its camera,
// leaving OFFER stuck in have-local-offer until a later ICE failure forced a reconnect.
(()=>{
  if(typeof handleSignal!=='function'||typeof connectIfReady!=='function'||typeof destroyPeer!=='function')return;

  let queuedOffer=null;
  let offerWatchTimer=null;
  let pumping=false;

  const clearOfferWatch=()=>{
    if(offerWatchTimer)clearTimeout(offerWatchTimer);
    offerWatchTimer=null;
  };

  const baseDestroyPeer=destroyPeer;
  destroyPeer=function(){
    clearOfferWatch();
    return baseDestroyPeer();
  };

  const baseHandleSignal=handleSignal;
  handleSignal=async function(signal){
    if(!signal)return;

    // Do not drop the initial offer just because getUserMedia has not finished yet.
    if(!localReady||!stream){
      if(signal.description?.type==='offer'&&!isOfferer())queuedOffer=signal;
      else if(signal.candidate)pendingCandidates.push(signal.candidate);
      return;
    }

    if(signal.description?.type==='offer'&&!isOfferer()){
      queuedOffer=null;
      // A fresh offer must never be applied to a stale negotiating/failed peer.
      if(pc&&pc.signalingState!=='stable'){
        baseDestroyPeer();
        await new Promise(resolve=>setTimeout(resolve,120));
      }
    }

    if(signal.description?.type==='answer'&&isOfferer())clearOfferWatch();
    return baseHandleSignal(signal);
  };

  const baseConnectIfReady=connectIfReady;
  connectIfReady=async function(){
    await baseConnectIfReady();
    if(!isOfferer()||!pc||pc.connectionState==='connected')return;

    clearOfferWatch();
    const watchedPeer=pc;
    offerWatchTimer=setTimeout(async()=>{
      offerWatchTimer=null;
      if(leaving||pc!==watchedPeer||watchedPeer.connectionState==='connected')return;
      // No answer/connection arrived. Rebuild one clean peer instead of waiting for
      // the browser to eventually report ICE failed.
      if(watchedPeer.signalingState==='have-local-offer'||['new','connecting','failed','disconnected'].includes(watchedPeer.connectionState)){
        await restartPeer();
      }
    },6500);
  };

  async function pumpQueuedOffer(){
    if(pumping||!queuedOffer||!localReady||!stream||isOfferer())return;
    pumping=true;
    const offer=queuedOffer;
    queuedOffer=null;
    try{await handleSignal(offer)}
    catch(error){
      console.warn('Kunne ikke behandle ventende WebRTC-offer',error);
      queuedOffer=offer;
    }finally{pumping=false}
  }

  const pumpTimer=setInterval(()=>pumpQueuedOffer(),200);
  window.addEventListener('beforeunload',()=>{
    clearInterval(pumpTimer);
    clearOfferWatch();
  },{once:true});
})();
