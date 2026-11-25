/* Isolated camera estimates. No video, images, scores or opponent writes. */
(function(root){
'use strict';
const MAX=600;
function clean(rows){
 return (Array.isArray(rows)?rows:[]).filter(p=>Number.isFinite(p?.u)&&Number.isFinite(p?.v)&&Math.hypot(p.u,p.v)<=1.55&&typeof p.time==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(p.time)).map(p=>({u:p.u,v:p.v,time:p.time,tipDetected:p.tipDetected===true})).slice(-MAX);
}
function merge(...lists){
 const map=new Map();
 for(const list of lists)for(const p of clean(list))map.set(JSON.stringify(p),p);
 return [...map.values()].sort((a,b)=>a.time.localeCompare(b.time)).slice(-MAX);
}
async function read(db,id){
 const {data,error}=await db.from('match_heatmaps').select('player_id,points').eq('match_id',id);
 if(error)throw error;
 return Object.fromEntries((data||[]).map(r=>[r.player_id,clean(r.points)]));
}
function writer(db,id,readOwn){
 let saved='',busy=null;
 return async function flush(){
  if(busy){await busy;return flush()}
  const points=clean(readOwn()),sig=JSON.stringify(points);
  if(!points.length||sig===saved)return;
  busy=(async()=>{const {error}=await db.rpc('save_match_heatmap',{p_match_id:id,p_points:points});if(error)throw error;saved=sig})();
  try{await busy}finally{busy=null}
 };
}
// Aggregate into small weighted spatial bins; each accepted point counts,
// not just the latest 600. Limit work to a bounded 64x64 grid.
function aggregate(rows){
 const bins=new Map();let count=0;
 for(const r of rows||[])for(const p of clean(r.points)){
  const x=Math.round(p.u*20),y=Math.round(p.v*20),key=x+':'+y;
  const bin=bins.get(key)||{u:0,v:0,weight:0};bin.u+=p.u;bin.v+=p.v;bin.weight++;bins.set(key,bin);count++;
 }
 return {count,points:[...bins.values()].map(b=>({u:b.u/b.weight,v:b.v/b.weight,weight:b.weight}))};
}
root.DartArenaHeatmapStorage={clean,merge,read,writer,aggregate};
if(typeof module==='object'&&module.exports)module.exports=root.DartArenaHeatmapStorage;
})(typeof window!=='undefined'?window:globalThis);
