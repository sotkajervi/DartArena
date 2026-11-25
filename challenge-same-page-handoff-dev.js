/* Opt-in seamless challenge handoff for 170 / 301 / 501 / 1001.
 * Runs only in room.html?challengeSeamlessDev=1 on a test deployment.
 * Uses the original match.html stage and keeps waiting-room capture alive.
 */
(()=>{
 'use strict';
 // Register the existing X01 bridge without using it automatically.
 // The challenge transition controls opt-in: normal X01 still requires the
 // existing flag; Chicago 301 alone can use the same proven bridge.
 // Tournament rooms are unaffected.
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
 async function finishMediaHandoff({client,matchId,me,opponent,resuming=false}={}){
   if(!client||!matchId||!me||!opponent)throw Error('Match handoff participants missing');
   window.DartArenaMediaTrace?.mark('HANDOFF_WAIT_NEW_SFU',{resuming});
   const deadline=Date.now()+20000;
   while(!window.DartArenaMatchMedia?.readyForHandoff?.()){
     if(Date.now()>deadline)throw Error('Kampvideo ble ikke klar før overgang');
     await new Promise(resolve=>setTimeout(resolve,250));
   }
   window.DartArenaMediaTrace?.mark('HANDOFF_NEW_SFU_READY');
   // On reload, the opponent is already in the match. A second mutual barrier
   // would deadlock until the opponent also refreshed its page.
   if(!resuming){
     if(!window.DartArenaHandoffBarrier?.wait)throw Error('Both-player media barrier is not loaded');
     await window.DartArenaHandoffBarrier.wait({client,matchId,me,opponent});
   }
   window.DartArenaMediaTrace?.mark('HANDOFF_RELEASING_OLD_MEDIA');
   window.DartArenaChallengeRoomState?.releaseForHandoff?.();
   window.DartArenaMediaTrace?.mark('HANDOFF_SUCCESS',{resuming});
   return true;
 }
 window.DartArenaChallengeSamePageHandoff={
   finishMediaHandoff,
   async enter({liveMatchId,challengeId,resuming=false}={}){
     if(entering)return true;
     if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(liveMatchId||''))return false;
     const state=window.DartArenaChallengeRoomState;
     const client=state?.client?.();
     if(!client||!state?.user?.())return false;
     // Validate match membership before taking ownership of media.
     const {data:match,error}=await client.from('matches')
       .select('id,player1_id,player2_id,status,game_variant')
       .eq('id',liveMatchId).maybeSingle();
     if(error||!match||!['playing','live'].includes(match.status)||
        ![match.player1_id,match.player2_id].includes(state.user()))return false;
     const pentathlon=match.game_variant==='pentathlon';
     entering=true;
     window.DartArenaMediaTrace?.mark('HANDOFF_BEGIN',{kind:'challenge',liveMatchId:String(liveMatchId).slice(0,8)});
     let released=false;
     try{
       if(pentathlon){
         const controller=window.DartArenaPentathlonMatchTest;
         if(typeof controller?.ready!=='function')throw Error('Pentathlon-modulen er ikke lastet');
         await controller.ready();
       }
       const host=window.DartArenaMatchSceneHost;
       if(!host)throw Error('Kamp-scene er ikke lastet');
       await host.prepare();
       window.DartArenaMediaTrace?.mark('MATCH_SCENE_PREPARED');
       // The imported X01 scene contains placeholder 501 scores. On
       // Pentathlon refresh, keep only the SCOREBOARD hidden until its
       // saved stage has been rendered, not the existing camera or media.
       if(pentathlon)document.documentElement.classList.add('da-penta-score-loading');
       // No second document or iframe. The same video nodes are moved into place.
       await host.enter();
       window.DartArenaMediaTrace?.mark('MATCH_SCENE_VISIBLE');
       document.body.classList.add('match-page');
       document.body.classList.remove('da-prematch-active');
       // On refresh the original room channel may still be initializing camera.
       // The standard X01 engine owns the tracks after capture transfer.
       if(pentathlon){
         const cameraDeadline=Date.now()+20000;
         while(!state.stream()?.getVideoTracks?.().some(t=>t.readyState==='live')){
           if(Date.now()>cameraDeadline)throw Error('Kamera fra venterommet ble ikke klart');
           await new Promise(resolve=>setTimeout(resolve,250));
         }
       }
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
       await script('match.js?v=20261125-score-roll1',{module:true});
       if(typeof window.DartArenaBootLiveMatch!=='function')throw Error('Kampmotor mangler');
       await window.DartArenaBootLiveMatch(liveMatchId);
       window.DartArenaMediaTrace?.mark('MATCH_ENGINE_BOOTED');
       // Pentathlon uses the same X01 match.js camera and media router, but
       // does not load X01 scoring, statistics or checkout controllers.
       if(pentathlon){
         // Load the EXACT X01 camera PiP and scoring-dock positioning module
         // before Pentathlon adapts the scoring controls. Never build a second dock.
         await script('opponent-focus.js?v=20261026-owncam-pip1');
         await script('match-controls.js?v=20261123-action-label25');
         await script('dartarena-dialog.js?v=20261027-correction2');
         await script('throw-log.js?v=20261125-score-roll1');
         await script('match-media-router.js?v=20261104-preserve-challenge1');
         const test=window.DartArenaPentathlonMatchTest;
         if(typeof test?.enter!=='function')throw Error('Pentathlon-spillmotoren er ikke lastet');
         await test.enter({matchId:liveMatchId,resuming,mediaManaged:true});
         // test.enter() awaits the Pentathlon state and runs render().
         document.documentElement.classList.remove('da-penta-score-loading');
       // X01's existing fixed-height sidebar controller, not a Pentathlon clone.
       await script('x01-stable-sidebar.js?v=20261104-measure1');
         await finishMediaHandoff({
           client,matchId:liveMatchId,me:state.user(),
           opponent:match.player1_id===state.user()?match.player2_id:match.player1_id,
           resuming
         });
         released=true;
         return true;
       }
       // Load the existing match modules only after the room is released and
       // scoring has an authenticated live-match ID. Reuse scripts already on
       // the tournament page instead of initializing duplicate media listeners.
       const modules=[
         'fx-live.js?v=20261125-score-roll1',
         'fx-match-bridge.js?v=20261125-score-roll1',
         'autozoom/heatmap-math.js?v=20261023-final2',
         'online-heatmap-chart.js?v=20261023-shareheat1',
         'online-heatmap-result.js?v=20261104-shared-auth1',
         'match-media-router.js?v=20261104-preserve-challenge1',
         'match-controls.js?v=20261123-action-label25',
         'opponent-focus.js?v=20261026-owncam-pip1',
          'x01-stable-sidebar.js?v=20261104-measure1',
         'dartarena-dialog.js?v=20261027-correction2',
         'cancelled-match-modal.js?v=20261103-tournament-return3',
         'throw-log.js?v=20261125-score-roll1',
         'set-engine.js?v=20261124-score-recovery1',
         'x01-leg-starter-marker.js?v=20261125-live-starter1',
         'checkout-engine.js?v=20261121-score-sync1',
         'secure-match-cancel.js?v=20261104-shared-auth1',
         'x01-stats.js?v=20260929-first9a',
         'match-room-polish.js?v=20261002-matchrooms2',
         'result-screenshot.js?v=20261023-shareheat1',
         'live-avg.js?v=20261102-live-id-fix3',
         'stats-engine.js?v=20261102-stats-button4',
         'spectator-presence.js?v=20261104-shared-auth1',
         'match-spectator-broadcast.js?v=20261104-shared-auth1',
         'match-media-telemetry.js?v=20261121-telemetry10s1',
         'ui-feedback.js?v=20260930-cam2',
         'shared-results.js?v=20261105-single-return1',
         'chicago-flow.js?v=20261104-live-match-id1',
         'x01-result-leg-details.js?v=20261104-shared-auth1',
         'mobile-x01-keypad.js?v=20261025-mobile1',
         'post-match-media-lifecycle.js?v=20261104-shared-auth1'
       ];
       window.DartArenaMediaTrace?.mark('MATCH_MODULES_LOADING',{count:modules.length});
       for(const src of modules){
         const path=src.split('?')[0];
         if([...document.scripts].some(el=>el.src&&new URL(el.src).pathname.endsWith('/'+path)))continue;
         await script(src);
       }
       // Do not cut the waiting-room transport until both a new publication
       // and a live subscribed opponent video are visible in the match session.
       await finishMediaHandoff({
         client,matchId:liveMatchId,me:state.user(),
         opponent:match.player1_id===state.user()?match.player2_id:match.player1_id
       });
       released=true;
       window.DartArenaMediaTrace?.mark('HANDOFF_SUCCESS');
       return true;
     }catch(err){
       document.documentElement.classList.remove('da-penta-score-loading');
       window.DartArenaMediaTrace?.mark('HANDOFF_FAILED',err?.message||String(err));
       console.error('[same-page match handoff]',err);
       if(pentathlon){
         // Never leave a broken X01 scorecard presented as a Pentathlon match.
         const message=String(err?.message||err);
         window.DartArenaMediaTrace?.mark('PENTATHLON_HANDOFF_FAILED',message);
         console.error('[Pentathlon shared X01 handoff]',err);
         let overlay=document.getElementById('ptStartupError');
         if(!overlay){
           overlay=document.createElement('div');
           overlay.id='ptStartupError';
           overlay.className='da-dialog-layer';
           overlay.innerHTML='<div class="da-dialog-backdrop"></div><section class="da-dialog-card" role="alertdialog" aria-modal="true" aria-labelledby="ptStartupErrorHeading"><span class="da-dialog-kicker">PENTATHLON</span><h2 id="ptStartupErrorHeading" class="da-dialog-title">Kamprommet kunne ikke åpnes</h2><p id="ptStartupErrorText" class="da-dialog-message"></p><div class="da-dialog-actions"><button id="ptStartupRetry" class="da-dialog-confirm" type="button">Prøv på nytt</button></div></section>';
           document.body.appendChild(overlay);
           overlay.querySelector('#ptStartupRetry').onclick=()=>location.reload();
         }
         overlay.querySelector('#ptStartupErrorText').textContent=message;
         document.documentElement.classList.remove('da-penta-rejoin');
         return true;
       }
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