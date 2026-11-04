/* Opt-in Cricket make-before-break transition; legacy Cricket is the fallback. */
(()=>{
 if(new URLSearchParams(location.search).get('cricketSeamlessDev')!=='1')return;
 let entering=false;
 const load=src=>new Promise((ok,fail)=>{const el=document.createElement('script');el.src=src;el.async=false;el.onload=ok;el.onerror=()=>fail(Error('Could not load '+src));document.body.appendChild(el)});
 window.DartArenaCricketSamePage={async enter({liveMatchId}={}){
  if(entering)return true;
  const state=window.DartArenaChallengeRoomState;
  const client=state?.client?.(),me=state?.user?.();
  if(!client||!me||!liveMatchId)return false;
  const {data:match,error}=await client.from('matches').select('id,game_variant,player1_id,player2_id,status').eq('id',liveMatchId).maybeSingle();
  if(error||!match||match.game_variant!=='cricket'||!['playing','live'].includes(match.status)||![match.player1_id,match.player2_id].includes(me))return false;
  entering=true;let released=false;
  try{
   const host=window.DartArenaCricketSceneHost;
   if(!host)throw Error('Cricket scene unavailable');
   await host.prepare();await host.enter();
   if(!window.DartArenaCaptureHandoff?.transfer?.(state.stream()))throw Error('Capture transfer failed');
   window.DartArenaTransferredMediaOwnership=state.takeMediaOwnership?.()||null;
   await load('cricket-mark-history.js?v=20261026-overlaid2');
   await load('cricket-seamless-bundle.js?v=20261104-starter-badge1');
   await window.DartArenaBootCricketSeamless(liveMatchId);
   await load('cricket-leg-starter.js?v=20261104-starter-badge1');
   // Bind the existing DartArena confirmation dialog to Cricket cancellation.
   await load('dartarena-dialog.js?v=20261002-dialog1');
   await load('cricket-seamless-cancel.js?v=20261104-confirm-rpc1');
   // Same cancellation notification as ordinary Cricket, missing from seamless room.
   await load('cancelled-match-modal.js?v=20261104-cricket-notice1');
   // Apply the same Cricket TV docking layout used by ordinary cricket.html.
   // Load after the Cricket board exists, before SFU attaches its live tracks.
   await load('opponent-focus.js?v=20261104-cricket-seamless-tv1');
   await load('cricket-status-align.js?v=20261104-fullwidth-log1');
   await load('cricket-sfu-media.js?v=20261104-dev1');
   await load('shared-results.js?v=20261104-cricket-seamless1');
   await load('post-match-media-lifecycle.js?v=20261104-shared-auth1');
   const deadline=Date.now()+15000;
   while(!window.DartArenaMatchMedia?.readyForHandoff?.()){
    if(Date.now()>deadline)throw Error('Cricket video handoff timeout');
    await new Promise(r=>setTimeout(r,250));
   }
   if(!window.DartArenaHandoffBarrier?.wait)throw Error('Handoff barrier unavailable');
   await window.DartArenaHandoffBarrier.wait({client,matchId:liveMatchId,me,opponent:me===match.player1_id?match.player2_id:match.player1_id});
   state.releaseForHandoff?.();released=true;
   window.DartArenaMediaTrace?.mark('CRICKET_HANDOFF_SUCCESS',{matchId:liveMatchId.slice(0,8)});
   return true;
  }catch(err){
   console.error('[CRICKET HANDOFF] using original Cricket page',err);
   window.DartArenaMediaTrace?.mark('CRICKET_HANDOFF_FAILED',String(err?.message||err));
   if(!released)window.DartArenaCaptureHandoff?.discard?.();
   location.replace('cricket.html?id='+encodeURIComponent(liveMatchId));
   return true;
  }
 }};
})();