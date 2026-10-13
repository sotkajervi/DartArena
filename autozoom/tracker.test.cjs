'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const T=require('./tracker.js');
const W=400,H=240;
function frame(fill=25){
  const out=new Uint8ClampedArray(W*H*4);
  for(let i=0;i<out.length;i+=4){out[i]=fill;out[i+1]=fill;out[i+2]=fill;out[i+3]=255}
  return out;
}
function paint(out,x,y,width,height,level=230){
  for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++){
    const p=(yy*W+xx)*4;out[p]=level;out[p+1]=level;out[p+2]=level;
  }
}
const board={x:200,y:120,radius:90};

test('D8 is in the lower left, T20 is at the top and T19 is lower left',()=>{
  const t20=T.targetPoint(200,120,90,'T20');
  const t19=T.targetPoint(200,120,90,'T19');
  const d8=T.targetPoint(200,120,90,'D8');
  assert.equal(Math.round(t20.x),200);
  assert.ok(t20.y<80);
  assert.ok(t19.x<200&&t19.y>120);
  assert.ok(d8.x<120&&d8.y>120);
  assert.equal(T.targetPoint(200,120,90,'BULL').x,200);
  assert.equal(T.targetPoint(200,120,90,'D99'),null);
  const rotated=T.targetPoint(200,120,90,'D20',Math.PI/2);
  assert.ok(rotated.x>285&&Math.abs(rotated.y-120)<.001);
});

test('changes isolated to a dart-sized new region produce an approximate hit location',()=>{
  const baseline=frame(),current=frame();
  paint(current,118,165,20,15);
  const hit=T.findChange(baseline,current,W,H,board);
  assert.ok(hit);
  assert.ok(hit.x>=115&&hit.x<=145,`x=${hit.x}`);
  assert.ok(hit.y>=160&&hit.y<=185,`y=${hit.y}`);
  assert.ok(hit.changedSamples>10);
});

test('no new pixels means no new dart suggestion',()=>{
  assert.equal(T.findChange(frame(),frame(),W,H,board),null);
  assert.equal(T.motionRatio(frame(),frame(),W,H,board),0);
});

test('uniform brightness or a hand-sized change is rejected',()=>{
  const a=frame(),b=frame(230);
  assert.equal(T.findChange(a,b,W,H,board),null);
  assert.ok(T.motionRatio(a,b,W,H,board)>.3);
});

test('changes outside the dartboard are ignored',()=>{
  const a=frame(),b=frame();paint(b,5,5,23,16);
  assert.equal(T.findChange(a,b,W,H,board),null);
});

test('frame-to-frame movement ratio reports a fresh change',()=>{
  const a=frame(),b=frame();paint(b,118,165,20,15);
  assert.ok(T.motionRatio(a,b,W,H,board)>.001);
});

test('zoom cropping preserves the inset aspect ratio and stays within webcam bounds',()=>{
  for(const position of [[0,0],[399,239],[200,120]]){
    const r=T.zoomCrop(W,H,...position,board.radius,4/3);
    assert.ok(r.x>=0&&r.y>=0);
    assert.ok(r.x+r.width<=W+.001);
    assert.ok(r.y+r.height<=H+.001);
    assert.ok(Math.abs(r.width/r.height-4/3)<.001);
  }
});

test('standalone page has fixed main video, moving inset and camera controls',()=>{
  const html=fs.readFileSync(path.join(root,'autozoom-test.html'),'utf8');
  assert.match(html,/id="azVideo"/);
  assert.match(html,/id="azZoom" width="320" height="240"/);
  assert.match(html,/id="azCalibrate"/);
  assert.match(html,/id="azReference"/);
  assert.match(html,/data-az-target="D8"/);
  assert.match(html,/autozoom\/test\.js\?v=20261013-autozoom1/);
});

test('zoom experiment does not send scores or video over the network',()=>{
  const src=fs.readFileSync(path.join(root,'autozoom/test.js'),'utf8');
  assert.doesNotMatch(src,/fetch\(|\.rpc\(|\.from\(|\.send\(|RTCPeerConnection|WebSocket|MediaRecorder/);
  assert.match(src,/getUserMedia\(/);
  assert.match(src,/audio:false/);
  assert.match(src,/els\.video\.play\(\)/);
  assert.match(src,/G\.findChange\(/);
  assert.match(src,/drawImage\(els\.video,crop\.x/);
});

test('AutoZoom entry is linked only from experimental Autoscoring Lab',()=>{
  const lab=fs.readFileSync(path.join(root,'autoscoring-lab.html'),'utf8');
  assert.match(lab,/id="labApp" hidden>[\s\S]*?href="autozoom-test\.html"/);
});
