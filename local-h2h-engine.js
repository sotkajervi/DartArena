/* DartArena local x01 engine: no network, camera, or account required. */
(function(global){
'use strict';
const nums=Array.from({length:20},(_,i)=>i+1);
const doubleScores=nums.map(n=>2*n).concat(50);
const anyScore=[0,...new Set([...nums,...doubleScores,...nums.map(n=>3*n),25,50])];
const checkouts=[new Set(),new Set(),new Set(),new Set()];
for(const d of doubleScores){
  checkouts[1].add(d);
  for(const a of anyScore){
    checkouts[2].add(a+d);
    for(const b of anyScore)checkouts[3].add(a+b+d);
  }
}
const clone=value=>JSON.parse(JSON.stringify(value));
function assert(ok,msg){if(!ok)throw Error(msg)}
function setup(config){
  const players=[String(config?.name1||'').trim().slice(0,32),String(config?.name2||'').trim().slice(0,32)];
  const format=Number(config?.format),bestOf=Number(config?.bestOf),starter=Number(config?.starter);
  assert(players.every(Boolean),'Skriv inn navn på begge spillerne.');
  assert([170,301,501].includes(format),'Ugyldig startscore.');
  assert(Number.isInteger(bestOf)&&bestOf>=1&&bestOf<=15&&bestOf%2===1,'Velg antall legs.');
  assert(starter===0||starter===1,'Ugyldig startspiller.');
  return {version:1,id:String(Date.now()),players,format,bestOf,firstStarter:starter,leg:1,
    starter,turn:starter,legs:[0,0],scores:[format,format],status:'playing',
    winner:null,visits:[],undo:[],startedAt:new Date().toISOString()};
}
function snapshot(s){const obj=clone(s);delete obj.undo;return obj}
function changed(previous,next){next.undo=[...(previous.undo||[]),snapshot(previous)].slice(-100);return next}
function validCheckout(score,darts){
  return Number.isInteger(score)&&Number.isInteger(darts)&&darts>=1&&darts<=3&&checkouts[darts].has(score);
}
const checkoutOptions=score=>[1,2,3].filter(d=>validCheckout(score,d));
function submit(state,value,opts={}){
  assert(state?.version===1&&state.status==='playing','Kampen er ikke klar for ny score.');
  const text=String(value).trim(),score=Number(text);
  assert(text!==''&&Number.isInteger(score)&&score>=0&&score<=180,'Scoren må være fra 0 til 180.');
  const next=snapshot(state),p=state.turn,remain=state.scores[p];
  let bust=Boolean(opts.bust),checkout=false,darts=3;
  if(score>remain||remain-score===1)bust=true;
  if(score===remain&&!bust){
    darts=Number(opts.darts);
    assert(opts.doubleConfirmed===true,'Bekreft at siste pil traff dobbel.');
    assert(validCheckout(score,darts),'Ugyldig utsjekk med valgt antall piler.');
    checkout=true;
  }
  if(!bust&&!checkout)assert(score<remain,'Ugyldig score.');
  const credited=bust?0:score;
  next.scores[p]-=credited;
  next.visits.push({player:p,leg:state.leg,score:credited,attempt:score,darts,bust,checkout,
    remaining:next.scores[p],at:new Date().toISOString()});
  if(checkout){
    next.legs[p]++;
    if(next.legs[p]>=(state.bestOf+1)/2){next.status='finished';next.winner=p}
    else next.status='between';
  }else next.turn=1-p;
  return changed(state,next);
}
function bust(state){return submit(state,0,{bust:true})}
function nextLeg(state){
  assert(state?.version===1&&state.status==='between','Neste leg er ikke klart.');
  const next=snapshot(state);
  next.leg++;next.starter=1-next.starter;next.turn=next.starter;
  next.scores=[next.format,next.format];next.status='playing';
  return changed(state,next);
}
function undo(state){
  assert(state?.undo?.length,'Ingen registrering å angre.');
  const stack=state.undo.slice(),previous=stack.pop();
  previous.undo=stack;return previous;
}
function stats(state,p){
  const visits=state.visits.filter(v=>v.player===p);
  const scored=visits.reduce((a,v)=>a+v.score,0),darts=visits.reduce((a,v)=>a+v.darts,0);
  let fastestLeg=null,highestCheckout=0;
  for(const v of visits.filter(x=>x.checkout)){
    highestCheckout=Math.max(highestCheckout,v.score);
    const used=visits.filter(x=>x.leg===v.leg).reduce((a,x)=>a+x.darts,0);
    fastestLeg=fastestLeg===null?used:Math.min(fastestLeg,used);
  }
  return {visits:visits.length,scored,darts,average:darts?3*scored/darts:0,
    fastestLeg,highestCheckout,busts:visits.filter(v=>v.bust).length,
    hundreds:visits.filter(v=>v.score>=100).length,
    forties:visits.filter(v=>v.score>=140).length,
    oneEighties:visits.filter(v=>v.score===180).length};
}
function restore(value){
  if(!value||value.version!==1||![170,301,501].includes(value.format)||
    !Array.isArray(value.players)||value.players.length!==2||
    !Array.isArray(value.scores)||value.scores.length!==2||
    !Array.isArray(value.legs)||value.legs.length!==2||
    !Array.isArray(value.visits)||!['playing','between','finished'].includes(value.status))return null;
  return value;
}
global.DartArenaLocalH2HEngine={setup,submit,bust,nextLeg,undo,stats,restore,validCheckout,checkoutOptions};
})(window);
