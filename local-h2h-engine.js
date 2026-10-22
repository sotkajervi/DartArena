/* Offline DartArena X01: mirrors online submit_x01_visit and submit_match_checkout rules. */
(function(global){
'use strict';
const forbidden=new Set([163,166,169,172,173,175,176,178,179]);
const numbers=Array.from({length:20},(_,i)=>i+1);
const doubles=numbers.map(n=>n*2).concat(50);
const any=[0,...new Set([...numbers,...doubles,...numbers.map(n=>n*3),25,50])];
const outs=[new Set(),new Set(),new Set(),new Set()];
for(const d of doubles){outs[1].add(d);for(const a of any){outs[2].add(a+d);for(const b of any)outs[3].add(a+b+d)}}
const clone=value=>JSON.parse(JSON.stringify(value));
function assert(test,message){if(!test)throw Error(message)}
const validScore=n=>Number.isInteger(n)&&n>=0&&n<=180&&!forbidden.has(n);
const validCheckout=(score,darts)=>Number.isInteger(score)&&score>=2&&score<=170&&Number.isInteger(darts)&&darts>=1&&darts<=3&&outs[darts].has(score);
const checkoutOptions=score=>[1,2,3].filter(darts=>validCheckout(score,darts));
const needed=best=>(best+1)/2;
const opposite=n=>1-n;
function legStarter(state,setNo=state.currentSet,legNo=state.leg){
  const base=(setNo%2===1)?state.firstStarter:opposite(state.firstStarter);
  return legNo%2===1?base:opposite(base);
}
function setup(config){
  const players=[String(config?.name1||'').trim().slice(0,32),String(config?.name2||'').trim().slice(0,32)];
  const format=Number(config?.format),bestOf=Number(config?.bestOf),bestOfSets=Number(config?.bestOfSets||1);
  const mode=config?.mode==='sets'?'sets':'legs',firstStarter=Number(config?.starter);
  assert(players.every(Boolean),'Skriv inn navn på begge spillerne.');
  assert([170,301,501,1001].includes(format),'Ugyldig startscore.');
  assert(Number.isInteger(bestOf)&&bestOf%2===1&&bestOf>=1&&bestOf<=21,'Velg gyldig antall legs.');
  assert(Number.isInteger(bestOfSets)&&bestOfSets%2===1&&bestOfSets>=1&&bestOfSets<=15,'Velg gyldig antall sets.');
  assert([0,1].includes(firstStarter),'Ugyldig startspiller.');
  const doubleIn=config?.doubleIn===true&&format===301;
  return {version:2,id:String(Date.now()),players,format,mode,bestOf,doubleIn,entered:[!doubleIn,!doubleIn],
    bestOfSets:mode==='sets'?bestOfSets:1,currentSet:1,leg:1,
    firstStarter,starter:firstStarter,turn:firstStarter,sets:[0,0],legs:[0,0],
    scores:[format,format],status:'playing',winner:null,betweenType:null,
    visits:[],undo:[],startedAt:new Date().toISOString()};
}
function snapshot(state){const saved=clone(state);delete saved.undo;return saved}
function changed(previous,next){next.undo=[...(previous.undo||[]),snapshot(previous)].slice(-100);return next}
function submit(state,value,opts={}){
  assert(state?.version===2&&state.status==='playing','Kampen er ikke klar for ny score.');
  const raw=String(value).trim(),score=Number(raw);
  assert(raw!==''&&validScore(score),'Scoren er ikke mulig med tre piler (0–180).');
  const next=snapshot(state),p=state.turn,remaining=state.scores[p];
  let bust=opts.bust===true,checkout=false,darts=3;
  const requiresDouble=next.doubleIn===true&&next.entered?.[p]!==true;
  const enteredNow=requiresDouble&&!bust&&score>0&&opts.doubleInConfirmed===true;
  if(requiresDouble&&!enteredNow&&!bust&&score>0)throw Error('Double In: Bekreft at første tellende pil traff en dobbel, eller registrer 0.');
  if(score>remaining||remaining-score===1)bust=true;
  if(score===remaining&&!bust){
    darts=Number(opts.darts);
    assert(opts.doubleConfirmed===true,'Bekreft at siste pil traff dobbel.');
    assert(validCheckout(score,darts),'Ugyldig utsjekk med valgt antall piler.');
    checkout=true;
  }
  const credited=bust||requiresDouble&&!enteredNow?0:score;
  if(enteredNow)next.entered[p]=true;
  next.scores[p]=remaining-credited;
  next.visits.push({player:p,set:state.currentSet,leg:state.leg,
    score:credited,attempt:score,darts,bust,checkout,doubleInConfirmed:enteredNow,remaining:next.scores[p],
    at:new Date().toISOString()});
  if(!checkout){next.turn=opposite(p);return changed(state,next)}
  next.legs[p]++;
  if(next.legs[p]<needed(state.bestOf)){next.status='between';next.betweenType='leg';return changed(state,next)}
  if(state.mode==='legs'){next.status='finished';next.winner=p;return changed(state,next)}
  next.sets[p]++;
  if(next.sets[p]>=needed(state.bestOfSets)){next.status='finished';next.winner=p}
  else {next.status='between';next.betweenType='set'}
  return changed(state,next);
}
const bust=state=>submit(state,0,{bust:true});
function nextLeg(state){
  assert(state?.version===2&&state.status==='between','Neste leg er ikke klart.');
  const next=snapshot(state);
  if(state.betweenType==='set'){next.currentSet++;next.leg=1;next.legs=[0,0]}
  else next.leg++;
  next.starter=legStarter(next,next.currentSet,next.leg);
  next.turn=next.starter;next.scores=[next.format,next.format];
  next.entered=next.doubleIn?[false,false]:[true,true];
  next.betweenType=null;next.status='playing';
  return changed(state,next);
}
function undo(state){
  assert(state?.undo?.length,'Ingen registrering å angre.');
  const stack=state.undo.slice(),previous=stack.pop();
  previous.undo=stack;return previous;
}
function editableIndices(state,player){
  if(state?.status!=='playing')return [];
  return state.visits.map((visit,index)=>({visit,index}))
    .filter(({visit})=>visit.player===player&&visit.leg===state.leg&&
      (visit.set||1)===state.currentSet&&!visit.checkout)
    .slice(-3).map(({index})=>index);
}
function correctVisit(state,index,newScore,checkoutDarts=null){
  assert(state?.version===2&&state.status==='playing','Korrigering krever et aktivt leg.');
  const oldVisit=state.visits?.[index];
  assert(oldVisit&&editableIndices(state,oldVisit.player).includes(index),
    'Bare spillerens tre siste kast i aktivt leg kan korrigeres.');
  const raw=String(newScore).trim(),score=Number(raw);
  assert(raw!==''&&validScore(score),'Ny score er ikke mulig med tre piler.');
  let replay=setup({name1:state.players[0],name2:state.players[1],
    format:state.format,mode:state.mode,bestOf:state.bestOf,
    bestOfSets:state.bestOfSets,starter:state.firstStarter,doubleIn:state.doubleIn});
  replay.id=state.id;replay.startedAt=state.startedAt;
  for(let i=0;i<state.visits.length;i++){
    const old=state.visits[i];
    if(replay.status==='between'){replay=nextLeg(replay);replay.undo=[]}
    assert(replay.status==='playing'&&replay.currentSet===(old.set||1)&&
      replay.leg===old.leg&&replay.turn===old.player,
      'Korrigeringen endrer tidligere leg eller spillerrekkefølge.');
    const edited=i===index,points=edited?score:old.attempt;
    const options=edited?{doubleInConfirmed:old.doubleInConfirmed}:{bust:old.bust,doubleConfirmed:old.checkout,darts:old.darts,doubleInConfirmed:old.doubleInConfirmed};
    if(edited&&points===replay.scores[old.player]){
      assert(i===state.visits.length-1,'Kan ikke avslutte leget når senere kast er registrert.');
      options.doubleConfirmed=true;options.darts=checkoutDarts;
    }
    replay=submit(replay,points,options);
    const actual=replay.visits[replay.visits.length-1];
    actual.at=old.at;
    if(!edited&&(actual.checkout!==old.checkout||actual.bust!==old.bust||
      actual.score!==old.score))
      throw Error('Endringen påvirker senere kast. Korriger det siste kastet først.');
    replay.undo=[];
  }
  assert(replay.currentSet===state.currentSet&&replay.leg===state.leg,
    'Korrigeringen endrer aktivt leg.');
  replay.undo=[...(state.undo||[]),snapshot(state)].slice(-100);
  return replay;
}
function stats(state,p){
  const visits=state.visits.filter(v=>v.player===p);
  const scored=visits.reduce((n,v)=>n+v.score,0),darts=visits.reduce((n,v)=>n+v.darts,0);
  let high=0,fast=null;
  for(const checkout of visits.filter(v=>v.checkout)){
    high=Math.max(high,checkout.score);
    const used=visits.filter(v=>v.leg===checkout.leg&&(v.set||1)===(checkout.set||1)).reduce((n,v)=>n+v.darts,0);
    fast=fast===null?used:Math.min(fast,used);
  }
  return {visits:visits.length,scored,darts,average:darts?3*scored/darts:0,highestCheckout:high,fastestLeg:fast};
}
// Migrate active v1 browser games to v2 without erasing scores or undo history.
function upgrade(old){
  if(!old||typeof old!=='object')return null;
  if(old.version===2)return old;
  if(old.version!==1)return null;
  const migrated={...old,version:2,mode:'legs',bestOfSets:1,currentSet:1,sets:[0,0],
    betweenType:old.status==='between'?'leg':null};
  migrated.visits=(old.visits||[]).map(v=>({...v,set:1}));
  migrated.undo=(old.undo||[]).map(v=>upgrade(v)).filter(Boolean);
  return migrated;
}
function restore(raw){
  const value=upgrade(raw);
  if(value?.doubleIn===true&&(!Array.isArray(value.entered)||value.entered.length!==2))return null;
  if(!value||![170,301,501,1001].includes(value.format)||
    !['legs','sets'].includes(value.mode)||![0,1].includes(value.firstStarter)||
    !Array.isArray(value.players)||value.players.length!==2||
    !Array.isArray(value.scores)||value.scores.length!==2||
    !Array.isArray(value.legs)||value.legs.length!==2||
    !Array.isArray(value.sets)||value.sets.length!==2||
    !Array.isArray(value.visits)||!['playing','between','finished'].includes(value.status)||
    !Number.isInteger(value.currentSet)||!Number.isInteger(value.leg))return null;
  return value;
}
global.DartArenaLocalH2HEngine={setup,submit,bust,nextLeg,undo,stats,restore,validCheckout,
  checkoutOptions,editableIndices,correctVisit,legStarter,validScore};
})(window);
