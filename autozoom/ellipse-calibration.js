/* Owner-only candidate v2. The measurement is read-only and must not save
 * calibration. Requires a Bull component + both colored rings; rejects
 * dubious images using withheld angular sectors. Not full perspective mapping.
 */
(function(root){
'use strict';
function estimate(image){
 const w=image?.width|0,h=image?.height|0,rgba=image?.data;
 if(w<160||h<130||!rgba||rgba.length<w*h*4)return null;
 const greens=new Uint8Array(w*h),pts=[];
 let sx=0,sy=0,n=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const idx=y*w+x,k=idx*4,r=rgba[k],g=rgba[k+1],b=rgba[k+2];
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
  if(mx<60||d<35||d/mx<.3)continue;
  const hue=mx===r?60*((g-b)/d+(g<b?6:0)):mx===g?60*((b-r)/d+2):60*((r-g)/d+4);
  const red=(hue<=21||hue>=345)&&r>=75,green=hue>=75&&hue<=166&&g>=65;
  if(!red&&!green)continue;
  if(green)greens[idx]=1;
  sx+=x;sy+=y;n++;pts.push(x,y);
 }
 if(n<Math.max(350,w*h*.0035))return null;
 const rough={x:sx/n,y:sy/n};
 const distances=[];
 for(let i=0;i<pts.length;i+=2)distances.push(Math.hypot(pts[i]-rough.x,pts[i+1]-rough.y));
 distances.sort((a,b)=>a-b);
 const approxRadius=distances[Math.round(distances.length*.72)];
 if(approxRadius<22||approxRadius>Math.min(w,h)*.52)return null;
 let bull=null;
 const seen=new Uint8Array(w*h),q=new Int32Array(w*h),minArea=Math.max(13,Math.round(approxRadius*approxRadius*.001));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const ix=y*w+x;if(!greens[ix]||seen[ix])continue;
  let head=0,tail=1,csx=0,csy=0,minX=x,maxX=x,minY=y,maxY=y;
  q[0]=ix;seen[ix]=1;
  while(head<tail){
   const idx=q[head++],px=idx%w,py=(idx/w)|0;csx+=px;csy+=py;
   if(px<minX)minX=px;if(px>maxX)maxX=px;if(py<minY)minY=py;if(py>maxY)maxY=py;
   for(let yy=py-1;yy<=py+1;yy++)for(let xx=px-1;xx<=px+1;xx++){
    if(xx<0||xx>=w||yy<0||yy>=h)continue;
    const j=yy*w+xx;if(greens[j]&&!seen[j]){seen[j]=1;q[tail++]=j}
   }
  }
  if(tail<minArea||tail>approxRadius*approxRadius*.09)continue;
  if(maxX-minX>approxRadius*.4||maxY-minY>approxRadius*.4)continue;
  const cx=csx/tail,cy=csy/tail,away=Math.hypot(cx-rough.x,cy-rough.y);
  if(away>approxRadius*.3)continue;
  const score=away/approxRadius+.0001*Math.abs(tail-approxRadius*approxRadius*.014);
  if(!bull||score<bull.score)bull={x:cx,y:cy,score};
 }
 if(!bull)return null;
 const radii=[];
 for(let i=0;i<pts.length;i+=2)radii.push(Math.hypot(pts[i]-bull.x,pts[i+1]-bull.y));
 radii.sort((a,b)=>a-b);
 const R=radii[Math.round(radii.length*.71)];
 if(R<24||R>Math.min(w,h)*.52)return null;
 const sectors=72,binStep=Math.max(1.6,R*.009),nb=Math.ceil((1.21-.67)*R/binStep);
 const ringSamples=Array.from({length:sectors},()=>[]);
 const hist=Array.from({length:sectors},()=>new Uint16Array(nb));
 const sum=Array.from({length:sectors},()=>new Float64Array(nb));
 const counts=Array.from({length:sectors},()=>new Uint16Array(nb));
 let triple=0;
 for(let i=0;i<pts.length;i+=2){
  const dx=pts[i]-bull.x,dy=pts[i+1]-bull.y,r=Math.hypot(dx,dy);
  if(r>R*.50&&r<R*.71)triple++;
  if(r<R*.67||r>R*1.21)continue;
  const a=Math.atan2(dy,dx),sector=Math.floor((a+Math.PI)/(Math.PI*2)*sectors)%sectors;
  const k=Math.floor((r-R*.67)/binStep);
  if(r>R*.72&&r<R*1.18)ringSamples[sector].push(r);
  if(k>=0&&k<nb){hist[sector][k]++;sum[sector][k]+=r;counts[sector][k]++}
 }
 if(triple<n*.04)return null;
 const obs=[];
 for(let j=0;j<sectors;j++){
  let chosen=-1,best=0;
  for(let k=1;k<nb-1;k++){
   const count=hist[j][k-1]+hist[j][k]+hist[j][k+1];
   if(count>best){best=count;chosen=k}
  }
  if(chosen<0||best<Math.max(4,R*.035))continue;
  let count=0,total=0;
  for(let k=Math.max(0,chosen-2);k<=Math.min(nb-1,chosen+2);k++){
   count+=counts[j][k];total+=sum[j][k];
  }
  if(count<4)continue;
  const center=total/count;
  const nearby=ringSamples[j].filter(r=>Math.abs(r-center)<Math.max(6,R*.060))
    .sort((a,b)=>a-b);
  if(nearby.length<14)continue;
  const lower=nearby[Math.floor((nearby.length-1)*.035)];
  const upper=nearby[Math.floor((nearby.length-1)*.965)];
  const thickness=upper-lower;
  if(thickness<R*.022||thickness>R*.14)continue;
  obs.push({theta:-Math.PI+(j+.5)*Math.PI*2/sectors,
    r:center,colorInner:lower,colorOuter:upper,sector:j});
 }
 if(obs.length<sectors*.75)return null;
 const basis=t=>[1,Math.cos(t),Math.sin(t),Math.cos(2*t),Math.sin(2*t)];
 function linearFit(data){
  const count=5,A=Array.from({length:count},()=>new Float64Array(count+1));
  for(const point of data){const X=basis(point.theta);for(let i=0;i<count;i++){
   A[i][count]+=X[i]*point.r;
   for(let j=0;j<count;j++)A[i][j]+=X[i]*X[j];
  }}
  for(let k=0;k<count;k++){
   let pivot=k;for(let i=k+1;i<count;i++)if(Math.abs(A[i][k])>Math.abs(A[pivot][k]))pivot=i;
   if(Math.abs(A[pivot][k])<1e-8)return null;
   [A[k],A[pivot]]=[A[pivot],A[k]];
   const v=A[k][k];for(let j=k;j<=count;j++)A[k][j]/=v;
   for(let i=0;i<count;i++)if(i!==k){const f=A[i][k];for(let j=k;j<=count;j++)A[i][j]-=f*A[k][j]}
  }
  return Array.from({length:count},(_,i)=>A[i][count]);
 }
 let fitting=obs.filter(o=>o.sector%2===0),heldout=obs.filter(o=>o.sector%2!==0);
 if(fitting.length<sectors*.32||heldout.length<sectors*.32)return null;
 let coeffs=linearFit(fitting);if(!coeffs)return null;
 const radiusAt=t=>basis(t).reduce((a,v,i)=>a+v*coeffs[i],0);
 for(let iter=0;iter<4;iter++){
  const residuals=fitting.map(o=>Math.abs(o.r-radiusAt(o.theta))).sort((a,b)=>a-b);
  const cutoff=Math.max(3.2,R*.017,residuals[Math.floor(residuals.length*.75)]*2);
  fitting=fitting.filter(o=>Math.abs(o.r-radiusAt(o.theta))<cutoff);
  if(fitting.length<sectors*.30)return null;
  coeffs=linearFit(fitting);if(!coeffs)return null;
 }
 const errors=heldout.map(o=>Math.abs(o.r-radiusAt(o.theta))).sort((a,b)=>a-b);
 const p50=errors[Math.floor(errors.length*.5)],p90=errors[Math.floor(errors.length*.90)];
 if(p50>Math.max(3.5,R*.014)||p90>Math.max(6,R*.027)||Math.hypot(coeffs[3],coeffs[4])>R*.33)return null;
 // Two separate candidate wire boundaries, estimated from the colored
 // segment band. They are NOT independent metal-wire measurements.
 const inner=linearFit(fitting.map(o=>({theta:o.theta,r:o.colorInner})));
 const outer=linearFit(fitting.map(o=>({theta:o.theta,r:o.colorOuter})));
 if(!inner||!outer)return null;
 const at=(c,t)=>basis(t).reduce((sum,v,k)=>sum+v*c[k],0);
 const edgeErrors=heldout.map(o=>Math.max(
   Math.abs(o.colorInner-at(inner,o.theta)),
   Math.abs(o.colorOuter-at(outer,o.theta)))).sort((a,b)=>a-b);
 const edge90=edgeErrors[Math.floor(edgeErrors.length*.9)];
 const thickness=outer[0]-inner[0];
 if(thickness<R*.021||thickness>R*.13||edge90>Math.max(7,R*.040))return null;
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/18){
   const innerAt=at(inner,angle),outerAt=at(outer,angle);
   if(outerAt<=innerAt+R*.01||outerAt>=R*1.23||innerAt<R*.73)return null;
 }
 return {cx:bull.x,cy:bull.y,radius:coeffs[0],coeffs,
  boundaries:{inner,outer,edgeP90:edge90,thickness},
  fit:{medianError:p50,p90Error:p90,angles:obs.length,validationAngles:heldout.length},
  coverage:obs.length/sectors,method:'bull-ring-edges-experiment',orientationKnown:false};
}
root.DartArenaEllipseCalibration={estimate};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaEllipseCalibration;
})(typeof window!=='undefined'?window:globalThis);