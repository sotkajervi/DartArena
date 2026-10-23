'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const H=require('../autozoom/heatmap-math.js');
const T=require('../autozoom/tip-map.js');
test('calibrated heatmap puts bull at center and D20 at top with tilted cameras',()=>{
 const b={x:640,y:360,radius:290,rotation:Math.PI/6};
 assert.deepEqual(H.normalize(b,{x:640,y:360}),{u:0,v:0});
 const d20={x:b.x+b.radius*Math.sin(b.rotation),y:b.y-b.radius*Math.cos(b.rotation)};
 const p=H.normalize(b,d20);
 assert.ok(Math.abs(p.u)<1e-10,'D20 must remain centered');
 assert.ok(Math.abs(p.v+1)<1e-10,'D20 remains above bull');
 assert.equal(H.normalize(b,{x:1600,y:990}),null,'Outside-board point rejected');
});
test('zoom canvas clicks map precisely to video coordinates',()=>{
 const crop={x:200,y:100,width:400,height:300},rect={left:10,top:20,width:640,height:480};
 assert.deepEqual(T.pointFromZoom({clientX:330,clientY:260},rect,crop,320,240),{x:400,y:250});
 assert.deepEqual(T.pointOnZoom({x:400,y:250},crop,320,240),{x:160,y:120});
 assert.equal(T.pointFromZoom({clientX:9,clientY:260},rect,crop,320,240),null);
});
test('the raw ZoomCam source is used without starting another capture or updating scoring',()=>{
 const source=fs.readFileSync(path.join(root,'online-heatmap-beta.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
 assert.match(source,/DartArenaX01ZoomSession\?\.sourceTrack/);
 assert.match(source,/new MediaStream\(\[s\.track\]\)/);
 assert.doesNotMatch(source,/getUserMedia|\.rpc\(|\.from\(|\.insert\(|\.update\(/);
 assert.match(source,/if\(!active\(\)\)/);
 assert.match(source,/sessionStorage\.setItem/);
 assert.match(source,/tipDetected/);
 assert.match(source,/pointFromZoom/);
 const ordered=['autozoom/tracker.js','autozoom/heatmap-math.js','autozoom/tip-map.js','online-heatmap-beta.js'];
 let last=-1;
 for(const file of ordered){
   const pos=html.indexOf('src="'+file);
   assert.ok(pos>last,'Correct script dependency order for '+file);
   last=pos;
 }
 assert.match(html,/online-heatmap-beta\.css/);
 for(const normal of ['cricket.html','half-it.html','61-match.html']){
   assert.doesNotMatch(fs.readFileSync(path.join(root,normal),'utf8'),/online-heatmap-beta\.js/);
 }
});
test('narrow-tip inference never reports certainty on unchanged video frames',()=>{
 const width=100,height=70;
 const data=new Uint8ClampedArray(width*height*4);
 const p=H.infer(data,data,width,height,{x:45,y:35},{x:50,y:35,radius:24});
 assert.equal(p.tipDetected,false);
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
});
