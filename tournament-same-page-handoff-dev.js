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
       await script('match-media-router.js?v=20261102-samepage-dev1');
       await script('match-controls.js?v=20261102-samepage-dev1');
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