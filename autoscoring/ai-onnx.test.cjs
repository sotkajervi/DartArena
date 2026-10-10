/* Node test of the ONNX YOLO output parser (no model binaries needed). */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const window={},document={createElement(){return{getContext(){return{}}}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/ai-onnx.js','utf8'),{window,document,Float32Array,Number,Math,Promise});
const AI=window.DartArenaLabAI;
function make(c,n,entries){
  const raw=new Float32Array(c*n);
  for(const [r,ch,value] of entries)raw[ch*n+r]=value;
  return {dims:[1,c,n],data:raw};
}
const bounds={scale:.5,left:10,top:20,sw:1280,sh:720};
const tensor=make(8,12,[
  [0,0,110],[0,1,120],[0,4,.8],[0,5,170],[0,6,200],[0,7,.75],
  [1,0,110],[1,1,120],[1,4,.3],[1,5,170],[1,6,200],[1,7,.9],
  [2,0,110],[2,1,120],[2,4,.9],[2,5,171],[2,6,201],[2,7,.8],
]);
const hits=AI.parseOutput(tensor,bounds,{mode:'keypoint',keypointIndex:0,threshold:.5});
assert.equal(hits.length,1,'duplicate tips should merge');
assert.equal(Math.round(hits[0].x),322);
assert.equal(Math.round(hits[0].y),362);
assert.equal(hits[0].mode,'keypoint');
const cropHits=AI.parseOutput(tensor,{...bounds,sx:140,sy:90,sw:400,sh:400},{mode:'keypoint',keypointIndex:0,threshold:.5});
assert.equal(cropHits.length,1,'crop must retain model candidate');
assert.equal(Math.round(cropHits[0].x),462,'crop offset x');
assert.equal(Math.round(cropHits[0].y),452,'crop offset y');

const box=AI.parseOutput(make(5,12,[[0,0,170],[0,1,200],[0,4,.8]]),bounds,{mode:'bbox',keypointIndex:0,threshold:.5});
assert.equal(box.length,1);
assert.throws(()=>AI.parseOutput(tensor,bounds,{mode:'keypoint',keypointIndex:2,threshold:.5}),/mangler/);
const shape=AI.getInputShape({dimensions:[1,3,640,640]});
assert.equal(shape.w,640);
assert.equal(shape.nchw,true);
const shape2=AI.getInputShape({dimensions:[1,800,800,3]});
assert.equal(shape2.nchw,false);
assert.throws(()=>AI.getInputShape({dimensions:[1,1,640,640]}),/RGB/);
console.log('AI ONNX parser checks: PASS');
