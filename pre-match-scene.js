/* Isolated pre-match scene foundation. NOT enabled for live matches yet.
 * Keeps the existing #videoGrid element (and its WebRTC media elements)
 * across scene transitions; never clones video or creates a new connection.
 */
(()=>{
 'use strict';
 if(window.DartArenaPreMatchScene)return;
 let phase='match',holder=null,anchor=null,scene=null;
 function attach({container=document.getElementById('matchView')}={}){
  if(scene)return scene;
  const video=document.getElementById('videoGrid');
  if(!video||!container)throw Error('Existing match video elements are required');
  anchor=document.createComment('DartArena original video position');
  video.before(anchor);
  scene=document.createElement('section');
  scene.id='preMatchScene';
  scene.className='da-prematch-scene';
  scene.hidden=true;
  scene.setAttribute('aria-label','Før kamp');
  scene.innerHTML='<div class="da-prematch-title">FØR KAMP</div><div class="da-prematch-videos"></div><div class="da-prematch-info">Kamera og lyd beholdes gjennom overgangen. Startervalg, myntkast og Klar kobles til eksisterende kamplogikk i neste trinn.</div>';
  container.prepend(scene);
  holder=scene.querySelector('.da-prematch-videos');
  return scene;
 }
 function preMatch(){
  attach();
  if(phase==='pre')return;
  holder.appendChild(document.getElementById('videoGrid'));
  scene.hidden=false;
  document.body.classList.add('da-prematch-active');
  phase='pre';
 }
 function match(){
  if(!scene||phase==='match')return;
  anchor.after(document.getElementById('videoGrid'));
  document.body.classList.remove('da-prematch-active');
  scene.hidden=true;
  phase='match';
 }
 window.DartArenaPreMatchScene={attach,preMatch,match,phase:()=>phase};
})();