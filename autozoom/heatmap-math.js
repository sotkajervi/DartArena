/* DartArena camera heatmap beta — geometric helpers only; no scoring. */
(function(root){
'use strict';
function infer(base,frame,w,h,hit,board){
 // Experimental tip candidate: changed pixels form a broad flight and a
 // narrower shaft. Estimate the narrow end rather than the change centroid.
 const samples=[],rad=Math.max(14,Math.min(65,board.radius*.90)),threshold=85;
 for(let y=Math.max(0,Math.floor(hit.y-rad));y<Math.min(h,Math.ceil(hit.y+rad));y++)
  for(let x=Math.max(0,Math.floor(hit.x-rad));x<Math.min(w,Math.ceil(hit.x+rad));x++){
   const dx=x-hit.x,dy=y-hit.y;if(dx*dx+dy*dy>rad*rad)continue;
   const p=(y*w+x)*4,d=Math.abs(frame[p]-base[p])+Math.abs(frame[p+1]-base[p+1])+Math.abs(frame[p+2]-base[p+2]);
   if(d>threshold)samples.push({x,y});
  }
 if(samples.length<24)return{x:hit.x,y:hit.y,quality:'usikkert – få endrede piksler',tipDetected:false};
 const mx=samples.reduce((a,p)=>a+p.x,0)/samples.length,my=samples.reduce((a,p)=>a+p.y,0)/samples.length;
 let xx=0,yy=0,xy=0;
 for(const p of samples){xx+=(p.x-mx)**2;yy+=(p.y-my)**2;xy+=(p.x-mx)*(p.y-my)}
 const angle=.5*Math.atan2(2*xy,xx-yy),ax=Math.cos(angle),ay=Math.sin(angle);
 const values=samples.map(p=>({x:p.x,y:p.y,t:(p.x-mx)*ax+(p.y-my)*ay,n:-(p.x-mx)*ay+(p.y-my)*ax})).sort((a,b)=>a.t-b.t);
 const low=values[Math.floor(values.length*.04)].t,high=values[Math.floor(values.length*.96)].t,span=high-low;
 if(span<Math.max(12,board.radius*.18))return{x:hit.x,y:hit.y,quality:'usikkert – for kort form',tipDetected:false};
 // Compare transverse widths at both ends, ignoring isolated changed pixels.
 const band=Math.max(5,span*.22);
 const ends=[values.filter(p=>p.t>=low&&p.t<=low+band),values.filter(p=>p.t<=high&&p.t>=high-band)];
 function width(a){
  if(a.length<8)return Infinity;
  const sorted=a.map(p=>p.n).sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length*.85)]-sorted[Math.floor(sorted.length*.15)];
 }
 const widths=ends.map(width);
 const narrow=widths[0]<widths[1]?0:1,wide=1-narrow;
 if(!Number.isFinite(widths[narrow])||!Number.isFinite(widths[wide])||
    widths[wide]<Math.max(3,widths[narrow]*1.45))
  return{x:hit.x,y:hit.y,quality:'usikkert – kan ikke skille flight fra spiss',tipDetected:false};
 // The lower visible part is the expected board-entry side in this camera setup.
 // Do not use the upper narrow endpoint: it may still be a flight edge.
 const upperEnd=ends[0].reduce((a,p)=>a+p.y,0)/ends[0].length;
 const lowerEnd=ends[1].reduce((a,p)=>a+p.y,0)/ends[1].length;
 const lower=upperEnd>lowerEnd?0:1;
 if(narrow!==lower)return{x:hit.x,y:hit.y,quality:'usikkert – smal ende ikke nederst',tipDetected:false};
 // Use robust tail location (not the single outermost noise pixel).
 const tail=ends[narrow].sort((a,b)=>narrow===0?a.t-b.t:b.t-a.t);
 const point=tail[Math.min(tail.length-1,Math.max(0,Math.floor(tail.length*.15)))];
 const candidate={x:point.x,y:point.y};
 if(Math.hypot(candidate.x-hit.x,candidate.y-hit.y)>board.radius*.75)
  return{x:hit.x,y:hit.y,quality:'usikkert – avvikende spisskandidat',tipDetected:false};
 return{...candidate,quality:'smal ende av pilform (eksperiment)',tipDetected:true};
}

function normalize(board,point){
  if(!board||!(board.radius>0)||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return null;
  const x=(point.x-board.x)/board.radius,y=(point.y-board.y)/board.radius;
  const angle=board.rotation||0;
  // Undo the clockwise camera rotation so D20 remains at the top.
  const u=x*Math.cos(angle)+y*Math.sin(angle);
  const v=-x*Math.sin(angle)+y*Math.cos(angle);
  if(!Number.isFinite(u)||!Number.isFinite(v)||Math.hypot(u,v)>1.55)return null;
  return {u,v};
}
function boardPoint(board,point){
  const p=normalize(board,point);
  return p?{...p,radius:Math.hypot(p.u,p.v)}:null;
}
root.DartArenaHeatmapMath={infer,normalize,boardPoint};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaHeatmapMath;
})(typeof window!=='undefined'?window:globalThis);
