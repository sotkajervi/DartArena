/* Owner-only calibrated AI point overlay for experimental testzone.
   This does not retrain or modify the model. Inputs must be previously labeled
   points from the same camera setup; exclude current test to prevent leakage. */
(function(root){
'use strict';
const finite=Number.isFinite;
function median(numbers){
  if(!numbers.length)return null;
  const s=numbers.slice().sort((a,b)=>a-b),m=s.length>>>1;
  return s.length%2?s[m]:(s[m-1]+s[m])/2;
}
function usable(row,config,model,cropWidth){
  const p=row?.rawAiZoom||row?.aiZoom,q=row?.correctedZoom,c=row?.cameraCalibration;
  return row?.model===model&&
    !!config&&!!c&&!!config.deviceId&&c.deviceId===config.deviceId&&
    Math.abs((c.cx||0)-(config.cx||0))<.012&&
    Math.abs((c.cy||0)-(config.cy||0))<.012&&
    Math.abs((c.radius||0)-(config.radius||0))<.012&&
    Math.abs((c.rotation||0)-(config.rotation||0))<.06&&
    Math.abs((row.crop?.width||0)-cropWidth)<1.5&&
    p&&q&&[p.x,p.y,q.x,q.y].every(finite)&&
    p.x>=0&&p.x<=640&&p.y>=0&&p.y<=480&&
    q.x>=0&&q.x<=640&&q.y>=0&&q.y<=480&&
    Math.hypot(q.x-p.x,q.y-p.y)<=48;
}
function estimate(previous,config,model,cropWidth,min=5){
  if(!Array.isArray(previous)||!Number.isFinite(cropWidth))return null;
  // Only earlier Owner-marked tips are admissible; never include pending tests.
  const data=previous.filter(row=>usable(row,config,model,cropWidth)).slice(-80);
  if(data.length<min)return null;
  const dx=median(data.map(r=>r.correctedZoom.x-(r.rawAiZoom||r.aiZoom).x));
  const dy=median(data.map(r=>r.correctedZoom.y-(r.rawAiZoom||r.aiZoom).y));
  return{dx:Math.max(-24,Math.min(24,dx)),
         dy:Math.max(-24,Math.min(24,dy)),
         samples:data.length,method:'median-prior-approved-tip-residual'};
}
function apply(p,adjustment){
  if(!p||![p.x,p.y].every(finite))return null;
  if(!adjustment)return{x:p.x,y:p.y};
  return{x:Math.max(0,Math.min(639,p.x+adjustment.dx)),
         y:Math.max(0,Math.min(479,p.y+adjustment.dy))};
}
const api={estimate,apply,usable};
root.DartArenaTipOnlineCalibration=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);