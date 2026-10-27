'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const viewerScript=fs.readFileSync(path.join(__dirname,'..','help-guide-viewer.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','help.html'),'utf8');

function mount(viewportWidth){
  const ids=['helpZoomcamOpen','helpZoomcamViewer','helpZoomcamViewport','helpZoomcamFull',
    'helpZoomcamScale','helpZoomcamIn','helpZoomcamOut','helpZoomcamFit','helpZoomcamClose'];
  const el={};
  for(const id of ids)el[id]={
    id,handlers:{},style:{width:''},textContent:'',value:'',
    scrollTop:0,scrollLeft:0,clientWidth:id==='helpZoomcamViewport'?viewportWidth:0,
    clientHeight:id==='helpZoomcamViewport'?600:0,
    addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)},
    fire(type,event={}){for(const fn of this.handlers[type]||[])fn(event)},
    getBoundingClientRect(){return{width:parseFloat(this.style.width)||650}},
    focus(){this.focused=true}
  };
  el.helpZoomcamViewer.open=false;
  el.helpZoomcamViewer.showModal=function(){this.open=true};
  el.helpZoomcamViewer.close=function(){this.open=false;this.fire('close')};
  const fakeDocument={getElementById:id=>el[id]||null};
  new Function('document',viewerScript)(fakeDocument);
  return el;
}

test('Help poster opens a native modal rather than its old small image tab',()=>{
  const el=mount(1270);let prevented=false;
  el.helpZoomcamOpen.fire('click',{preventDefault(){prevented=true}});
  assert.ok(prevented);
  assert.equal(el.helpZoomcamViewer.open,true);
  assert.ok(parseFloat(el.helpZoomcamFull.style.width)>=1200);
  assert.equal(el.helpZoomcamClose.focused,true);
  assert.match(html,/\.help-guide-viewport\{[^}]*overflow:auto/);
  assert.match(html,/<dialog class="help-guide-viewer"/);
});
test('Zoom controls change image width without changing the actual guide asset',()=>{
  const el=mount(1270);el.helpZoomcamOpen.fire('click',{preventDefault(){}});
  const original=parseFloat(el.helpZoomcamFull.style.width);
  el.helpZoomcamIn.fire('click');
  assert.ok(parseFloat(el.helpZoomcamFull.style.width)>original);
  assert.equal(el.helpZoomcamScale.textContent,'125 %');
  el.helpZoomcamOut.fire('click');
  assert.equal(parseFloat(el.helpZoomcamFull.style.width),original);
  el.helpZoomcamFit.fire('click');
  assert.equal(parseFloat(el.helpZoomcamFull.style.width),1246);
  assert.equal(el.helpZoomcamScale.textContent,'100 %');
  assert.match(html,/assets\/zoomcam-guide\.avif/);
});
test('Small screens open a scrollable 850px guide and support fitting it to width',()=>{
  const el=mount(350);el.helpZoomcamOpen.fire('click',{preventDefault(){}});
  assert.equal(parseFloat(el.helpZoomcamFull.style.width),850);
  assert.ok(parseFloat(el.helpZoomcamFull.style.width)>el.helpZoomcamViewport.clientWidth);
  el.helpZoomcamFit.fire('click');
  assert.equal(parseFloat(el.helpZoomcamFull.style.width),326);
});
test('Closing with button or backdrop restores keyboard focus to image',()=>{
  const el=mount(900);el.helpZoomcamOpen.fire('click',{preventDefault(){}});
  el.helpZoomcamClose.fire('click');
  assert.equal(el.helpZoomcamViewer.open,false);
  assert.equal(el.helpZoomcamOpen.focused,true);
  el.helpZoomcamOpen.fire('click',{preventDefault(){}});
  el.helpZoomcamViewer.fire('click',{target:el.helpZoomcamViewer});
  assert.equal(el.helpZoomcamViewer.open,false);
});
test('Help viewer has translated controls and retains a no-JavaScript image fallback',()=>{
  assert.match(html,/id="helpZoomcamOpen"[^>]*href="\.\/assets\/zoomcam-guide\.avif[^"]*" target="_blank"/);
  assert.match(html,/help-guide-viewer\.js\?v=20261028-scrollzoom1/);
  assert.match(html,/id="helpZoomcamClose"/);
  assert.match(html,/id="helpZoomcamFit"/);
});
