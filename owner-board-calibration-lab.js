/* Owner-only, local-file Darts board calibration MODEL DIAGNOSTIC.
 * No embedded proprietary model, no uploads, no calibration writes and no score writes.
 * User selects their own local APK/TFLite; inference is experimental.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const tf=window.tf,tflite=window.tflite;
const APK_ENTRY='assets/flutter_assets/assets/models/dart_calibration_w7s.tflite';
const MAX_MODEL=80*1024*1024,MAX_APK=260*1024*1024;
const STAGE=1024;
const db=window.supabase?.createClient(
  'https://jqpxlbhwvskhjbqrbidk.supabase.co',
  'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
);
let allowed=false,runner=null,source=null,stream=null,loading=false,analyzing=false,lastBoxes=[];
const view=$('visual'),ctx=view.getContext('2d'),status=$('status');
const report=$('results'),video=$('camera');
function say(s,level='info'){
  status.textContent=String(s);
  $('runState').dataset.level=level;
}
function runtimeStatus(){
  const ready=!!window.tf&&!!window.tflite;
  $('runtimeState').textContent=ready?'TFLite: lastet':
    (!window.tf?'TensorFlow.js mangler':'TFLite-motoren mangler');
  return ready;
}
$('copyDiagnostic').addEventListener('click',async()=>{
  const msg='DartArena kalibreringstest\n'+status.textContent+'\n'+report.textContent+'\n'+$('runtimeState').textContent;
  try{await navigator.clipboard.writeText(msg);$('copyDiagnostic').textContent='Kopiert ✓'}
  catch{say('Kunne ikke kopiere automatisk. Marker feilmeldingen og kopier den.', 'error')}
});
function update(){
  $('load').disabled=!allowed||loading||!$('modelFile').files.length;
  $('analyze').disabled=!allowed||analyzing||loading||!runner||!source;
  $('takeFrame').disabled=!allowed||!stream;
  $('stopCamera').disabled=!allowed||!stream;
  $('startCamera').disabled=!allowed||!!stream;
  $('saveOverlay').disabled=!allowed||!lastBoxes.length;
  runtimeStatus();
}
function zipModelBytes(apk){
  const needle=new TextEncoder().encode(APK_ENTRY);
  let from=0;
  for(;;){
    const start=apk.indexOf(needle[0],from);
    if(start<0)throw Error('Kalibreringsmodellen finnes ikke i denne APK-en.');
    from=start+1;
    if(start+needle.length>apk.length)continue;
    let match=true;
    for(let i=1;i<needle.length;i++)if(apk[start+i]!==needle[i]){match=false;break}
    if(!match||start<30)continue;
    const header=start-30;
    const view=new DataView(apk.buffer,apk.byteOffset,apk.byteLength);
    if(view.getUint32(header,true)!==0x04034b50)continue;
    const sizeName=view.getUint16(header+26,true),extra=view.getUint16(header+28,true);
    const method=view.getUint16(header+8,true),flags=view.getUint16(header+6,true);
    const length=view.getUint32(header+18,true);
    const rawSize=view.getUint32(header+22,true);
    if(sizeName!==needle.length)continue;
    if((flags&0x8)!==0)throw Error('APK bruker ZIP-datafelt som ikke støttes i denne testsiden.');
    if(method!==0)throw Error('Kalibreringsmodellen er komprimert i APK-en, ikke lagret direkte.');
    if(length<1000||length>MAX_MODEL||rawSize!==length)throw Error('Uventet størrelse på TFLite-modellen.');
    const begin=start+sizeName+extra;
    if(begin+length>apk.length)throw Error('Ufullstendig APK-fil.');
    const bytes=apk.slice(begin,begin+length);
    if(new TextDecoder().decode(bytes.subarray(4,8))!=='TFL3')
      throw Error('Modellinnholdet er ikke en gyldig TFLite FlatBuffer.');
    return bytes.buffer;
  }
}
async function readModelFile(file){
  if(file.name.toLowerCase().endsWith('.tflite')){
    if(file.size>MAX_MODEL)throw Error('Modellfilen er for stor.');
    return file.arrayBuffer();
  }
  if(!file.name.toLowerCase().endsWith('.apk'))throw Error('Velg APK eller TFLite-fil.');
  if(file.size>MAX_APK)throw Error('APK-filen er for stor for testen.');
  const data=new Uint8Array(await file.arrayBuffer());
  return zipModelBytes(data);
}
$('modelFile').addEventListener('change',update);
$('load').addEventListener('click',async()=>{
  if(!allowed||loading)return;
  const file=$('modelFile').files?.[0];if(!file)return;
  loading=true;update();lastBoxes=[];say('Leser modellen lokalt fra filen. Dette kan ta litt tid …');
  try{
    if(!runtimeStatus())throw Error('TensorFlow Lite er ikke tilgjengelig. Sjekk nettforbindelsen eller prøv Chrome.');
    const bytes=await readModelFile(file);
    say('TFLite funnet ('+(bytes.byteLength/1048576).toFixed(1)+' MB). Starter lokal WASM-kjøring …');
    await tf.setBackend('cpu');await tf.ready();
    const instance=await Promise.race([
      tflite.loadTFLiteModel(bytes,{numThreads:1}),
      new Promise((_,reject)=>setTimeout(
        ()=>reject(Error('Modellinnlasting tok mer enn 45 sekunder. Denne modellen støttes kanskje ikke av nettleseren.')),45000))
    ]);
    if(typeof instance.predict!=='function')throw Error('Modellen kunne ikke startes av denne nettleseren.');
    if(runner&&typeof runner.dispose==='function')runner.dispose();
    runner=instance;
    const ins=runner.inputs||[],outs=runner.outputs||[];
    report.hidden=false;
    report.textContent='Modellens innganger: '+JSON.stringify(ins)+'\nUtganger: '+JSON.stringify(outs);
    say('Modellen er lastet. Velg skivebilde eller Ta bilde, og trykk deretter Analyser bildet.','success');
  }catch(e){
    runner=null;
    say('Modellen kunne ikke startes: '+(e?.message||String(e))+
      '\nIngen kalibrering er endret. Modellen kan kreve TFLite-operasjoner nettleseren ikke støtter.','error');
    report.hidden=false;report.textContent=String(e?.stack||e);
    console.warn(e);
  }
  finally{loading=false;update()}
});
function paint(){
  if(!source)return;
  view.hidden=false;
  const factor=Math.min(1440/source.width,1080/source.height,1);
  view.width=Math.max(1,Math.round(source.width*factor));
  view.height=Math.max(1,Math.round(source.height*factor));
  ctx.drawImage(source,0,0,view.width,view.height);
  const sx=view.width/source.width,sy=view.height/source.height;
  ctx.textBaseline='top';
  for(const b of lastBoxes){
    const x=b.x*sx,y=b.y*sy,w=b.w*sx,h=b.h*sy;
    ctx.lineWidth=2.3;ctx.strokeStyle='#00ebf4';ctx.strokeRect(x-w/2,y-h/2,w,h);
    const label='C'+b.classId+' '+Math.round(b.conf*100)+'%';
    ctx.font='bold 14px system-ui';
    const width=ctx.measureText(label).width+12;
    const ly=Math.max(0,y-h/2-20);
    ctx.fillStyle='rgba(3,21,26,.88)';ctx.fillRect(Math.max(0,x-w/2),ly,width,19);
    ctx.fillStyle='#00ebf4';ctx.fillText(label,Math.max(0,x-w/2)+6,ly+1);
  }
}
function imageFromFile(file){
  return new Promise((resolve,reject)=>{
    if(!file.type.startsWith('image/'))return reject(Error('Velg et bildefilformat.'));
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);const c=document.createElement('canvas');
      c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);
      resolve(c);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Kunne ikke lese bildet.'))};
    img.src=url;
  });
}
$('imageFile').addEventListener('change',async()=>{
  if(!allowed||!$('imageFile').files?.[0])return;
  try{
    source=await imageFromFile($('imageFile').files[0]);lastBoxes=[];paint();
    $('imageState').textContent='Bilde klart: '+source.width+' × '+source.height;
    say('Skivebildet klart ('+source.width+' × '+source.height+'). '+(runner?'Trykk Analyser bildet.':'Last inn en modell for analyse.'));
    report.textContent='';report.hidden=true;
  }
  catch(e){say(e.message,'error')}update();
});
$('startCamera').addEventListener('click',async()=>{
  if(!allowed||stream)return;
  try{stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
    video.srcObject=stream;video.hidden=false;await video.play();
    $('cameraState').textContent='Kamera aktivt';
    say('Kamera startet. Trykk Ta bilde når hele skiva vises.');
  }catch(e){say('Kunne ikke starte kamera: '+e.message,'error')}
  update();
});
function stopCamera(){
  stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;video.hidden=true;
  $('cameraState').textContent='Kamera avslått';update();
}
$('stopCamera').addEventListener('click',stopCamera);
$('takeFrame').addEventListener('click',()=>{
  if(!stream||!video.videoWidth)return;
  source=document.createElement('canvas');source.width=video.videoWidth;source.height=video.videoHeight;
  source.getContext('2d').drawImage(video,0,0);
  lastBoxes=[];paint();$('imageState').textContent='Kamerabilde klart: '+source.width+' × '+source.height;
  say('Kamerabilde tatt. '+(runner?'Trykk Analyser bildet.':'Last modellen for å analysere.'));update();
});
function decodeModelOutput(output,layout,minConfidence){
  const shape=output.shape,data=output.dataSync();
  // YOLO-style output [1, 4+C, N], not a guaranteed class mapping.
  if(shape.length!==3||shape[0]!==1||shape[1]<5||shape[2]<1)
    throw Error('Ukjent modellutgang: '+JSON.stringify(shape));
  const dims=shape[1],count=shape[2],classes=dims-4;
  const props={dims,count,classes,shape};
  const candidates=[];
  for(let k=0;k<count;k++){
    let cl=-1,confidence=minConfidence;
    for(let j=0;j<classes;j++){
      const v=data[(4+j)*count+k];
      if(v>confidence){cl=j;confidence=v}
    }
    if(cl<0)continue;
    const x=data[k],y=data[count+k],w=data[2*count+k],h=data[3*count+k];
    if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;
    candidates.push({x,y,w,h,classId:cl,conf:confidence});
  }
  candidates.sort((a,b)=>b.conf-a.conf);
  const selected=[];
  for(const b of candidates){
    if(selected.length>=65)break;
    if(selected.some(s=>s.classId===b.classId&&Math.hypot(s.x-b.x,s.y-b.y)<Math.max(12,Math.min(s.w,s.h,b.w,b.h)*.33)))continue;
    selected.push(b);
  }
  return{props,candidates:selected,rawCount:candidates.length};
}
function bboxToImage(b,scale,padX,padY,normalized,imgW,imgH){
  const scalar=normalized?STAGE:1;
  return{...b,x:(b.x*scalar-padX)/scale,y:(b.y*scalar-padY)/scale,
    w:b.w*scalar/scale,h:b.h*scalar/scale};
}
$('analyze').addEventListener('click',async()=>{
  if(!allowed||!runner||!source||analyzing)return;
  analyzing=true;lastBoxes=[];update();say('Analyserer skiva lokalt med TFLite. Dette kan bruke litt tid …');
  let input=null,output=null;
  try{
    // Typical YOLO letterbox; the exact APK preprocessor is not yet verified.
    const canvas=document.createElement('canvas');canvas.width=canvas.height=STAGE;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    c.fillStyle='#727272';c.fillRect(0,0,STAGE,STAGE);
    const scale=Math.min(STAGE/source.width,STAGE/source.height);
    const x=(STAGE-source.width*scale)/2,y=(STAGE-source.height*scale)/2;
    c.drawImage(source,x,y,source.width*scale,source.height*scale);
    input=tf.tidy(()=>tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0));
    output=runner.predict(input);
    const tensor=output?.shape?output:Array.isArray(output)?output[0]:Object.values(output||{})[0];
    if(!tensor?.dataSync)throw Error('Ukjent modellutgang.');
    const result=decodeModelOutput(tensor,null,Number($('threshold').value));
    const normalized=result.candidates.length>0&&Math.max(...result.candidates.slice(0,20).map(v=>Math.max(v.x,v.y,v.w,v.h)))<3;
    lastBoxes=result.candidates.map(b=>bboxToImage(b,scale,x,y,normalized,source.width,source.height));
    paint();
    const counts=new Map();
    lastBoxes.forEach(b=>counts.set(b.classId,(counts.get(b.classId)||0)+1));
    say('Ferdig: '+lastBoxes.length+' punktforslag. Modellklassene er ennå ikke identifisert. Ingen kalibrering er lagret.','success');
    report.hidden=false;
    report.textContent='Utgang: '+JSON.stringify(result.props)+'\nKlasser: '+JSON.stringify(Object.fromEntries([...counts].sort((a,b)=>a[0]-b[0])))+
      '\n\nToppforslag:\n'+lastBoxes.slice(0,30).map(b=>'C'+b.classId+' '+(b.conf*100).toFixed(1)+'% ved ('+b.x.toFixed(1)+', '+b.y.toFixed(1)+')').join('\n');
  }catch(e){
    say('Modellanalyse feilet: '+(e?.message||String(e))+'\nIngen kalibrering er endret.','error');
    report.hidden=false;report.textContent=String(e?.stack||e);
    console.warn(e);
  }
  finally{
    if(input?.dispose)input.dispose();
    if(output?.dispose)output.dispose();
    else if(Array.isArray(output))output.forEach(t=>t?.dispose?.());
    else if(output)Object.values(output).forEach(t=>t?.dispose?.());
    analyzing=false;update();
  }
});
$('threshold').addEventListener('change',()=>{if(source&&lastBoxes.length)paint()});
$('saveOverlay').addEventListener('click',()=>{
  if(!lastBoxes.length)return;
  view.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='dartarena-lokal-kalibreringsanalyse.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
  },'image/png');
});
window.addEventListener('pagehide',stopCamera);
(async()=>{
  try{
    if(!db)throw Error('Innlogging er utilgjengelig.');
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user)throw Error('Du må være logget inn.');
    const {data,isOwnerError,error:rpcError}=await db.rpc('is_owner');
    if(rpcError||data!==true)throw Error('Kun Owner kan bruke dette laboratoriet.');
    allowed=true;$('denied').hidden=true;$('app').hidden=false;update();
    if(!runtimeStatus())say('Owner bekreftet, men TensorFlow Lite-biblioteket mangler. Modellanalyse er utilgjengelig. Kamerabilder kan fortsatt tas.','error');
    else say('Owner bekreftet. Velg modellfil og skivebilde.');
  }catch(e){$('denied').textContent='Ingen tilgang: '+e.message;say('Kan ikke åpne testsiden: '+e.message,'error')}
})();
})();