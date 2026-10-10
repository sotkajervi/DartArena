/* Isolated, testable dartboard geometry – no camera or match dependencies. */
(function(){
  'use strict';
  const ORDER=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const CALIBRATION_NAMES=['Bull (midt)','D20 ytterkant (kl. 12)','D6 ytterkant (kl. 3)','D3 ytterkant (kl. 6)','D11 ytterkant (kl. 9)'];
  const RINGS={doubleBull:6.35/170,singleBull:15.9/170,tripleInner:99/170,tripleOuter:107/170,doubleInner:162/170,doubleOuter:1};
  function prepare(points){
    if(!Array.isArray(points)||points.length!==5)throw new Error('Kalibrer fem punkter først.');
    const [bull,top,right,bottom,left]=points;
    const vx={x:(right.x-left.x)/2,y:(right.y-left.y)/2};
    const vy={x:(bottom.x-top.x)/2,y:(bottom.y-top.y)/2};
    const det=vx.x*vy.y-vx.y*vy.x;
    if(Math.abs(det)<1800||Math.hypot(vx.x,vx.y)<50||Math.hypot(vy.x,vy.y)<50)throw new Error('Skiven er for liten eller kalibreringspunktene er feilplassert.');
    const centerX=(top.x+right.x+bottom.x+left.x)/4,centerY=(top.y+right.y+bottom.y+left.y)/4;
    const deviation=Math.hypot(bull.x-centerX,bull.y-centerY);
    if(deviation>Math.min(Math.hypot(vx.x,vx.y),Math.hypot(vy.x,vy.y))*.23)throw new Error('Bull ligger for langt unna sentrum. Kalibrer på nytt.');
    return {bull,vx,vy,det,points:points.map(p=>({...p}))};
  }
  function normalize(model,p){
    const dx=p.x-model.bull.x,dy=p.y-model.bull.y;
    return {x:(dx*model.vy.y-dy*model.vy.x)/model.det,
      y:(model.vx.x*dy-model.vx.y*dx)/model.det};
  }
  function score(model,p){
    const q=normalize(model,p),r=Math.hypot(q.x,q.y);
    if(r>1)return {label:'MISS',points:0,radius:r,position:q};
    if(r<=RINGS.doubleBull)return {label:'DB',points:50,radius:r,position:q};
    if(r<=RINGS.singleBull)return {label:'SB',points:25,radius:r,position:q};
    const angle=(Math.atan2(q.x,-q.y)+Math.PI*2)%(Math.PI*2);
    const segment=ORDER[Math.round(angle/(Math.PI/10))%20];
    const ring=r>=RINGS.doubleInner?'D':r>=RINGS.tripleInner&&r<=RINGS.tripleOuter?'T':'S';
    return {label:ring+segment,points:segment*(ring==='D'?2:ring==='T'?3:1),radius:r,position:q};
  }
  function runSanityChecks(){
    const pts=[{x:320,y:240},{x:320,y:70},{x:490,y:240},{x:320,y:410},{x:150,y:240}];
    const m=prepare(pts);
    return [['T20',score(m,{x:320,y:240-170*.60}).label],
      ['D20',score(m,{x:320,y:240-170*.98}).label],
      ['S20',score(m,{x:320,y:240-170*.74}).label],
      ['S6',score(m,{x:320+170*.75,y:240}).label],
      ['S3',score(m,{x:320,y:240+170*.75}).label],
      ['DB',score(m,{x:320,y:240}).label],
      ['MISS',score(m,{x:320,y:55}).label]].every(x=>x[0]===x[1]);
  }
  window.DartArenaLabGeometry={ORDER,RINGS,CALIBRATION_NAMES,prepare,normalize,score,runSanityChecks};
})();