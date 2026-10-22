/* Shared empirical X01 AI Rival model: reconstruct visits by leg, learn checkout situations,
 * and calibrate finishing to actual historical 3-dart average. No changes to real match data. */
(()=>{'use strict';window.DartArenaRivalModel=(function rivalModelFactory(){
 'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function seeded(seed){let x=(seed>>>0)||1;return()=>{x=(x+0x6D2B79F5)|0;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
 function build(visits,engine,settings={}){
  if(!engine||!engine.validScore||!engine.checkoutOptions)throw Error('X01-regelmotor mangler.');
  const format=Number(settings.format||501),doubleIn=format===301&&settings.doubleIn===true;
  if(![170,301,501,1001].includes(format))throw Error('Ukjent X01-format.');
  const legs=new Map();
  for(const row of visits||[]){
   const key=[row.match_id,row.set_no||1,row.leg_no||1].join(':');
   if(!legs.has(key))legs.set(key,[]);
   legs.get(key).push(row);
  }
  const events=[];let wins=0,discarded=0;
  for(const group of legs.values()){
   group.sort((a,b)=>Number(a.visit_no)-Number(b.visit_no)||Number(a.id)-Number(b.id));
   let remaining=501,rounds=[],invalid=false;
   for(const row of group){
    const score=Number(row.score),darts=Number(row.darts_used)||3;
    if(!engine.validScore(score)||!Number.isInteger(darts)||darts<1||darts>3){invalid=true;break}
    const finish=row.is_checkout===true&&remaining===score&&engine.checkoutOptions(remaining).includes(darts);
    if(!finish && (score>remaining-2 || darts!==3)){invalid=true;break}
    rounds.push({before:remaining,score,darts,checkout:finish});
    remaining-=score;
    if(finish){wins++;break}
   }
   if(invalid){discarded++;continue}
   events.push(...rounds);
  }
  const scored=events.reduce((a,v)=>a+v.score,0),darts=events.reduce((a,v)=>a+v.darts,0);
  const avg=darts?3*scored/darts:0;
  if(events.length<30||wins<3)throw Error('AI Rival krever minst 30 gyldige 501-runder og 3 fullførte legs for å estimere spillerstyrke.');
  const open=events.filter(v=>v.before>170);
  const ending=events.filter(v=>v.before<=170);
  // Dartmål logges ikke. Double-in-raten estimeres fra historisk dobbel-ut.
  const closeAttempts=ending.filter(v=>v.before<=40).length;
  const closeSuccess=ending.filter(v=>v.before<=40&&v.checkout).length;
  const doubleInChance=clamp((closeSuccess+2)/(closeAttempts+6)*.8,.10,.66);
  const doubleScores=[...Array.from({length:20},(_,i)=>2*(i+1)),50];
  const singles=[0,...new Set([...Array.from({length:20},(_,i)=>i+1),...doubleScores,...Array.from({length:20},(_,i)=>3*(i+1)),25])];
  const possibleIn=new Set();
  for(const d of doubleScores)for(const a of singles)for(const b of singles)possibleIn.add(d+a+b);
  const cache=new Map();
  function pool(remaining){
   if(cache.has(remaining))return cache.get(remaining);
   const end=remaining<=170,options=engine.checkoutOptions(remaining);
   const normal=[],finish=[];let ns=0,fs=0;
   for(const v of (end?ending:open)){
    const distance=Math.abs(v.before-remaining);
    let weight=end?Math.pow(1+distance/20,-2):1;
    if(end&&remaining<=40&&v.before>40)weight*=.3;
    if(v.checkout){
     if(!options.length)continue;
     const min=Math.min(...options),darts=options.includes(v.darts)?v.darts:Math.max(min,v.darts);
     fs+=weight;finish.push({score:remaining,darts,weight});
    }else if(v.score<=remaining-2){
     ns+=weight;normal.push({score:v.score,darts:3,weight});
    }
   }
   const result={normal,finish,ns,fs};cache.set(remaining,result);return result;
  }
  function weighted(items,total,rng){
   if(!total)return null;
   let r=rng()*total;
   for(const item of items){r-=item.weight;if(r<=0)return item}
   return items[items.length-1];
  }
  function throwVisit(remaining,scale=1,rng=Math.random,needsDoubleIn=false){
   if(!Number.isInteger(remaining)||remaining<2||remaining>Math.max(format,501))throw Error('Ugyldig restscore.');
   if(doubleIn&&needsDoubleIn){
    if(rng()>=doubleInChance)return {score:0,bust:false,checkout:false,darts:3,doubleInConfirmed:false,throws:[]};
    const openScores=open.filter(v=>!v.checkout&&possibleIn.has(v.score)&&v.score>0&&v.score<=remaining-2);
    const chosen=openScores.length?openScores[Math.floor(rng()*openScores.length)].score:40;
    return {score:chosen,bust:false,checkout:false,darts:3,doubleInConfirmed:true,throws:[]};
   }
   const p=pool(remaining),winWeight=p.fs*scale;
   if(winWeight>0&&rng()*(p.ns+winWeight)<winWeight){
    const item=weighted(p.finish,p.fs,rng);
    return {score:remaining,bust:false,checkout:true,darts:item.darts,throws:[]};
   }
   const item=weighted(p.normal,p.ns,rng);
   return {score:item?.score||0,bust:false,checkout:false,darts:3,throws:[]};
  }
  function simulate(scale,n=180,config={format:501,doubleIn:false}){
   const rng=seeded(815271);let scored=0,darts=0,finished=0;
   for(let leg=0;leg<n;leg++){
    let remaining=Number(config.format||501),entered=config.doubleIn!==true;
    for(let turn=0;turn<180;turn++){
     const item=throwVisit(remaining,scale,rng,!entered);
     if(item.doubleInConfirmed)entered=true;
     scored+=item.score;darts+=item.darts;remaining-=item.score;
     if(item.checkout){finished++;break}
    }
   }
   return {average:darts?3*scored/darts:0,finished};
  }
  // Fit checkout completion speed to observed 3-dart scoring across both
  // winning and unfinished legs; retain the empirical non-checkout distribution.
  let low=.15,high=5,best={scale:1,diff:Infinity,estimate:0};
  for(let i=0;i<12;i++){
   const scale=(low+high)/2;
   const check=simulate(scale,750);
   const diff=Math.abs(check.average-avg)+(check.finished<750?100:0);
   if(diff<best.diff)best={scale,diff,estimate:check.average};
   if(check.average<avg)low=scale;else high=scale;
  }
  // Re-evaluate neighboring values with a larger sample to reduce sampling noise.
  for(const factor of [.86,.93,1,1.07,1.14]){
   const scale=clamp(best.scale*factor,.08,8),check=simulate(scale,1800);
   const diff=Math.abs(check.average-avg)+(check.finished<1800?100:0);
   if(diff<best.diff)best={scale,diff,estimate:check.average};
  }
  const estimate=simulate(best.scale,1000,{format,doubleIn});
  return {format,doubleIn,historyAverage:avg,historyVisits:events.length,historyCheckouts:wins,
   discardedLegs:discarded,calibrationScale:best.scale,estimatedAverage:estimate.average,
   doubleInChance:doubleIn?doubleInChance:null,
   visit:(remaining,config={})=>throwVisit(remaining,best.scale,config.rng||Math.random,config.needsDoubleIn===true),simulate,events};
 }
 return {build};
})();})();
