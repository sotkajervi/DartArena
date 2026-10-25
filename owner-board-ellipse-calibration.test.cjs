'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('./autozoom/ellipse-calibration.js');
function board({w=480,h=320,cx=245,cy=155,major=116,minor=96,angle=.22,light=1,inner=true}={}){
 const data=new Uint8ClampedArray(w*h*4),co=Math.cos(angle),si=Math.sin(angle);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,dx=x-cx,dy=y-cy,ex=(dx*co+dy*si)/major,ey=(-dx*si+dy*co)/minor;
  const distance=Math.hypot(ex,ey);
  const ring=Math.abs(distance-.976)<.019||(inner&&Math.abs(distance-.606)<.021);
  const alt=Math.round(20*(Math.atan2(ey,ex)+Math.PI)/(2*Math.PI))%2;
  const rgb=ring?(alt?[210,40,32]:[40,210,50]):[25,25,25];
  data[i]=Math.round(rgb[0]*light);data[i+1]=Math.round(rgb[1]*light);
  data[i+2]=Math.round(rgb[2]*light);data[i+3]=255;
 }
 return{width:w,height:h,data};
}
test('fits an elliptic dartboard ring without the TFLite model',()=>{
 const found=E.estimate(board());
 assert.ok(found);
 assert.ok(Math.abs(found.cx-245)<5&&Math.abs(found.cy-155)<5);
 assert.ok(Math.abs(found.major-116)<10&&Math.abs(found.minor-96)<10);
 assert.ok(found.coverage>=.9);
 assert.equal(found.orientationKnown,false,'Color rings do not identify D20');
});
test('locates tilted and moderately dim ellipse',()=>{
 const found=E.estimate(board({major:90,minor:62,angle:.7,light:.65}));
 assert.ok(found);
 assert.ok(Math.abs(found.cx-245)<5&&Math.abs(found.cy-155)<5);
 assert.ok(Math.abs(found.major-90)<10&&Math.abs(found.minor-62)<10);
});
test('rejects frames without both clear colored rings',()=>{
 assert.equal(E.estimate(board({inner:false})),null);
 const black=new Uint8ClampedArray(480*320*4);
 assert.equal(E.estimate({width:480,height:320,data:black}),null);
});
test('Owner lab connects read-only no-model analysis to image and camera flow',()=>{
 const html=fs.readFileSync(path.join(__dirname,'owner-board-calibration-lab.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'owner-board-calibration-lab.js'),'utf8');
 assert.match(html,/id="ellipseAnalyze"/);
 assert.match(html,/autozoom\/ellipse-calibration\.js\?v=20261025-ellipse1/);
 assert.match(js,/DartArenaEllipseCalibration/);
 assert.match(js,/ellipseAnalyze'\)\.addEventListener/);
 assert.match(js,/getImageData\(0,0,width,height\)/);
 assert.match(js,/Ingen innstillinger er endret/);
 assert.doesNotMatch(js,/saveConfig\(|localStorage\.setItem\(/);
});
