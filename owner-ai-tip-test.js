/* Owner-only live AI-tip experiment. No score writes or camera uploads.
 * The torch weights are loaded from a local, user-selected JSON file and run
 * through TensorFlow.js on the device. This page is separate from all matches.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const db=window.supabase?.createClient(
  'https://jqpxlbhwvskhjbqrbidk.supabase.co',
  'sb_publishable_aqx1Q36C3cznImJ5KMDk3w_I1uUTHQK'
);
const T=window.DartArenaAutoZoom,Z=window.DartArenaZoomCam,Bias=window.DartArenaTipBias,Online=window.DartArenaTipOnlineCalibration;
const SIZE={width:640,height:480};
let authorized=false,stream=null,config=null,before=null,after=null,video=$('tipVideo');
let weights=[],ready=false,busy=false,zoomCrop=null,proposal=null,corrected=null;
let current=null,results=[],previousRecords=[],manualCenter=null;
let scanTimer=null,scanBusy=false,roundCount=0,roundArmed=false,scanPrev=null,motionAt=0,quietCount=0,lastScanAt=0,reviewIndex=-1,stableCandidate=null;
const HISTORY_KEY='dartarena-owner-ai-tip-prior-labels-v1';
let historyLabels=[];
function minimalLabel(row){
  const {id,model,cameraCalibration,crop,rawAiZoom,aiZoom,correctedZoom}=row;
  if(typeof id!=='string'||!correctedZoom||!cameraCalibration?.deviceId)return null;
  if(![correctedZoom.x,correctedZoom.y,(rawAiZoom||aiZoom)?.x,(rawAiZoom||aiZoom)?.y].every(Number.isFinite))return null;
  return{id,model,cameraCalibration,
    crop:{width:crop?.width},rawAiZoom:rawAiZoom||aiZoom,correctedZoom};
}
function mergeLabels(oldRows,newRows){
  const m=new Map();
  for(const row of [...oldRows,...newRows]){
    const record=minimalLabel(row);
    if(record)m.set(record.id,record);
  }
  return Array.from(m.values()).slice(-180);
}
function showHistory(){
  $('tipHistoryCount').textContent=historyLabels.length+' lagrede AI+-korrigeringer';
  $('tipForgetCalibration').disabled=!historyLabels.length;
}
function persistHistory(){
  if(!authorized)return;
  historyLabels=mergeLabels(historyLabels,results);
  try{localStorage.setItem(HISTORY_KEY,JSON.stringify(historyLabels))}
  catch(e){announce('tipImportStatus','Kunne ikke lagre AI+-punkter i nettleseren: '+e.message,true)}
  showHistory();
}
function previousApprovedForInference(){
  return mergeLabels(historyLabels,results);
}
// The local, uncompressed Owner-export ZIP starts with labels.json.
// Read only metadata; no old camera images are ever retained by this importer.
async function readZipLabels(file){
  if(file.size>64*1024*1024)throw Error('Test-ZIP er større enn 64 MB.');
  const data=await file.arrayBuffer(),view=new DataView(data);
  if(data.byteLength<30||view.getUint32(0,true)!==0x04034b50)
    throw Error('Ukjent ZIP-format.');
  const method=view.getUint16(8,true),size=view.getUint32(18,true);
  const nameLength=view.getUint16(26,true),extraLength=view.getUint16(28,true);
  const nameStart=30,begin=nameStart+nameLength+extraLength;
  if(begin>data.byteLength||begin+size>data.byteLength||size>4*1024*1024||method!==0)
    throw Error('ZIP-data eller komprimering støttes ikke.');
  const decode=new TextDecoder();
  const name=decode.decode(new Uint8Array(data,nameStart,nameLength));
  if(name!=='labels.json')throw Error('Dette er ikke en AI-spisstest fra DartArena.');
  const json=JSON.parse(decode.decode(new Uint8Array(data,begin,size)));
  if(!Array.isArray(json.tests))throw Error('Finner ingen testpunkter i ZIP-filen.');
  return json.tests;
}
$('tipImportLabels').addEventListener('change',async e=>{
  if(!authorized)return;
  const file=e.target.files?.[0];if(!file)return;
  try{
    const entries=await readZipLabels(file);
    const before=historyLabels.length;
    historyLabels=mergeLabels(historyLabels,entries);
    localStorage.setItem(HISTORY_KEY,JSON.stringify(historyLabels));
    showHistory();
    announce('tipImportStatus',historyLabels.length-before+
      ' nye godkjente testpunkter importert. Lagrede totalt: '+historyLabels.length+
      '. AI+ brukes først når minst fem tidligere punkter passer kameraet.');
  }catch(err){announce('tipImportStatus','Import feilet: '+(err.message||String(err)),true)}
  finally{e.target.value=''}
});
$('tipForgetCalibration').addEventListener('click',()=>{
  if(!authorized||!confirm('Glemme tidligere lagrede AI+-koordinater på denne PC-en? Testbildene og aktiv testbatch slettes ikke.'))return;
  historyLabels=[];
  try{localStorage.removeItem(HISTORY_KEY)}catch{}
  showHistory();announce('tipImportStatus','Tidligere lagrede AI+-korrigeringer er slettet fra denne nettleseren.');
});
const counter=()=>{
  const approved=results.filter(item=>item.verification==='accepted_ai').length;
  const corrected=results.filter(item=>item.verification==='manual_tip').length;
  $('tipCount').textContent=results.length+' tester · '+approved+' AI-godkjent · '+corrected+' manuelt korrigert';
  $('tipExport').disabled=!results.length;$('tipClear').disabled=!results.length;
};
function announce(id,text,error=false){
  const node=$(id);node.textContent=text;node.setAttribute('role',error?'alert':'status');
}
function update(){
  const playing=authorized&&!!stream;
  $('tipBefore').disabled=!playing||busy;
  $('tipAfter').disabled=!playing||!before||!ready||busy||($('tipAuto').checked?!roundArmed:!!current);
  $('tipApproveAi').disabled=!playing||!current||busy||current.verification!=='unreviewed';
  $('tipNext').disabled=!playing||!after||!current||busy;
  $('tipPrevReview').disabled=reviewIndex<=0;
  $('tipNextReview').disabled=reviewIndex<0||reviewIndex>=results.length-1;
  $('tipStart').disabled=!authorized||playing||busy;
  $('tipStop').disabled=!playing;
}
function stop(){
  stopScan();
  for(const track of stream?.getTracks()||[])track.stop();
  stream=null;video.pause();video.srcObject=null;
  before=null;after=null;current=null;manualCenter=null;roundArmed=false;roundCount=0;
  update();
}
window.addEventListener('pagehide',()=>{
  stop();
  for(const t of weights) {t.kernel.dispose();t.bias.dispose();}
  weights=[];
});
async function ownerAuth(){
  try{
    if(!db)throw Error('Innlogging kunne ikke lastes.');
    const {data:{user},error}=await db.auth.getUser();
    if(error||!user)throw Error('Du må være innlogget.');
    const owner=await db.rpc('is_owner');
    if(owner.error||owner.data!==true)throw Error('Denne testsonen er kun for Owner.');
    authorized=true;$('tipDenied').hidden=true;$('tipApp').hidden=false;
    try{
      const stored=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');
      historyLabels=mergeLabels([],Array.isArray(stored)?stored:[]);
    }catch{historyLabels=[]}
    showHistory();
    update();
    announce('tipCameraStatus','Start kameraet når du vil teste.');
  }catch(e){
    // Fail closed before any model, camera, local images or UI are activated.
    authorized=false;$('tipApp').hidden=true;$('tipDenied').hidden=false;
    $('tipDenied').textContent=e.message||'Kun Owner har tilgang.';
  }
}
const shapeOk=(shape,expected)=>Array.isArray(shape)&&shape.length===expected.length&&
  shape.every((v,i)=>v===expected[i]);
function decodeFloat32(encoded,count){
  const bin=atob(encoded);
  if(bin.length!==count*4)throw Error('Modellfilen inneholder feil antall vekter.');
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  // Official weight converter exports little-endian float32.
  const reader=new DataView(bytes.buffer),arr=new Float32Array(count);
  for(let i=0;i<count;i++)arr[i]=reader.getFloat32(i*4,true);
  return arr;
}
async function loadModel(file){
  if(!authorized)return;
  busy=true;update();
  const next=[];
  try{
    if(!window.tf)throw Error('TensorFlow.js ble ikke lastet. Kontroller internett og prøv igjen.');
    const raw=JSON.parse(await file.text());
    const expected=[[5,5,6,24],[3,3,24,48],[3,3,48,64],
      [3,3,64,64],[3,3,64,64],[1,1,64,1]];
    if(raw.format!=='dartarena-diffnet-v1-tfjs-f32'||
      !shapeOk(raw.input,[120,160,6])||!shapeOk(raw.output,[30,40,1])||
      !Array.isArray(raw.steps)||raw.steps.length!==expected.length)
      throw Error('Velg DartArenas før-/ettermodell v1, ikke en annen JSON-fil.');
    await tf.ready();
    for(let i=0;i<expected.length;i++){
      const layer=raw.steps[i],size=expected[i].reduce((a,b)=>a*b,1);
      if(!shapeOk(layer.shape,expected[i])||
        layer.stride!==(i<2?2:1)||
        layer.activation!==(i===5?'linear':'relu')||
        typeof layer.kernelB64!=='string'||typeof layer.biasB64!=='string')
        throw Error('Modellfilen har ugyldige lag.');
      next.push({
        kernel:tf.tensor4d(decodeFloat32(layer.kernelB64,size),layer.shape),
        bias:tf.tensor1d(decodeFloat32(layer.biasB64,expected[i][3])),
        stride:layer.stride,activation:layer.activation
      });
    }
    for(const layer of weights){layer.kernel.dispose();layer.bias.dispose();}
    weights=next;ready=true;
    announce('tipModelStatus','Modell klar: '+raw.name+' · '+tf.getBackend().toUpperCase()+
      '. Velg før-bilde og kast en pil. Forslag godkjennes aldri automatisk.');
  }catch(e){
    for(const layer of next){layer.kernel.dispose();layer.bias.dispose();}
    announce('tipModelStatus','Kunne ikke laste modell: '+(e.message||String(e)),true);
  }finally{busy=false;update()}
}
$('tipModel').addEventListener('change',e=>{
  const file=e.target.files?.[0];if(file)void loadModel(file);
});
async function start(){
  if(!authorized||stream||busy)return;
  config=Z.loadConfig(localStorage);
  if(!config){announce('tipCameraStatus','Kalibrer dette kameraet i Cam-test / Zoom-cam først.',true);return}
  busy=true;update();
  try{
    const s=await navigator.mediaDevices.getUserMedia({audio:false,video:{
      deviceId:{exact:config.deviceId},width:{ideal:1920},height:{ideal:1080}}});
    stream=s;
    const track=s.getVideoTracks()[0],settings=track.getSettings();
    if(!Z.compatible(config,track,settings.width||1920,settings.height||1080))
      throw Error('Kameraet stemmer ikke med Zoom-cam-kalibreringen. Kalibrer på nytt.');
    video.srcObject=s;await video.play();
    if(!video.videoWidth||!video.videoHeight)throw Error('Kameraet returnerte ikke videobilder.');
    previousRecords=await loadOwnerLabels();
    startScan();
    announce('tipCameraStatus','Kamera klart ('+video.videoWidth+' × '+video.videoHeight+
      '). Tidligere godkjente spisser: '+previousRecords.length+'. Lagre et før-bilde.');
  }catch(e){
    stop();
    announce('tipCameraStatus','Kameraet kunne ikke startes: '+(e.message||String(e)),true);
  }finally{busy=false;update()}
}
$('tipStart').addEventListener('click',()=>{void start()});
$('tipStop').addEventListener('click',()=>{stop();announce('tipCameraStatus','Kamera stoppet.')});
function snapshot(){
  if(!stream||!video.videoWidth||!video.videoHeight)throw Error('Kamerabildet er ikke klart.');
  const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;
  c.getContext('2d').drawImage(video,0,0,c.width,c.height);
  return c;
}
function storeBefore(frame){
  before=frame;after=null;zoomCrop=null;current=null;proposal=null;corrected=null;manualCenter=null;
  roundCount=0;roundArmed=true;scanPrev=null;motionAt=0;quietCount=0;stableCandidate=null;reviewIndex=-1;
  announce('tipAutoStatus',$('tipAuto').checked?'Auto klar: kast pil 1 av 3.':'Manuell modus: kast pilen og analyser.');
  $('tipResult').textContent=$('tipAuto').checked?'Før-bilde lagret. Kast tre piler i vanlig tempo.':'Før-bilde lagret. Kast én pil og analyser.';
  const c=$('tipZoom');c.getContext('2d').clearRect(0,0,640,480);
  announce('tipCameraStatus','Før-bilde lagret ('+frame.width+' × '+frame.height+').');
  update();
}
$('tipBefore').addEventListener('click',()=>{
  try{storeBefore(snapshot())}catch(e){announce('tipCameraStatus',e.message,true)}
});
video.addEventListener('click',e=>{
  if(!authorized||!stream)return;
  const p=Z.pointer(video,e);
  if(!p)return;
  manualCenter=p;
  announce('tipCameraStatus','Manuelt område valgt. Etter kastet kan du trykke «Analyser ny pil».');
});
function samples(canvas,w,h){
  const scratch=document.createElement('canvas');scratch.width=w;scratch.height=h;
  const cx=scratch.getContext('2d',{willReadFrequently:true});
  cx.drawImage(canvas,0,0,w,h);
  return cx.getImageData(0,0,w,h).data;
}
function findRegion(first,second){
  if(manualCenter)return {point:manualCenter,source:'manually-selected'};
  const sw=480,sh=Math.round(sw*second.height/second.width);
  const b=samples(first,sw,sh),a=samples(second,sw,sh);
  const board={x:config.cx*sw,y:config.cy*sh,radius:config.radius*sw};
  const hit=T.findChange(b,a,sw,sh,board,{
    ...T.sensitivityPreset(config.sensitivity),searchRadius:1.65,
    maxRatio:.20,stride:1
  });
  if(!hit)throw Error('Fant ingen tydelig bildeendring. Klikk nær den nye pilen i videobildet og prøv på nytt.');
  return {point:{x:hit.x*second.width/sw,y:hit.y*second.height/sh},source:'frame-difference'};
}
function cropFrame(frame,rect){
  const c=document.createElement('canvas');c.width=640;c.height=480;
  c.getContext('2d').drawImage(frame,rect.x,rect.y,rect.width,rect.height,0,0,640,480);
  return c;
}
function inputTensor(first,second){
  const older=samples(first,160,120),newer=samples(second,160,120);
  const out=new Float32Array(120*160*6);
  for(let i=0;i<120*160;i++){
    const j=i*4,k=i*6;
    for(let channel=0;channel<3;channel++){
      const a=newer[j+channel]/255,b=older[j+channel]/255;
      out[k+channel]=a;out[k+3+channel]=Math.min(1,Math.abs(a-b)*2);
    }
  }
  return out;
}
function infer(input){
  if(!ready||weights.length!==6)throw Error('Last inn modellen før du analyserer.');
  const output=tf.tidy(()=>{
    let x=tf.tensor4d(input,[1,120,160,6]);
    for(const layer of weights){
      const y=tf.conv2d(x,layer.kernel,layer.stride,'same').add(layer.bias);
      x=layer.activation==='relu'?y.relu():y;
    }
    return x.reshape([1200]);
  });
  return output.data().then(logits=>{
    output.dispose();
    if(logits.length!==1200)throw Error('Modellen returnerte feil antall punkter.');
    let max=-Infinity,idx=0;
    for(let i=0;i<logits.length;i++)if(logits[i]>max){max=logits[i];idx=i}
    const ix=idx%40,iy=Math.floor(idx/40);
    let sx=0,sy=0,weight=0;
    for(let y=Math.max(0,iy-1);y<=Math.min(29,iy+1);y++){
      for(let x=Math.max(0,ix-1);x<=Math.min(39,ix+1);x++){
        const w=Math.exp(logits[y*40+x]-max);
        sx+=x*w;sy+=y*w;weight+=w;
      }
    }
    if(!weight||!Number.isFinite(sx))throw Error('Ugyldig modelldata.');
    return {x:16*(sx/weight+.5),y:16*(sy/weight+.5)};
  },e=>{output.dispose();throw e});
}
function circle(ctx,p,color,size){
  if(!p)return;
  ctx.strokeStyle=color;ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(p.x,p.y,size,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(p.x-size-6,p.y);ctx.lineTo(p.x+size+6,p.y);
  ctx.moveTo(p.x,p.y-size-6);ctx.lineTo(p.x,p.y+size+6);ctx.stroke();
}
function display(){
  const c=$('tipZoom'),ctx=c.getContext('2d');
  ctx.clearRect(0,0,640,480);
  if(!current)return;
  ctx.drawImage(current.afterImage,0,0,640,480);
  circle(ctx,current.changeZoom,'#ffaf35',7);
  if(current.appliedAdjustment)circle(ctx,current.rawAiZoom,'#c5cbd0',5);
  circle(ctx,current.aiZoom,'#00effc',6);
  circle(ctx,current.correctedZoom,'#59ff93',6);
}
function resultText(){
  if(!current)return;
  const ai=current.aiZoom,p=current.correctedZoom;
  let text=(current.appliedAdjustment?
    'AI+ korrigert med '+current.appliedAdjustment.samples+' tidligere godkjente tester. ':
    'Rå AI-forslag (tilpasning starter etter 5 kontrollerte tester). ')+
    'Klikk den faktiske spissen for å måle feilen.';
  if(current.verification==='accepted_ai'){
    text='AI-forslaget er godkjent av Owner uten nytt koordinatpunkt. '+
      'Godkjent teller i treffoversikten, men brukes ikke som fasit for videre modelltrening eller AI+-justering. '+
      'Hvis du oppdager en feil: klikk den korrekte spissen i bildet.';
  }
  if(p){
    const err=Math.hypot(ai.x-p.x,ai.y-p.y);
    const old=current.changeZoom;
    const rawErr=Math.hypot(current.rawAiZoom.x-p.x,current.rawAiZoom.y-p.y);
    text=(current.appliedAdjustment?'AI+ feil: ':'AI-feil: ')+err.toFixed(1)+
      ' px zoom (ca. '+(err*current.crop.width/640).toFixed(1)+' px original).'+
      (current.appliedAdjustment?' Rå modell: '+rawErr.toFixed(1)+' px.':'')+
      (old?' Bildeendring: '+Math.hypot(old.x-p.x,old.y-p.y).toFixed(1)+' px.':'')+
      (rawErr>48?' Stor avvik: kontroller at modellen valgte den NYE pilen.':'');
  }
  $('tipResult').textContent=text;
}
function toBlob(c){return new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(Error('Kunne ikke lagre testbilde.')),'image/jpeg',.88))}
function stopScan(){if(scanTimer!==null)clearInterval(scanTimer);scanTimer=null;scanBusy=false;}
function startScan(){
  stopScan();
  // Bounded, local camera polling. No server-side processing.
  scanTimer=setInterval(()=>{void scan()},260);
}
async function scan(){
  if(scanBusy||busy||!authorized||!stream||!before||!ready||
     !$('tipAuto').checked||!roundArmed||roundCount>=3)return;
  scanBusy=true;
  try{
    const now=performance.now(),frame=snapshot();
    if(frame.width!==before.width||frame.height!==before.height){
      roundArmed=false;announce('tipAutoStatus','Kameraformatet endret seg. Trykk Ny runde.',true);return;
    }
    // Compare current still frame with the last accepted dart, not only
    // consecutive frames. Fast thrown darts can miss the motion threshold entirely.
    const sw=480,sh=Math.max(1,Math.round(sw*frame.height/frame.width));
    const sampled=samples(frame,sw,sh);
    const board={x:config.cx*sw,y:config.cy*sh,radius:config.radius*sw};
    const opts={...T.sensitivityPreset(config.sensitivity),searchRadius:1.65,
      stride:1,maxRatio:.12};
    if(!scanPrev){scanPrev=sampled;return}
    const movement=T.motionRatio(scanPrev,sampled,sw,sh,board,{searchRadius:1.65});
    scanPrev=sampled;
    if(movement>.018){
      stableCandidate=null;quietCount=0;return;
    }
    if(now-lastScanAt<850)return;
    const base=samples(before,sw,sh);
    const hit=T.findChange(base,sampled,sw,sh,board,opts);
    if(!hit||hit.changedSamples<opts.minSamples){
      stableCandidate=null;quietCount=0;return;
    }
    // Require the same new region over multiple quiet frames before accepting.
    // This cannot duplicate a dart: analyze() immediately sets before=frame.
    if(stableCandidate&&Math.hypot(hit.x-stableCandidate.x,hit.y-stableCandidate.y)<9){
      quietCount++;
    }else{
      quietCount=1;
    }
    stableCandidate=hit;
    if(quietCount<3)return;
    stableCandidate=null;quietCount=0;
    await analyze(frame);
  }catch(e){
    announce('tipAutoStatus','Automatisk analyse feilet: '+(e.message||String(e))+'. Prøv manuelt.',true);
  }finally{scanBusy=false}
}
async function analyze(frameOverride=null){
  const automatic=!!frameOverride||$('tipAuto').checked;
  if(!authorized||!stream||!before||!ready||busy||(!automatic&&current))return;
  busy=true;update();
  try{
    const next=frameOverride||snapshot();
    if(next.width!==before.width||next.height!==before.height)
      throw Error('Kameraoppløsningen ble endret. Ta et nytt før-bilde.');
    const hit=findRegion(before,next);
    // For automatic change detection, use the Owner's verified, per-camera
    // offset only for choosing the crop. The AI never receives this centroid.
    const bias=hit.source==='frame-difference'&&Bias?
      Bias.estimate(previousRecords,config,next.width,next.height):null;
    const target=bias?Bias.adjust(hit.point,bias,next.width,next.height):hit.point;
    const rect=T.zoomCrop(next.width,next.height,target.x,target.y,
      config.radius*next.width,4/3);
    const earlierCrop=cropFrame(before,rect),laterCrop=cropFrame(next,rect);
    const xy=await infer(inputTensor(earlierCrop,laterCrop));
    if(!(xy.x>=0&&xy.y>=0&&xy.x<=640&&xy.y<=480))
      throw Error('Modellen ga et ugyldig punkt.');
    // Apply a small robust learned offset from PRIOR corrected tests only.
    // Never use this dart's label to adjust its own prediction.
    const appliedAdjustment=Online?.estimate(previousApprovedForInference(),config,'DartArenaDiffNet_v1',rect.width)||null;
    const calibrated=Online?.apply(xy,appliedAdjustment)||xy;
    const changeZoom={x:(hit.point.x-rect.x)*640/rect.width,
      y:(hit.point.y-rect.y)*480/rect.height};
    const [beforeBlob,afterBlob]=await Promise.all([toBlob(earlierCrop),toBlob(laterCrop)]);
    after=next;zoomCrop=rect;proposal=calibrated;corrected=null;
    const record={
      id:crypto.randomUUID(),createdAt:new Date().toISOString(),
      model:'DartArenaDiffNet_v1',cameraWidth:next.width,cameraHeight:next.height,
      cameraCalibration:{...config},crop:rect,source:hit.source,
      beforeBlob,afterBlob,afterImage:laterCrop,
      changeZoom,rawAiZoom:xy,aiZoom:calibrated,appliedAdjustment,correctedZoom:null,
      verification:'unreviewed',verifiedAt:null
    };
    current=record;results.push(record);reviewIndex=results.length-1;
    manualCenter=null;
    if(automatic){
      roundCount++;
      before=next;roundArmed=roundCount<3;
      scanPrev=null;motionAt=0;quietCount=0;stableCandidate=null;lastScanAt=performance.now();
      announce('tipAutoStatus',roundArmed?'Lagret pil '+roundCount+'/3. Kast pil '+(roundCount+1)+'.':
        '3/3 piler lagret. Gjennomgå forslagene med Forrige/Neste, trekk pilene og trykk Ny runde.');
    }
    display();resultText();counter();
    announce('tipCameraStatus','Analyse klar. AI-forslaget er markert i lyseblått. Korriger i bildet til høyre.');
  }catch(e){announce('tipResult','Kunne ikke analysere: '+(e.message||String(e)),true)}
  finally{busy=false;update()}
}
$('tipAfter').addEventListener('click',()=>{void analyze()});
$('tipAuto').addEventListener('change',()=>{
  roundArmed=!!before&&roundCount<3;
  scanPrev=null;motionAt=0;quietCount=0;stableCandidate=null;
  announce('tipAutoStatus',$('tipAuto').checked?'Auto aktiv. Kast når skiva er klar.':'Auto slått av. Bruk manuell analyse.');
  update();
});
function showRecorded(index){
  if(index<0||index>=results.length)return;
  reviewIndex=index;current=results[index];display();resultText();update();
  announce('tipAutoStatus','Gjennomgang: pil '+(index+1)+' av '+results.length+'.');
}
$('tipPrevReview').addEventListener('click',()=>showRecorded(reviewIndex-1));
$('tipNextReview').addEventListener('click',()=>showRecorded(reviewIndex+1));
$('tipNext').addEventListener('click',()=>{
  if(!after||!current)return;
  storeBefore(after);
});
$('tipApproveAi').addEventListener('click',()=>{
  if(!authorized||!current||busy||current.verification!=='unreviewed')return;
  // Intentional distinction: a visually accepted AI point is NOT manually
  // measured ground truth. Never fabricate correctedZoom or learn from it.
  current.verification='accepted_ai';
  current.verifiedAt=new Date().toISOString();
  current.correctedZoom=null;
  display();resultText();counter();update();
});
$('tipZoom').addEventListener('click',e=>{
  if(!current)return;
  const rect=$('tipZoom').getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  corrected={x:Math.max(0,Math.min(639,(e.clientX-rect.left)*640/rect.width)),
    y:Math.max(0,Math.min(479,(e.clientY-rect.top)*480/rect.height))};
  current.correctedZoom=corrected;
  current.verification='manual_tip';current.verifiedAt=new Date().toISOString();
  persistHistory();
  display();resultText();counter();update();
});
async function loadOwnerLabels(){
  if(typeof indexedDB==='undefined')return [];
  try{
    const handle=await new Promise((ok,no)=>{
      const req=indexedDB.open('dartarena-ai-rival-training-v1',1);
      req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
      req.onupgradeneeded=()=>{const obj=req.result;if(!obj.objectStoreNames.contains('captures'))obj.createObjectStore('captures',{keyPath:'id'})};
    });
    if(!handle.objectStoreNames.contains('captures')){handle.close();return []}
    const rows=await new Promise((ok,no)=>{
      const req=handle.transaction('captures').objectStore('captures').getAll();
      req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
    });
    handle.close();return rows.filter(x=>x.status==='approved'&&x.corrected);
  }catch{return []}
}
async function exportBatch(){
  if(!authorized||!results.length||busy)return;
  busy=true;update();
  try{
    const entries=[],metadata=[];
    for(let i=0;i<results.length;i++){
      const r=results[i],idx=String(i+1).padStart(3,'0');
      const beforeName='images/'+idx+'-before.jpg',afterName='images/'+idx+'-after.jpg';
      entries.push({name:beforeName,bytes:new Uint8Array(await r.beforeBlob.arrayBuffer())});
      entries.push({name:afterName,bytes:new Uint8Array(await r.afterBlob.arrayBuffer())});
      const {id,createdAt,model,cameraWidth,cameraHeight,cameraCalibration,crop,source,changeZoom,rawAiZoom,aiZoom,appliedAdjustment,correctedZoom,verification,verifiedAt}=r;
      metadata.push({id,createdAt,model,cameraWidth,cameraHeight,cameraCalibration,
        crop,source,changeZoom,rawAiZoom,aiZoom,appliedAdjustment,correctedZoom,verification,verifiedAt,
        beforeFile:beforeName,afterFile:afterName});
    }
    entries.unshift({name:'labels.json',bytes:new TextEncoder().encode(JSON.stringify({
      purpose:'Owner-only before-after model test. accepted_ai means visually accepted prediction, NOT manually measured ground truth; manual_tip correctedZoom is independently clicked.',
      createdAt:new Date().toISOString(),tests:metadata
    },null,2))});
    const blob=window.DartArenaLabZip.build(entries),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;
    a.download='dartarena-ai-spisstest-'+new Date().toISOString().slice(0,10)+'.zip';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    announce('tipCameraStatus','Testbatch ZIP er laget. Kontroller nedlastingen før du nullstiller.');
  }catch(e){announce('tipCameraStatus','Eksport feilet: '+(e.message||String(e)),true)}
  finally{busy=false;update()}
}
$('tipExport').addEventListener('click',()=>{void exportBatch()});
$('tipClear').addEventListener('click',()=>{
  if(!authorized||busy||!confirm('Nullstille alle testene som ikke er eksportert?'))return;
  results=[];current=null;after=null;reviewIndex=-1;
  display();counter();update();
  announce('tipResult','Testbatch nullstilt.');
});
counter();update();void ownerAuth();
})();