/* Development-only same-document handoff host.
 * Scoring runs in an isolated iframe to avoid duplicate global db, stream and channel
 * declarations. This is NOT seamless media transfer: waiting-room SFU is closed and
 * match.html creates a new authorized match SFU context.
 */
(()=>{
 'use strict';
 if(!new URLSearchParams(location.search).has('embeddedMatchDev'))return;
 if(window.DartArenaTournamentHandoff)return;
 let started=false;
 window.DartArenaTournamentHandoff={
  async enter({liveMatchId,tournamentMatchId,releaseWaitingRoom}={}){
   if(started)return true;
   if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(liveMatchId||''))return false;
   const main=document.querySelector('main.shell');
   if(!main||typeof releaseWaitingRoom!=='function')return false;
   started=true;
   try{
    const frame=document.createElement('iframe');
    frame.id='daEmbeddedMatch';
    frame.title='DartArena kampmodus';
    frame.allow='camera; microphone; autoplay';
    frame.referrerPolicy='same-origin';
    frame.style.cssText='display:block;width:100%;min-height:90vh;border:0;border-radius:14px;background:#071012';
    const stage=document.createElement('section');
    stage.id='daEmbeddedMatchStage';
    stage.hidden=true;
    stage.appendChild(frame);
    main.after(stage);
    const uri=new URL('match.html',location.href);
    uri.searchParams.set('id',liveMatchId);
    uri.searchParams.set('tournamentMatch',tournamentMatchId);
    const loaded=new Promise((resolve,reject)=>{
      frame.addEventListener('load',resolve,{once:true});
      frame.addEventListener('error',()=>reject(new Error('Kampmodus kunne ikke åpnes')),{once:true});
    });
    // Stop the tournament media context BEFORE booting the live-match context.
    releaseWaitingRoom();
    frame.src=uri.href;
    await Promise.race([loaded,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tidsavbrudd ved kampstart')),12000))]);
    // A cross-document match must acquire its own authenticated media context.
    stage.hidden=false;
    main.hidden=true;
    stage.animate?.([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,easing:'ease-out'});
    return true;
   }catch(error){
    console.error('[DartArena development handoff]',error);
    document.getElementById('daEmbeddedMatchStage')?.remove();
    started=false;
    return false;
   }
  }
 };
})();