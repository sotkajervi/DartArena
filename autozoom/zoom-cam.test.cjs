'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const Z=require('./zoom-cam.js');
const T=require('./tracker.js');
const sample={deviceId:'webcam-1',cx:.5,cy:.5,radius:.195,rotation:0,aspect:16/9};
function storage(){
  const state=new Map();
  return {getItem:k=>state.get(k)||null,setItem:(k,v)=>state.set(k,String(v)),removeItem:k=>state.delete(k)};
}
test('Cam-test calibration stores only device geometry across navigation',()=>{
  const store=storage();
  assert.ok(Z.saveConfig(store,sample));
  const saved=Z.loadConfig(store);
  assert.deepEqual({...saved},{...sample,speed:'normal',sensitivity:'normal',version:1});
  assert.equal(Object.keys(saved).includes('track'),false);
  assert.equal(Z.loadConfig(storage()),null);
  assert.equal(Z.saveConfig(store,{...sample,cx:4}),false);
  assert.ok(Z.saveConfig(store,{...sample,speed:'fast',sensitivity:'low'}));
  assert.equal(Z.loadConfig(store).speed,'fast');
  assert.equal(Z.loadConfig(store).sensitivity,'low');
});
test('device and aspect ratio are checked before using calibration',()=>{
  const track={getSettings:()=>({deviceId:'webcam-1'})};
  assert.equal(Z.compatible(Z.loadConfig((()=>{const v=storage();Z.saveConfig(v,sample);return v})()),track,1280,720),true);
  assert.equal(Z.compatible(sample,{getSettings:()=>({deviceId:'different'})},1280,720),false);
  assert.equal(Z.compatible(sample,track,640,480),false);
});
test('selected Zoom-cam is a separate video mode, not a fake physical device ID',()=>{
  const s=storage();
  assert.equal(Z.selected(s),false);
  Z.setSelected(s,true);assert.equal(Z.selected(s),true);
  assert.equal(Z.ZOOM_VALUE,'__dartarena_zoomcam__');
  Z.setSelected(s,false);assert.equal(Z.selected(s),false);
});
test('calibrate from Bull and D20 with no extra camera tracks',()=>{
  const video={videoWidth:1280,videoHeight:720};
  const c=Z.calibration(video,{x:640,y:360},{x:640,y:130},'webcam-1');
  assert.ok(c&&c.radius>.15&&c.radius<.25);
  assert.equal(c.cx,.5);assert.equal(c.cy,.5);assert.ok(Math.abs(c.rotation)<.0001);
  assert.equal(Z.calibration(video,{x:640,y:360},{x:641,y:359},'webcam-1'),null);
});
test('calibration positions are mapped to the underlying image, including letterbox',()=>{
  const video={videoWidth:1280,videoHeight:720,
    getBoundingClientRect:()=>({left:100,top:100,width:600,height:450})};
  const p=Z.pointer(video,{clientX:400,clientY:325});
  assert.ok(p);assert.ok(Math.abs(p.x-640)<1);assert.ok(Math.abs(p.y-360)<1);
});
test('composer makes one output video track and preserves the original audio track',()=>{
  const source={kind:'video',readyState:'live',enabled:true,
    getSettings:()=>({deviceId:'webcam-1',width:1280,height:720}),stopped:false,
    stop(){this.stopped=true}};
  const microphone={kind:'audio',readyState:'live'};
  class FakeStream{
    constructor(tracks){this.tracks=tracks}
    getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
  }
  const outgoing={kind:'video',readyState:'live',stopped:false,stop(){this.stopped=true}};
  let draws=0;
  function ctx(){return{fillRect(){},drawImage(){draws++},strokeRect(){},
    getImageData(){return{data:new Uint8ClampedArray(480*270*4)}}}}
  const renderCanvas={width:0,height:0,getContext:ctx,captureStream:()=>new FakeStream([outgoing])};
  const video={videoWidth:1280,videoHeight:720,play:async()=>{},pause(){},srcObject:null};
  const frames=[];
  const oldMedia=global.MediaStream,oldRAF=global.requestAnimationFrame,oldCancel=global.cancelAnimationFrame;
  const oldDoc=global.document;
  try{
    global.MediaStream=FakeStream;
    global.requestAnimationFrame=fn=>{frames.push(fn);return frames.length};
    global.cancelAnimationFrame=()=>{};
    global.document={createElement:()=>({width:0,height:0,getContext:ctx})};
    const raw=new FakeStream([source,microphone]);
    const composite=Z.create(raw,sample,{video,canvas:renderCanvas,tracker:T});
    assert.equal(composite.track,outgoing);
    assert.equal(composite.stream.getVideoTracks().length,1);
    assert.equal(composite.stream.getAudioTracks()[0],microphone);
    assert.equal(composite.sourceTrack,source);
    assert.ok(frames.length>0);
    frames.shift()(250);
    assert.ok(draws>=2,'Full board and magnified inset drawn onto the same canvas');
    composite.stop();
    assert.equal(outgoing.stopped,true);
    assert.equal(source.stopped,false,'Caller still owns the physical camera track');
  }finally{
    global.MediaStream=oldMedia;global.requestAnimationFrame=oldRAF;
    global.cancelAnimationFrame=oldCancel;global.document=oldDoc;
  }
});
test('Zoom-cam has fallback when captureStream is unsupported',()=>{
  const source={kind:'video',readyState:'live',getSettings:()=>({deviceId:'webcam-1',width:1280,height:720})};
  assert.throws(()=>Z.create({getVideoTracks:()=>[source]},sample,{canvas:{}}),/captureStream/);
});
test('main lobby Cam-test includes calibration code and the physical camera selector',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/autozoom\/camera-calibration\.js\?v=20261013-zoomcam1/);
  assert.match(html,/autozoom\/zoom-cam\.js\?v=20261013-zoomcam1/);
  assert.match(html,/id="cameraTestCameraSelect"/);
});
test('waiting room includes calibrated Zoom-cam selection and real sender.replaceTrack',()=>{
  const html=fs.readFileSync(path.join(root,'room.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'room-device-selector.js'),'utf8');
  assert.match(html,/autozoom\/zoom-cam\.js\?v=20261013-zoomcam1/);
  assert.match(js,/ZOOM_VALUE/);
  assert.match(js,/option\.textContent='Zoom-cam \(kalibrert\)'/);
  assert.match(js,/sender\.replaceTrack\(next\.track\)/);
  assert.doesNotMatch(js,/db\.rpc\('is_owner'\)/);
  assert.doesNotMatch(js,/db\.rpc\('is_admin'\)/);
});
test('X01 match reloads physical input and composes actual outbound video',()=>{
  const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'match.js'),'utf8');
  assert.match(html,/autozoom\/zoom-cam\.js\?v=20261013-zoomcam1/);
  assert.match(js,/Z\.create\(raw,config\)/);
  assert.match(js,/stream=zoomCamSession\.stream/);
  assert.match(js,/deviceId:\{exact:config\.deviceId\}/);
  assert.doesNotMatch(js,/db\.rpc\('is_owner'\)/);
  assert.doesNotMatch(js,/db\.rpc\('is_admin'\)/);
  assert.doesNotMatch(html,/autozoom\/match-share\.js/);
  assert.doesNotMatch(html,/autozoom\/match-beta\.js/);
});
test('every player can see and activate Zoom-cam without administrative RPC checks',()=>{
  const room=fs.readFileSync(path.join(root,'room-device-selector.js'),'utf8');
  const match=fs.readFileSync(path.join(root,'match.js'),'utf8');
  assert.match(room,/select===cameraSelect&&Z/);
  assert.match(room,/if\(!Z\|\|zoomSession\)return/);
  assert.match(room,/Z\.selected\(localStorage\)/);
  assert.doesNotMatch(room,/zoomAllowed|is_owner|is_admin/);
  assert.match(match,/const useZoom=!!\(Z&&config&&Z\.selected\(localStorage\)\)/);
  assert.doesNotMatch(match,/permitted|is_owner|is_admin/);
});

test('Zoom-cam remains opt-in with calibration required; regular camera stays available',()=>{
  const room=fs.readFileSync(path.join(root,'room-device-selector.js'),'utf8');
  const match=fs.readFileSync(path.join(root,'match.js'),'utf8');
  assert.match(room,/if\(config&&devices\.some\(d=>d\.deviceId===config\.deviceId\)\)/);
  assert.match(room,/Z\.compatible\(config,sourceTrack/);
  assert.match(room,/Z\.setSelected\(localStorage,false\)/);
  assert.match(room,/return await|replaceDevice\('video', savedCamera, false\)/);
  assert.match(match,/const useZoom=!!\(Z&&config&&Z\.selected\(localStorage\)\)/);
  assert.match(match,/stream=raw/);
  assert.match(match,/Zoom-cam kunne ikke starte, bruker vanlig kamera/);
});

test('ordinary stream is used if Zoom-cam fails; camera and mic controls still work',()=>{
  const match=fs.readFileSync(path.join(root,'match.js'),'utf8');
  const controls=fs.readFileSync(path.join(root,'match-controls.js'),'utf8');
  assert.match(match,/stream=raw/);
  assert.match(match,/Zoom-cam kunne ikke starte, bruker vanlig kamera/);
  assert.match(controls,/DartArenaX01ZoomSession\.sourceTrack\.enabled=false/);
  assert.match(controls,/DartArenaX01ZoomSession\.sourceTrack\.enabled=true/);
});
