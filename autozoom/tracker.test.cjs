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

test('small low-contrast D4 change near double ring is detectable at high sensitivity',()=>{
  const d4=T.targetPoint(board.x,board.y,board.radius,'D4');
  assert.ok(d4.x>board.x&&d4.y<board.y,'D4 should be upper right');
  const baseline=frame(),current=frame();
  const x=Math.round(d4.x),y=Math.round(d4.y);
  paint(current,x-1,y-1,3,4,46);
  const hit=T.findChange(baseline,current,W,H,board,
    {stride:1,threshold:55,minSamples:5,minLocal:4});
  assert.ok(hit,'A narrow dart-sized D4 mark should be retained');
  assert.ok(Math.abs(hit.x-x)<5&&Math.abs(hit.y-y)<5);
  assert.equal(T.findChange(baseline,current,W,H,board,
    {stride:2,threshold:95,minSamples:12,minLocal:7}),null,
    'Low sensitivity may legitimately miss a faint dart-sized mark');
});

test('Normal temporarily uses the same proven-stable detector profile as Low',()=>{
  assert.deepEqual(T.sensitivityPreset('normal'),T.sensitivityPreset('low'));
  assert.equal(T.sensitivityPreset('normal').stride,2);
  assert.equal(T.sensitivityPreset('normal').threshold,95);
  assert.equal(T.sensitivityPreset('high').threshold,55);
});

test('Normal ignores weak camera flicker that used to trigger repeated motion events',()=>{
  const base=frame(),flicker=frame();
  // 30 grey levels in each colour channel = 90 summed RGB; old Normal
  // threshold 75 considered it a fresh hit, while Low threshold 95 ignored it.
  paint(flicker,120,160,14,15,55);
  const previousNormal={stride:1,threshold:75,minSamples:9,minLocal:6};
  assert.ok(T.findChange(base,flicker,W,H,board,previousNormal));
  assert.equal(T.findChange(base,flicker,W,H,board,T.sensitivityPreset('normal')),null);
  assert.equal(T.findChange(base,flicker,W,H,board,T.sensitivityPreset('low')),null);
});

test('Normal still tracks an obvious real dart-like change',()=>{
  const base=frame(),withDart=frame();
  paint(withDart,118,165,16,12,230);
  const normal=T.findChange(base,withDart,W,H,board,T.sensitivityPreset('normal'));
  assert.ok(normal&&normal.x>110&&normal.x<145);
});

test('zoom does not move for stable noise without a new motion event',()=>{
  const gate=T.createChangeGate({stableFrames:5});
  const noise={x:111,y:98,changedSamples:9,localSamples:9};
  for(let n=0;n<20;n++)
    assert.equal(gate.observe(noise,{now:n*150,radius:board.radius}),null);
});

test('new dart motion requires five consistent still frames, then moves once',()=>{
  const gate=T.createChangeGate({stableFrames:5});
  const dart={x:285,y:92,changedSamples:13,localSamples:13};
  assert.equal(gate.observe(dart,{movement:true,now:100,radius:board.radius}),null);
  for(let i=0;i<4;i++)
    assert.equal(gate.observe({...dart,x:dart.x+i*.3},{now:250+i*150,radius:board.radius}),null);
  assert.ok(gate.observe({...dart,x:dart.x+1.1},{now:850,radius:board.radius}));
  for(let i=0;i<10;i++)
    assert.equal(gate.observe(dart,{now:1000+i*150,radius:board.radius}),null,
      'Do not repeat the same old dart without a new motion event');
});

test('random jitter never triggers the zoom and ongoing movement resets stability',()=>{
  const gate=T.createChangeGate({stableFrames:5});
  let now=100;
  gate.observe(null,{movement:true,now,radius:board.radius});
  for(let i=0;i<30;i++){
    now+=150;
    const noise={x:i%2?90:260,y:i%2?160:70,changedSamples:8,localSamples:8};
    assert.equal(gate.observe(noise,{now,radius:board.radius}),null);
  }
  gate.observe(null,{movement:true,now:now+150,radius:board.radius});
  const stable={x:210,y:130,changedSamples:18,localSamples:17};
  assert.equal(gate.observe(stable,{now:now+300,radius:board.radius}),null);
  assert.equal(gate.observe(stable,{movement:true,now:now+450,radius:board.radius}),null);
  for(let i=0;i<4;i++)
    assert.equal(gate.observe(stable,{now:now+600+i*150,radius:board.radius}),null);
  assert.ok(gate.observe(stable,{now:now+1200,radius:board.radius}));
});

test('diffuse illumination flicker and expired motion never redirect zoom',()=>{
  const gate=T.createChangeGate({stableFrames:5});
  const scattered={x:190,y:100,changedSamples:100,localSamples:18};
  gate.observe(scattered,{movement:true,now:100,radius:board.radius});
  for(let i=0;i<8;i++)
    assert.equal(gate.observe(scattered,{now:250+i*150,radius:board.radius}),null);
  const quietDart={x:120,y:80,changedSamples:14,localSamples:14};
  for(let i=0;i<8;i++)
    assert.equal(gate.observe(quietDart,{now:5000+i*150,radius:board.radius}),null);
});

test('small D4 still moves after a real motion and sufficient stability',()=>{
  const gate=T.createChangeGate({stableFrames:5});
  const baseline=frame(),changed=frame();
  const d4=T.targetPoint(board.x,board.y,board.radius,'D4');
  paint(changed,Math.round(d4.x)-1,Math.round(d4.y)-1,3,4,46);
  const opts={stride:1,threshold:55,minSamples:5,minLocal:4};
  const motion=T.findChange(baseline,changed,W,H,board,opts);
  assert.ok(motion,'A new low-contrast D4 produces a motion event');
  assert.equal(gate.observe(null,{movement:!!motion,now:200,radius:board.radius}),null);
  for(let n=1;n<5;n++)
    assert.equal(gate.observe(T.findChange(baseline,changed,W,H,board,opts),
      {now:200+n*150,radius:board.radius}),null);
  const hit=gate.observe(T.findChange(baseline,changed,W,H,board,opts),
    {now:950,radius:board.radius});
  assert.ok(hit&&Math.abs(hit.x-d4.x)<5);
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

test('speed presets adjust both stable-frame confirmation and zoom motion',()=>{
  const fast=T.speedPreset('fast'),normal=T.speedPreset('normal'),smooth=T.speedPreset('smooth');
  assert.ok(fast.intervalMs<normal.intervalMs&&normal.intervalMs<smooth.intervalMs);
  assert.ok(fast.stableFrames<normal.stableFrames&&normal.stableFrames<smooth.stableFrames);
  assert.ok(fast.ease>normal.ease&&normal.ease>smooth.ease);
  assert.equal(T.speedPreset('invalid'),normal);
});

test('outer double-ring misses remain visible to the extended match tracker',()=>{
  const base=frame(),frameWithMiss=frame();
  paint(frameWithMiss,326,113,12,12);
  assert.equal(T.findChange(base,frameWithMiss,W,H,board,T.sensitivityPreset('normal')),null);
  const extended={...T.sensitivityPreset('normal'),searchRadius:1.65};
  const hit=T.findChange(base,frameWithMiss,W,H,board,extended);
  assert.ok(hit,'Visible dart outside board should be followed');
  assert.ok(hit.x>board.x+board.radius,'Hit is beyond double ring');
  assert.equal(T.motionRatio(base,frameWithMiss,W,H,board),0);
  assert.ok(T.motionRatio(base,frameWithMiss,W,H,board,{searchRadius:1.65})>0);
});

test('zoom cropping preserves the inset aspect ratio and stays within webcam bounds',()=>{
  const centre=T.zoomCrop(W,H,board.x,board.y,board.radius,4/3);
  assert.ok(Math.abs(centre.width-board.radius*.65)<.001,'Inset should be ~38% closer than v1');
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
  assert.match(html,/id="azCamera"/);
  assert.match(html,/id="azCalibrate"/);
  assert.match(html,/id="azReference"/);
  assert.match(html,/data-az-target="D8"/);
  assert.match(html,/data-az-target="D4"/);
  assert.match(html,/id="azSensitivity"/);
  assert.match(html,/id="azSpeed"/);
  assert.match(html,/autozoom\/test\.js\?v=20261013-autozoom6/);
  assert.match(html,/<option value="normal" selected>/);
});

test('zoom experiment does not send scores or video over the network',()=>{
  const src=fs.readFileSync(path.join(root,'autozoom/test.js'),'utf8');
  assert.doesNotMatch(src,/fetch\(|\.rpc\(|\.from\(|\.send\(|RTCPeerConnection|WebSocket|MediaRecorder/);
  assert.match(src,/getUserMedia\(/);
  assert.match(src,/enumerateDevices/);
  assert.match(src,/deviceId:/);
  assert.match(src,/audio:false/);
  assert.match(src,/els\.video\.play\(\)/);
  assert.match(src,/G\.findChange\(/);
  assert.match(src,/G\.createChangeGate\(/);
  assert.match(src,/changeGate\.observe\(candidate/);
  assert.match(src,/G\.sensitivityPreset\(els\.sensitivity\.value\)/);
  assert.match(src,/G\.speedPreset\(els\.speed\.value\)/);
  assert.match(src,/drawImage\(els\.video,crop\.x/);
});

test('AutoZoom entry is linked only from experimental Autoscoring Lab',()=>{
  const lab=fs.readFileSync(path.join(root,'autoscoring-lab.html'),'utf8');
  assert.match(lab,/id="labApp" hidden>[\s\S]*?href="autozoom-test\.html"/);
});
