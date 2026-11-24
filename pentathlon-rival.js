/* Local Pentathlon Rival: empirical X01, estimated target precision. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function build(rows){
 const model=root.DartArenaRivalModel.build(rows,root.DartArenaLocalH2HEngine,{format:1001});
 const close=model.events.filter(v=>v.before<=40), wins=close.filter(v=>v.checkout).length;
 const rate=clamp((wins+2)/(close.length+8),.06,.78),avg=model.historyAverage;
 return {model,double:clamp(1-Math.pow(1-rate,1/2.2),.04,.48),triple:clamp((avg-20)/180,.035,.43),target:clamp(.38+avg/175,.43,.92)};
}
function step(s,p,E,rng=Math.random){
 if(s.status!=='playing'||s.current.turn!==1)return s;
 if(s.current.kind==='x01'){
  const rest=s.current.remaining[1],v=p.model.visit(Math.min(1001,rest),{rng});
  return E.submitX01(s,{score:v.score,bust:v.bust===true,doubleConfirmed:v.checkout===true&&v.score===rest,darts:v.darts});
 }
 for(let i=0;i<3&&s.status==='playing'&&s.current.turn===1;i++){
  const t=E.currentTarget(s),r=rng();let d={n:0,m:0};
  if(s.current.kind==='clock'||t.type==='double'){
   if(r<p.double*(t.number===25?.65:1))d={n:t.number,m:2};
  }else if(t.type==='triple'){
   if(r<p.triple)d={n:t.number,m:3};
  }else{
   const a=Math.min(p.triple,p.target*.5),b=Math.min(p.double*.4,p.target*.25);
   if(r<a)d={n:t.number,m:3};else if(r<a+b)d={n:t.number,m:2};else if(r<p.target)d={n:t.number,m:1};
  }
  s=E.submitDart(s,d);
 }
 return s;
}
root.DartArenaPentathlonRival=Object.freeze({build,step});
})(window);