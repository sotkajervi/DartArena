/* Run node autoscoring/roboflow.test.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const scope={window:{},document:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/roboflow.js','utf8'),scope,{filename:'roboflow.js'});
const C=scope.window.DartArenaLabRoboflow;
const region={x:100,y:50,width:400,height:200};
const resp={image:{width:200,height:100},detections:[
  {x:100,y:50,confidence:.86,className:'dart_tip'},
  {x:-1,y:50,confidence:.77},
  {x:199,y:90,confidence:.03}
]};
const mapped=C.mapDetections(resp,region,{width:200,height:100});
assert.equal(mapped.length,1);
assert.equal(mapped[0].x,300);
assert.equal(mapped[0].y,150);
assert.equal(mapped[0].confidence,.86);
const fallback=C.mapDetections({image:{width:null,height:null},detections:[{x:5,y:10,confidence:.7}]},
  {x:20,y:30,width:200,height:100},{width:20,height:20});
assert.equal(fallback[0].x,70);
assert.equal(fallback[0].y,80);
assert.throws(()=>C.mapDetections({},region,{width:200,height:100}),/Ugyldig svar/);
assert.match(C.explain(null,{error:'roboflow_key_not_configured'}),/ROBOFLOW_API_KEY/);
assert.match(C.explain(null,{error:'daily_test_limit'}),/testgrense/);
console.log('Roboflow adapter: coordinates, validation, errors OK');
