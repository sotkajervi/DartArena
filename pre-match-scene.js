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
  scene.innerHTML=`
    <div class="da-prematch-title">VENTEROM</div>
    <div class="da-prematch-videos"></div>
    <div class="camera-controls">
      <div class="room-device-controls">
        <label class="field">Kamera <select id="preCameraSelect" disabled><option>Gjeldende kamera</option></select></label>
        <label class="field">Mikrofon <select id="preMicSelect" disabled><option>Gjeldende mikrofon</option></select></label>
      </div>
    </div>
    <section class="card da-prematch-ready">
      <small>KLARSTATUS</small>
      <h2>Kampen starter når begge er klare</h2>
      <p class="muted">Velg hvem som begynner før begge markerer seg klare.</p>
      <label class="field starter-choice">Hvem begynner?
        <select id="preStarterChoice" disabled>
          <option value="me">Jeg begynner</option>
          <option value="opponent">Motstander begynner</option>
          <option value="random" selected>Myntkast</option>
        </select>
      </label>
      <p class="muted compact starter-help">Hvis valget endres, nullstilles klarstatusen.</p>
      <div class="ready-panel">
        <div class="ready-state"><strong id="preLocalName">Du</strong><span id="preLocalDot" class="ready-dot"></span><span id="preLocalReady">Ikke klar</span></div>
        <div class="ready-state"><strong id="preRemoteName">Motstander</strong><span id="preRemoteDot" class="ready-dot"></span><span id="preRemoteReady">Ikke klar</span></div>
      </div>
      <div class="room-actions"><button id="preReadyBtn" class="primary" disabled>Jeg er klar</button></div>
      <p id="preRoomMessage" class="message">Pre-kamp er ennå ikke koblet til serverens Klar- og startervalg.</p>
    </section>`;
  container.prepend(scene);
  holder=scene.querySelector('.da-prematch-videos');
  return scene;
 }
 let transitionInProgress=false;
 async function moveVideo(nextParent,afterAnchor=false){
  const video=document.getElementById('videoGrid');
  if(!video)throw Error('Video elements missing');
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const first=video.getBoundingClientRect();
  if(afterAnchor)anchor.after(video);else nextParent.appendChild(video);
  const last=video.getBoundingClientRect();
  if(reduceMotion||!first.width||!last.width)return;
  const deltaX=first.left-last.left,deltaY=first.top-last.top;
  const sx=first.width/last.width,sy=first.height/last.height;
  if(!Number.isFinite(sx)||!Number.isFinite(sy))return;
  const animation=video.animate([
   {transform:'translate('+deltaX+'px,'+deltaY+'px) scale('+sx+','+sy+')',opacity:.82},
   {transform:'translate(0,0) scale(1,1)',opacity:1}
  ],{duration:480,easing:'cubic-bezier(.2,.75,.2,1)'});
  await animation.finished.catch(()=>{});
 }
 async function preMatch(){
  attach();
  if(phase==='pre'||transitionInProgress)return;
  transitionInProgress=true;
  scene.hidden=false;
  document.body.classList.add('da-prematch-active');
  try{await moveVideo(holder)}finally{phase='pre';transitionInProgress=false}
 }
 async function match(){
  if(!scene||phase==='match'||transitionInProgress)return;
  transitionInProgress=true;
  document.body.classList.remove('da-prematch-active');
  try{await moveVideo(null,true)}finally{scene.hidden=true;phase='match';transitionInProgress=false}
 }
 window.DartArenaPreMatchScene={attach,preMatch,match,phase:()=>phase};
 // Deliberately do not auto-enter the scene: match.js currently requires an already-created live match ID.
 // A separate guarded migration of the tournament start RPC is required before enabling multiplayer readiness.
})();