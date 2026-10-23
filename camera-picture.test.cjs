'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Picture=require('./camera-picture.js');
function memoryStorage(){
  const map=new Map();
  return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,String(value))};
}

test('neutral defaults and bounded image adjustments',()=>{
  assert.deepEqual(Picture.normalize(null),{brightness:100,contrast:100,saturation:100});
  assert.deepEqual(Picture.normalize({brightness:500,contrast:2,saturation:'120'}),
    {brightness:135,contrast:80,saturation:120});
  assert.equal(Picture.normalize({brightness:'invalid'}).brightness,100);
  assert.equal(Picture.cssFilter({brightness:110,contrast:115,saturation:90}),
    'brightness(110%) contrast(115%) saturate(90%)');
});
test('picture settings save independently for each camera',()=>{
  const storage=memoryStorage();
  assert.deepEqual(Picture.load(storage,'camera-A'),Picture.DEFAULTS);
  assert.equal(Picture.save(storage,'camera-A',{brightness:114,contrast:118,saturation:95}),true);
  assert.equal(Picture.save(storage,'camera-B',{brightness:82,contrast:90,saturation:125}),true);
  assert.equal(Picture.load(storage,'camera-A').contrast,118);
  assert.equal(Picture.load(storage,'camera-B').brightness,82);
  assert.equal(Picture.save(storage,'',{}),false);
});
test('corrupt saved data falls back to neutral without throwing',()=>{
  const storage=memoryStorage();
  storage.setItem(Picture.STORAGE_KEY,'not-json');
  assert.deepEqual(Picture.load(storage,'camera'),Picture.DEFAULTS);
  assert.equal(Picture.save(storage,'camera',{contrast:125}),false);
  assert.deepEqual(Picture.load(null,'camera'),Picture.DEFAULTS);
});
test('Cam-test has a compact collapsible panel and original toggle',()=>{
  const source=fs.readFileSync(path.join(__dirname,'camera-picture.js'),'utf8');
  assert.match(source,/createElement\('details'\)/);
  assert.match(source,/Vis original/);
  assert.match(source,/Nullstill bilde/);
  assert.match(source,/loadedmetadata/);
  assert.match(source,/--da-picture-filter/);
});
test('Zoom-cam preserves raw detection while filtering only the outgoing render',()=>{
  const zoom=fs.readFileSync(path.join(__dirname,'autozoom','zoom-cam.js'),'utf8');
  const sampleIndex=zoom.indexOf('sampleCtx.drawImage(video');
  const drawIndex=zoom.indexOf('setDrawFilter(visualFilter)');
  assert.ok(sampleIndex>drawIndex,'The visual filter is configured before sample analysis');
  assert.match(zoom,/const visualFilter=picture!==false/);
  assert.match(zoom,/setDrawFilter\('none'\)/);
});
test('load helper wherever Zoom-cam is created',()=>{
  for(const page of ['index.html','room.html','match.html','tournament-match-room.html']){
    const html=fs.readFileSync(path.join(__dirname,page),'utf8');
    assert.ok(html.includes('camera-picture.js?v=20261023-picture1'),page);
    const pictureIndex=html.indexOf('camera-picture.js?v=20261023-picture1');
    if(page!=='index.html')
      assert.ok(pictureIndex<html.indexOf('autozoom/zoom-cam.js'),page+' loads picture helper first');
  }
});
