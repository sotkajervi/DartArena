/* Zoom-cam: an actual composed MediaStreamTrack for normal DartArena WebRTC.
   Calibration survives page navigation; a live video track never does. */
(function(root){
'use strict';
const CONFIG_KEY='dartarena-zoomcam-calibration-v1';
const MODE_KEY='dartarena-zoomcam-mode';
const ZOOM_VALUE='__dartarena_zoomcam__';
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
function framingOf(data={}){
  data=data||{};
  const zoom=Number(data.zoom),panX=Number(data.panX),panY=Number(data.panY);
  return{
    zoom:Number.isFinite(zoom)?clamp(zoom,1,3):1,
    panX:Number.isFinite(panX)?clamp(panX,-1,1):0,
    panY:Number.isFinite(panY)?clamp(panY,-1,1):0
  };
}
// Framing is a crop of the physical image. Board calibration and hit detection
// continue using raw camera coordinates, so changing framing cannot alter scoring.
function framingCrop(width,height,settings={}){
  if(!(width>0&&height>0))return null;
  const {zoom,panX,panY}=framingOf(settings);
  const cropW=width/zoom,cropH=height/zoom;
  return{
    x:(width-cropW)*(panX+1)/2,y:(height-cropH)*(panY+1)/2,
    width:cropW,height:cropH
  };
}
// Exact mapping of clicks on the fitted/framed Cam-test canvas back to
// unmodified video coordinates (used for Bull / D20 calibration).
function framedPointer(video,preview,event,settings={}){
  const w=video?.videoWidth,h=video?.videoHeight;
  const box=preview?.getBoundingClientRect?.(),crop=framingCrop(w,h,settings);
  if(!box?.width||!box?.height||!crop)return null;
  const fit=Math.min(box.width/crop.width,box.height/crop.height);
  const dx=(box.width-crop.width*fit)/2,dy=(box.height-crop.height*fit)/2;
  const x=(event.clientX-box.left-dx)/fit,y=(event.clientY-box.top-dy)/fit;
  if(x<0||y<0||x>crop.width||y>crop.height)return null;
  return {x:crop.x+x,y:crop.y+y};
}
function hitOffsetOf(settings={}){
  return {
    hitOffsetX:clamp(Number(settings?.hitOffsetX)||0,-1,1),
    hitOffsetY:clamp(Number(settings?.hitOffsetY)||0,-1,1)
  };
}
function offsetHit(point,boardRadius,settings={}){
  if(!point)return null;
  const {hitOffsetX,hitOffsetY}=hitOffsetOf(settings);
  return {x:point.x+boardRadius*hitOffsetX,y:point.y+boardRadius*hitOffsetY};
}
function insetRect(width,height){
  const w=Math.round(width*.33),h=Math.round(w*3/4),pad=Math.round(width*.016);
  return {x:width-w-pad,y:pad,width:w,height:h};
}
function saveConfig(storage,data){
  if(!data||typeof data.deviceId!=='string'||!data.deviceId)return false;
  if(![data.cx,data.cy,data.radius,data.rotation,data.aspect].every(Number.isFinite))return false;
  if(data.cx<0||data.cx>1||data.cy<0||data.cy>1||data.radius<.03||data.radius>.65||data.aspect<.5||data.aspect>3)return false;
  storage.setItem(CONFIG_KEY,JSON.stringify({...data,...framingOf(data),...hitOffsetOf(data),
    speed:['fast','normal','smooth'].includes(data.speed)?data.speed:'normal',
    sensitivity:['low','normal','high'].includes(data.sensitivity)?data.sensitivity:'normal',
    version:1}));
  return true;
}
function loadConfig(storage){
  try{
    const data=JSON.parse(storage.getItem(CONFIG_KEY)||'null');
    if(!data||data.version!==1||typeof data.deviceId!=='string'||!data.deviceId)return null;
    if(![data.cx,data.cy,data.radius,data.rotation,data.aspect].every(Number.isFinite)
      ||data.cx<0||data.cx>1||data.cy<0||data.cy>1||data.radius<.03||data.radius>.65||data.aspect<.5||data.aspect>3)return null;
    return {...data,...framingOf(data),...hitOffsetOf(data)};
  }catch{return null}
}
function selected(storage){return storage.getItem(MODE_KEY)==='zoom'}
function setSelected(storage,on){if(on)storage.setItem(MODE_KEY,'zoom');else storage.removeItem(MODE_KEY)}
function compatible(data,track,width,height){
  if(!data||!track)return false;
  const id=track.getSettings?.()?.deviceId||'';
  const aspect=width/height;
  return !!id&&id===data.deviceId&&Math.abs(aspect-data.aspect)/data.aspect<.085;
}
function pointer(video,event){
  const rect=video.getBoundingClientRect(),w=video.videoWidth,h=video.videoHeight;
  if(!w||!h||!rect.width||!rect.height)return null;
  const fit=typeof getComputedStyle==='function'?getComputedStyle(video).objectFit:'contain';
  const scale=fit==='cover'?Math.max(rect.width/w,rect.height/h):Math.min(rect.width/w,rect.height/h);
  const left=(rect.width-w*scale)/2,top=(rect.height-h*scale)/2;
  const x=(event.clientX-rect.left-left)/scale,y=(event.clientY-rect.top-top)/scale;
  return x>=0&&x<=w&&y>=0&&y<=h?{x,y}:null;
}
function calibration(video,bull,d20,deviceId){
  const w=video.videoWidth,h=video.videoHeight;
  if(!w||!h||!bull||!d20||!deviceId)return null;
  const dist=Math.hypot(d20.x-bull.x,d20.y-bull.y);
  if(dist<Math.min(w,h)*.075)return null;
  return {deviceId,cx:bull.x/w,cy:bull.y/h,radius:dist/(.976*w),
    rotation:Math.atan2(d20.x-bull.x,bull.y-d20.y),aspect:w/h};
}
function create(raw,config,{fps=25,video=null,
  canvas=null,tracker=root.DartArenaAutoZoom,picture=null,onStableHit=null}={}){
  const sourceTrack=raw?.getVideoTracks?.()[0];
  if(!sourceTrack||sourceTrack.readyState!=='live'||!tracker)throw Error('Zoom-cam krever et aktivt kamera.');
  if(!canvas&&typeof document!=='undefined')canvas=document.createElement('canvas');
  if(!canvas?.captureStream)throw Error('Zoom-cam krever canvas captureStream.');
  if(!video&&typeof document!=='undefined')video=document.createElement('video');
  if(!video)throw Error('Zoom-cam mangler videospiller.');
  const dims=sourceTrack.getSettings?.()||{};
  if(dims.width&&dims.height&&!compatible(config,sourceTrack,dims.width,dims.height))throw Error('Kalibreringen passer ikke dette kameraet eller videoformatet.');
  video.autoplay=true;video.muted=true;video.playsInline=true;video.srcObject=new MediaStream([sourceTrack]);
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Kan ikke tegne Zoom-cam.');
  // Presentation filter only. Change detection always reads the untouched source video.
  const P=root.DartArenaCameraPicture;
  const deviceId=sourceTrack.getSettings?.()?.deviceId||config?.deviceId||'';
  const visualFilter=picture!==false&&P?P.cssFilter(picture||P.load(root.localStorage,deviceId)):'none';
  const setDrawFilter=value=>{if('filter' in ctx)ctx.filter=value};
  let out=null,loop=0,clock=0,stopped=false,prev=null,ref=null,still=0,target=null,current=null;
  const speed=tracker.speedPreset(config.speed);
  const gate=tracker.createChangeGate({stableFrames:speed.stableFrames,motionWindowMs:4000,cooldownMs:speed.cooldownMs});
  const sampled=document.createElement('canvas'),sampleCtx=sampled.getContext('2d',{willReadFrequently:true});
  let lastAnalysis=0,resetResumeAt=0,lastRenderErrorAt=-Infinity;
  function resetToT20(){
    if(stopped)return false;
    // Go straight back to the 20-bed after a recorded visit. Do not treat
    // dart removal as a new hit while the player clears the board.
    const sw=video.videoWidth||dims.width||1280;
    const sh=video.videoHeight||dims.height||720;
    const p=tracker.targetPoint(config.cx*sw,config.cy*sh,config.radius*sw,'T20',config.rotation);
    if(!p)return false;
    target={...p};current={...p};
    prev=null;ref=null;still=0;gate.reset();
    resetResumeAt=(typeof performance!=='undefined'?performance.now():0)+1800;
    return true;
  }
  function tick(now){
    if(stopped)return;
    try{
    // Some browsers report dimensions before the first drawable video frame.
    // A transient drawImage/getImageData failure must never kill the live track.
    if(video.videoWidth&&video.videoHeight&&(typeof video.readyState!=='number'||video.readyState>=2)){
      const w=canvas.width||1280,h=canvas.height||720;
      const sw=video.videoWidth,sh=video.videoHeight;
      const framed=framingCrop(sw,sh,config);
      ctx.fillStyle='#030708';ctx.fillRect(0,0,w,h);
      setDrawFilter(visualFilter);
      // User-framed main image. The overlay and hit tracking still use raw pixels.
      const fit=Math.min(w/framed.width,h/framed.height);
      const dx=(w-framed.width*fit)/2,dy=(h-framed.height*fit)/2;
      ctx.drawImage(video,framed.x,framed.y,framed.width,framed.height,
        dx,dy,framed.width*fit,framed.height*fit);
      setDrawFilter('none');
      const board={x:config.cx*sw,y:config.cy*sh,radius:config.radius*sw};
      if(!target){const p=tracker.targetPoint(board.x,board.y,board.radius,'T20',config.rotation);target=p;current={...p}}
      if(now-lastAnalysis>=speed.intervalMs){
        lastAnalysis=now;
        sampled.width=480;sampled.height=Math.max(1,Math.round(480*sh/sw));
        sampleCtx.drawImage(video,0,0,sampled.width,sampled.height);
        const frame=new Uint8ClampedArray(sampleCtx.getImageData(0,0,sampled.width,sampled.height).data);
        const small={x:config.cx*sampled.width,y:config.cy*sampled.height,radius:config.radius*sampled.width};
        const opts={...tracker.sensitivityPreset(config.sensitivity),searchRadius:1.65};
        const motion=prev?tracker.motionRatio(prev,frame,sampled.width,sampled.height,small,{searchRadius:1.65}):0;
        const moved=prev&&motion<=.008?tracker.findChange(prev,frame,sampled.width,sampled.height,small,{...opts,maxRatio:.045}):null;
        prev=frame;
        if(now<resetResumeAt){
          // Refresh the baseline as darts are collected; no zoom jumps.
          ref=new Uint8ClampedArray(frame);still=0;gate.reset();
        }else{
          if(motion>.008)still=0;else still++;
          if(!ref)ref=new Uint8ClampedArray(frame);
        }
        const hit=now<resetResumeAt?null:gate.observe(still>=speed.quietFrames?tracker.findChange(ref,frame,sampled.width,sampled.height,small,opts):null,
          {movement:motion>.008||!!moved,now,radius:small.radius});
        if(hit){
          // A camera-specific presentation correction compensates for shaft/flight
          // centroids landing above the actual tip. It never changes hit detection,
          // calibration, scoring or the raw coordinates provided to observers.
          const rawHit={x:hit.x*sw/sampled.width,y:hit.y*sh/sampled.height};
          target=offsetHit(rawHit,board.radius,config);
          ref=new Uint8ClampedArray(frame);still=0;
          // Optional observer for experimental capture; normal Zoom-cam is unchanged.
          if(typeof onStableHit==='function'){
            try{onStableHit({x:rawHit.x,y:rawHit.y,width:sw,height:sh},video)}
            catch(error){console.warn('Zoom-cam capture observer error',error)}
          }
        }
      }
      current.x+=(target.x-current.x)*speed.ease;current.y+=(target.y-current.y)*speed.ease;
      const inset=insetRect(w,h);
      const {x:ix,y:iy,width:insetW,height:insetH}=inset;
      const crop=tracker.zoomCrop(sw,sh,current.x,current.y,board.radius,4/3);
      ctx.fillStyle='#071b20';ctx.fillRect(ix-3,iy-3,insetW+6,insetH+6);
      setDrawFilter(visualFilter);
      ctx.drawImage(video,crop.x,crop.y,crop.width,crop.height,ix,iy,insetW,insetH);
      setDrawFilter('none');
      ctx.strokeStyle='#00eaf4';ctx.lineWidth=Math.max(2,w/450);ctx.strokeRect(ix-2,iy-2,insetW+4,insetH+4);
    }
    }catch(error){
      setDrawFilter('none');
      if(now-lastRenderErrorAt>5000){
        console.warn('Zoom-cam frame unavailable, retrying',error);
        lastRenderErrorAt=now;
      }
    }finally{
      if(!stopped)loop=requestAnimationFrame(tick);
    }
  }
  let capture;
  try{
    canvas.width=1280;canvas.height=720;
    capture=canvas.captureStream(fps);
    out=capture.getVideoTracks()[0];
    if(!out)throw Error('Ingen Zoom-cam videotrack');
    video.play().catch(()=>{});
    loop=requestAnimationFrame(tick);
  }catch(error){out?.stop();video.srcObject=null;throw error}
  return{
    track:out,sourceTrack,stream:new MediaStream([out,...raw.getAudioTracks()]),
    resetToT20,
    stop(){
      if(stopped)return;stopped=true;
      if(loop)cancelAnimationFrame(loop);
      out?.stop();
      video.pause();video.srcObject=null;
      // Caller owns raw source track and must stop it when no longer needed.
    }
  };
}
root.DartArenaZoomCam={CONFIG_KEY,MODE_KEY,ZOOM_VALUE,saveConfig,loadConfig,hitOffsetOf,offsetHit,
  selected,setSelected,compatible,pointer,framingOf,framingCrop,framedPointer,insetRect,calibration,create};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaZoomCam;
})(typeof window!=='undefined'?window:globalThis);
