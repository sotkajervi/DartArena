// Reuse the microphone selected in the tournament waiting room when the X01
// match opens. Each match needs a new getUserMedia capture after navigation.
(function(root){
  'use strict';
  const MISSING_DEVICE_ERRORS=new Set(['NotFoundError','OverconstrainedError']);

  async function capture(mediaDevices,constraints,{preferredMicId='',cameraFallbackVideo=null}={}){
    if(!mediaDevices?.getUserMedia)throw new Error('Camera and microphone access unavailable');
    const requestedMic=String(preferredMicId||'').trim();
    const baseAudio={...constraints.audio};
    const preferredAudio=requestedMic?{...baseAudio,deviceId:{exact:requestedMic}}:baseAudio;
    const attempts=[
      {video:constraints.video,audio:preferredAudio,defaultMic:!requestedMic,defaultCamera:false},
    ];
    if(cameraFallbackVideo)attempts.push({video:cameraFallbackVideo,audio:preferredAudio,defaultMic:!requestedMic,defaultCamera:true});
    if(requestedMic){
      attempts.push({video:constraints.video,audio:baseAudio,defaultMic:true,defaultCamera:false});
      if(cameraFallbackVideo)attempts.push({video:cameraFallbackVideo,audio:baseAudio,defaultMic:true,defaultCamera:true});
    }
    let lastError;
    for(const attempt of attempts){
      try{
        const stream=await mediaDevices.getUserMedia({video:attempt.video,audio:attempt.audio});
        return{stream,usedDefaultMic:attempt.defaultMic&&!!requestedMic,usedDefaultCamera:attempt.defaultCamera};
      }catch(error){
        lastError=error;
        // Permissions and hardware errors are not device-selection failures.
        if(!MISSING_DEVICE_ERRORS.has(error?.name))throw error;
      }
    }
    throw lastError;
  }

  const api={capture};
  root.DartArenaMatchPreferredMedia=api;
  if(typeof module==='object'&&module?.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
