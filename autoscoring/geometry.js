/* Isolated, perspective-aware scoring geometry. Input coordinates are source-video pixels. */
(function(){
'use strict';
const ORDER=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const CALIBRATION_NAMES=[
  'Bull (midten)',
  'D20 – midt på dobbelringen kl. 12',
  'Nordøst – midt på dobbelringen kl. 1:30',
  'D6 – midt på dobbelringen kl. 3',
  'Sørøst – midt på dobbelringen kl. 4:30',
  'D3 – midt på dobbelringen kl. 6',
  'Sørvest – midt på dobbelringen kl. 7:30',
  'D11 – midt på dobbelringen kl. 9',
  'Nordvest – midt på dobbelringen kl. 10:30'
];
const RINGS={doubleBull:6.35/170,singleBull:15.9/170,tripleInner:99/170,tripleOuter:107/170,doubleInner:162/170,doubleOuter:1};
// In calibration, click MIDLINE of the double ring, not the external wire.
const DOUBLE_MID=(162+170)/(2*170);
const CALIBRATION_PARAMS=[[0,0],...Array.from({length:8},(_,i)=>[DOUBLE_MID*Math.sin(i*Math.PI/4),-DOUBLE_MID*Math.cos(i*Math.PI/4)])];
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
  if(!Array.isArray(points)||points.length!==CALIBRATION_NAMES.length||points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))
    throw new Error('Velg Bull og åtte punkter på dobbelringen (9 punkter totalt).');
  const bull=points[0],rim=points.slice(1);
  const radii=rim.map(p=>Math.hypot(p.x-bull.x,p.y-bull.y));
  const minRadius=Math.min(...radii);
  if(minRadius<45||Math.max(...radii)>minRadius*2.4)
    throw new Error('Punktene er for ujevne. Bruk samme dobbelring hele veien rundt.');
  // Reject mixed OBS previews or wrong click order before the solve.
  for(let i=0;i<8;i++){
    const p=rim[i],q=rim[(i+1)%8];
    const cross=(p.x-bull.x)*(q.y-bull.y)-(p.y-bull.y)*(q.x-bull.x);
    if(cross<minRadius*minRadius*.18)
      throw new Error('Punktene må gå med klokken rundt samme skive. Bruk Angre og prøv igjen.');
  }
  const rows=[],values=[];
  for(let i=0;i<CALIBRATION_PARAMS.length;i++){
    const p=CALIBRATION_PARAMS[i],q=points[i];
    rows.push([p[0],p[1],1,0,0,0,-q.x*p[0],-q.x*p[1]]);
    values.push(q.x);
    rows.push([0,0,0,p[0],p[1],1,-q.y*p[0],-q.y*p[1]]);
    values.push(q.y);
  }
  const homography=solve(rows,values);
  const model={bull:{...bull},homography,points:points.map(p=>({...p}))};
  const rms=Math.sqrt(points.reduce((sum,p,i)=>{
    const q=project(model,{x:CALIBRATION_PARAMS[i][0],y:CALIBRATION_PARAMS[i][1]});
    return sum+(q.x-p.x)**2+(q.y-p.y)**2;
  },0)/points.length);
  model.errorPx=rms;
  // A fitted perspective transform is only accepted if all user-selected wire
  // centres are close to the projected locations.
  if(!Number.isFinite(rms)||rms>Math.max(5,minRadius*.045))
    throw new Error('Kalibreringen har for stort avvik ('+rms.toFixed(1)+' px). Finjuster dobbelringpunktene.');
  const bounds=boardBounds(model,Infinity,Infinity,.04);
  if(![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite))
    throw new Error('Geometrien er ugyldig.');
  return model;
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
  const pts=CALIBRATION_PARAMS.map(([x,y])=>({x:320+170*x,y:240+170*y}));
  const m=prepare(pts),r=170;
  return [['T20',score(m,{x:320,y:240-r*.60}).label],
    ['D20',score(m,{x:320,y:240-r*.98}).label],
    ['S20',score(m,{x:320,y:240-r*.74}).label],
    ['S6',score(m,{x:320+r*.75,y:240}).label],
    ['S3',score(m,{x:320,y:240+r*.75}).label],
    ['DB',score(m,{x:320,y:240}).label],
    ['MISS',score(m,{x:320,y:50}).label]].every(x=>x[0]===x[1]);
}
window.DartArenaLabGeometry={ORDER,RINGS,DOUBLE_MID,CALIBRATION_NAMES,CALIBRATION_PARAMS,prepare,project,normalize,score,boardBounds,runSanityChecks};
})();
