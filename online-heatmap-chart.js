/* Result-only dartboard heatmap renderer for online X01. No data collection. */
(function(root){
'use strict';
const ORDER=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
function draw(canvas,rows=[]){
 if(!canvas||!canvas.getContext)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const W=canvas.width||340,H=canvas.height||W;
 const x0=W/2,y0=H/2,R=Math.min(W,H)*.395,pi=Math.PI;
 ctx.clearRect(0,0,W,H);
 ctx.fillStyle='#f2f3ed';ctx.fillRect(0,0,W,H);
 for(let i=0;i<20;i++){
   const a=(i-.5)*pi/10-pi/2,b=(i+.5)*pi/10-pi/2;
   ctx.beginPath();ctx.moveTo(x0,y0);ctx.arc(x0,y0,R,a,b);ctx.closePath();
   ctx.fillStyle=i%2?'#eee9df':'#545c5b';ctx.fill();
   for(const [outer,inner] of [[1,.953],[.63,.583]]){
     ctx.beginPath();ctx.arc(x0,y0,R*outer,a,b);ctx.arc(x0,y0,R*inner,b,a,true);ctx.closePath();
     ctx.fillStyle=i%2?'#b45b66':'#3d9879';ctx.fill();
   }
   ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x0+R*Math.cos(a),y0+R*Math.sin(a));
   ctx.strokeStyle='rgba(240,246,242,.83)';ctx.lineWidth=.75;ctx.stroke();
   const mid=i*pi/10-pi/2;
   ctx.fillStyle='#42494b';ctx.font='bold '+Math.round(W*.042)+'px system-ui,sans-serif';
   ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(String(ORDER[i]),x0+(R+17)*Math.cos(mid),y0+(R+17)*Math.sin(mid));
 }
 ctx.beginPath();ctx.arc(x0,y0,R*.093,0,2*pi);ctx.fillStyle='#3b967b';ctx.fill();
 ctx.beginPath();ctx.arc(x0,y0,R*.037,0,2*pi);ctx.fillStyle='#ba4b59';ctx.fill();
 const points=(Array.isArray(rows)?rows:[]).filter(p=>Number.isFinite(p?.u)&&Number.isFinite(p?.v)&&Math.hypot(p.u,p.v)<=1.50).slice(-600);
 if(!points.length)return;
 // Accumulate Gaussian density at visible pixels; concentrated hits turn red,
 // gradually fading through yellow and green like the supplied reference.
 const size=W*H,field=new Float32Array(size),radius=Math.max(16,Math.round(R*.185));
 const spread=Math.pow(radius*.42,2)*2,reach=radius;
 for(const p of points){
   const cx=x0+p.u*R,cy=y0+p.v*R;
   const minx=Math.max(0,Math.floor(cx-reach)),maxx=Math.min(W-1,Math.ceil(cx+reach));
   const miny=Math.max(0,Math.floor(cy-reach)),maxy=Math.min(H-1,Math.ceil(cy+reach));
   for(let y=miny;y<=maxy;y++){
     const dy2=(y-cy)*(y-cy),offset=y*W;
     for(let x=minx;x<=maxx;x++){
       const d2=(x-cx)*(x-cx)+dy2;if(d2>reach*reach)continue;
       field[offset+x]+=Math.exp(-d2/spread);
     }
   }
 }
 let peak=0;for(let i=0;i<field.length;i++)if(field[i]>peak)peak=field[i];
 if(peak<=0)return;
 const pixels=ctx.createImageData(W,H),rgba=pixels.data;
 for(let i=0;i<size;i++){
   const d=field[i]/peak;if(d<.055)continue;
   let r,g,b;
   if(d<.25){const t=(d-.055)/.195;r=Math.round(38+48*t);g=Math.round(152+68*t);b=Math.round(75-40*t)}
   else if(d<.50){const t=(d-.25)/.25;r=Math.round(86+160*t);g=Math.round(220+12*t);b=Math.round(35-30*t)}
   else if(d<.75){const t=(d-.50)/.25;r=246;g=Math.round(232-118*t);b=5}
   else{const t=(d-.75)/.25;r=Math.round(246-29*t);g=Math.round(114-101*t);b=Math.round(5+10*t)}
   const n=i*4;rgba[n]=r;rgba[n+1]=g;rgba[n+2]=b;
   rgba[n+3]=Math.round(Math.min(.96,.25+d*.76)*255);
 }
 ctx.putImageData(pixels,0,0);
}
root.DartArenaHeatmapChart={draw};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaHeatmapChart;
})(typeof window!=='undefined'?window:globalThis);
