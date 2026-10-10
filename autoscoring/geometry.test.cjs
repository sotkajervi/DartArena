/* Run with: node autoscoring/geometry.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/geometry.js','utf8'),context,{filename:'geometry.js'});
const G=context.window.DartArenaLabGeometry;
assert.equal(G.runSanityChecks(),true);
const R=170,center={x:320,y:240};
const p=(x,y)=>({x:center.x+x*R,y:center.y+y*R});
const m=G.prepare([p(0,0),p(0,-G.DOUBLE_MID),p(G.DOUBLE_MID,0),p(0,G.DOUBLE_MID),p(-G.DOUBLE_MID,0)]);
const cases=[
  [p(0,0),'DB',50],[p(.06,0),'SB',25],
  [p(0,-.98),'D20',40],[p(0,-.60),'T20',60],
  [p(0,-.75),'S20',20],[p(.75,0),'S6',6],
  [p(0,.75),'S3',3],[p(-.75,0),'S11',11],[p(1.1,0),'MISS',0]
];
for(const [point,label,points] of cases){
  const actual=G.score(m,point);
  assert.equal(actual.label,label,JSON.stringify(point));
  assert.equal(actual.points,points,JSON.stringify(point));
}
// Synthetic perspective distortion: verify inverse/projected scoring, not only a face-on circle.
const mock={homography:[178,15,320,-18,164,240,.13,-.085]};
const card=[{x:0,y:0},{x:0,y:-G.DOUBLE_MID},{x:G.DOUBLE_MID,y:0},{x:0,y:G.DOUBLE_MID},{x:-G.DOUBLE_MID,y:0}];
const imagePoints=card.map(q=>G.project(mock,q));
const warped=G.prepare(imagePoints);
for(const [q,label] of [
  [{x:0,y:-.60},'T20'],[{x:.75,y:0},'S6'],[{x:0,y:.98},'D3'],[{x:-.60,y:0},'T11'],[{x:0,y:0},'DB']
]){
  const img=G.project(mock,q);
  assert.equal(G.score(warped,img).label,label,'Perspective score mismatch '+label);
  const inv=G.normalize(warped,img);
  assert.ok(Math.hypot(inv.x-q.x,inv.y-q.y)<.002,'Perspective mapping mismatch');
}
const bounds=G.boardBounds(warped,1280,720,.045);
assert.ok(bounds.width>200&&bounds.height>200&&bounds.x>=0&&bounds.x+bounds.width<=1280);
assert.throws(()=>G.prepare([{x:0,y:0}]),/fem gyldige/);
assert.throws(()=>G.prepare([{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]),/for små/);
assert.throws(()=>G.prepare([p(0,0),p(0,-.97),p(-.97,0),p(0,.97),p(.97,0)]),/SAMME skive/);
console.log('Autoscoring geometry: scoring, perspective transform, crop and invalid calibration OK');
