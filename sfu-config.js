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
      console.warn('[MEDIA] Lagret kamera/mikrofon finnes ikke. Bruker standardvalg.',error?.name||error);
      return nativeGetUserMedia(original);
    }
  };
})();
