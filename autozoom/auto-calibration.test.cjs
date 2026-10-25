'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Detector=require('./auto-calibration.js');
const root=path.resolve(__dirname,'..');

function boardFrame({width=420,height=300,cx=206,cy=150,radius=109,brightness=1,triple=true}={}){
  const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4,r=Math.hypot(x-cx,y-cy)/radius;
    const onRing=Math.abs(r-.976)<.025||(triple&&Math.abs(r-.606)<.025);
    if(onRing||r<.035){
      const green=Math.round(((Math.floor((Math.atan2(y-cy,x-cx)+Math.PI)*10/Math.PI)%2)===0?220:48)*brightness);
      const red=Math.round(((Math.floor((Math.atan2(y-cy,x-cx)+Math.PI)*10/Math.PI)%2)===0?45:220)*brightness);
      data[i]=red;data[i+1]=green;data[i+2]=40;
    }else{data[i]=30;data[i+1]=30;data[i+2]=30;}
    data[i+3]=255;
  }
  return{width,height,data};
}
test('auto-detects centered Bull and D20 from two colored dartboard rings',()=>{
  const p=Detector.detect(boardFrame());
  assert.ok(p,'Both rings should be located');
  assert.ok(Math.abs(p.x-206)<=6);
  assert.ok(Math.abs(p.y-150)<=6);
  assert.ok(Math.abs(p.radius-109)<=8);
  assert.ok(Math.abs(p.d20.x-p.x)<.001);
  assert.ok(p.d20.y<p.y);
  assert.equal(p.assumption,'20-up','Outer rings alone cannot determine the rotation');
});
test('finds a smaller distant dartboard in a webcam frame',()=>{
  const p=Detector.detect(boardFrame({radius:40}));
  assert.ok(p,'The board must still be detectable when it occupies a smaller frame area');
  assert.ok(Math.abs(p.x-206)<=6);
  assert.ok(Math.abs(p.y-150)<=6);
  assert.ok(Math.abs(p.radius-40)<=8);
});
test('accepts a moderately dim camera image if colored rings remain visible',()=>{
  assert.ok(Detector.detect(boardFrame({brightness:.55})));
});
test('rejects blank/noisy boards and only one colored ring',()=>{
  const blank=boardFrame({brightness:0,triple:false});
  assert.equal(Detector.detect(blank),null);
  assert.equal(Detector.detect(boardFrame({triple:false})),null);
});
test('D20 orientation click snaps to previously detected double ring for rotated boards',()=>{
  const c={x:200,y:150},r=100;
  const direct=Detector.snapD20(c,{x:310,y:150},r);
  assert.ok(direct);
  assert.ok(Math.abs(direct.x-(200+r*.976))<.001);
  assert.ok(Math.abs(direct.y-150)<.001);
  // Click on printed "20" just outside double ring and obtain same angle.
  const printed=Detector.snapD20(c,{x:320,y:150},r);
  assert.ok(Math.abs(printed.x-direct.x)<.001);
  assert.ok(Math.abs(printed.y-direct.y)<.001);
  assert.equal(Detector.snapD20(c,{x:200,y:150},r),null);
  assert.equal(Detector.snapD20(c,{x:900,y:150},r),null);
});
test('auto calibration forbids Apply before selecting actual D20 direction',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'camera-calibration.js'),'utf8');
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(ui,/autoD20Verified=false/);
  assert.match(ui,/autoD20Verified=true/);
  assert.match(ui,/autoEditTarget\|\|!autoD20Verified/);
  assert.match(ui,/beginAutoEdit\('d20'\)/);
  assert.match(ui,/autoD20Verified\?\[\[bull/,'The unconfirmed guessed D20 is not drawn as verified');
  assert.match(index,/autozoom\/auto-calibration\.js\?v=20261025-d20-angle1/);
  assert.match(index,/autozoom\/camera-calibration\.js\?v=20261025-d20-angle1/);
});
test('Cam-test offers editable auto Bull and D20, explicit save, and manual fallback',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'camera-calibration.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'camera-calibration.css'),'utf8');
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(ui,/id="camZoomAuto"/);
  assert.match(ui,/id="camAutoEditBull"/);
  assert.match(ui,/id="camAutoEditD20"/);
  assert.match(ui,/id="camAutoApply"/);
  assert.match(ui,/Z\.framedPointer\(video,preview,event,framing\)/);
  assert.match(ui,/autoEditTarget/);
  assert.match(ui,/autoApply\.addEventListener\('click'/);
  assert.match(ui,/id="camZoomCalibrate"/,'Manual calibration remains available');
  assert.match(css,/\.cam-auto-edit-layer\[hidden\]/);
  assert.match(html,/autozoom\/camera-calibration\.js\?v=20261025-autocal-adjust1/);
});
