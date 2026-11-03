/* Opt-in seamless challenge handoff for 170 / 301 / 501 / 1001.
 * Runs only in room.html?challengeSeamlessDev=1 on a test deployment.
 * Uses the original match.html stage and keeps waiting-room capture alive.
 */
(()=>{
 'use strict';
 // Explicit opt-in on the isolated test deployment only.
 // Production tournament rooms retain the original navigation.
 if(new URLSearchParams(location.search).get('challengeSeamlessDev')!=='1')return;
 if(!['dartarena-test.pages.dev','sotkajervi.github.io'].includes(location.hostname)){
   console.warn('[DartArena] Same-page handoff is limited to the test deployment.');
   return;
 }
 if(window.DartArenaChallengeSamePageHandoff)return;
 let entering=false;
 function script(src,{module=false}={}){
   return new Promise((resolve,reject)=>{
     const el=document.createElement('script');
     el.src=src;el.async=false;if(module)el.type='module';
     el.onload=resolve;
     el.onerror=()=>reject(new Error('Kunne ikke laste '+src));
     document.body.appendChild(el);
   });
 }
 window.DartArenaChallengeSamePageHandoff={
   async enter({liveMatchId,challengeId}={}){
     if(entering)return true;
     if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(liveMatchId||''))return false;
     const state=window.DartArenaChallengeRoomState;
     const client=state?.client?.();
     if(!client||!state?.user?.())return false;
     // Validate match membership before taking ownership of media.
     const {data:match,error}=await client.from('matches')
       .select('id,player1_id,player2_id,status')
       .eq('id',liveMatchId).single();
     if(error||!match||!['playing','live'].includes(match.status)||
        ![match.player1_id,match.player2_id].includes(state.user()))return false;
     entering=true;
     window.DartArenaMediaTrace?.mark('HANDOFF_BEGIN',{kind:'challenge',liveMatchId:String(liveMatchId).slice(0,8)});
     let released=false;
     try{
       const host=window.DartArenaMatchSceneHost;
       if(!host)throw Error('Kamp-scene er ikke lastet');
       await host.prepare();
       window.DartArenaMediaTrace?.mark('MATCH_SCENE_PREPARED');
       // No second document or iframe. The same video nodes are moved into place.
       await host.enter();
       window.DartArenaMediaTrace?.mark('MATCH_SCENE_VISIBLE');
       document.body.classList.add('match-page');
       document.body.classList.remove('da-prematch-active');
       // Stage the same local tracks while the waiting room remains connected.
       // Only the match engine may claim this capture.
       if(!window.DartArenaCaptureHandoff?.transfer?.(state.stream())){
         throw Error('Kamera- og mikrofonspor kunne ikke overføres');
       }
       window.DartArenaTransferredMediaOwnership=state.takeMediaOwnership?.()||null;
       // match.js is now safe to load: tournament engine is IIFE scoped.
       // The match page owns the new authenticated SFU session.
       await script('match-preferred-media.js?v=20261031-owner1');
       // Module scope isolates match.js declarations from classic room.js globals.
       await script('match.js?v=20261103-cancel-tab-fix1',{module:true});
       if(typeof window.DartArenaBootLiveMatch!=='function')throw Error('Kampmotor mangler');
       await window.DartArenaBootLiveMatch(liveMatchId);
       window.DartArenaMediaTrace?.mark('MATCH_ENGINE_BOOTED');
       // Load the existing match modules only after the room is released and
       // scoring has an authenticated live-match ID. Reuse scripts already on
       // the tournament page instead of initializing duplicate media listeners.
       const modules=[
         'fx-live.js?v=20261023-sweep2',
         'fx-match-bridge.js?v=20261023-live1',
         'autozoom/heatmap-math.js?v=20261023-final2',
         'online-heatmap-chart.js?v=20261023-shareheat1',
         'online-heatmap-result.js?v=20261102-live-id-fix3',
         'match-media-router.js?v=20261103-real-new-stream1',
         'match-controls.js?v=20261102-samepage-dev1',
         'opponent-focus.js?v=20261026-owncam-pip1',
         'dartarena-dialog.js?v=20261027-correction2',
         'cancelled-match-modal.js?v=20261103-tournament-return3',
         'throw-log.js?v=20261102-live-id-fix3',
         'set-engine.js?v=20261102-live-id-fix3',
         'x01-leg-starter-marker.js?v=20261102-live-id-fix3',
         'checkout-engine.js?v=20261102-live-id-fix3',
         'secure-match-cancel.js?v=20261103-cancel-tab-fix1',
         'x01-stats.js?v=20260929-first9a',
         'match-room-polish.js?v=20261002-matchrooms2',
         'result-screenshot.js?v=20261023-shareheat1',
         'live-avg.js?v=20261102-live-id-fix3',
         'stats-engine.js?v=20261102-stats-button4',
         'spectator-presence.js?v=20261102-live-id-fix3',
         'match-spectator-broadcast.js?v=20261031-spectator1',
         'match-media-telemetry.js?v=20261102-samepage-id1',
         'ui-feedback.js?v=20260930-cam2',
         'shared-results.js?v=20261102-finish-liveid5',
         'chicago-flow.js?v=20261006-chicago5',
         'x01-result-leg-details.js?v=20261102-live-id-fix3',
         'mobile-x01-keypad.js?v=20261025-mobile1',
         'post-match-media-lifecycle.js?v=20261102-finish-liveid5'
       ];
       window.DartArenaMediaTrace?.mark('MATCH_MODULES_LOADING',{count:modules.length});
       for(const src of modules){
         const path=src.split('?')[0];
         if([...document.scripts].some(el=>el.src&&new URL(el.src).pathname.endsWith('/'+path)))continue;
         await script(src);
       }
       // Do not cut the waiting-room transport until both a new publication
       // and a live subscribed opponent video are visible in the match session.
       window.DartArenaMediaTrace?.mark('HANDOFF_WAIT_NEW_SFU');
       const deadline=Date.now()+15000;
       while(!window.DartArenaMatchMedia?.readyForHandoff?.()){
         if(Date.now()>deadline)throw Error('Kampvideo ble ikke klar før overgang');
         await new Promise(resolve=>setTimeout(resolve,250));
       }
       window.DartArenaMediaTrace?.mark('HANDOFF_NEW_SFU_READY');
       // Make-before-break must be mutual: a faster player must not close
       // their waiting-room SFU while the opponent is still preparing match SFU.
       if(!window.DartArenaHandoffBarrier?.wait)throw Error('Both-player media barrier is not loaded');
       await window.DartArenaHandoffBarrier.wait({
         client,matchId:liveMatchId,me:state.user(),
         opponent:match.player1_id===state.user()?match.player2_id:match.player1_id
       });
       window.DartArenaMediaTrace?.mark('HANDOFF_RELEASING_OLD_MEDIA');
       state.releaseForHandoff?.();
       released=true;
       window.DartArenaMediaTrace?.mark('HANDOFF_SUCCESS');
       return true;
     }catch(err){
       window.DartArenaMediaTrace?.mark('HANDOFF_FAILED',err?.message||String(err));
       console.error('[same-page match handoff]',err);
       // Scoring may already have booted, so a clean navigation is safer
       // than trying to resume the old room with two engines active.
       if(!released)window.DartArenaCaptureHandoff?.discard?.();
       // After transport teardown, never revive the old SFU room.
       // Navigate only as a recovery path, not as a second active connection.
       const url=new URL('match.html',location.href);
       url.searchParams.set('id',liveMatchId);

       window.DartArenaMediaTrace?.mark('HANDOFF_FALLBACK_NAVIGATION');
       location.replace(url.href);
       return true;
     }
   }
 };
})();