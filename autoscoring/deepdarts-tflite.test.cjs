/* node autoscoring/deepdarts-tflite.test.cjs */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const script=fs.readFileSync(__dirname+'/deepdarts-tflite.js','utf8');
const env={window:{}};
vm.runInNewContext(script,env,{filename:'deepdarts-tflite.js'});
const D=env.window.DartArenaLabDeepDarts;
const tensor=(grid)=>({shape:[1,grid,grid,30],data:new Float32Array(grid*grid*30).fill(-100)});
function add(t,gy,gx,anchor,cls,tx=0,ty=0,obj=10){
  const grid=t.shape[1],k=(gy*grid+gx)*30+anchor*10;
  t.data[k]=tx;t.data[k+1]=ty;t.data[k+2]=0;t.data[k+3]=0;t.data[k+4]=obj;
  for(let i=0;i<5;i++)t.data[k+5+i]=i===cls?10:-10;
}
const larger=tensor(50),smaller=tensor(25);
add(larger,10,20,0,0); // tip at image x=(20.5/50)*800, y=(10.5/50)*800
add(smaller,5,5,0,1); // class 1: calibration only
const result=D.decode([smaller,larger],.2);
assert.equal(result.boxes.length,1);
assert.ok(Math.abs(result.boxes[0].x-.41)<.001);
assert.ok(Math.abs(result.boxes[0].y-.21)<.001);
assert.ok(result.boxes[0].confidence>.99);
const empty=D.decode([tensor(50),tensor(25)],.2);
assert.equal(empty.boxes.length,0);
const invalid=tensor(50);add(invalid,5,5,0,4);
assert.equal(D.decode([invalid,tensor(25)],.2).boxes.length,0);
assert.throws(()=>D.decode([tensor(50)]),/to modellutganger/);
assert.throws(()=>D.decode([{shape:[1,13,13,30],data:new Float32Array(13*13*30)},tensor(25)]),/YOLO-utgang/);
D.validateShapes({shape:[1,800,800,3],dtype:'float32'},[{shape:[1,50,50,30]},{shape:[1,25,25,30]}]);
assert.throws(()=>D.validateShapes({shape:[1,640,640,3],dtype:'float32'},[{shape:[1,50,50,30]},{shape:[1,25,25,30]}]),/800×800/);
assert.throws(()=>D.validateShapes({shape:[1,800,800,3],dtype:'float32'},[{shape:[1,50,50,30]},{shape:[1,13,13,30]}]),/kompatible/);
assert.equal(D.ready(),false);
console.log('DeepDarts D1 decoder/shapes: OK');
