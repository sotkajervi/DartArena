'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('./autozoom/ellipse-calibration.js');
function board({w=480,h=320,cx=240,cy=160,major=126,minor=112,angle=0,light=1,
  hasBull=true,hasTriple=true,hasDouble=true}={}){
 const data=new Uint8ClampedArray(w*h*4),co=Math.cos(angle),si=Math.sin(angle);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,dx=x-cx,dy=y-cy;
  const xx=(dx*co+dy*si)/major,yy=(-dx*si+dy*co)/minor;
  const radius=Math.hypot(xx,yy);
  const colored=(hasDouble&&Math.abs(radius-.976)<.026)||
    (hasTriple&&Math.abs(radius-.606)<.023);
  const bull=hasBull&&radius<.075;
  const green=(Math.floor((Math.atan2(yy,xx)+Math.PI)/(Math.PI/10))%2)===0;
  const rgb=colored?(green?[45,220,55]:[230,45,36]):bull?[50,215,65]:[20,20,20];
  data[i]=Math.round(rgb[0]*light);data[i+1]=Math.round(rgb[1]*light);
  data[i+2]=Math.round(rgb[2]*light);data[i+3]=255;
 }
 return{width:w,height:h,data};
}
test('v2 uses an independent Bull location rather than colored ring centroid',()=>{
 const found=E.estimate(board());
 assert.ok(found,'Bull and rings must be recognized');
 assert.ok(Math.hypot(found.cx-240,found.cy-160)<3);
 assert.ok(found.fit.medianError<2);
 assert.ok(found.fit.p90Error<4);
 assert.ok(found.boundaries?.outer?.length===5);
 assert.ok(found.boundaries?.inner?.length===5);
 assert.ok(found.boundaries.outer[0]>found.boundaries.inner[0]);
 assert.equal(found.fit.validationAngles,36);
 assert.equal(found.orientationKnown,false,'D20 cannot be inferred from ring colors');
});
test('v2 handles shifted and rotated ellipse under moderately dim light',()=>{
 const input=board({cx:210,cy:168,major:136,minor:95,angle:.65,light:.65});
 const found=E.estimate(input);
 assert.ok(found);
 assert.ok(Math.hypot(found.cx-210,found.cy-168)<4);
 assert.ok(found.fit.p90Error<5);
});
test('v2 handles smaller boards with clearly visible Bull and rings',()=>{
 const found=E.estimate(board({cx:215,cy:153,major:53,minor:45}));
 assert.ok(found);
 assert.ok(Math.hypot(found.cx-215,found.cy-153)<3);
});
test('v2 rejects missing Bull, triple ring, double ring and cropped boards',()=>{
 for(const image of [
  board({hasBull:false}),board({hasTriple:false}),
  board({hasDouble:false}),board({cx:60,cy:35})
 ])assert.equal(E.estimate(image),null);
 const black=new Uint8ClampedArray(480*320*4);
 assert.equal(E.estimate({width:480,height:320,data:black}),null);
});
test('Owner test remains read-only with explicit quality/status information',()=>{
 const html=fs.readFileSync(path.join(__dirname,'owner-board-calibration-lab.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'owner-board-calibration-lab.js'),'utf8');
 assert.match(html,/id="ellipseAnalyze"/);
 assert.match(html,/autozoom\/ellipse-calibration\.js\?v=20261025-wireaudit1/);
 assert.match(js,/DartArenaEllipseCalibration/);
 assert.match(js,/found\.fit\.validationAngles/);
 assert.match(js,/found\.fit\.p90Error/);
 assert.match(js,/IKKE GODKJENT KALIBRERING/);
 assert.match(html,/id="wireAuditStart"/);
 assert.match(html,/id="wireAuditUndo"/);
 assert.match(html,/id="wireAuditReset"/);
 assert.match(js,/auditAngles=Array.from/);
 assert.match(js,/view\.addEventListener\('click'/);
 assert.match(js,/MANUELLE REFERANSEPUNKT/);
 assert.match(js,/e\.boundaries\.outer/);
 assert.match(js,/closePath\(\);ctx\.stroke/);
 assert.doesNotMatch(js,/saveConfig\(|localStorage\.setItem\(/);
 assert.doesNotMatch(html,/src=".*\.tflite/);
});
