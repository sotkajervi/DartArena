/* AI Rival tournament policies, isolated from live match and enrollment flows.
 * The tournament bot is eligible for group standings and seeded cup slots.
 * On bracket creation a round-1 opponent receives a walkover.
 * No reseeding or promotion is done after the group calculation.
 */
(function(root){
 'use strict';
 function buildFirstRound(slots,isBot){
  if(!Array.isArray(slots)||slots.length%2)throw Error('Even cup slot count required');
  if(typeof isBot!=='function')throw Error('Bot predicate required');
  const results=[];
  for(let i=0;i<slots.length;i+=2){
   const a=slots[i]||null,b=slots[i+1]||null;
   const botA=!!a&&isBot(a),botB=!!b&&isBot(b);
   const humanA=a&&!botA?a:null,humanB=b&&!botB?b:null;
   let winner=null,reason=null;
   if(botA||botB)reason='ai_rival';
   else if(!a||!b)reason='bye';
   if(reason&&Boolean(humanA)!==Boolean(humanB))winner=humanA||humanB;
   results.push({
    slotA:a,slotB:b,player1:humanA,player2:humanB,
    status:winner?'wo':(!humanA||!humanB?'pending':'pending'),
    isWO:!!winner,winner,woReason:winner?reason:null
   });
  }
  return results;
 }
 const api={buildFirstRound};
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.DartArenaTournamentAIPolicy=api;
})(typeof window!=='undefined'?window:globalThis);
