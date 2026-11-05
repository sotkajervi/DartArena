/* Challenge start entrypoint for X01 (including Chicago 301) and Cricket seamless match transitions.
 * Unsupported modes and unprepared handoffs retain original navigation.
 * No live media is torn down here.
 */
(()=>{
 'use strict';
 if(window.DartArenaChallengeStart)return;
 const x01=new Set(['170','301','501','1001']);
 let started=false;
 const valid=id=>/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id||'');
 const target=(id,variant)=>{
   const page=window.DartArenaGames?.pageForVariant?.(variant)||
     (variant==='cricket'?'cricket.html':variant==='half_it'?'half-it.html':variant==='sixty_one'?'61-match.html':variant==='jdc'?'jdc-match.html':'match.html');
   return page+'?id='+encodeURIComponent(id);
 };
 async function begin(matchId,variant,{startAt}={}){
   if(started||!valid(matchId))return;
   started=true;
   window.DartArenaMediaTrace?.mark('CHALLENGE_START',{matchId:String(matchId).slice(0,8),variant});
   try{
     const db=window.DartArenaChallengeRoomState?.client?.();
     const user=window.DartArenaChallengeRoomState?.user?.();
     if(!db||!user)throw Error('Challenge credentials unavailable');
     const {data:match,error}=await db.from('matches').select('id,game,current_leg,game_variant,game_config,player1_id,player2_id,status').eq('id',matchId).maybeSingle();
     if(error||!match||![match.player1_id,match.player2_id].includes(user))throw error||new Error('Match access denied');
     // Remember the exact match for this tab so Ctrl+R can rejoin directly.
     if(['playing','live'].includes(match.status)){
       try{sessionStorage.setItem('dartarena-challenge-match:'+window.DartArenaChallengeRoomState.challengeId(),match.id)}catch{}
     }
     const game=String(match.game||'');
     // Chicago Game 1 is the existing X01 301 engine. Reuse its proven
     // challenge waiting-room -> X01 same-document video handoff.
     // Never attempt an X01 handoff after Chicago switches to Cricket.
     const chicago=String(match.game_config?.chicago??'false').toLowerCase()==='true';
     const chicagoStage=Number(match.game_config?.chicago_stage||match.current_leg||1);
     const chicagoX01Start=chicago&&match.game_variant==='x01'&&chicagoStage===1;
     const isX01=match.game_variant==='x01'&&
       (chicagoX01Start||(!chicago&&x01.has(game)));
     if(variant==='cricket'&&window.DartArenaCricketSamePage?.enter&&
        await window.DartArenaCricketSamePage.enter({liveMatchId:matchId})===true)return;
     const bridge=window.DartArenaChallengeSamePageHandoff;
     // Give both authenticated players the same media migration window when
     // no coin flip is used, instead of racing the opponent's start event.
     if(isX01&&typeof bridge?.enter==='function'&&Number.isFinite(Number(startAt))&&Number(startAt)>Date.now()){
       await new Promise(resolve=>setTimeout(resolve,Math.min(4000,Math.max(0,Number(startAt)-Date.now()))));
     }
     if(isX01&&typeof bridge?.enter==='function'&&
       await bridge.enter({liveMatchId:matchId,challengeId:new URLSearchParams(location.search).get('id')})===true)return;
   }catch(error){console.warn('[challenge transition] Using original match page',error)}
   window.DartArenaMediaTrace?.mark('CHALLENGE_LEGACY_NAVIGATION');
   location.href=target(matchId,variant);
 }
 window.DartArenaChallengeStart=Object.freeze({
   supportedGames:Object.freeze([...x01]),
   open(matchId,variant,options={}){if(!valid(matchId)||started)return true;begin(matchId,variant,options);return true}
 });
})();