(()=>{
  if(window.__dartArenaPreferredMediaDevices)return;
  window.__dartArenaPreferredMediaDevices=true;

  const media=navigator.mediaDevices;
  if(!media?.getUserMedia)return;

  const CAMERA_KEY='dartarena-preferred-camera';
  const MIC_KEY='dartarena-preferred-microphone';
  const nativeGetUserMedia=media.getUserMedia.bind(media);

  function addPreferredDevice(value,deviceId){
    if(!value||!deviceId)return{value,applied:false};
    if(value===true)return{value:{deviceId:{exact:deviceId}},applied:true};
    if(typeof value!=='object')return{value,applied:false};
    if(value.deviceId!=null)return{value,applied:false};
    return{value:{...value,deviceId:{exact:deviceId}},applied:true};
  }

  function preferredConstraints(input){
    const original=input??{video:true,audio:true};
    if(!original||typeof original!=='object')return{original,patched:original,applied:false};

    const cameraId=localStorage.getItem(CAMERA_KEY)||'';
    const micId=localStorage.getItem(MIC_KEY)||'';
    const video=addPreferredDevice(original.video,cameraId);
    const audio=addPreferredDevice(original.audio,micId);

    return{
      original,
      patched:{...original,video:video.value,audio:audio.value},
      applied:video.applied||audio.applied
    };
  }

  async function getUserMediaWithPreference(input){
    const request=preferredConstraints(input);
    try{
      return await nativeGetUserMedia(request.patched);
    }catch(error){
      const stalePreference=request.applied&&['NotFoundError','OverconstrainedError'].includes(error?.name);
      if(!stalePreference)throw error;
      console.warn('[MEDIA] Lagret kamera/mikrofon finnes ikke. Bruker nettleserens standardvalg.',error?.name||error);
      return nativeGetUserMedia(request.original);
    }
  }

  try{
    media.getUserMedia=getUserMediaWithPreference;
  }catch{
    try{Object.defineProperty(media,'getUserMedia',{configurable:true,value:getUserMediaWithPreference})}catch(error){
      console.warn('[MEDIA] Kunne ikke aktivere lagret kameravalg.',error);
    }
  }
})();
