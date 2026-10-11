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
    roboflow_credentials_or_access:'Roboflow avviste API-nøkkelen eller modelltilgangen. Kontroller Private API Key og tilgang til modellen.',
    roboflow_public_key:'Dette ser ut til å være en Public/Publishable API Key (rf_). Bruk Private API Key fra Roboflow Workspace Settings → API Keys.',
    roboflow_unauthorized:'Roboflow svarte 401: nøkkelen er ugyldig, utløpt eller mangler riktig tilgang. Kontroller Private API Key.',
    roboflow_forbidden:'Roboflow svarte 403: nøkkelen har ikke tilgang til denne modellen/arbeidsområdet, eller mangler nødvendige rettigheter.',
    roboflow_model_missing:'Roboflow svarte 404: modellversjonen finnes ikke eller er utilgjengelig.',
    roboflow_billing_or_limit:'Roboflow stoppet forespørselen på grunn av kreditter eller en begrensning på kontoen.',
    roboflow_connection_failed:'Kunne ikke nå Roboflow. Prøv igjen senere.',
    roboflow_inference_failed:'Roboflow kunne ikke analysere bildet.',
    quota_check_unavailable:'Daglig testgrense kunne ikke kontrolleres.',
    unauthorized:'Logg inn igjen før AI-testen.',
    forbidden:'Bare Admin og Owner kan bruke testen.'
  };
  const message=labels[String(code)]||('Roboflow-test feilet: '+String(code).slice(0,110));
  const upstream=Number(data?.upstreamStatus);
  return message+(Number.isInteger(upstream)&&upstream>=400&&upstream<=599?' (HTTP '+upstream+' fra Roboflow)':'');
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
    detections:mapDetections(data,img.region,{width:img.width,height:img.height}),
    diagnostics:data.diagnostics||null};
}
// Same JPEG generator as infer(): preview is local-only, no HTTP request.
function preview(frame,region){
  const img=makeImage(frame,region);
  return {src:'data:image/jpeg;base64,'+img.image,width:img.width,height:img.height,region:img.region};
}
// Comparison experiment: same frozen frame and board crop, three JPEG resolutions.
function resizeImage(frame,region,size){
  const base=makeImage(frame,region);
  if(size===0)return base;
  //   // reconstruct from original frozen frame using the same pixel rectangle and JPEG settings.
  const canvas=document.createElement('canvas');
  canvas.width=size;canvas.height=size;
  canvas.getContext('2d',{alpha:false}).drawImage(
    frame,base.region.x,base.region.y,base.region.width,base.region.height,
    0,0,size,size);
  const image=canvas.toDataURL('image/jpeg',.78).split(',')[1];
  if(!image||image.length>800000)throw new Error('Bildet i '+size+' × '+size+' er for stort.');
  return {image,width:size,height:size,region:base.region};
}
async function compare(client,frame,region,onResult){
  const variants=[{label:'Original',size:0},{label:'800 × 800',size:800},{label:'1024 × 1024',size:1024}];
  const results=[];
  for(const variant of variants){
    const img=resizeImage(frame,region,variant.size);
    try{
      const {data,error}=await client.functions.invoke(ENDPOINT,{body:{image:img.image}});
      if(error||data?.error)throw new Error(await errorMessage(error,data));
      const detections=mapDetections(data,img.region,{width:img.width,height:img.height});
      const result={label:variant.label,width:img.width,height:img.height,
        objects:Number(data.diagnostics?.providerPredictions)||0,
        keypoints:Number(data.diagnostics?.validKeypoints)||0,
        detections,diagnostics:data.diagnostics||null};
      results.push(result);onResult?.(result);
    }catch(e){
      const result={label:variant.label,width:img.width,height:img.height,error:e?.message||String(e)};
      results.push(result);onResult?.(result);
      // On quota/auth/network issues do not spend additional attempts blindly.
      break;
    }
  }
  return results;
}
// A/B test: identical JPEG input for both hosted keypoint models.
async function compareModels(client,frame,region,onResult){
  const img=makeImage(frame,region);
  const variants=[{label:'Roboflow v17',id:'v17'},{label:'Universal V3',id:'universal-v3'}];
  const results=[];
  for(const variant of variants){
    try{
      const {data,error}=await client.functions.invoke(ENDPOINT,{body:{image:img.image,model:variant.id}});
      if(error||data?.error)throw new Error(await errorMessage(error,data));
      const result={label:variant.label,model:data.model,
        width:img.width,height:img.height,
        objects:Number(data.diagnostics?.providerPredictions)||0,
        keypoints:Number(data.diagnostics?.validKeypoints)||0,
        detections:mapDetections(data,img.region,{width:img.width,height:img.height}),
        diagnostics:data.diagnostics||null};
      results.push(result);onResult?.(result);
    }catch(e){
      const result={label:variant.label,error:e?.message||String(e)};
      results.push(result);onResult?.(result);
      // Only abort subsequent calls on authentication, quota, or transport failures.
      if(/dagens testgrense|quota|401|403|logg inn|forbidden|unauthorized|Kunne ikke nå/i.test(result.error))break;
    }
  }
  return results;
}
window.DartArenaLabRoboflow={check,infer,preview,compare,compareModels,mapDetections,makeImage,explain};
})();
