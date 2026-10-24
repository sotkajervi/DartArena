'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Bias=require('./tip-online-calibration.js');
const camera={deviceId:'test-cam',cx:.31,cy:.49,radius:.22,rotation:0};
const row=(dx,dy,extra={})=>({
  model:'DartArenaDiffNet_v1',
  cameraCalibration:{...camera},crop:{width:298.07},
  rawAiZoom:{x:310,y:210},aiZoom:{x:310,y:210},
  correctedZoom:{x:310+dx,y:210+dy},...extra
});
test('requires five earlier verified Owner corrections',()=>{
  const approved=[row(12,9),row(13,8),row(11,9),row(12,11)];
  assert.equal(Bias.estimate(approved,camera,'DartArenaDiffNet_v1',298.07),null);
  approved.push(row(13,9));
  assert.deepEqual(Bias.estimate(approved,camera,'DartArenaDiffNet_v1',298.07),{
    dx:12,dy:9,samples:5,method:'median-prior-approved-tip-residual'
  });
});
test('does not learn from old camera, different models or unlabeled rows',()=>{
  const arr=[row(12,9),row(12,9),row(12,9),row(12,9)];
  arr.push(row(90,90,{correctedZoom:null}));
  arr.push(row(15,8,{cameraCalibration:{...camera,deviceId:'different'}}));
  arr.push(row(15,8,{model:'other'}));
  arr.push(row(15,8,{crop:{width:290}}));
  assert.equal(Bias.estimate(arr,camera,'DartArenaDiffNet_v1',298.07),null);
});
test('ignores large wrong-dart outlier, uses raw model not prior displayed adjustment',()=>{
  const arr=[row(12,9),row(11,10),row(14,7),row(13,9),row(12,8),
    row(75,116),row(11,8,{aiZoom:{x:325,y:219}})];
  const b=Bias.estimate(arr,camera,'DartArenaDiffNet_v1',298.07);
  assert.equal(b.samples,6);assert.equal(b.dx,12);assert.equal(b.dy,8.5);
  assert.deepEqual(Bias.apply({x:300,y:200},b),{x:312,y:208.5});
});
test('limits adjustment and cannot produce out-of-frame point',()=>{
  const arr=Array.from({length:5},()=>row(29,30));
  const b=Bias.estimate(arr,camera,'DartArenaDiffNet_v1',298.07);
  assert.equal(b.dx,24);assert.equal(b.dy,24);
  assert.deepEqual(Bias.apply({x:637,y:478},b),{x:639,y:479});
  assert.deepEqual(Bias.apply({x:1,y:2},null),{x:1,y:2});
});
