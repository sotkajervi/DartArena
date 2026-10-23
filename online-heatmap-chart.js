/* Original photographed board with camera-derived heatmap only in results. */
(function(root){
'use strict';
const board=new Image();
let ready=false;
board.onload=()=>{
 ready=true;
 document.querySelectorAll('.da-result-hm-player canvas').forEach(canvas=>draw(canvas,canvas.__heatmapPoints||[]));
};
board.onerror=()=>console.warn('DartArena: original heatmap image did not load');
board.src='./assets/dartarena-heatmap-board.png?v=20261023-heatmap3';
function draw(canvas,rows=[]){
 if(!canvas?.getContext)return;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return;
 const W=canvas.width||340,H=canvas.height||W;
 canvas.__heatmapPoints=rows;
 ctx.clearRect(0,0,W,H);
 if(!ready){ctx.fillStyle='#071012';ctx.fillRect(0,0,W,H);return}
 // Full supplied photo, with identical geometry and no cropping, redraw, or logos.
 ctx.drawImage(board,0,0,W,H);
 // The calibrated camera radius maps to the outer double ring on this image.
 const x0=W*.496,y0=H*.493,R=Math.min(W,H)*.362;
 const points=(Array.isArray(rows)?rows:[]).filter(p=>Number.isFinite(p?.u)&&Number.isFinite(p?.v)&&Math.hypot(p.u,p.v)<=1.55).slice(-600);
 if(!points.length)return;
 const field=new Float32Array(W*H),radius=Math.max(14,Math.round(R*.205));
 const spread=Math.pow(radius*.45,2)*2;
 for(const p of points){
  const cx=x0+p.u*R,cy=y0+p.v*R;
  for(let y=Math.max(0,Math.floor(cy-radius));y<=Math.min(H-1,Math.ceil(cy+radius));y++){
   const y2=(y-cy)*(y-cy);
   for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(W-1,Math.ceil(cx+radius));x++){
    const d2=(x-cx)*(x-cx)+y2;if(d2>radius*radius)continue;
    field[y*W+x]+=Math.exp(-d2/spread);
   }
  }
 }
 let peak=0;for(const v of field)if(v>peak)peak=v;
 if(peak<=0)return;
 const pixels=ctx.getImageData(0,0,W,H),rgba=pixels.data;
 for(let i=0;i<field.length;i++){
  const d=field[i]/peak;if(d<.055)continue;
  let r,g,b;
  if(d<.25){const t=(d-.055)/.195;r=Math.round(38+48*t);g=Math.round(152+68*t);b=Math.round(75-40*t)}
  else if(d<.50){const t=(d-.25)/.25;r=Math.round(86+160*t);g=Math.round(220+12*t);b=Math.round(35-30*t)}
  else if(d<.75){const t=(d-.50)/.25;r=246;g=Math.round(232-118*t);b=5}
  else{const t=(d-.75)/.25;r=Math.round(246-29*t);g=Math.round(114-101*t);b=Math.round(5+10*t)}
  const n=i*4,alpha=Math.min(.94,.22+d*.70);
  rgba[n]=Math.round(rgba[n]*(1-alpha)+r*alpha);
  rgba[n+1]=Math.round(rgba[n+1]*(1-alpha)+g*alpha);
  rgba[n+2]=Math.round(rgba[n+2]*(1-alpha)+b*alpha);
  rgba[n+3]=255;
 }
 ctx.putImageData(pixels,0,0);
}
root.DartArenaHeatmapChart={draw};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaHeatmapChart;
})(typeof window!=='undefined'?window:globalThis);
