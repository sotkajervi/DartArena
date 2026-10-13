/* Experimental single-camera autozoom tracking. No scoring, uploads or AI claims. */
(function(root){
'use strict';
const ORDER=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function targetPoint(cx,cy,radius,label){
  if(label==='BULL')return{x:cx,y:cy};
  const m=/^([TDS])(\d{1,2})$/.exec(String(label));
  if(!m)return null;
  const index=ORDER.indexOf(Number(m[2]));if(index<0)return null;
  const r=m[1]==='D'?.976:m[1]==='T'?.606:.42;
  const angle=index*Math.PI/10;
  return{x:cx+Math.sin(angle)*radius*r,y:cy-Math.cos(angle)*radius*r};
}
function motionRatio(first,last,width,height,board,options={}){
  if(!first||!last||first.length!==last.length||!board)return 0;
  const stride=options.stride||3,threshold=options.threshold||88;
  const r2=board.radius*board.radius;
  let changed=0,total=0;
  for(let y=Math.max(0,Math.floor(board.y-board.radius));y<Math.min(height,Math.ceil(board.y+board.radius));y+=stride){
    for(let x=Math.max(0,Math.floor(board.x-board.radius));x<Math.min(width,Math.ceil(board.x+board.radius));x+=stride){
      if((x-board.x)**2+(y-board.y)**2>r2)continue;
      const i=(y*width+x)*4;
      if(Math.abs(first[i]-last[i])+Math.abs(first[i+1]-last[i+1])+Math.abs(first[i+2]-last[i+2])>threshold)changed++;
      total++;
    }
  }
  return total?changed/total:0;
}
function findChange(base,frame,width,height,board,options={}){
  if(!base||!frame||base.length!==frame.length||!board?.radius)return null;
  const stride=options.stride||2,threshold=options.threshold||85;
  const radius=board.radius*1.025,r2=radius*radius;
  const cell=options.cell||18;
  const points=[],bins=new Map();
  let total=0;
  for(let y=Math.max(0,Math.floor(board.y-radius));y<Math.min(height,Math.ceil(board.y+radius));y+=stride){
    for(let x=Math.max(0,Math.floor(board.x-radius));x<Math.min(width,Math.ceil(board.x+radius));x+=stride){
      if((x-board.x)**2+(y-board.y)**2>r2)continue;
      total++;
      const i=(y*width+x)*4;
      const delta=Math.abs(base[i]-frame[i])+Math.abs(base[i+1]-frame[i+1])+Math.abs(base[i+2]-frame[i+2]);
      if(delta<=threshold)continue;
      points.push({x,y});
      const gx=Math.floor(x/cell),gy=Math.floor(y/cell),key=gx+','+gy;
      bins.set(key,(bins.get(key)||0)+1);
    }
  }
  if(!total)return null;
  const ratio=points.length/total;
  if(points.length<(options.minSamples||10)||ratio>(options.maxRatio||.12))return null;
  let best=null,maxCount=0;
  for(const key of bins.keys()){
    const [gx,gy]=key.split(',').map(Number);
    let score=0;
    for(let yy=gy-1;yy<=gy+1;yy++)for(let xx=gx-1;xx<=gx+1;xx++)score+=bins.get(xx+','+yy)||0;
    if(score>maxCount){maxCount=score;best={gx,gy}}
  }
  if(!best)return null;
  const midX=(best.gx+.5)*cell,midY=(best.gy+.5)*cell;
  const bound=cell*1.6;
  let sx=0,sy=0,local=0;
  for(const p of points){
    if(Math.abs(p.x-midX)>bound||Math.abs(p.y-midY)>bound)continue;
    sx+=p.x;sy+=p.y;local++;
  }
  if(local<Math.max(7,points.length*.08))return null;
  return{x:sx/local,y:sy/local,changedSamples:points.length,localSamples:local,ratio};
}
function zoomCrop(videoWidth,videoHeight,x,y,boardRadius,aspect=4/3){
  const width=Math.max(40,Math.min(videoWidth,boardRadius*.9));
  const height=width/aspect;
  const boundedWidth=Math.min(videoWidth,width,videoHeight*aspect);
  const boundedHeight=boundedWidth/aspect;
  return{x:clamp(x-boundedWidth/2,0,videoWidth-boundedWidth),
    y:clamp(y-boundedHeight/2,0,videoHeight-boundedHeight),
    width:boundedWidth,height:boundedHeight};
}
const api={ORDER,targetPoint,motionRatio,findChange,zoomCrop};
if(typeof module==='object'&&module.exports)module.exports=api;
root.DartArenaAutoZoom=api;
})(typeof window!=='undefined'?window:globalThis);
