/* Isolated heatmap experiment. No uploads, no gameplay changes. */
(()=>{
'use strict';
const canvas=document.getElementById('azHeatBoard'),summary=document.getElementById('azHeatSummary'),undo=document.getElementById('azHeatUndo'),clear=document.getElementById('azHeatClear');
if(!canvas||!summary)return;
const ctx=canvas.getContext('2d'),size=canvas.width,c=size/2,r=size*.43;
let marks=[],selected=-1;
const order=window.DartArenaAutoZoom?.ORDER||[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
function paint(){
 ctx.clearRect(0,0,size,size);ctx.fillStyle='#071012';ctx.fillRect(0,0,size,size);
 for(let ring=0;ring<20;ring++){
  const a=(ring-.5)*Math.PI/10-Math.PI/2,b=(ring+.5)*Math.PI/10-Math.PI/2;
  ctx.beginPath();ctx.moveTo(c,c);ctx.arc(c,c,r,a,b);ctx.closePath();ctx.fillStyle=ring%2?'#e8dccc':'#182329';ctx.fill();
 }
 for(const [rad,width,col] of [[.98,.075,'#c72e41'],[.61,.075,'#159b73']]){
  for(let sector=0;sector<20;sector++){
   const a=(sector-.5)*Math.PI/10-Math.PI/2,b=(sector+.5)*Math.PI/10-Math.PI/2;
   ctx.beginPath();ctx.arc(c,c,r*(rad+width/2),a,b);ctx.arc(c,c,r*(rad-width/2),b,a,true);ctx.closePath();ctx.fillStyle=sector%2?col:(rad>.8?'#168e65':'#be2539');ctx.fill();
  }
 }
 for(let ring=0;ring<20;ring++){
  const a=(ring-.5)*Math.PI/10-Math.PI/2;
  ctx.beginPath();ctx.moveTo(c,c);ctx.lineTo(c+r*Math.cos(a),c+r*Math.sin(a));ctx.strokeStyle='#b3ac9d';ctx.lineWidth=.8;ctx.stroke();
  const t=ring*Math.PI/10-Math.PI/2;ctx.fillStyle='#f4eeee';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 13px sans-serif';ctx.fillText(String(order[ring]),c+(r+16)*Math.cos(t),c+(r+16)*Math.sin(t));
 }
 for(const [rad,color] of [[.093,'#169b77'],[.037,'#c83244']]){ctx.beginPath();ctx.arc(c,c,r*rad,0,Math.PI*2);ctx.fillStyle=color;ctx.fill()}
 marks.forEach((m,i)=>{
  const x=c+m.u*r,y=c+m.v*r;
  ctx.beginPath();ctx.arc(x,y,i===selected?7:5,0,Math.PI*2);ctx.fillStyle=m.corrected?'#fff':'#24d6d0';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#071012';ctx.stroke();
 });
 summary.textContent=marks.length?'Forslag: '+marks.length+' · Siste treff: '+(marks.at(-1).corrected?'manuelt korrigert':'estimert fra bildeendring'):'Ingen treff ennå. Kast en pil etter at referanse er tatt.';
 undo.disabled=marks.length===0;clear.disabled=marks.length===0;
}
function infer(base,frame,w,h,hit,board){
 // Locate changed pixels near the AutoZoom cluster; principal axis is a
 // tentative dart body direction. Neither endpoint is a confirmed tip.
 const samples=[],rad=Math.max(10,Math.min(45,board.radius*.55)),threshold=85;
 for(let y=Math.max(0,Math.floor(hit.y-rad));y<Math.min(h,Math.ceil(hit.y+rad));y+=1)
  for(let x=Math.max(0,Math.floor(hit.x-rad));x<Math.min(w,Math.ceil(hit.x+rad));x+=1){
   const dx=x-hit.x,dy=y-hit.y;if(dx*dx+dy*dy>rad*rad)continue;
   const p=(y*w+x)*4,d=Math.abs(frame[p]-base[p])+Math.abs(frame[p+1]-base[p+1])+Math.abs(frame[p+2]-base[p+2]);
   if(d>threshold)samples.push({x,y});
  }
 if(samples.length<8)return{x:hit.x,y:hit.y,quality:'svakt signal'};
 const mx=samples.reduce((a,p)=>a+p.x,0)/samples.length,my=samples.reduce((a,p)=>a+p.y,0)/samples.length;
 let xx=0,yy=0,xy=0;for(const p of samples){xx+=(p.x-mx)**2;yy+=(p.y-my)**2;xy+=(p.x-mx)*(p.y-my)}
 const angle=.5*Math.atan2(2*xy,xx-yy),ax=Math.cos(angle),ay=Math.sin(angle);
 // Robust end-of-axis estimate: pixels at a single extreme can be camera
 // noise, reflections or a flight. Use the first/last 12% of projections
 // and prefer the cluster closer to the bull (the likely embedded tip).
 const projected=samples.map(p=>({p,t:(p.x-mx)*ax+(p.y-my)*ay})).sort((a,b)=>a.t-b.t);
 const span=projected.at(-1).t-projected[0].t;
 if(span<6)return{x:mx,y:my,quality:'lite avlang endring'};
 const count=Math.max(4,Math.ceil(projected.length*.12));
 const centroid=part=>({x:part.reduce((sum,v)=>sum+v.p.x,0)/part.length,
                          y:part.reduce((sum,v)=>sum+v.p.y,0)/part.length});
 const lo=centroid(projected.slice(0,count)),hi=centroid(projected.slice(-count));
 const distance=p=>(p.x-board.x)**2+(p.y-board.y)**2;
 const end=distance(lo)<distance(hi)?lo:hi;
 // Keep this conservative: avoid large jumps from a diffuse change cluster.
 const correction=Math.min(5,span*.08);
 const direction=end===lo?-1:1;
 const x=end.x+direction*ax*correction,y=end.y+direction*ay*correction;
 return{x,y,quality:'robust akse-estimat (test)'};
}
window.addEventListener('dartarena:autozoom-test-hit',e=>{
 const {base,frame,width,height,hit,board}=e.detail;
 const tip=infer(base,frame,width,height,hit,board);
 const u=(tip.x-board.x)/board.radius,v=(tip.y-board.y)/board.radius;
 marks.push({u,v,corrected:false,quality:tip.quality});selected=marks.length-1;paint();
 summary.textContent+=' · '+tip.quality+' (ikke bekreftet pilspiss)';
});
canvas.addEventListener('click',e=>{
 if(!marks.length)return;
 const box=canvas.getBoundingClientRect(),x=(e.clientX-box.left)*size/box.width,y=(e.clientY-box.top)*size/box.height;
 const u=(x-c)/r,v=(y-c)/r;if(Math.hypot(u,v)>1.15)return;
 const index=selected>=0?selected:marks.length-1;marks[index]={...marks[index],u,v,corrected:true};paint();
});
undo.onclick=()=>{marks.pop();selected=marks.length-1;paint()};
clear.onclick=()=>{marks=[];selected=-1;paint()};
window.addEventListener('dartarena:autozoom-test-reset',()=>{marks=[];selected=-1;paint()});
paint();
})();