/* DartArena bot experiment: offline, probabilistic dart throws and checkout planning.
   No API calls, no webcam access, no changes to online games. */
(function(root){
'use strict';
const ORDER=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const MODES=new Set(['steady','erratic','scorer','finisher']);
const prefers=[20,16,18,12,10,8,14,6,4,2,1,3,5,7,9,11,13,15,17,19];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const segment=(kind,n)=>({label:kind+String(n),score:n*(kind==='T'?3:kind==='D'?2:1),double:kind==='D'});
const targets=[];
for(const n of [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1])targets.push(segment('T',n));
for(const n of [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1])targets.push(segment('S',n));
targets.push({label:'B50',score:50,double:true},{label:'B25',score:25,double:false});
const doubleTargets=prefers.map(n=>segment('D',n)).concat([{label:'B50',score:50,double:true}]);
function at(x,y){
 const radius=Math.hypot(x,y);
 if(radius>170)return {label:'MISS',score:0,double:false};
 if(radius<=6.35)return {label:'B50',score:50,double:true};
 if(radius<=15.9)return {label:'B25',score:25,double:false};
 const angle=(Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2);
 const number=ORDER[Math.floor((angle+Math.PI/20)/(Math.PI/10))%20];
 const kind=radius>=162?'D':radius>=99&&radius<=107?'T':'S';
 return segment(kind,number);
}
function point(label){
 if(label==='B50')return{x:0,y:0};
 if(label==='B25')return{x:0,y:12};
 const kind=label.charAt(0),n=Number(label.slice(1));
 const index=ORDER.indexOf(n);
 if(index<0)throw Error('Ukjent felt: '+label);
 const radius=kind==='T'?103:kind==='D'?166:130;
 const angle=index*Math.PI/10;
 return{x:Math.sin(angle)*radius,y:-Math.cos(angle)*radius};
}
function rng(seed){
 let n=(seed>>>0)||1;
 return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296};
}
function normal(rand){
 const a=Math.max(1e-10,rand()),b=rand();
 return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b);
}
function profileScale(profile,rand){
 if(profile==='erratic')return rand()<.4?.58:1.37;
 if(profile==='scorer')return .93;
 if(profile==='finisher')return 1.08;
 return .94+rand()*.12;
}
function shot(label,sigma,rand,scale=1){
 const aim=point(label),s=sigma*scale;
 const hit=at(aim.x+normal(rand)*s,aim.y+normal(rand)*s);
 return {aim:label,hit:hit.label,score:hit.score,double:hit.double};
}
function estimate(sigma,profile){
 const rand=rng(348195);
 let total=0;
 for(let i=0;i<1800;i++){
   const scale=profileScale(profile,rand);
   total+=shot('T20',sigma,rand,scale).score;
 }
 return total*3/1800;
}
function calibrate(average,profile,format=501){
 // X01 scoring averages depend on leg length; shorter formats have more
 // setup/finishing darts. Offsets are experimental beta calibration values.
 const base=clamp(Number(average)||55,20,120);
 const compensation=Number(format)===170?Math.min(31,13+base*.4):Number(format)===301?20:12;
 const profileAdjustment=(profile==='scorer'?7:profile==='finisher'?-6:0)*Math.min(1,(120-base)/60);
 const desired=base+compensation+profileAdjustment;
 let low=2,high=150;
 for(let i=0;i<13;i++){
   const middle=(low+high)/2,observed=estimate(middle,profile);
   if(observed>desired)low=middle;else high=middle;
 }
 return (low+high)/2;
}
const routesMemo=new Map();
function route(remaining,darts){
 if(darts<1||remaining<2||remaining>170)return null;
 const k=remaining+':'+darts;
 if(routesMemo.has(k))return routesMemo.get(k);
 let found=null;
 for(const target of doubleTargets){
   if(target.score===remaining){found=[target.label];break}
 }
 // Prefer familiar single + preferred double routes for short finishes.
 if(!found&&darts>1&&remaining<=70){
   for(const target of doubleTargets){
     const first=remaining-target.score;
     if(first>=1&&first<=20){found=['S'+first,target.label];break}
   }
 }
 if(!found&&darts>1){
   for(const target of targets){
     if(target.score>=remaining-1)continue;
     const next=route(remaining-target.score,darts-1);
     if(next){found=[target.label,...next];break}
   }
 }
 routesMemo.set(k,found);
 return found;
}
function chooseAim(remaining,darts,profile,rand){
 if(remaining<=170){
   const plan=route(remaining,darts);
   if(plan)return plan[0];
   // Set up a preferred even double when direct checkout is unavailable.
   if(remaining<=60){
     for(const leave of [40,32,36,24,20,16,12,8,4,2]){
       const needed=remaining-leave;
       if(needed>0){
         const exact=targets.find(t=>t.score===needed&&t.label.startsWith('S'));
         if(exact)return exact.label;
       }
     }
   }
 }
 if(profile==='scorer'&&rand()<.12)return'T19';
 if(remaining===169||remaining===168||remaining===166)return'T19';
 return'T20';
}
function visit(remaining,config,random=Math.random){
 if(!Number.isInteger(remaining)||remaining<2)throw Error('Ugyldig restscore.');
 const profile=MODES.has(config.profile)?config.profile:'steady';
 const sigma=Number(config.sigma)||calibrate(config.average,profile,config.format);
 const throws=[];
 let rest=remaining,bust=false,checkout=false;
 const scale=profileScale(profile,random);
 for(let i=0;i<3;i++){
   const aim=chooseAim(rest,3-i,profile,random);
   const doubleScale=aim.startsWith('D')||aim==='B50'
     ?(profile==='finisher'?.67:profile==='scorer'?1.35:1.03):1;
   const doubleSigma=aim.startsWith('D')||aim==='B50'?Math.min(28,sigma)*doubleScale:sigma;
   const hit=shot(aim,doubleSigma,random,scale);
   throws.push(hit);
   rest-=hit.score;
   if(rest<0||rest===1||(rest===0&&!hit.double)){bust=true;break}
   if(rest===0){checkout=true;break}
 }
 return {score:bust?0:remaining-rest,darts:throws.length,bust,checkout,throws,
   remaining:bust?remaining:rest};
}
function nextAdaptive(current,actual){
 const old=clamp(Number(current)||55,20,120);
 if(!Number.isFinite(actual)||actual<=0)return old;
 // Maximum five-point correction between completed matches; never mid-leg.
 return Math.round(clamp(old+clamp((actual-old)*.22,-5,5),20,120)*10)/10;
}
root.DartArenaBotEngine={at,point,shot,visit,calibrate,estimate,route,chooseAim,nextAdaptive,profiles:[...MODES]};
})(typeof window!=='undefined'?window:globalThis);
