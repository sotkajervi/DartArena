/* Single challenge-start entrypoint for X01 170, 301, 501 and 1001.
 * Other game modes and unprepared handoffs retain existing navigation.
 * The test switch is opt-in; no live media is torn down here.
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
     const {data:match,error}=await db.from('matches').select('id,game,game_variant,game_config,player1_id,player2_id,status').eq('id',matchId).maybeSingle();
     if(error||!match||![match.player1_id,match.player2_id].includes(user))throw error||new Error('Match access denied');
     const game=String(match.game||'');
     const isX01=x01.has(game)&&match.game_variant==='x01'&&String(match.game_config?.chicago||'false')!=='true';
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