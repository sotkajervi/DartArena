window.DARTARENA_SFU = Object.freeze({ workerUrl: 'https://dartarena-realtime.sotkajervi.workers.dev' });

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
    if(typeof value!=='object'||value.deviceId!=null)return{value,applied:false};
    return{value:{...value,deviceId:{exact:deviceId}},applied:true};
  }

  function withoutPreferredDevice(value){
    if(value===true)return true;
    if(!value||typeof value!=='object')return value;
    if(!('deviceId' in value))return value;
    const copy={...value};
    delete copy.deviceId;
    return copy;
  }

  media.getUserMedia=async input=>{
    const original=input??{video:true,audio:true};
    if(!original||typeof original!=='object')return nativeGetUserMedia(original);

    const cameraId=localStorage.getItem(CAMERA_KEY)||'';
    const micId=localStorage.getItem(MIC_KEY)||'';
    const video=addPreferredDevice(original.video,cameraId);
    const audio=addPreferredDevice(original.audio,micId);
    const applied=video.applied||audio.applied;
    const patched={...original,video:video.value,audio:audio.value};

    try{
      return await nativeGetUserMedia(patched);
    }catch(error){
      if(!applied||!['NotFoundError','OverconstrainedError'].includes(error?.name))throw error;

      // Keep the waiting-room camera choice authoritative even if the saved
      // microphone disappeared, and vice versa. Never discard both choices
      // just because one device is unavailable.
      if(video.applied&&audio.applied){
        try{
          const keepCamera={...original,video:video.value,audio:withoutPreferredDevice(original.audio)};
          const result=await nativeGetUserMedia(keepCamera);
          localStorage.removeItem(MIC_KEY);
          console.warn('[MEDIA] Lagret mikrofon mangler. Beholder valgt kamera.');
          return result;
        }catch(cameraError){
          if(!['NotFoundError','OverconstrainedError'].includes(cameraError?.name))throw cameraError;
        }

        try{
          const keepMic={...original,video:withoutPreferredDevice(original.video),audio:audio.value};
          const result=await nativeGetUserMedia(keepMic);
          localStorage.removeItem(CAMERA_KEY);
          console.warn('[MEDIA] Lagret kamera mangler. Beholder valgt mikrofon.');
          return result;
        }catch(micError){
          if(!['NotFoundError','OverconstrainedError'].includes(micError?.name))throw micError;
        }
      }else if(video.applied){
        try{
          return await nativeGetUserMedia({...original,video:video.value});
        }catch(cameraError){
          if(!['NotFoundError','OverconstrainedError'].includes(cameraError?.name))throw cameraError;
          localStorage.removeItem(CAMERA_KEY);
        }
      }else if(audio.applied){
        try{
          return await nativeGetUserMedia({...original,audio:audio.value});
        }catch(micError){
          if(!['NotFoundError','OverconstrainedError'].includes(micError?.name))throw micError;
          localStorage.removeItem(MIC_KEY);
        }
      }

      console.warn('[MEDIA] Valgt enhet finnes ikke lenger. Bruker tilgjengelig standardenhet.',error?.name||error);
      return nativeGetUserMedia(original);
    }
  };
})();
