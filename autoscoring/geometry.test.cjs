/* Run: node autoscoring/geometry.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/geometry.js','utf8'),scope,{filename:'geometry.js'});
const G=scope.window.DartArenaLabGeometry;
assert.equal(G.CALIBRATION_NAMES.length,9,'Bull + eight double-ring markers');
assert.ok(G.runSanityChecks(),'Geometry sanity checks');
const p=(x,y)=>({x:320+170*x,y:240+170*y});
const points=G.CALIBRATION_PARAMS.map(([x,y])=>p(x,y));
const m=G.prepare(points);
const samples=[
  [p(0,0),'DB',50],[p(.06,0),'SB',25],
  [p(0,-.98),'D20',40],[p(0,-.60),'T20',60],
  [p(0,-.75),'S20',20],[p(.75,0),'S6',6],
  [p(0,.75),'S3',3],[p(-.75,0),'S11',11],
  [p(1.1,0),'MISS',0]
];
for(const [point,label,points] of samples){
  const got=G.score(m,point);
  assert.equal(got.label,label,JSON.stringify(point));
  assert.equal(got.points,points,JSON.stringify(point));
}
assert.ok(m.errorPx<1e-5);
const mock={homography:[178,15,320,-18,164,240,.13,-.085]};
const projected=G.CALIBRATION_PARAMS.map(([x,y])=>G.project(mock,{x,y}));
const warped=G.prepare(projected);
assert.ok(warped.errorPx<.001);
for(const [q,label] of [
  [{x:0,y:-.60},'T20'],[{x:.75,y:0},'S6'],
  [{x:0,y:.98},'D3'],[{x:-.60,y:0},'T11'],
  [{x:0,y:0},'DB']
]){
  const im=G.project(mock,q);
  assert.equal(G.score(warped,im).label,label,'Perspective '+label);
  const inv=G.normalize(warped,im);
  assert.ok(Math.hypot(inv.x-q.x,inv.y-q.y)<.002,'Roundtrip');
}
const slightlyNoisy=projected.map((pt,i)=>({x:pt.x+(i%3-1)*1.5,y:pt.y+(i%2?.8:-.8)}));
const noisy=G.prepare(slightlyNoisy);
assert.ok(noisy.errorPx<5&&noisy.errorPx>0);
const bounds=G.boardBounds(warped,1280,720,.045);
assert.ok(bounds.width>200&&bounds.height>200&&bounds.x>=0&&bounds.x+bounds.width<=1280);
assert.throws(()=>G.prepare([{x:0,y:0}]),/ni punkter|9 punkter/);
assert.throws(()=>G.prepare(Array.from({length:9},()=>({x:0,y:0}))),/ujevne/);
const badOrder=points.map(x=>({...x}));[badOrder[2],badOrder[3]]=[badOrder[3],badOrder[2]];
assert.throws(()=>G.prepare(badOrder),/med klokken/);
const terrible=points.map(x=>({...x}));terrible[2].x+=65;
assert.throws(()=>G.prepare(terrible),/avvik|ujevne|med klokken/);
console.log('Autoscoring geometry: 9 anchors, precision, perspective, scoring and validation OK');
