'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Bias=require('./tip-bias.js');
const cfg={deviceId:'owner-cam',cx:.31,cy:.49,radius:.24,rotation:0};
function sample(dx,dy,options={}){
  const raw={x:700,y:330};
  return {status:'approved',manual:false,width:1920,height:1080,
    calibration:{...cfg},capturedAt:'2026-10-24T10:20:00.000Z',
    rawProposal:raw,proposal:raw,corrected:{x:raw.x+dx,y:raw.y+dy},...options};
}
test('approved Owner labels supply a robust per-camera median offset',()=>{
  const entries=[[-50,60],[-45,57],[-51,61],[-55,64],[-52,62],[-110,120]].map(([dx,dy])=>sample(dx,dy));
  const bias=Bias.estimate(entries,cfg,1920,1080);
  assert.equal(bias.samples,6);
  assert.ok(bias.dx<-50&&bias.dx>-54);
  assert.ok(bias.dy>60&&bias.dy<64);
  const candidate=Bias.adjust({x:700,y:330},bias,1920,1080);
  assert.equal(candidate.x,700+bias.dx);
  assert.equal(candidate.y,330+bias.dy);
});
test('rejected/pending guesses and other camera calibration are ignored',()=>{
  const entries=[sample(-50,60),sample(-52,61),sample(-51,62),sample(-53,60)];
  assert.equal(Bias.estimate(entries,cfg,1920,1080),null);
  entries.push(sample(250,200,{status:'pending'}));
  entries.push(sample(250,200,{status:'rejected'}));
  entries.push(sample(250,200,{calibration:{...cfg,deviceId:'different'}}));
  entries.push(sample(250,200,{calibration:{...cfg,cx:.5}}));
  entries.push(sample(250,200,{manual:true}));
  assert.equal(Bias.estimate(entries,cfg,1920,1080),null);
});
test('new proposals always measure against original centroid, not prior adjusted display point',()=>{
  const entries=[-50,-51,-49,-50,-52].map(dx=>sample(dx,60,{
    rawProposal:{x:700,y:330},proposal:{x:650,y:390},corrected:{x:700+dx,y:390}
  }));
  const est=Bias.estimate(entries,cfg,1920,1080);
  assert.equal(est.dx,-50);
  assert.equal(est.dy,60);
});
test('bias becomes inactive when resolution or calibration changed',()=>{
  const entries=[-50,-51,-49,-50,-52].map(dx=>sample(dx,60));
  assert.ok(Bias.estimate(entries,cfg,1920,1080));
  assert.equal(Bias.estimate(entries,cfg,1280,720),null);
  assert.equal(Bias.estimate(entries,{...cfg,radius:.3},1920,1080),null);
});
test('limits keep extreme or malicious corrections from influencing new estimates',()=>{
  const entries=[sample(1000,1000),sample(1000,1000),sample(1000,1000),
    sample(-50,60),sample(-50,60),sample(-50,60),sample(-50,60),sample(-50,60)];
  const est=Bias.estimate(entries,cfg,1920,1080);
  assert.equal(est.samples,5);
  assert.equal(est.dx,-50);assert.equal(est.dy,60);
  assert.deepEqual(Bias.adjust({x:5,y:1070},est,1920,1080),{x:0,y:1079});
  assert.equal(Bias.adjust(null,est,1920,1080),null);
});
