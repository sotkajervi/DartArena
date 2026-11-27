/* Isolated SEER -> existing local 501 engine input preview. No UI or network writes. */
(function(root){
'use strict';
const Visit=typeof module!=='undefined'&&module.exports?require('./seer-visit.js'):(typeof SeerVisit!=='undefined'?SeerVisit:root.SeerVisit);
function preview(state,visit){
  if(!state||state.format!==501||state.status!=='playing'||state.doubleIn||
     ![0,1].includes(state.turn)||!Number.isInteger(state.scores?.[state.turn])||
     state.scores[state.turn]<2) return {status:'blocked',reason:'inactive-or-unsupported'};
  if(!visit||!(visit.darts instanceof Map))return {status:'blocked',reason:'missing-visit'};
  const numbers=[...visit.darts.keys()].sort((a,b)=>a-b);
  if(numbers.some(n=>!Number.isInteger(n)||n<1||n>3))return {status:'blocked',reason:'unexpected-dart-number'};
  let total=0,remaining=state.scores[state.turn];
  for(let i=1;i<=3;i++){
    const dart=visit.darts.get(i);
    if(!dart)return {status:'pending',reason:'missing-dart',dart:i};
    const hit=Visit.selected(dart);
    if(!Visit.points.has(hit))return {status:'pending',reason:'unresolved-dart',dart:i};
    total+=Visit.points.get(hit);
    remaining-=Visit.points.get(hit);
    const double=hit.startsWith('D');
    const bust=remaining<0||remaining===1||(remaining===0&&!double);
    const checkout=remaining===0&&double;
    if(bust||checkout){
      if(numbers.some(n=>n>i))return {status:'blocked',reason:'darts-after-terminal',dart:i};
      return {status:'ready',score:total,options:bust?{bust:true}:{doubleConfirmed:true,darts:i},
        kind:bust?'bust':'checkout',darts:i};
    }
  }
  return {status:'ready',score:total,options:{},kind:'score',darts:3};
}
if(typeof module!=='undefined'&&module.exports)module.exports={preview};
else root.DartArenaSeer501Preview={preview};
})(typeof window!=='undefined'?window:globalThis);
