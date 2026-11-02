/* Opt-in development handoff: same document, real scoring engine.
 * Usage: tournament-match-room.html?id=...&samePageDev=1
 * The existing production transition stays unchanged without that flag.
 */
(()=>{
 'use strict';
 if(new URLSearchParams(location.search).get('samePageDev')!=='1')return;
 if(window.DartArenaTournamentHandoff)return;
 let entering=false;
 function script(src){
   return new Promise((resolve,reject)=>{
     const el=document.createElement('script');
     el.src=src;el.async=false;
     el.onload=resolve;
     el.onerror=()=>reject(new Error('Kunne ikke laste '+src));
     document.body.appendChild(el);
   });
 }
 window.DartArenaTournamentHandoff={
   async enter({liveMatchId,tournamentMatchId,transferCapture,releaseWaitingRoom}={}){
     if(entering)return true;
     if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(liveMatchId||''))return false;
     const state=window.DartArenaTournamentRoomState;
     const client=state?.client?.();
     if(!client||!state?.userId?.())return false;
     // Validate match membership before taking ownership of media.
     const {data:match,error}=await client.from('matches')
       .select('id,player1_id,player2_id,status')
       .eq('id',liveMatchId).single();
     if(error||!match||!['playing','live'].includes(match.status)||
        ![match.player1_id,match.player2_id].includes(state.userId()))return false;
     entering=true;
     let released=false;
     try{
       const host=window.DartArenaMatchSceneHost;
       if(!host)throw Error('Kamp-scene er ikke lastet');
       host.prepare();
       // No second document or iframe. The same video nodes are moved into place.
       await host.enter();
       document.body.classList.add('match-page');
       document.body.classList.remove('da-prematch-active');
       if(typeof transferCapture==='function')transferCapture();
       else releaseWaitingRoom?.();
       released=true;
       // match.js is now safe to load: tournament engine is IIFE scoped.
       // The match page owns the new authenticated SFU session.
       await script('match.js?v=20261102-samepage-dev1');
       if(typeof window.DartArenaBootLiveMatch!=='function')throw Error('Kampmotor mangler');
       await window.DartArenaBootLiveMatch(liveMatchId);
       // Load the existing match modules only after the room is released and
       // scoring has an authenticated live-match ID. Reuse scripts already on
       // the tournament page instead of initializing duplicate media listeners.
       const modules=[
         'fx-live.js?v=20261023-sweep2',
         'fx-match-bridge.js?v=20261023-live1',
         'autozoom/heatmap-math.js?v=20261023-final2',
         'online-heatmap-chart.js?v=20261023-shareheat1',
         'online-heatmap-result.js?v=20261025-i18nfix1',
         'match-media-router.js?v=20261102-samepage-dev1',
         'match-controls.js?v=20261102-samepage-dev1',
         'opponent-focus.js?v=20261026-owncam-pip1',
         'dartarena-dialog.js?v=20261027-correction2',
         'throw-log.js?v=20261101-channel-cleanup1',
         'set-engine.js?v=20261101-channel-cleanup1',
         'x01-leg-starter-marker.js?v=20261006-starterfirst1',
         'checkout-engine.js?v=20261101-channel-cleanup1',
         'secure-match-cancel.js?v=20261013-lobbytab1',
         'x01-stats.js?v=20260929-first9a',
         'match-room-polish.js?v=20261002-matchrooms2',
         'result-screenshot.js?v=20261023-shareheat1',
         'live-avg.js?v=20261101-realtime-lean1',
         'stats-engine.js?v=20261101-realtime-lean1',
         'spectator-presence.js?v=20261006-layer1',
         'match-spectator-broadcast.js?v=20261031-spectator1',
         'ui-feedback.js?v=20260930-cam2',
         'shared-results.js?v=20261023-final2',
         'chicago-flow.js?v=20261006-chicago5',
         'x01-result-leg-details.js?v=20261020-legs-scroll1',
         'mobile-x01-keypad.js?v=20261025-mobile1',
         'post-match-media-lifecycle.js?v=20261029-postmatch1'
       ];
       for(const src of modules){
         const path=src.split('?')[0];
         if([...document.scripts].some(el=>el.src&&new URL(el.src).pathname.endsWith('/'+path)))continue;
         await script(src);
       }
       return true;
     }catch(err){
       console.error('[same-page match handoff]',err);
       if(!released){
         entering=false;
         window.DartArenaMatchSceneHost?.restore?.();
         return false;
       }
       // After transport teardown, never revive the old SFU room.
       // Navigate only as a recovery path, not as a second active connection.
       const url=new URL('match.html',location.href);
       url.searchParams.set('id',liveMatchId);
       url.searchParams.set('tournamentMatch',tournamentMatchId);
       location.replace(url.href);
       return true;
     }
   }
 };
})();