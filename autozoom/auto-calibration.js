/* Experimental LOCAL dartboard-ring locator for Cam-test. No network/model calls.
   Returns image coordinates for Bull and an upright D20 candidate.
   The outer ring is rotationally symmetric: orientation MUST be confirmed. */
(function(root){
'use strict';
const ANGLES=48, cs=[], sn=[];
for(let i=0;i<ANGLES;i++){
 const a=i*Math.PI*2/ANGLES;
 cs.push(Math.cos(a));sn.push(Math.sin(a));
}
function detect(image){
 const w=image?.width|0,h=image?.height|0,p=image?.data;
 if(w<150||h<130||!p||p.length<w*h*4)return null;
 const mask=new Uint8Array(w*h);
 let colored=0;
 for(let i=0,j=0;i<mask.length;i++,j+=4){
  const r=p[j],g=p[j+1],b=p[j+2];
  const red=r>60&&r>g*1.25&&r>b*1.18&&r-g>24;
  const green=g>53&&g>r*1.20&&g>b*.88&&g-r>15;
  if(red||green){mask[i]=1;colored++}
 }
 if(colored<Math.max(250,w*h*.003))return null;
 function at(x,y){
  const ix=Math.round(x),iy=Math.round(y);
  return ix>=0&&iy>=0&&ix<w&&iy<h?mask[iy*w+ix]:0;
 }
 function annulus(cx,cy,r,ratio){
  // Small distant boards have only 1-2 pixels across each colored ring.
  // Sample a slightly wider radial band there, without blurring video.
  const band=r<Math.min(w,h)*.19?.035:.017;
  let hits=0;
  for(let k=0;k<ANGLES;k++){
   const x=cs[k],y=sn[k];
   if(at(cx+x*r*(ratio-band),cy+y*r*(ratio-.017))||
      at(cx+x*r*ratio,cy+y*r*ratio)||
      at(cx+x*r*(ratio+band),cy+y*r*(ratio+.017)))hits++;
  }
  return hits/ANGLES;
 }
 function evaluate(cx,cy,r){
  const outer=annulus(cx,cy,r,.976);
  if(outer<.27)return null;
  const triple=annulus(cx,cy,r,.606);
  if(triple<.27)return null;
  const gap=annulus(cx,cy,r,.82);
  const inner=annulus(cx,cy,r,.36);
  const bull=(at(cx,cy)+at(cx+r*.035,cy)+at(cx-r*.035,cy)+
              at(cx,cy+r*.035)+at(cx,cy-r*.035))/5;
  const score=.45*outer+.45*triple-.15*gap-.04*inner+.08*bull;
  return {cx,cy,r,score,outer,triple,gap,bull};
 }
 let best=null;
 const side=Math.min(w,h),r0=Math.max(26,Math.round(side*.12)),r1=Math.floor(side*.47);
 for(let r=r0;r<=r1;r+=6){
  const pad=r+3;
  for(let cy=pad;cy<h-pad;cy+=12){
   for(let cx=pad;cx<w-pad;cx+=12){
    const q=evaluate(cx,cy,r);
    if(q&&(!best||q.score>best.score))best=q;
   }
  }
 }
 if(!best)return null;
 let refined=best;
 for(let r=Math.max(r0,best.r-7);r<=Math.min(r1,best.r+7);r+=1){
  for(let cy=Math.max(r+3,best.cy-13);cy<=Math.min(h-r-4,best.cy+13);cy+=2){
   for(let cx=Math.max(r+3,best.cx-13);cx<=Math.min(w-r-4,best.cx+13);cx+=2){
    const q=evaluate(cx,cy,r);
    if(q&&q.score>refined.score)refined=q;
   }
  }
 }
 // Guard against the common false positives: colored objects or only one ring.
 if(refined.outer<.52||refined.triple<.52||refined.score<.48||
    refined.outer-refined.gap<.22||refined.triple-refined.gap<.22)return null;
 return {
  x:refined.cx,y:refined.cy,radius:refined.r,
  d20:{x:refined.cx,y:refined.cy-refined.r*.976},
  score:refined.score,outer:refined.outer,triple:refined.triple,
  assumption:'20-up',method:'local-ring-colors'
 };
}
// A colored ring identifies centre and radius, not which of the 20 sectors
// is D20. The user must point at the printed 20/D20 to fix orientation.
// Snap that angle onto the detected outer double-ring radius.
function snapD20(bull,click,radius){
 const dx=Number(click?.x)-Number(bull?.x),dy=Number(click?.y)-Number(bull?.y);
 const dist=Math.hypot(dx,dy);
 if(!Number.isFinite(radius)||radius<=0||!Number.isFinite(dist)||
    dist<radius*.55||dist>radius*1.55)return null;
 const scale=radius*.976/dist;
 return{x:bull.x+dx*scale,y:bull.y+dy*scale};
}
root.DartArenaAutoCalibration={detect,snapD20};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaAutoCalibration;
})(typeof window!=='undefined'?window:globalThis);