/* Isolated, perspective-aware scoring geometry. Input coordinates are source-video pixels. */
(function(){
'use strict';
const ORDER=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const CALIBRATION_NAMES=['Bull (midten)','D20 – midten av ytterringen kl. 12','D6 – midten av ytterringen kl. 3','D3 – midten av ytterringen kl. 6','D11 – midten av ytterringen kl. 9'];
const RINGS={doubleBull:6.35/170,singleBull:15.9/170,tripleInner:99/170,tripleOuter:107/170,doubleInner:162/170,doubleOuter:1};
// In calibration, click MIDLINE of the double ring, not the external wire.
const DOUBLE_MID=(162+170)/(2*170);
function solve(rows,values){
  const n=8,aug=Array.from({length:n},(_,i)=>Array(n+1).fill(0));
  for(let k=0;k<rows.length;k++){
    const row=rows[k];
    for(let i=0;i<n;i++){
      aug[i][n]+=row[i]*values[k];
      for(let j=0;j<n;j++)aug[i][j]+=row[i]*row[j];
    }
  }
  for(let col=0;col<n;col++){
    let pivot=col;
    for(let r=col+1;r<n;r++)if(Math.abs(aug[r][col])>Math.abs(aug[pivot][col]))pivot=r;
    if(Math.abs(aug[pivot][col])<1e-8)throw new Error('Kalibreringspunktene gir en ustabil beregning. Prøv igjen.');
    [aug[col],aug[pivot]]=[aug[pivot],aug[col]];
    const scale=aug[col][col];
    for(let j=col;j<=n;j++)aug[col][j]/=scale;
    for(let r=0;r<n;r++)if(r!==col){
      const v=aug[r][col];
      for(let j=col;j<=n;j++)aug[r][j]-=v*aug[col][j];
    }
  }
  return aug.map(row=>row[n]);
}
function project(m,q){
  const [a,b,c,d,e,f,g,h]=m.homography;
  const div=g*q.x+h*q.y+1;
  if(Math.abs(div)<1e-10)return {x:NaN,y:NaN};
  return{x:(a*q.x+b*q.y+c)/div,y:(d*q.x+e*q.y+f)/div};
}
function prepare(points){
  if(!Array.isArray(points)||points.length!==5||points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))throw new Error('Velg fem gyldige kalibreringspunkter.');
  const [bull,top,right,bottom,left]=points;
  const dTop=Math.hypot(top.x-bull.x,top.y-bull.y),dRight=Math.hypot(right.x-bull.x,right.y-bull.y),dBottom=Math.hypot(bottom.x-bull.x,bottom.y-bull.y),dLeft=Math.hypot(left.x-bull.x,left.y-bull.y);
  const minRadius=Math.min(dTop,dRight,dBottom,dLeft);
  if(minRadius<45||Math.max(dTop,dRight,dBottom,dLeft)>minRadius*2.8)throw new Error('Skivepunktene er for små eller ujevne. Kontroller at alle fire er på samme yttring.');
  // Wrong ordering and points in two different OBS views must be rejected.
  const u={x:right.x-left.x,y:right.y-left.y},v={x:bottom.x-top.x,y:bottom.y-top.y};
  const cross=u.x*v.y-u.y*v.x;
  if(cross<minRadius*minRadius*.75)throw new Error('Punktene må velges med klokken: Bull, D20, D6, D3, D11 – på SAMME skive.');
  const params=[[0,0],[0,-DOUBLE_MID],[DOUBLE_MID,0],[0,DOUBLE_MID],[-DOUBLE_MID,0]];
  const rows=[],values=[];
  for(let i=0;i<5;i++){
    const p=params[i],q=points[i];
    rows.push([p[0],p[1],1,0,0,0,-q.x*p[0],-q.x*p[1]]);
    values.push(q.x);
    rows.push([0,0,0,p[0],p[1],1,-q.y*p[0],-q.y*p[1]]);
    values.push(q.y);
  }
  const homography=solve(rows,values);
  const m={bull:{...bull},homography,points:points.map(p=>({...p}))};
  const rms=Math.sqrt(points.reduce((sum,p,i)=>{
    const q=project(m,{x:params[i][0],y:params[i][1]});
    return sum+(q.x-p.x)**2+(q.y-p.y)**2;
  },0)/points.length);
  if(!Number.isFinite(rms)||rms>minRadius*.09)throw new Error('Kalibreringen treffer ikke punktene godt nok. Velg punktene på nytt.');
  const bounds=boardBounds(m,Infinity,Infinity,.04);
  if(![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite))throw new Error('Geometrien er ugyldig.');
  return m;
}
function normalize(model,p){
  const [a,b,c,d,e,f,g,h]=model.homography;
  const A=a-p.x*g,B=b-p.x*h,C=d-p.y*g,D=e-p.y*h,det=A*D-B*C;
  if(Math.abs(det)<1e-10)return{x:NaN,y:NaN};
  const u=p.x-c,v=p.y-f;
  return{x:(D*u-B*v)/det,y:(A*v-C*u)/det};
}
function score(model,p){
  const q=normalize(model,p),r=Math.hypot(q.x,q.y);
  if(!Number.isFinite(r)||r>1)return {label:'MISS',points:0,radius:r,position:q};
  if(r<=RINGS.doubleBull)return {label:'DB',points:50,radius:r,position:q};
  if(r<=RINGS.singleBull)return {label:'SB',points:25,radius:r,position:q};
  const angle=(Math.atan2(q.x,-q.y)+Math.PI*2)%(Math.PI*2);
  const segment=ORDER[Math.round(angle/(Math.PI/10))%20];
  const ring=r>=RINGS.doubleInner?'D':r>=RINGS.tripleInner&&r<=RINGS.tripleOuter?'T':'S';
  return {label:ring+segment,points:segment*(ring==='D'?2:ring==='T'?3:1),radius:r,position:q};
}
function boardBounds(m,width,height,padding=.12){
  const pts=[];
  for(let i=0;i<120;i++){
    const t=i*2*Math.PI/120;
    pts.push(project(m,{x:Math.cos(t)*(1+padding),y:Math.sin(t)*(1+padding)}));
  }
  let minx=Math.min(...pts.map(p=>p.x)),maxx=Math.max(...pts.map(p=>p.x)),miny=Math.min(...pts.map(p=>p.y)),maxy=Math.max(...pts.map(p=>p.y));
  if(Number.isFinite(width)){minx=Math.max(0,minx);maxx=Math.min(width,maxx)}
  if(Number.isFinite(height)){miny=Math.max(0,miny);maxy=Math.min(height,maxy)}
  return{x:Math.max(0,minx),y:Math.max(0,miny),width:Math.max(0,maxx-Math.max(0,minx)),height:Math.max(0,maxy-Math.max(0,miny))};
}
function runSanityChecks(){
  const pts=[{x:320,y:240},{x:320,y:240-170*DOUBLE_MID},{x:320+170*DOUBLE_MID,y:240},{x:320,y:240+170*DOUBLE_MID},{x:320-170*DOUBLE_MID,y:240}];
  const m=prepare(pts);
  const r=170;
  return [['T20',score(m,{x:320,y:240-r*.60}).label],
    ['D20',score(m,{x:320,y:240-r*.98}).label],
    ['S20',score(m,{x:320,y:240-r*.74}).label],
    ['S6',score(m,{x:320+r*.75,y:240}).label],
    ['S3',score(m,{x:320,y:240+r*.75}).label],
    ['DB',score(m,{x:320,y:240}).label],
    ['MISS',score(m,{x:320,y:50}).label]].every(x=>x[0]===x[1]);
}
window.DartArenaLabGeometry={ORDER,RINGS,DOUBLE_MID,CALIBRATION_NAMES,prepare,project,normalize,score,boardBounds,runSanityChecks};
})();
