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
  assert.deepEqual({...saved},{...sample,zoom:1,panX:0,panY:0,hitOffsetX:0,hitOffsetY:0,speed:'normal',sensitivity:'normal',version:1});
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
  assert.match(html,/autozoom\/camera-calibration\.js\?v=20261027-turncal1/);
  assert.match(html,/autozoom\/zoom-cam\.js\?v=20261027-turncal1/);
  assert.match(html,/id="cameraTestCameraSelect"/);
});
test('waiting room includes calibrated Zoom-cam selection and real sender.replaceTrack',()=>{
  const html=fs.readFileSync(path.join(root,'room.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'room-device-selector.js'),'utf8');
  assert.match(html,/autozoom\/zoom-cam\.js\?v=20261027-turncal1/);
  assert.match(js,/ZOOM_VALUE/);
  assert.match(js,/option\.textContent='Zoom-cam \(kalibrert\)'/);
  assert.match(js,/sender\.replaceTrack\(next\.track\)/);
  assert.doesNotMatch(js,/db\.rpc\('is_owner'\)/);
  assert.doesNotMatch(js,/db\.rpc\('is_admin'\)/);
});
test('X01 match reloads physical input and composes actual outbound video',()=>{
  const html=fs.readFileSync(path.join(root,'match.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'match.js'),'utf8');
  assert.match(html,/autozoom\/zoom-cam\.js\?v=20261027-turncal1/);
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


test('Zoom-cam resets immediately to T20 after a saved visit and keeps the media track',()=>{
  const source={kind:'video',readyState:'live',getSettings:()=>({deviceId:'webcam-1',width:1280,height:720})};
  const outgoing={kind:'video',readyState:'live',stop(){}};
  class FakeStream{
    constructor(tracks){this.tracks=tracks}
    getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
  }
  const crops=[],frames=[];
  const context=()=>({
    fillRect(){},drawImage(){},strokeRect(){},
    getImageData(){return{data:new Uint8ClampedArray(480*270*4)}}
  });
  const renderCanvas={width:0,height:0,getContext:context,captureStream:()=>new FakeStream([outgoing])};
  const video={videoWidth:1280,videoHeight:720,play:async()=>{},pause(){},srcObject:null};
  const fakeTracker={
    ...T,
    speedPreset:()=>({...T.speedPreset('fast'),intervalMs:1,quietFrames:0,ease:1}),
    findChange:()=>({x:390,y:100}),
    motionRatio:()=>0,
    createChangeGate:()=>({observe:hit=>hit,reset(){}}),
    zoomCrop:(w,h,x,y)=>{
      crops.push({x,y});
      return{x:100,y:50,width:60,height:45};
    }
  };
  const old={media:global.MediaStream,raf:global.requestAnimationFrame,
    cancel:global.cancelAnimationFrame,doc:global.document};
  try{
    global.MediaStream=FakeStream;
    global.requestAnimationFrame=fn=>{frames.push(fn);return frames.length};
    global.cancelAnimationFrame=()=>{};
    global.document={createElement:()=>({width:0,height:0,getContext:context})};
    const session=Z.create(new FakeStream([source]),sample,
      {video,canvas:renderCanvas,tracker:fakeTracker});
    frames.shift()(performance.now()+4000);
    assert.ok(crops.at(-1).x>800,'The detected hit moved the inset from T20');
    assert.equal(session.resetToT20(),true);
    frames.shift()(performance.now()+20);
    assert.ok(Math.abs(crops.at(-1).x-640)<.001,'Inset immediately returns to T20 x');
    assert.ok(crops.at(-1).y<360,'T20 target is above the bull');
    assert.equal(session.track,outgoing,'Reset does not replace or interrupt outbound video');
    session.stop();
    assert.equal(session.resetToT20(),false,'Stopped camera cannot restart a reset');
  }finally{
    global.MediaStream=old.media;global.requestAnimationFrame=old.raf;
    global.cancelAnimationFrame=old.cancel;global.document=old.doc;
  }
});
test('own saved visits pause tracking; opponent turn confirmation triggers reset',()=>{
  const regular=fs.readFileSync(path.join(root,'set-engine.js'),'utf8');
  const checkout=fs.readFileSync(path.join(root,'checkout-engine.js'),'utf8');
  const fallback=fs.readFileSync(path.join(root,'match.js'),'utf8');
  for(const code of [regular,checkout]){
    const fail=code.indexOf('if(error||!data)');
    const pause=code.indexOf('window.DartArenaX01ZoomSession?.pauseTracking?.()');
    assert.ok(pause>fail&&fail>=0,'Pause only after a successful score save');
    assert.doesNotMatch(code,/window\.DartArenaX01ZoomSession\?\.resetToT20\?\.\(\)/);
  }
  assert.match(fallback,/function syncZoomCamTurn\(previous,next\)/);
  assert.match(fallback,/if\(newTurn\|\|newLeg\)zoomCamSession\.resetToT20\?\.\(\)/);
  assert.match(fallback,/window\.DartArenaX01ZoomSession\?\.pauseTracking\?\.\(\)/);
});

test('digital framing crops and pans without changing camera calibration coordinates',()=>{
  assert.deepEqual(Z.framingOf(null),{zoom:1,panX:0,panY:0});
  assert.deepEqual(Z.framingCrop(1280,720,{}),
    {x:0,y:0,width:1280,height:720});
  assert.deepEqual(Z.framingCrop(1280,720,{zoom:2,panX:1,panY:-1}),
    {x:640,y:0,width:640,height:360});
  assert.deepEqual(Z.framingOf({zoom:99,panX:-4,panY:4}),
    {zoom:3,panX:-1,panY:1});
  assert.equal(Z.framingCrop(0,720,{zoom:2}),null);
});
test('Bull/D20 clicks on zoomed and panned preview map to raw video pixels',()=>{
  const video={videoWidth:1280,videoHeight:720};
  const preview={getBoundingClientRect:()=>({left:100,top:50,width:640,height:360})};
  const p=Z.framedPointer(video,preview,{clientX:420,clientY:230},
    {zoom:2,panX:.5,panY:0});
  assert.ok(p);
  assert.equal(p.x,800);assert.equal(p.y,360);
  const top=Z.framedPointer(video,preview,{clientX:420,clientY:50},
    {zoom:2,panX:.5,panY:0});
  assert.equal(top.y,180);
  assert.equal(Z.framedPointer(video,preview,{clientX:50,clientY:50},{zoom:2}),null);
});
test('saved framing survives navigation and is bounded safely',()=>{
  const store=storage();
  assert.ok(Z.saveConfig(store,{...sample,zoom:2.5,panX:.4,panY:-.35}));
  const cfg=Z.loadConfig(store);
  assert.equal(cfg.zoom,2.5);assert.equal(cfg.panX,.4);assert.equal(cfg.panY,-.35);
  assert.equal(cfg.cx,sample.cx);
});
test('inset location matches the optional top-right placement guide',()=>{
  const r=Z.insetRect(1280,720);
  assert.equal(r.width,422);assert.equal(r.height,317);
  assert.equal(r.x,838);assert.equal(r.y,20);
  const css=fs.readFileSync(path.join(root,'autozoom','camera-calibration.css'),'utf8');
  assert.match(css,/right:1\.6%;top:2\.8%;width:33%;aspect-ratio:4\/3/);
});
test('Cam-test offers zoom, draggable positioning, reset and optional inset guide',()=>{
  const ui=fs.readFileSync(path.join(root,'autozoom','camera-calibration.js'),'utf8');
  assert.match(ui,/id="camFramingZoom"/);
  assert.match(ui,/id="camFramingReset"/);
  assert.match(ui,/id="camFramingGuide"/);
  assert.match(ui,/framedPointer\(video,preview,event,framing\)/);
  assert.match(ui,/pointermove/);
  assert.match(ui,/\.\.\.settings,\.\.\.framing/);
  const match=fs.readFileSync(path.join(root,'match.html'),'utf8');
  assert.match(match,/autozoom\/zoom-cam\.js\?v=20261027-turncal1/);
});

test('Cam-test picture controls load after calibration and stay separate from detection',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const i=html.indexOf('autozoom/camera-calibration.js?v=20261027-turncal1');
  const pic=html.indexOf('camera-picture.js?v=20261023-picture2');
  assert.ok(i>0&&pic>i);
  assert.match(html,/autozoom\/camera-calibration\.css\?v=20261027-turncal1/);
  const calibration=fs.readFileSync(path.join(root,'autozoom','camera-calibration.js'),'utf8');
  assert.match(calibration,/picture:false/);
  const zoom=fs.readFileSync(path.join(root,'autozoom','zoom-cam.js'),'utf8');
  assert.match(zoom,/P\.cssFilter/);
  assert.match(zoom,/sampleCtx\.drawImage\(video/);
});

test('experimental auto calibration is not loaded in the user-facing Cam-test',()=>{
  const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const calibrationUi=fs.readFileSync(path.join(root,'autozoom','camera-calibration.js'),'utf8');
  assert.doesNotMatch(home,/src="autozoom\/auto-calibration\.js/);
  assert.match(calibrationUi,/id="camZoomUseInMatch"/);
  assert.match(calibrationUi,/Z\.setSelected\(localStorage,true\)/);
  assert.match(calibrationUi,/Z\.setSelected\(localStorage,false\)/);
});
test('online match reports whether Zoom-cam was actually used',()=>{
  const match=fs.readFileSync(path.join(root,'match.js'),'utf8');
  assert.match(match,/zoomCamNotice\('Zoom-cam valgt og startet i kamp\.'/);
  assert.match(match,/zoomCamNotice\('Zoom-cam kunne ikke startes\./);
  assert.match(match,/zoomCamNotice\('Zoom-cam er kalibrert, men ikke valgt\./);
});
test('Zoom-cam retries after delayed startup frame and a temporary draw failure',()=>{
  const source={kind:'video',readyState:'live',getSettings:()=>({deviceId:'webcam-1',width:1280,height:720})};
  const outgoing={kind:'video',readyState:'live',stop(){this.readyState='ended'}};
  class FakeStream{
    constructor(tracks){this.tracks=tracks}
    getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
  }
  let failDraw=true,drawCount=0;
  const context=()=>({
    fillRect(){},strokeRect(){},
    drawImage(){if(failDraw){failDraw=false;throw Error('video frame not ready')}drawCount++},
    getImageData(){return{data:new Uint8ClampedArray(480*270*4)}}
  });
  const canvas={width:0,height:0,getContext:context,captureStream:()=>new FakeStream([outgoing])};
  const video={videoWidth:1280,videoHeight:720,readyState:1,play:async()=>{},pause(){},srcObject:null};
  const frames=[];
  const old={media:global.MediaStream,raf:global.requestAnimationFrame,
    cancel:global.cancelAnimationFrame,doc:global.document};
  try{
    global.MediaStream=FakeStream;
    global.requestAnimationFrame=fn=>{frames.push(fn);return frames.length};
    global.cancelAnimationFrame=()=>{};
    global.document={createElement:()=>({width:0,height:0,getContext:context})};
    const session=Z.create(new FakeStream([source]),sample,{video,canvas,tracker:T});
    assert.equal(frames.length,1);
    frames.shift()(100);
    assert.equal(drawCount,0,'No frame drawn before playback is ready');
    assert.equal(frames.length,1,'Next animation frame still scheduled');
    video.readyState=2;
    const oldWarn=console.warn;
    console.warn=()=>{};
    try{frames.shift()(200)}finally{console.warn=oldWarn}
    assert.equal(frames.length,1,'A drawing error does not kill the compositor');
    frames.shift()(300);
    assert.ok(drawCount>=2,'Composite continues after the error');
    assert.equal(session.track,outgoing,'Outbound video remains the same track');
    session.stop();
  }finally{
    global.MediaStream=old.media;global.requestAnimationFrame=old.raf;
    global.cancelAnimationFrame=old.cancel;global.document=old.doc;
  }
});

test('camera-specific zoom correction is stored, bounded and keeps raw calibration intact',()=>{
  const store=storage();
  assert.ok(Z.saveConfig(store,{...sample,hitOffsetX:2,hitOffsetY:-.35}));
  const cfg=Z.loadConfig(store);
  assert.equal(cfg.hitOffsetX,1);
  assert.equal(cfg.hitOffsetY,-.35);
  assert.equal(cfg.cx,sample.cx);
  assert.equal(cfg.cy,sample.cy);
  assert.equal(cfg.radius,sample.radius);
  const rawHit={x:620,y:380};
  const boardRadius=250;
  assert.deepEqual(Z.offsetHit(rawHit,boardRadius,cfg),{x:870,y:292.5});
  assert.deepEqual(rawHit,{x:620,y:380},'Unmodified source point');
  assert.deepEqual(Z.offsetHit(rawHit,boardRadius,{}),rawHit,'Default correction is neutral');
});
test('Stian can correct upward-biased zoom without changing other users defaults',()=>{
  const calibration=fs.readFileSync(path.join(root,'autozoom','camera-calibration.js'),'utf8');
  const core=fs.readFileSync(path.join(root,'autozoom','zoom-cam.js'),'utf8');
  assert.match(calibration,/id="camHitOffsetX"/);
  assert.match(calibration,/id="camHitOffsetY"/);
  assert.match(calibration,/Bruk dette bare hvis Zoom-cam peker feil/);
  assert.match(core,/target=offsetHit\(rawHit,board\.radius,config\)/);
  assert.match(core,/onStableHit\(\{x:rawHit\.x,y:rawHit\.y/);
});

test('Cam-test sliders keep the running Zoom-cam preview mounted',()=>{
  const ui=fs.readFileSync(path.join(root,'autozoom','camera-calibration.js'),'utf8');
  const hitFn=ui.match(/function saveHitOffset\(\)\{([\s\S]*?)\n\}/)?.[1];
  const framingFn=ui.match(/function framingChanged\(\)\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(hitFn,'Hit correction handler exists');
  assert.ok(framingFn,'Framing handler exists');
  assert.doesNotMatch(hitFn,/stopPreview\(/);
  assert.doesNotMatch(framingFn,/stopPreview\(/);
  assert.match(hitFn,/zoomSession\?\.setHitOffset\?\./);
  assert.match(framingFn,/zoomSession\?\.setFraming\?\./);
});
test('live slider corrections move the latest hit without stopping video or offsetting T20 reset',()=>{
  const source={kind:'video',readyState:'live',getSettings:()=>({deviceId:'webcam-1',width:1280,height:720})};
  const out={kind:'video',readyState:'live',stop(){this.readyState='ended'}};
  class Stream {
    constructor(tracks){this.tracks=tracks}
    getVideoTracks(){return this.tracks.filter(t=>t.kind==='video')}
    getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio')}
  }
  const ctx=()=>({fillRect(){},drawImage(){},strokeRect(){},getImageData(){
    return {data:new Uint8ClampedArray(480*270*4)};
  }});
  const canvas={width:0,height:0,getContext:ctx,captureStream:()=>new Stream([out])};
  const video={videoWidth:1280,videoHeight:720,readyState:2,play:async()=>{},pause(){},srcObject:null};
  const crops=[],frames=[];
  const tracker={
    ...T,
    speedPreset:()=>({...T.speedPreset('fast'),intervalMs:1,quietFrames:0,ease:1}),
    findChange:()=>({x:390,y:100}),
    motionRatio:()=>0,
    createChangeGate:()=>({observe:hit=>hit,reset(){}}),
    zoomCrop:(w,h,x,y)=>{
      crops.push({x,y});
      return{x:100,y:50,width:60,height:45};
    }
  };
  const old={media:global.MediaStream,raf:global.requestAnimationFrame,
    cancel:global.cancelAnimationFrame,doc:global.document};
  try{
    global.MediaStream=Stream;
    global.requestAnimationFrame=fn=>{frames.push(fn);return frames.length};
    global.cancelAnimationFrame=()=>{};
    global.document={createElement:()=>({width:0,height:0,getContext:ctx})};
    const session=Z.create(new Stream([source]),{...sample},
      {video,canvas,tracker});
    frames.shift()(4000);
    const before=crops.at(-1);
    assert.ok(before);
    const liveTrack=session.track;
    assert.equal(session.setHitOffset({hitOffsetY:.4,hitOffsetX:.1}),true);
    frames.shift()(4010);
    const shifted=crops.at(-1);
    assert.ok(Math.abs((shifted.y-before.y)-1280*sample.radius*.4)<.001);
    assert.ok(Math.abs((shifted.x-before.x)-1280*sample.radius*.1)<.001);
    assert.equal(session.track,liveTrack,'The same video track remains live');
    assert.equal(out.readyState,'live');
    assert.equal(session.setFraming({zoom:2,panX:.3,panY:-.2}),true);
    frames.shift()(4020);
    assert.equal(session.track,liveTrack,'Framing does not replace the camera track');
    assert.equal(session.resetToT20(),true);
    frames.shift()(performance.now()+20);
    const resetPoint=crops.at(-1);
    assert.ok(resetPoint.y<360,'T20 remains above bull');
    assert.ok(Math.abs(resetPoint.x-640)<.001,'T20 reset has no arbitrary sideways offset');
    assert.equal(session.setHitOffset({hitOffsetY:.9}),true);
    const resetTargetBefore=crops.at(-1);
    frames.shift()(performance.now()+40);
    const resetTargetAfter=crops.at(-1);
    assert.deepEqual(resetTargetAfter,resetTargetBefore,'Offset slider does not corrupt T20 reset');
    session.stop();
    assert.equal(session.setHitOffset({hitOffsetY:.1}),false);
    assert.equal(session.setFraming({zoom:1}),false);
  }finally{
    global.MediaStream=old.media;global.requestAnimationFrame=old.raf;
    global.cancelAnimationFrame=old.cancel;global.document=old.doc;
  }
});
