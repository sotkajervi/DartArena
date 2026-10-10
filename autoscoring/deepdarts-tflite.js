/* DeepDarts D1 local TFLite detector, isolated from score submission.
   The model is supplied by the tester; DartArena never downloads/stores weights.
   Architecture: YOLOv4-tiny 800x800 NHWC float32, dual 50/25 grid, 5 classes.
   Only class 0 represents dart tips. Other classes are calibration points.
*/
(function(){
'use strict';
const TF_CORE_CDN='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.22.0/dist/tf-core.min.js';
const TF_CPU_CDN='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-cpu@4.22.0/dist/tf-backend-cpu.min.js';
const TFLITE_CDN='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.8/dist/';
const SIZE=800,MAX_BYTES=80*1024*1024;
const ANCHORS={50:[[23,27],[37,58],[81,82]],25:[[81,82],[135,169],[344,319]]};
let runtimePromise=null,model=null,modelName=null,modelBusy=false;
function script(src,ready){
  if(ready())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const element=document.createElement('script');
    element.src=src;element.async=true;
    element.onload=()=>ready()?resolve():reject(new Error('Bibliotek lastet, men mangler i nettleseren.'));
    element.onerror=()=>reject(new Error('Kunne ikke laste TFLite-biblioteket. Kontroller nettverk og innholdsblokkering.'));
    document.head.appendChild(element);
  });
}
function runtime(){
  if(runtimePromise)return runtimePromise;
  runtimePromise=(async()=>{
    await script(TF_CORE_CDN,()=>!!window.tf?.tensor);
    await script(TF_CPU_CDN,()=>!!window.tf?.findBackend?.('cpu'));
    await window.tf.setBackend('cpu');
    await script(TFLITE_CDN+'tf-tflite.min.js',()=>!!window.tflite?.loadTFLiteModel);
    window.tflite.setWasmPath(TFLITE_CDN);
    // Fail with the missing URL rather than a cryptic _malloc from the WASM wrapper.
    const wasmUrl=TFLITE_CDN+'tflite_web_api_cc_simd.wasm';
    try {
      const wasmResponse=await fetch(wasmUrl,{method:'GET',cache:'force-cache'});
      if(!wasmResponse.ok)throw new Error('HTTP '+wasmResponse.status);
      await wasmResponse.arrayBuffer();
    } catch (error) {
      throw new Error('Kunne ikke hente TFLite WASM: '+wasmUrl+' ('+String(error?.message||error)+')');
    }
    await window.tf.ready();
    return {tf:window.tf,tflite:window.tflite};
  })().catch(e=>{runtimePromise=null;throw e});
  return runtimePromise;
}
function matches(shape,expected){
  return Array.isArray(shape)&&shape.length===expected.length&&
    shape.every((n,i)=>Number(n)===expected[i]);
}
function modelOutputs(outputs){
  if(Array.isArray(outputs))return outputs;
  if(outputs?.shape&&outputs?.data)return [outputs];
  if(outputs&&typeof outputs==='object')return Object.values(outputs);
  return [];
}
function validateShapes(input,outputs){
  if(!matches(input?.shape,[1,SIZE,SIZE,3])||input.dtype!=='float32')
    throw new Error('Kun DeepDarts 800×800 float32 RGB støttes i denne testen.');
  if(!Array.isArray(outputs)||outputs.length!==2)
    throw new Error('DeepDarts må ha to YOLO-utganger (50×50 og 25×25).');
  if(!outputs.some(o=>matches(o.shape,[1,50,50,30]))||
     !outputs.some(o=>matches(o.shape,[1,25,25,30])))
    throw new Error('TFLite-utgangene er ikke kompatible med DeepDarts D1.');
}
async function load(file){
  if(!file||!/\.tflite$/i.test(file.name))throw new Error('Velg en DeepDarts D1-fil med .tflite.');
  if(file.size<1024*1024||file.size>MAX_BYTES)throw new Error('Forventet TFLite-fil på 1–80 MB.');
  if(modelBusy)throw new Error('Vennligst vent på forrige TFLite-jobb.');
  modelBusy=true;
  try{
    if(model)throw new Error('Én TFLite-modell per testøkt. Oppdater siden for å bytte modell.');
    const {tflite}=await runtime();
    const bytes=await file.arrayBuffer();
    // No remote URL, cache or upload: all file bytes remain local to the browser.
    let next;
    try {
      next=await tflite.loadTFLiteModel(bytes,{numThreads:1});
    } catch (error) {
      if(String(error?.message||error).includes('_malloc')) {
        throw new Error('TFLite WebAssembly ble ikke initialisert (_malloc). Prøv å laste siden på nytt med Ctrl+F5. Hvis feilen fortsetter, kontroller om WASM-filer fra cdn.jsdelivr.net blokkeres. Opprinnelig feil: '+String(error?.message||error));
      }
      throw error;
    }
    try{
      validateShapes(next.inputs?.[0],next.outputs);
    }catch(e){try{next.dispose?.()}catch{}throw e}
    model=next;modelName=file.name;
    return {name:file.name,model:'DeepDarts D1',input:next.inputs?.[0]?.shape,outputs:next.outputs.map(o=>o.shape)};
  }finally{modelBusy=false}
}
function ready(){return !!model}
function name(){return modelName}
function sigmoid(x){return 1/(1+Math.exp(-Math.max(-88,Math.min(88,x))))}
function clamp(x,low,high){return Math.max(low,Math.min(high,x))}
function iou(a,b){
  const x1=Math.max(a.x-a.w/2,b.x-b.w/2),y1=Math.max(a.y-a.h/2,b.y-b.h/2),
    x2=Math.min(a.x+a.w/2,b.x+b.w/2),y2=Math.min(a.y+a.h/2,b.y+b.h/2);
  const shared=Math.max(0,x2-x1)*Math.max(0,y2-y1);
  return shared/(a.w*a.h+b.w*b.h-shared+1e-8);
}
function decode(raw,confidence=.50){
  const output=modelOutputs(raw);
  if(output.length!==2)throw new Error('DeepDarts trenger to modellutganger.');
  const boxes=[],byClass=[0,0,0,0,0],topByClass=[null,null,null,null,null],rawStats=[];
  for(const tensor of output){
    const shape=tensor.shape||tensor.dims,grid=Number(shape?.[1]);
    if(!ANCHORS[grid]||!matches(shape,[1,grid,grid,30]))
      throw new Error('Uventet YOLO-utgang fra DeepDarts: '+String(shape));
    const data=tensor.data;
    if(!data||data.length!==grid*grid*30)throw new Error('Modellen returnerte ufullstendige data.');
    let min=Infinity,max=-Infinity,inside=0,checked=0;
    for(let j=4;j<data.length;j+=10){const v=data[j];if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v);inside+=Number(v>=0&&v<=1);checked++}}
    rawStats.push({grid,min,max,fraction01:checked?inside/checked:0});
    const anchors=ANCHORS[grid],limit=clamp(Number(confidence)||.50,.05,.95);
    for(let gy=0;gy<grid;gy++)for(let gx=0;gx<grid;gx++)for(let a=0;a<3;a++){
      const k=(gy*grid+gx)*30+a*10;
      const objectness=clamp(data[k+4],0,1);
      if(objectness<limit)continue;
      // Only class 0 = dart tip; four remaining classes are cal markers.
      const classScores=[0,1,2,3,4].map(i=>clamp(data[k+5+i],0,1));
      const score=objectness*classScores[0];
      const dominant=classScores.indexOf(Math.max(...classScores));
      const dominantScore=objectness*classScores[dominant];
      if(dominantScore>=limit){
        byClass[dominant]++;
        if(!topByClass[dominant]||dominantScore>topByClass[dominant].confidence)
          topByClass[dominant]={confidence:dominantScore,grid,gx,gy,anchor:a};
      }
      if(score<limit||dominant!==0)continue;
      const x=(gx+clamp(data[k],0,1))/grid,y=(gy+clamp(data[k+1],0,1))/grid;
      const w=anchors[a][0]*Math.exp(clamp(data[k+2],-5,5))/SIZE;
      const h=anchors[a][1]*Math.exp(clamp(data[k+3],-5,5))/SIZE;
      if(![x,y,w,h,score].every(Number.isFinite)||x<0||x>1||y<0||y>1)continue;
      boxes.push({x,y,w,h,confidence:score});
    }
  }
  boxes.sort((a,b)=>b.confidence-a.confidence);
  const kept=[];
  for(const b of boxes){
    if(kept.length>=15)break;
    if(kept.every(k=>iou(k,b)<.45))kept.push(b);
  }
  return {rawCount:boxes.length,boxes:kept,diagnostic:{byClass,topByClass,rawStats}};
}
function cropBoard(frame,region){
  const fw=frame?.videoWidth||frame?.width,fh=frame?.videoHeight||frame?.height;
  if(!fw||!fh)throw new Error('Ingen tilgjengelig frosset kamerabilde.');
  const sx=clamp(Math.floor(region.x),0,fw-1),sy=clamp(Math.floor(region.y),0,fh-1),
    sw=Math.min(fw-sx,Math.ceil(region.x+region.width)-sx),
    sh=Math.min(fh-sy,Math.ceil(region.y+region.height)-sy);
  if(sw<90||sh<90)throw new Error('Skiveutsnittet er for lite til DeepDarts.');
  const scale=Math.min(SIZE/sw,SIZE/sh),dw=sw*scale,dh=sh*scale,
    left=(SIZE-dw)/2,top=(SIZE-dh)/2;
  const canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=SIZE;
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle='#727272';ctx.fillRect(0,0,SIZE,SIZE);
  ctx.drawImage(frame,sx,sy,sw,sh,left,top,dw,dh);
  return {canvas,sx,sy,sw,sh,left,top,dw,dh};
}
async function infer(frame,region,confidence=.50){
  if(!model||modelBusy)throw new Error('Last inn DeepDarts D1 før analyse.');
  modelBusy=true;
  let input=null,tensors=[];
  try{
    const {tf}=await runtime(),crop=cropBoard(frame,region);
    input=tf.tidy(()=>{
      // tfjs-core standalone build does not register Tensor chain methods.
      const pixels=tf.browser.fromPixels(crop.canvas);
      const normalized=tf.div(tf.cast(pixels,'float32'),255);
      return tf.expandDims(normalized,0);
    });
    const output=model.predict(input);
    tensors=modelOutputs(output);
    if(tensors.length!==2)throw new Error('DeepDarts returnerte ikke to utganger.');
    const raw=await Promise.all(tensors.map(async t=>({shape:t.shape,data:await t.data()})));
    const detections=decode(raw,confidence);
    return {
      model:modelName,method:'deepdarts-tflite',
      detections:detections.boxes.map(b=>({
        x:crop.sx+(b.x*SIZE-crop.left)/crop.dw*crop.sw,
        y:crop.sy+(b.y*SIZE-crop.top)/crop.dh*crop.sh,
        confidence:b.confidence
      })).filter(b=>b.x>=crop.sx&&b.x<=crop.sx+crop.sw&&b.y>=crop.sy&&b.y<=crop.sy+crop.sh),
      rawCount:detections.rawCount,diagnostic:detections.diagnostic
    };
  }finally{
    try{input?.dispose()}catch{}
    for(const t of tensors){try{t?.dispose()}catch{}}
    modelBusy=false;
  }
}
window.DartArenaLabDeepDarts={load,ready,name,infer,decode,validateShapes,cropBoard};
})();