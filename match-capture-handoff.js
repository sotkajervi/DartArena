/* Same-document capture transfer. No iframe, track cloning, or new getUserMedia.
 * This module never changes SFU authorization; transport migration remains separate.
 */
(()=>{
 'use strict';
 if(window.DartArenaCaptureHandoff)return;
 let held=null,claimed=false;
 function transfer(stream){
   if(held||!stream?.getTracks)return false;
   const tracks=stream.getTracks();
   if(!tracks.length||tracks.some(t=>t.readyState!=='live'))return false;
   held=stream;
   claimed=false;
   return true;
 }
 function claim(){
   if(!held||claimed)return null;
   if(held.getTracks().some(t=>t.readyState!=='live')){held=null;return null}
   claimed=true;
   const result=held;
   held=null;
   return result;
 }
 function discard(){
   if(held)held.getTracks().forEach(t=>{try{t.stop()}catch{}});
   held=null;claimed=false;
 }
 window.DartArenaCaptureHandoff={transfer,claim,discard,hasPending:()=>!!held};
 window.addEventListener('pagehide',discard);
})();