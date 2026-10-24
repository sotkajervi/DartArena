/* Owner-only capture: correct recurring flight-centroid bias from APPROVED tips.
   This is a geometric calibration, not a trained dart-tip model. */
(function(root){
'use strict';
const finite=Number.isFinite;
function median(values){
  if(!values.length)return null;
  const sorted=values.slice().sort((a,b)=>a-b);
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}
function sameCamera(item,config,width,height){
  const c=item?.calibration;
  return !!(c&&config&&c.deviceId&&c.deviceId===config.deviceId&&
    Number(item.width)===width&&Number(item.height)===height&&
    [c.cx,c.cy,c.radius,c.rotation,config.cx,config.cy,config.radius,config.rotation].every(finite)&&
    Math.abs(c.cx-config.cx)<.012&&Math.abs(c.cy-config.cy)<.012&&
    Math.abs(c.radius-config.radius)<.012&&Math.abs(c.rotation-config.rotation)<.06);
}
function estimate(items,config,width,height,{minSamples=5,maxSamples=100}={}){
  if(!Array.isArray(items)||!width||!height)return null;
  // The owner must have checked the actual tip. Rejected and pending proposals
  // can never become ground truth or feed into their own corrections.
  const deltas=items.filter(item=>
    item?.status==='approved'&&sameCamera(item,config,width,height)&&
    (item.rawProposal||item.proposal)&&item.corrected&&item.manual!==true)
    .sort((a,b)=>String(a.capturedAt||'').localeCompare(String(b.capturedAt||'')))
    .slice(-maxSamples).map(item=>{
      const raw=item.rawProposal||item.proposal;
      if(![raw.x,raw.y,item.corrected.x,item.corrected.y].every(finite))return null;
      return {dx:item.corrected.x-raw.x,dy:item.corrected.y-raw.y};
    }).filter(v=>v&&Math.abs(v.dx)<=width*.18&&Math.abs(v.dy)<=height*.18);
  if(deltas.length<minSamples)return null;
  return {dx:median(deltas.map(v=>v.dx)),dy:median(deltas.map(v=>v.dy)),
    samples:deltas.length,method:'per-camera-median-approved-delta'};
}
function adjust(point,bias,width,height){
  if(!point||![point.x,point.y].every(finite))return null;
  if(!bias)return {x:point.x,y:point.y};
  return {x:Math.max(0,Math.min(width-1,point.x+bias.dx)),
    y:Math.max(0,Math.min(height-1,point.y+bias.dy))};
}
const api={estimate,adjust,sameCamera};
root.DartArenaTipBias=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
