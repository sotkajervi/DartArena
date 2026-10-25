/* Local-only approximate colored-ring ellipse detection for Owner camera test.
 * Not a DartsKey model; not a homography; it never changes saved calibration.
 * D20 orientation cannot be inferred from symmetric colored rings.
 */
(function(root){
'use strict';
function estimate(image){
 const w=image?.width|0,h=image?.height|0,data=image?.data;
 if(w<150||h<130||!data||data.length<w*h*4)return null;
 let sx=0,sy=0,sxx=0,syy=0,sxy=0,n=0;
 const xs=[],ys=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),range=mx-mn;
  if(mx<70||range<1)continue;
  const saturation=range/mx;
  let hue;
  if(mx===r)hue=60*((g-b)/range+(g<b?6:0));
  else if(mx===g)hue=60*((b-r)/range+2);
  else hue=60*((r-g)/range+4);
  const red=(hue<=26||hue>=340)&&saturation>=85/255;
  const green=hue>=70&&hue<=176&&saturation>=55/255;
  if(!red&&!green)continue;
  xs.push(x);ys.push(y);sx+=x;sy+=y;sxx+=x*x;syy+=y*y;sxy+=x*y;n++;
 }
 if(n<Math.max(220,w*h*.007))return null;
 const cx=sx/n,cy=sy/n,xx=sxx/n-cx*cx,yy=syy/n-cy*cy,xy=sxy/n-cx*cy;
 const disc=Math.hypot(xx-yy,2*xy),eig1=(xx+yy+disc)/2,eig2=(xx+yy-disc)/2;
 if(eig1<=30||eig2<20||eig2/eig1<.25)return null;
 const angle=.5*Math.atan2(2*xy,xx-yy),co=Math.cos(angle),si=Math.sin(angle);
 const hist=new Uint32Array(28),start=1.14,step=.027;
 const rhos=new Float32Array(n),angles=new Float32Array(n);
 for(let i=0;i<n;i++){
  const dx=xs[i]-cx,dy=ys[i]-cy;
  const rx=(dx*co+dy*si)/Math.sqrt(eig1),ry=(-dx*si+dy*co)/Math.sqrt(eig2);
  const rho=Math.hypot(rx,ry);rhos[i]=rho;angles[i]=Math.atan2(ry,rx);
  const bin=Math.floor((rho-start)/step);
  if(bin>=0&&bin<hist.length)hist[bin]++;
 }
 let peakIdx=-1,peakCount=0;
 for(let i=1;i<hist.length-1;i++){
  const count=hist[i-1]+hist[i]+hist[i+1];
  if(count>peakCount){peakCount=count;peakIdx=i}
 }
 if(peakIdx<0||peakCount<Math.max(75,n*.035))return null;
 const peak=start+(peakIdx+.5)*step;
 const coverage=new Set();let outer=0,inner=0;
 for(let i=0;i<n;i++){
  const rho=rhos[i];
  if(Math.abs(rho-peak)<.085){
   outer++;
   coverage.add(Math.floor(((angles[i]+Math.PI)/(2*Math.PI))*20)%20);
  }
  if(rho>=.54*peak&&rho<=.69*peak)inner++;
 }
 const major=Math.sqrt(eig1)*peak,minor=Math.sqrt(eig2)*peak;
 const fit=coverage.size/20;
 if(outer<Math.max(130,n*.10)||inner<Math.max(70,n*.065)||fit<.65)return null;
 if(major>Math.min(w,h)*.64||minor>Math.min(w,h)*.59||minor<18)return null;
 return{cx,cy,major,minor,angle,coverage:fit,
  colored:n,outer,inner,method:'colored-ring-ellipse',orientationKnown:false};
}
root.DartArenaEllipseCalibration={estimate};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaEllipseCalibration;
})(typeof window!=='undefined'?window:globalThis);