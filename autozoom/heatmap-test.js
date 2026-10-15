/* Isolated heatmap experiment. No uploads, no gameplay changes. */
(()=>{
'use strict';
const canvas=document.getElementById('azHeatBoard'),summary=document.getElementById('azHeatSummary'),undo=document.getElementById('azHeatUndo'),clear=document.getElementById('azHeatClear');
if(!canvas||!summary)return;
const ctx=canvas.getContext('2d'),size=canvas.width,c=size/2,r=size*.43;
let marks=[],selected=-1;
const exportBtn=document.getElementById('azHeatExport');
const fmt=n=>Math.round(n*10000)/10000;
function exportTest(){
 const rows=marks.map((m,i)=>({number:i+1,timestamp:m.timestamp,quality:m.quality,
   estimate:{u:fmt(m.estimatedU),v:fmt(m.estimatedV)},
   corrected:m.corrected?{u:fmt(m.u),v:fmt(m.v)}:null,
   errorPercentOfBoardRadius:m.corrected?fmt(Math.hypot(m.u-m.estimatedU,m.v-m.estimatedV)*100):null}));
 const data={schema:'dartarena-autozoom-corrections-v1',createdAt:new Date().toISOString(),coordinateSystem:'normalized board radius from bull; u right, v down',rows};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='autozoom-korrigeringer-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
exportBtn?.addEventListener('click',exportTest);
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
 undo.disabled=marks.length===0;clear.disabled=marks.length===0;if(exportBtn)exportBtn.disabled=marks.length===0;
}
function infer(base,frame,w,h,hit,board){
 // Experimental tip candidate: changed pixels form a broad flight and a
 // narrower shaft. Estimate the narrow end rather than the change centroid.
 const samples=[],rad=Math.max(14,Math.min(65,board.radius*.90)),threshold=85;
 for(let y=Math.max(0,Math.floor(hit.y-rad));y<Math.min(h,Math.ceil(hit.y+rad));y++)
  for(let x=Math.max(0,Math.floor(hit.x-rad));x<Math.min(w,Math.ceil(hit.x+rad));x++){
   const dx=x-hit.x,dy=y-hit.y;if(dx*dx+dy*dy>rad*rad)continue;
   const p=(y*w+x)*4,d=Math.abs(frame[p]-base[p])+Math.abs(frame[p+1]-base[p+1])+Math.abs(frame[p+2]-base[p+2]);
   if(d>threshold)samples.push({x,y});
  }
 if(samples.length<24)return{x:hit.x,y:hit.y,quality:'usikkert – få endrede piksler',tipDetected:false};
 const mx=samples.reduce((a,p)=>a+p.x,0)/samples.length,my=samples.reduce((a,p)=>a+p.y,0)/samples.length;
 let xx=0,yy=0,xy=0;
 for(const p of samples){xx+=(p.x-mx)**2;yy+=(p.y-my)**2;xy+=(p.x-mx)*(p.y-my)}
 const angle=.5*Math.atan2(2*xy,xx-yy),ax=Math.cos(angle),ay=Math.sin(angle);
 const values=samples.map(p=>({x:p.x,y:p.y,t:(p.x-mx)*ax+(p.y-my)*ay,n:-(p.x-mx)*ay+(p.y-my)*ax})).sort((a,b)=>a.t-b.t);
 const low=values[Math.floor(values.length*.04)].t,high=values[Math.floor(values.length*.96)].t,span=high-low;
 if(span<Math.max(12,board.radius*.18))return{x:hit.x,y:hit.y,quality:'usikkert – for kort form',tipDetected:false};
 // Compare transverse widths at both ends, ignoring isolated changed pixels.
 const band=Math.max(5,span*.22);
 const ends=[values.filter(p=>p.t>=low&&p.t<=low+band),values.filter(p=>p.t<=high&&p.t>=high-band)];
 function width(a){
  if(a.length<8)return Infinity;
  const sorted=a.map(p=>p.n).sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length*.85)]-sorted[Math.floor(sorted.length*.15)];
 }
 const widths=ends.map(width);
 const narrow=widths[0]<widths[1]?0:1,wide=1-narrow;
 if(!Number.isFinite(widths[narrow])||!Number.isFinite(widths[wide])||
    widths[wide]<Math.max(3,widths[narrow]*1.45))
  return{x:hit.x,y:hit.y,quality:'usikkert – kan ikke skille flight fra spiss',tipDetected:false};
 // Use robust tail location (not the single outermost noise pixel).
 const tail=ends[narrow].sort((a,b)=>narrow===0?a.t-b.t:b.t-a.t);
 const point=tail[Math.min(tail.length-1,Math.max(0,Math.floor(tail.length*.15)))];
 const candidate={x:point.x,y:point.y};
 if(Math.hypot(candidate.x-hit.x,candidate.y-hit.y)>board.radius*.75)
  return{x:hit.x,y:hit.y,quality:'usikkert – avvikende spisskandidat',tipDetected:false};
 return{...candidate,quality:'smal ende av pilform (eksperiment)',tipDetected:true};
}
window.addEventListener('dartarena:autozoom-test-hit',e=>{
 const {base,frame,width,height,hit,board}=e.detail;
 const tip=infer(base,frame,width,height,hit,board);
 // Empirical calibration from nine manually corrected throws (board-radius units).
 // Isolated heatmap display only; does not move AutoZoom or alter hit detection.
 const CALIBRATION={u:-0.06,v:0.13};
 const u=(tip.x-board.x)/board.radius+(tip.tipDetected?0:CALIBRATION.u),v=(tip.y-board.y)/board.radius+(tip.tipDetected?0:CALIBRATION.v);
 marks.push({u,v,estimatedU:u,estimatedV:v,timestamp:new Date().toISOString(),corrected:false,quality:tip.quality});selected=marks.length-1;paint();
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