/* Roboflow adapter: explicit one-frame opt-in only, no recurring uploads.
   All credentials remain in the authenticated Supabase Edge Function. */
(function(){
'use strict';
const ENDPOINT='autoscoring-roboflow';
const MAX_SIDE=768;
function clamp(x,min,max){return Math.min(max,Math.max(min,x))}
function mapDetections(response, region, sent){
  if(!response||!Array.isArray(response.detections))throw new Error('Ugyldig svar fra Roboflow-tjenesten.');
  const iw=Number(response.image?.width)||sent.width;
  const ih=Number(response.image?.height)||sent.height;
  if(!Number.isFinite(iw)||!Number.isFinite(ih)||iw<=0||ih<=0)throw new Error('Ugyldig bildeformat i AI-svar.');
  return response.detections.filter(d=>d&&Number.isFinite(d.x)&&Number.isFinite(d.y)
      &&d.x>=0&&d.y>=0&&d.x<=iw&&d.y<=ih&&Number.isFinite(d.confidence))
    .map(d=>({
      x:region.x+d.x/iw*region.width,
      y:region.y+d.y/ih*region.height,
      confidence:clamp(d.confidence,0,1),
      className:String(d.className||'dart_tip')
    })).filter(d=>d.confidence>=.05);
}
function makeImage(frame,region){
  const fw=frame?.videoWidth||frame?.width,fh=frame?.videoHeight||frame?.height;
  if(!fw||!fh)throw new Error('Kamerabildet mangler.');
  const x=clamp(Math.floor(region.x),0,fw-1),y=clamp(Math.floor(region.y),0,fh-1);
  const w=Math.min(fw-x,Math.ceil(region.x+region.width)-x),h=Math.min(fh-y,Math.ceil(region.y+region.height)-y);
  if(w<80||h<80)throw new Error('Skiveutsnittet er for lite.');
  const scale=Math.min(1,MAX_SIDE/Math.max(w,h));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.drawImage(frame,x,y,w,h,0,0,canvas.width,canvas.height);
  const encoded=canvas.toDataURL('image/jpeg',.78).split(',')[1];
  if(!encoded||encoded.length>800000)throw new Error('Skivebildet er for stort.');
  return {image:encoded,width:canvas.width,height:canvas.height,region:{x,y,width:w,height:h}};
}
function explain(error,data){
  const code=data?.error||error?.context?.status||error?.message||'ukjent feil';
  const labels={
    roboflow_key_not_configured:'Roboflow-nøkkel mangler i Supabase. Legg inn ROBOFLOW_API_KEY under Edge Functions / Secrets.',
    daily_test_limit:'Dagens testgrense er nådd (25 per bruker, maksimalt 100 totalt).',
    roboflow_credentials_or_access:'Roboflow avviste API-nøkkelen eller modelltilgangen.',
    roboflow_connection_failed:'Kunne ikke nå Roboflow. Prøv igjen senere.',
    roboflow_inference_failed:'Roboflow kunne ikke analysere bildet.',
    quota_check_unavailable:'Daglig testgrense kunne ikke kontrolleres.',
    unauthorized:'Logg inn igjen før AI-testen.',
    forbidden:'Bare Admin og Owner kan bruke testen.'
  };
  return labels[String(code)]||('Roboflow-test feilet: '+String(code).slice(0,110));
}
async function errorMessage(error,data){
  let parsed=data;
  if(error?.context?.json){
    try{parsed=await error.context.json()}catch{}
  }
  return explain(error,parsed);
}
async function check(client){
  const {data,error}=await client.functions.invoke(ENDPOINT,{method:'GET'});
  if(error)throw new Error(await errorMessage(error,data));
  if(!data||typeof data.configured!=='boolean')throw new Error('Ugyldig status fra AI-tjenesten.');
  return data;
}
async function infer(client,frame,region){
  const img=makeImage(frame,region);
  const {data,error}=await client.functions.invoke(ENDPOINT,{body:{image:img.image}});
  if(error||data?.error)throw new Error(await errorMessage(error,data));
  return {model:data.model,method:'roboflow-keypoint',
    detections:mapDetections(data,img.region,{width:img.width,height:img.height})};
}
window.DartArenaLabRoboflow={check,infer,mapDetections,makeImage,explain};
})();
