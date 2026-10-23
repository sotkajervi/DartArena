/* Exact image coordinates for a point clicked in the cropped AutoZoom canvas.
   No score updates: the caller decides whether to confirm a heatmap marker. */
(function(root){
  'use strict';
  function pointFromZoom(event,rect,crop,canvasWidth,canvasHeight){
    if(!rect||!crop||![rect.left,rect.top,rect.width,rect.height,crop.x,crop.y,crop.width,crop.height,canvasWidth,canvasHeight]
      .every(Number.isFinite)||rect.width<=0||rect.height<=0||crop.width<=0||crop.height<=0||
      canvasWidth<=0||canvasHeight<=0)return null;
    const px=event?.clientX,py=event?.clientY;
    if(!Number.isFinite(px)||!Number.isFinite(py))return null;
    const u=(px-rect.left)/rect.width,v=(py-rect.top)/rect.height;
    if(u<0||u>1||v<0||v>1)return null;
    return {x:crop.x+u*crop.width,y:crop.y+v*crop.height};
  }
  function pointOnZoom(point,crop,width,height){
    if(!point||!crop||![point.x,point.y,crop.x,crop.y,crop.width,crop.height,width,height]
      .every(Number.isFinite)||crop.width<=0||crop.height<=0||width<=0||height<=0)return null;
    const x=(point.x-crop.x)/crop.width*width,y=(point.y-crop.y)/crop.height*height;
    if(x<0||x>width||y<0||y>height)return null;
    return{x,y};
  }
  root.DartArenaAutoZoomTipMap={pointFromZoom,pointOnZoom};
  if(typeof module==='object'&&module.exports)module.exports=root.DartArenaAutoZoomTipMap;
})(typeof window!=='undefined'?window:globalThis);
