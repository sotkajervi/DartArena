/* DartArena local special games. Offline, two players, same core game rules as online. */
(function(root){
'use strict';
const TARGETS=['20','19','18','17','16','15','B'];
const BOARD=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const RSTD=[13,14,'double',15,16,'treble',17,18,41,19,20,'bull'];
const RDC=[20,'double',19,'treble',18,'different',17,'exact',16,'same',15,'bull'];
const BAD=new Set([159,162,163,165,166,168,169]);
const clone=s=>JSON.parse(JSON.stringify(s));
function need(test,msg){if(!test)throw Error(msg)}
function emptyMarks(){return Object.fromEntries(TARGETS.map(t=>[t,0]))}
function init(config){
 const game=String(config.game||'cricket'),players=[String(config.name1||'').trim().slice(0,32),String(config.name2||'').trim().slice(0,32)];
 need(['cricket','half_standard','half_dartcounter','sixty_one','jdc','chicago'].includes(game),'Ukjent spill.');
 need(players.every(Boolean),'Oppgi navn på begge spillere.');
 const bestOf=Number(config.bestOf)||1,starter=Number(config.starter)||0,minutes=Number(config.minutes)||10;
 need(Number.isInteger(bestOf)&&bestOf%2===1&&bestOf>=1&&bestOf<=11,'Ugyldig legs.');
 need([0,1].includes(starter),'Ugyldig startspiller.');
 need([10,20,30,60].includes(minutes),'Velg gyldig varighet.');
 const exactOptions=[60+Math.floor(Math.random()*25),85+Math.floor(Math.random()*16),121];
 return {version:1,id:String(Date.now()),game,players,bestOf,starter,firstStarter:starter,turn:starter,
 leg:1,legs:[0,0],stage:game==='chicago'?1:0,scores:game==='chicago'?[301,301]:[0,0],marks:[emptyMarks(),emptyMarks()],
 round:[1,1],target:[61,61],attempts:[0,0],minutes,startedAt:Date.now(),paused:false,pausedAt:null,
 sudden:false,suddenFirst:null,visits:[],undo:[],status:'playing',winner:null,
 exactOptions,exactChoice:exactOptions[0],entered:[false,false],
 phaseStart:Date.now()};
}
function snapshot(s){let c=clone(s);delete c.undo;return c}
function save(before,after){after.undo=[...(before.undo||[]),snapshot(before)].slice(-90);return after}
function stageMode(s){return s.game==='chicago'?(s.stage===2?'cricket':'x01'):(s.game.startsWith('half_')?'half':s.game)}
function stageName(s){return s.game==='chicago'?['','301 DIDO','Cricket','501 SIDO'][s.stage]:({
 cricket:'Cricket',half_standard:'Half-It (Standard)',half_dartcounter:'Half-It (DartCounter)',sixty_one:'61',jdc:'JDC Challenge'
 })[s.game]}
function round(s){return s.round[s.turn]}
function halfRule(s){return(s.game==='half_standard'?RSTD:RDC)[round(s)-1]}
function dartsValid(d){return d&&((d.n===0&&d.mult===0)||(Number.isInteger(d.n)&&d.n>=1&&d.n<=20&&[1,2,3].includes(d.mult))||(d.n===25&&[1,2].includes(d.mult)))}
function dartScore(d){return d.n*d.mult}
function dartColor(d){if(!d.n)return'miss';if(d.n===25)return d.mult===1?'green':'red';const i=BOARD.indexOf(d.n);if(d.mult===1)return i%2===0?'black':'white';return i%2===0?'red':'green'}
function halfPoints(s,darts,p){
 const rule=(s.game==='half_standard'?RSTD:RDC)[s.round[p]-1],total=darts.reduce((sum,d)=>sum+dartScore(d),0);
 const allNonMiss=darts.every(d=>d.n>0);
 let points=0,success=false;
 if(typeof rule==='number'&&rule!==41)points=darts.filter(d=>d.n===rule).reduce((sum,d)=>sum+dartScore(d),0);
 else if(rule==='double')points=darts.filter(d=>d.mult===2).reduce((sum,d)=>sum+dartScore(d),0);
 else if(rule==='treble')points=darts.filter(d=>d.mult===3).reduce((sum,d)=>sum+dartScore(d),0);
 else if(rule==='bull')points=darts.filter(d=>d.n===25).reduce((sum,d)=>sum+dartScore(d),0);
 else if(rule==='different'){const c=darts.map(dartColor);success=allNonMiss&&new Set(c).size===3;points=success?total:0}
 else if(rule==='same'){const c=darts.map(dartColor);success=allNonMiss&&new Set(c).size===1;points=success?total:0}
 else if(rule==='exact'||rule===41){const target=rule===41?41:s.exactChoice;success=rule===41?(allNonMiss&&total===41):(target===121?total>=121:total===target);points=success?(rule===41?41:total):0}
 if(!['different','same','exact',41].includes(rule))success=points>0;
 return {points,success,round:s.round[p],rule};
}
function cricketVisit(s,darts,p){
 let scored=0;
 for(const dart of darts){
   const t=dart.target==='BULL'?'B':String(dart.target).toUpperCase(),mult=Number(dart.mult);
   need(t==='MISS'||TARGETS.includes(t),'Ugyldig Cricket-felt.');
   if(t==='MISS'){need(mult===0,'MISS må ha 0 merke.');continue}
   need(mult>=1&&mult<=(t==='B'?2:3),'Ugyldig antall merker.');
   const before=s.marks[p][t],opp=s.marks[1-p][t];
   const extra=Math.max(0,mult-Math.max(0,3-before));
   s.marks[p][t]=Math.min(3,before+mult);
   if(extra&&opp<3)scored+=extra*(t==='B'?25:Number(t));
 }
 s.scores[p]+=scored;
 const closed=TARGETS.every(t=>s.marks[p][t]===3);
 return {scored,win:closed&&s.scores[p]>=s.scores[1-p]};
}
function finishLeg(s,p){
 s.legs[p]++;s.visits[s.visits.length-1].winner=p;
 if(s.legs[p]>=(s.bestOf+1)/2){s.status='finished';s.winner=p}
 else{s.status='between';}
}
function submit(state,payload){
 need(state?.status==='playing','Kampen er ikke aktiv.');
 let s=snapshot(state),p=s.turn,kind=stageMode(s),entry={player:p,leg:s.leg,stage:s.stage||0,at:Date.now()};
 if(kind==='cricket'){
   const ds=payload?.darts||[];need(ds.length>=1&&ds.length<=3,'Registrer 1–3 Cricket-piler.');
   const result=cricketVisit(s,ds,p);
   Object.assign(entry,{darts:clone(ds),points:result.scored,marks:ds.reduce((n,d)=>n+(Number(d.mult)||0),0)});
   s.visits.push(entry);
   if(result.win){if(s.game==='chicago'){s.stage=3;s.scores=[501,501];s.entered=[true,true];s.marks=[emptyMarks(),emptyMarks()];s.turn=1-s.firstStarter}
     else finishLeg(s,p);}
   else s.turn=1-p;
 }else if(kind==='half'){
   const darts=payload?.darts||[];
   need(darts.length===3&&darts.every(dartsValid),'Half-It krever nøyaktig tre piler.');
   need(s.round[p]<=12,'Spilleren er ferdig med sine 12 runder.');
   if(halfRule(s)==='exact'){
     const choice=Number(payload.exactChoice||s.exactChoice);
     need(s.exactOptions.includes(choice),'Velg en av de tre eksakte scorene.');
     s.exactChoice=choice;
   }
   const result=halfPoints(s,darts,p);
   s.scores[p]=result.success?s.scores[p]+result.points:
       (s.game==='half_standard'?Math.ceil(s.scores[p]/2):Math.floor(s.scores[p]/2));
   Object.assign(entry,{darts:clone(darts),round:result.round,points:result.points,
     success:result.success,after:s.scores[p],choice:s.exactChoice});
   s.visits.push(entry);s.round[p]++;
   if(s.round[0]>12&&s.round[1]>12){
     if(s.scores[0]!==s.scores[1])finishLeg(s,s.scores[0]>s.scores[1]?0:1);
     else s.status='between'; // tied leg: replay as online
   }else s.turn=1-p;
 }else if(kind==='jdc'){
   const turn=s.round[p],codes=(payload?.codes||[]).map(x=>String(x).toUpperCase());
   need(turn<=33,'JDC er fullført.');
   const block=turn>=7&&turn<=27;
   const expected=block?Math.min(27,9+3*Math.floor((turn-7)/3))-turn+1:3;
   need(codes.length===expected,'Registrer alle '+expected+' pilene.');
   const target=turn<=6?9+turn:turn>=28?turn-13:null;
   let points=0,bonus=false;
   if(block){
     need(codes.every(x=>['H','M'].includes(x)),'Bruk treff eller bom på doubles.');
     points=codes.reduce((sum,x,i)=>sum+(x==='H'?(turn+i===27?100:50):0),0);
   }else{
     need(codes.every(x=>['S','D','T','M'].includes(x)),'Bruk single, double, triple eller bom.');
     points=codes.reduce((sum,x)=>sum+({S:target,D:2*target,T:3*target,M:0})[x],0);
     bonus=['S','D','T'].every(x=>codes.includes(x));
     if(bonus)points+=100;
   }
   Object.assign(entry,{round:turn,codes,points,bonus,target});
   s.visits.push(entry);s.round[p]+=expected;s.scores[p]+=points;
   if(s.round[0]>33&&s.round[1]>33){s.status='finished';s.winner=s.scores[0]===s.scores[1]?null:(s.scores[0]>s.scores[1]?0:1)}
   else s.turn=s.round[1-p]<s.round[p]?1-p:s.firstStarter;
 }else if(kind==='sixty_one'){
   const hit=payload?.hit;need(typeof hit==='boolean','Registrer treff eller bom.');
   let target=s.target[p]+(hit?5:-1);target=Math.max(2,Math.min(170,target));
   while(BAD.has(target))target+=hit?1:-1;
   s.target[p]=target;s.attempts[p]++;
   Object.assign(entry,{hit,points:target,round:s.attempts[p]});s.visits.push(entry);s.turn=1-p;
   if(s.sudden){
     if(!s.suddenFirst)s.suddenFirst={player:p,hit};
     else {if(s.suddenFirst.hit!==hit){finishLeg(s,hit?p:s.suddenFirst.player);s.sudden=false;s.suddenFirst=null}
       else s.suddenFirst=null}
   }
 }else if(kind==='x01'){
   const value=Number(payload?.score),raw=String(payload?.score??'');
   need(raw.trim()!==''&&Number.isInteger(value)&&value>=0&&value<=180&&
      ![163,166,169,172,173,175,176,178,179].includes(value),'Ugyldig score.');
   const remaining=s.scores[p],bust=value>remaining||remaining-value===1;
   const checkout=!bust&&value===remaining;
   if(s.stage===1&&!s.entered[p]&&value>0&&!bust)need(payload.doubleIn===true,'301 DIDO krever bekreftet dobbel-in.');
   if(checkout)need(Number.isInteger(payload.darts)&&payload.darts>=1&&payload.darts<=3&&
      root.DartArenaLocalH2HEngine?.validCheckout(value,payload.darts),
      'Bekreft en gyldig dobbel-ut (1–3 piler).');
   let points=bust?0:value;
   s.scores[p]-=points;
   if(s.stage===1&&!bust&&value>0)s.entered[p]=true;
   Object.assign(entry,{score:points,attempt:value,bust,checkout,darts:checkout?payload.darts:3});
   s.visits.push(entry);
   if(checkout){
     if(s.stage===1){s.stage=2;s.scores=[0,0];s.marks=[emptyMarks(),emptyMarks()];s.turn=1-s.firstStarter}
     else {s.status='finished';s.winner=p;s.legs[p]=2}
   }else s.turn=1-p;
 }else throw Error('Ukjent spillmodus.');
 return save(state,s);
}
function next(state){
 need(state?.status==='between','Neste leg er ikke klart.');
 const s=snapshot(state);s.leg++;s.starter=1-s.starter;s.turn=s.starter;
 s.scores=[0,0];s.marks=[emptyMarks(),emptyMarks()];
 s.round=[1,1];s.target=[61,61];s.attempts=[0,0];s.sudden=false;s.suddenFirst=null;
 s.exactOptions=[60+Math.floor(Math.random()*25),85+Math.floor(Math.random()*16),121];
 s.exactChoice=s.exactOptions[0];s.phaseStart=Date.now();s.status='playing';
 return save(state,s);
}
function undo(state){need(state?.undo?.length,'Ingen kast å angre.');const u=[...state.undo],s=u.pop();s.undo=u;return s}
function elapsed(s){return s.paused?(s.pausedAt-s.phaseStart):Date.now()-s.phaseStart}
function tick(state){
 if(state.game!=='sixty_one'||state.status!=='playing'||state.sudden||state.paused)return state;
 if(elapsed(state)<state.minutes*60*1000)return state;
 if(state.attempts[0]!==state.attempts[1])return state;
 const s=snapshot(state);
 if(s.target[0]!==s.target[1])finishLeg(s,s.target[0]>s.target[1]?0:1);
 else{s.sudden=true;s.suddenFirst=null}
 return save(state,s);
}
function pause(state){need(state?.game==='sixty_one','Pause er kun for 61.');const s=snapshot(state);
 if(s.paused){s.phaseStart+=Date.now()-s.pausedAt;s.pausedAt=null;s.paused=false}
 else{s.paused=true;s.pausedAt=Date.now()}
 return save(state,s)}
function restore(s){return s&&s.version===1&&['cricket','half_standard','half_dartcounter','sixty_one','jdc','chicago'].includes(s.game)?s:null}
root.DartArenaLocalSpecial={init,submit,next,undo,tick,pause,restore,stageMode,stageName,halfRule,halfPoints,round,emptyMarks,TARGETS};
})(window);
