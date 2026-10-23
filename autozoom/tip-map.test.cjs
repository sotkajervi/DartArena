'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const map=require('./tip-map.js');

test('ZoomCam click maps precisely from fitted crop back to source-video pixels',()=>{
  const rect={left:300,top:100,width:640,height:480};
  const crop={x:800,y:200,width:400,height:300};
  assert.deepEqual(map.pointFromZoom({clientX:620,clientY:340},rect,crop,320,240),{x:1000,y:350});
  assert.deepEqual(map.pointOnZoom({x:1000,y:350},crop,320,240),{x:160,y:120});
  const edge=map.pointFromZoom({clientX:300,clientY:100},rect,crop,320,240);
  assert.deepEqual(edge,{x:800,y:200});
  assert.equal(map.pointFromZoom({clientX:299,clientY:100},rect,crop,320,240),null);
  assert.equal(map.pointOnZoom({x:1201,y:350},crop,320,240),null);
  assert.equal(map.pointFromZoom({clientX:620,clientY:340},{...rect,width:0},crop,320,240),null);
});

test('Heatmap proposes a ZoomCam tip and stores a corrected board-entry point',()=>{
  const handlers=new Map();
  const ctx=new Proxy({}, {get(_,key){return ['clearRect','fillRect','beginPath','moveTo','arc','closePath','fill','stroke','lineTo','fillText'].includes(key)?()=>{}:undefined},
    set(){return true}});
  const canvas={width:380,height:380,getContext(){return ctx},addEventListener(type,fn){handlers.set('canvas:'+type,fn)},
    getBoundingClientRect(){return{left:0,top:0,width:380,height:380}}};
  const summary={textContent:''},undo={},clear={},exportBtn={addEventListener(){}};
  const elements={azHeatBoard:canvas,azHeatSummary:summary,azHeatUndo:undo,azHeatClear:clear,azHeatExport:exportBtn};
  const doc={getElementById(id){return elements[id]||null}};
  const dispatched=[];
  const win={DartArenaAutoZoom:{ORDER:[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]},
    addEventListener(type,fn){handlers.set(type,fn)},
    dispatchEvent(evt){dispatched.push(evt);handlers.get(evt.type)?.(evt)}};
  class CustomEvent{constructor(type,{detail}){this.type=type;this.detail=detail}}
  const sandbox={window:win,document:doc,CustomEvent,Math,Number,Date};
  vm.runInNewContext(fs.readFileSync(path.join(root,'heatmap-test.js'),'utf8'),sandbox);
  const width=100,height=100;
  const base=new Uint8ClampedArray(width*height*4),frame=new Uint8ClampedArray(base);
  const hit={x:55,y:52};
  handlers.get('dartarena:autozoom-test-hit')({detail:{
    base,frame,width,height,hit,
    sourceWidth:200,sourceHeight:200,
    board:{x:50,y:50,radius:38}
  }});
  const suggestion=dispatched.find(e=>e.type==='dartarena:autozoom-tip-estimate');
  assert.ok(suggestion);
  assert.equal(suggestion.detail.x,110);
  assert.equal(suggestion.detail.y,104);
  assert.equal(suggestion.detail.tipDetected,false);
  assert.match(summary.textContent,/estimert fra bildeendring/);
  handlers.get('dartarena:autozoom-tip-confirmed')({detail:{
    x:126,y:112,board:{x:100,y:100,radius:76}
  }});
  assert.match(summary.textContent,/pilspiss korrigert i ZoomCam/);
  handlers.get('dartarena:autozoom-test-reset')();
  assert.match(summary.textContent,/Ingen treff ennå/);
});

test('Only isolated AutoZoom test uses ZoomCam tip corrections; match scores are untouched',()=>{
  const html=fs.readFileSync(path.join(root,'../autozoom-test.html'),'utf8');
  const src=fs.readFileSync(path.join(root,'test.js'),'utf8');
  const heat=fs.readFileSync(path.join(root,'heatmap-test.js'),'utf8');
  assert.ok(html.indexOf('autozoom/tip-map.js')<html.indexOf('autozoom/test.js'));
  assert.match(src,/tip-confirmed/);
  assert.match(src,/pointFromZoom/);
  assert.match(heat,/correctedFrom:'zoomcam'/);
  assert.doesNotMatch(src,/from\('matches'\)|rpc\('submit/);
});
