/* ONNX dart-tip inference, isolated from DartArena's match code.
   Requires a legitimately licensed dart-tip model, supplied locally by the tester.
   Supports single-class YOLOv8/YOLO11 ONNX detect and one-keypoint pose heads. */
(function(){
'use strict';
const CDN='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/';
let runtimePromise=null,session=null,metadata=null;
const working=document.createElement('canvas');
const context=working.getContext('2d',{willReadFrequently:true});
const opts={mode:'keypoint',keypointIndex:0,threshold:.35};
function positive(n,fallback){return Number.isFinite(+n)&&+n>0?+n:fallback}
function fetchRuntime(){
  if(window.ort)return Promise.resolve(window.ort);
  if(runtimePromise)return runtimePromise;
  runtimePromise=new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=CDN+'ort.min.js';s.async=true;
    const timeout=setTimeout(()=>{s.remove();reject(new Error('ONNX-biblioteket svarte ikke.'))},30000);
    s.onload=()=>{clearTimeout(timeout);if(!window.ort)reject(new Error('ONNX-biblioteket mangler.'));else resolve(window.ort)};
    s.onerror=()=>{clearTimeout(timeout);reject(new Error('Kunne ikke laste ONNX Runtime fra CDN.'))};
    document.head.appendChild(s);
  }).catch(error=>{runtimePromise=null;throw error});
  return runtimePromise;
}
function getInputShape(info){
  const dims=info?.shape||info?.dimensions||info?.dims;
  if(!Array.isArray(dims)||dims.length!==4)throw new Error('Modellen må ha én 4D float32 bildeinngang.');
  const nchw=dims[1]===3||dims[1]==='3';
  const nhwc=dims[3]===3||dims[3]==='3';
  if(!nchw&&!nhwc)throw new Error('Modellen må bruke RGB med tre kanaler.');
  const w=positive(Number(dims[nchw?3:2]),640);
  const h=positive(Number(dims[nchw?2:1]),640);
  if(w<64||h<64||w>1280||h>1280)throw new Error('Modellens bildestørrelse er utenfor støttet område (64–1280).');
  return {w,h,nchw};
}
async function load(file){
  if(!file||!file.name.toLowerCase().endsWith('.onnx'))throw new Error('Velg en ONNX-modell (.onnx).');
  if(file.size<1024||file.size>128*1024*1024)throw new Error('Modellen må være mellom 1 KB og 128 MB.');
  const ort=await fetchRuntime();
  ort.env.wasm.wasmPaths=CDN;
  ort.env.wasm.numThreads=1;
  const bytes=new Uint8Array(await file.arrayBuffer());
  // Replace model atomically. No model bytes are uploaded, cached or persisted.
  let next;
  try{next=await ort.InferenceSession.create(bytes,{executionProviders:['wasm'],graphOptimizationLevel:'all'});}catch(e){throw new Error('Kunne ikke åpne ONNX-modellen: '+(e?.message||e))}
  if(next.inputNames.length!==1||next.outputNames.length<1){
    await next.release().catch(()=>{});
    throw new Error('Modellen må ha én bildeinngang og minst én utgang.');
  }
  const input=next.inputNames[0];
  let shape;
  try{
    const inputInfo=Array.isArray(next.inputMetadata)?next.inputMetadata.find(m=>m.name===input):next.inputMetadata?.[input];
    if(!inputInfo||inputInfo.isTensor===false||inputInfo.type&&inputInfo.type!=='float32')throw new Error('Modellen må ha en float32 RGB bildeinngang.');
    shape=getInputShape(inputInfo);
  }catch(e){await next.release().catch(()=>{});throw e}
  const former=session;
  session=next;
  metadata={name:file.name,input,output:next.outputNames[0],shape};
  if(former)await former.release().catch(()=>{});
  return {name:file.name,width:shape.w,height:shape.h,channelsFirst:shape.nchw,output:metadata.output};
}
function setOptions(values){
  const mode=values?.mode;
  if(!['keypoint','bbox'].includes(mode))throw new Error('Ukjent ML-deteksjonsmodus.');
  opts.mode=mode;
  opts.keypointIndex=Math.max(0,Math.min(12,Number(values.keypointIndex)||0));
  opts.threshold=Math.max(.05,Math.min(.95,Number(values.threshold)||.35));
}
function getArray(info,shape,frame,region){
  const {w,h,nchw}=shape;
  working.width=w;working.height=h;
  const fw=frame.videoWidth,fh=frame.videoHeight;
  if(!fw||!fh)throw new Error('Kamerabildet er ikke tilgjengelig.');
  const crop=region||{x:0,y:0,width:fw,height:fh};
  const sx=Math.max(0,Math.min(fw,crop.x)),sy=Math.max(0,Math.min(fh,crop.y));
  const sw=Math.max(1,Math.min(fw-sx,crop.width)),sh=Math.max(1,Math.min(fh-sy,crop.height));
  // Letterbox preserves coordinates for scoring.
  const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
  const left=(w-dw)/2,top=(h-dh)/2;
  context.fillStyle='#727272';context.fillRect(0,0,w,h);
  context.drawImage(frame,sx,sy,sw,sh,left,top,dw,dh);
  const rgba=context.getImageData(0,0,w,h).data;
  const values=new Float32Array(w*h*3);
  const area=w*h;
  for(let i=0;i<area;i++){
    const pix=i*4;
    if(nchw){values[i]=rgba[pix]/255;values[area+i]=rgba[pix+1]/255;values[2*area+i]=rgba[pix+2]/255}
    else{const base=i*3;values[base]=rgba[pix]/255;values[base+1]=rgba[pix+1]/255;values[base+2]=rgba[pix+2]/255}
  }
  return {values,scale,left,top,sw,sh,sx,sy,fw,fh};
}
function parseOutput(tensor,geometry,options=opts){
  const dims=tensor?.dims||[];
  const raw=tensor?.data;
  if(!raw||dims.length!==3||Number(dims[0])!==1)throw new Error('Forventer YOLO-utgang med tre dimensjoner [1,C,N] eller [1,N,C].');
  const d1=Number(dims[1]),d2=Number(dims[2]);
  // YOLO export: channels normally < 128 and predictions normally > 128.
  const transposed=d1>d2;
  const channels=transposed?d2:d1;
  const count=transposed?d1:d2;
  if(channels<5||channels>128||count<1||count>200000)throw new Error('YOLO-utgang har uventet form: '+dims.join('×'));
  const get=(row,ch)=>transposed?raw[row*channels+ch]:raw[ch*count+row];
  if(options.mode==='keypoint'&&5+(Number(options.keypointIndex)||0)*3+2>=channels)throw new Error('Pose-utgangen mangler ønsket nøkkelpunkt. Bruk en dart-tip YOLO-posemodell.');
  const detections=[];
  for(let row=0;row<count;row++){
    const objectness=get(row,4);
    if(!Number.isFinite(objectness)||objectness<options.threshold||objectness>1)continue;
    let x=get(row,0),y=get(row,1),tipConfidence=objectness;
    if(options.mode==='keypoint'){
      const offset=5+(Number(options.keypointIndex)||0)*3;
      x=get(row,offset);y=get(row,offset+1);
      const kc=get(row,offset+2);
      if(!Number.isFinite(kc)||kc<options.threshold||kc>1)continue;
      tipConfidence=Math.min(objectness,kc);
    }
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const px=(x-geometry.left)/geometry.scale+(geometry.sx||0);
    const py=(y-geometry.top)/geometry.scale+(geometry.sy||0);
    if(px<(geometry.sx||0)||py<(geometry.sy||0)||px>(geometry.sx||0)+geometry.sw||py>(geometry.sy||0)+geometry.sh)continue;
    detections.push({x:px,y:py,confidence:tipConfidence,mode:options.mode});
  }
  detections.sort((a,b)=>b.confidence-a.confidence);
  // Suppress multiple anchor predictions for the same visible tip.
  const kept=[];
  for(const item of detections){
    if(kept.some(p=>Math.hypot(item.x-p.x,item.y-p.y)<Math.max(9,geometry.sw*.012)))continue;
    kept.push(item);
    if(kept.length>=12)break;
  }
  return kept;
}
let busy=false;
async function infer(video,region){
  if(!session||!metadata)throw new Error('Ingen ONNX-modell er lastet.');
  if(busy)throw new Error('AI analyserer fortsatt forrige bilde.');
  busy=true;
  try{
    const ort=await fetchRuntime();
    const {shape,input,output}=metadata;
    const geometry=getArray(null,shape,video,region);
    const tensor=new ort.Tensor('float32',geometry.values,shape.nchw?[1,3,shape.h,shape.w]:[1,shape.h,shape.w,3]);
    const result=await session.run({[input]:tensor});
    const detections=parseOutput(result[output],geometry,opts);
    return {detections,source:'onnx-dart-tip',method:opts.mode};
  }finally{busy=false}
}
function ready(){return !!session}
function name(){return metadata?.name||''}
window.DartArenaLabAI={load,setOptions,infer,ready,name,parseOutput,getInputShape};
})();
