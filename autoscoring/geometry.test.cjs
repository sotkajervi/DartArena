/* Run: node autoscoring/geometry.test.cjs – no browser or credentials needed. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/geometry.js','utf8'),scope,{filename:'geometry.js'});
const G=scope.window.DartArenaLabGeometry;
assert.equal(G.runSanityChecks(),true,'Geometry sanity checks');
const m=G.prepare([{x:320,y:240},{x:320,y:70},{x:490,y:240},{x:320,y:410},{x:150,y:240}]);
const cases=[
  [{x:320,y:240},'DB',50],
  [{x:330,y:240},'SB',25],
  [{x:320,y:75},'D20',40],
  [{x:320,y:140},'T20',60],
  [{x:320,y:130},'S20',20],
  [{x:490,y:240},'D6',12],
  [{x:320,y:405},'D3',6],
  [{x:150,y:240},'D11',22],
  [{x:500,y:240},'MISS',0]
];
for(const [point,label,points] of cases){
  const actual=G.score(m,point);
  assert.equal(actual.label,label,JSON.stringify(point));
  assert.equal(actual.points,points,JSON.stringify(point));
}
assert.throws(()=>G.prepare([{x:0,y:0}]),/fem punkter/);
assert.throws(()=>G.prepare([{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]),/for liten/);
console.log('Autoscoring geometry: '+cases.length+' cases + validation OK');
