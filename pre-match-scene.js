/* Pre-match scene, developer opt-in. Reparents the actual waiting room
 * controls; does not duplicate handlers, devices, or WebRTC video elements.
 * Match layout is unchanged when the scene is inactive.
 */
(()=>{
 'use strict';
 if(window.DartArenaPreMatchScene)return;
 let scene=null,phase='match',busy=false;
 const moved=[];
 const el=id=>document.getElementById(id);
 function attach({container=el('matchView')}={}){
   if(scene)return scene;
   if(!container||!el('videoGrid'))throw Error('Pre-match host or video is missing');
   scene=document.createElement('section');
   scene.id='preMatchScene';
   scene.className='da-prematch-scene';
   scene.hidden=true;
   scene.setAttribute('aria-label','Før kamp');
   scene.innerHTML='<div class="da-prematch-title">VENTEROM</div><div class="da-prematch-videos"></div><div class="da-prematch-controls"></div>';
   container.prepend(scene);
   return scene;
 }
 function move(node,parent){
   if(!node)return;
   if(!moved.some(entry=>entry.node===node)){
     const anchor=document.createComment('Original position: '+(node.id||node.className));
     node.before(anchor);
     moved.push({node,anchor});
   }
   parent.appendChild(node);
 }
 async function animateMove(node,parent){
   if(!node)return;
   const before=node.getBoundingClientRect();
   move(node,parent);
   const after=node.getBoundingClientRect();
   if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
   if(!before.width||!after.width||typeof node.animate!=='function')return;
   const animation=node.animate([
     {transform:'translate('+(before.x-after.x)+'px,'+(before.y-after.y)+'px) scale('+(before.width/after.width)+','+(before.height/after.height)+')'},
     {transform:'none'}
   ],{duration:480,easing:'cubic-bezier(.2,.75,.2,1)'});
   await animation.finished.catch(()=>{});
 }
 async function preMatch(){
   attach();
   if(phase==='pre'||busy)return;
   busy=true;
   try{
     scene.hidden=false;
     const video=el('videoGrid');
     const controls=scene.querySelector('.da-prematch-controls');
     // These are the existing waiting-room DOM nodes, not reconstructed inputs.
     const device=el('roomDeviceControls')?.closest('.camera-controls');
     const ready=el('readyBtn')?.closest('section.card');
     if(device)move(device,controls);
     if(ready)move(ready,controls);
     document.body.classList.add('da-prematch-active');
     await animateMove(video,scene.querySelector('.da-prematch-videos'));
     phase='pre';
   }finally{busy=false}
 }
 async function match(){
   if(!scene||phase==='match'||busy)return;
   busy=true;
   try{
     document.body.classList.remove('da-prematch-active');
     for(const entry of [...moved].reverse()){
       if(entry.node===el('videoGrid'))continue;
       entry.anchor.after(entry.node);
     }
     const video=el('videoGrid'),original=moved.find(entry=>entry.node===video);
     if(original)await animateMove(video,original.anchor.parentNode);
     if(original)original.anchor.after(video);
     scene.hidden=true;
     phase='match';
   }finally{busy=false}
 }
 // Existing tournament-match-room.js remains sole owner of server-backed controls.
 function bindRoomControls(){
   attach();
   return {update(){},dispose(){}};
 }
 window.DartArenaPreMatchScene={attach,preMatch,match,bindRoomControls,phase:()=>phase};
})();