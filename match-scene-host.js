/* Development-only single-document match layout host.
 * Reuses actual camera <video> elements. Scoring engine boot is separate.
 */
(()=>{
 'use strict';
 if(window.DartArenaMatchSceneHost)return;
 let stage=null,videoAnchor=null,active=false;
 const MATCH_STYLES=[
  'match-controls.css?v=20260928-ui2',
  'opponent-focus.css?v=20261026-owncam-pip1',
  'match-mobile-scroll.css?v=20261002-mobile1',
  'match-own-turn.css?v=20261027-i18naudit1',
  'score-meta.css?v=20261004-legdarts1',
  'fx-live.css?v=20261023-sweep2',
  'online-heatmap-result.css?v=20261023-heatmap4',
  'shared-results.css?v=20261023-heatmap3',
  'stable-video-labels.css?v=20260930-label1'
 ];
 function loadMatchStyles(){
  for(const href of MATCH_STYLES){
   if([...document.querySelectorAll('link[rel="stylesheet"]')].some(link=>link.getAttribute('href')===href))continue;
   const link=document.createElement('link');
   link.rel='stylesheet';link.href=href;
   document.head.appendChild(link);
  }
 }
 function prepare(){
  if(stage)return stage;
  const main=document.getElementById('matchView');
  const video=document.getElementById('videoGrid');
  if(!main||!video)throw Error('Tournament room layout unavailable');
  // Match controls and media CSS rely on these exact card IDs.
  const cards=video.querySelectorAll('.video-card');
  if(cards.length!==2)throw Error('Expected two existing camera cards');
  cards[0].id='localVideoCard';
  cards[0].classList.add('local-card');
  cards[1].id='remoteVideoCard';
  cards[1].classList.add('remote-card');
  if(!document.getElementById('micBtn')){
    const mic=document.createElement('button');
    mic.id='micBtn';mic.type='button';mic.className='outline';
    mic.textContent='Mikrofon på';
    cards[0].appendChild(mic);
  }
  videoAnchor=document.createComment('Original tournament video position');
  video.before(videoAnchor);
  stage=document.createElement('section');
  stage.id='daMatchStage';
  stage.hidden=true;
  stage.innerHTML=`
   <div class="match-head"><div><small id="matchFormat">LIVE MATCH</small><h1 id="matchTitle">Kamprom</h1></div>
   <div class="top-actions"><button id="cancelMatchBtn" class="danger">Avbryt kamp</button><button id="closeMatchBtn" class="outline">Lukk kampfane</button></div></div>
   <div id="daMatchVideoSlot"></div>
   <div id="webrtcDebug" hidden>VIDEO DEBUG • starter…</div>
   <div class="match-grid"><section class="card score-card">
   <div class="match-players"><article id="matchP1" class="match-player"><div id="matchName1" class="match-name">Spiller 1</div><div id="matchScore1" class="match-score">501</div><div id="matchSets1" class="match-sets hidden">0 sets</div><div id="matchLegs1" class="match-legs">0 legs</div></article>
   <article id="matchP2" class="match-player"><div id="matchName2" class="match-name">Spiller 2</div><div id="matchScore2" class="match-score">501</div><div id="matchSets2" class="match-sets hidden">0 sets</div><div id="matchLegs2" class="match-legs">0 legs</div></article></div>
   <p id="turnText" class="turn-text">Venter…</p><div class="score-entry"><input id="matchScoreInput" type="number" inputmode="numeric" min="0" max="180" autocomplete="off" placeholder="Score 0–180"><button id="matchScoreBtn" class="primary">Registrer</button></div>
   <p id="matchMessage" class="message"></p></section>
   <aside class="card match-info"><small>KAMPSTATUS</small><h2 id="matchStatus">Pågår</h2><button id="cameraBtn" class="outline wide">Start kamera</button></aside></div>`;
  main.appendChild(stage);
  return stage;
 }
 async function enter(){
  if(active)return;
  prepare();
  loadMatchStyles();
  const video=document.getElementById('videoGrid');
  const old=video.getBoundingClientRect();
  stage.hidden=false;
  stage.querySelector('#daMatchVideoSlot').appendChild(video);
  video.classList.remove('waiting-video-grid');
  const current=video.getBoundingClientRect();
  if(typeof video.animate==='function'&&!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches&&old.width&&current.width){
   await video.animate([{transform:`translate(${old.left-current.left}px,${old.top-current.top}px) scale(${old.width/current.width})`},{transform:'none'}],{duration:480,easing:'ease-out'}).finished.catch(()=>{});
  }
  for(const node of [...document.getElementById('matchView').children])if(node!==stage)node.hidden=true;
  active=true;
 }
 function restore(){
  if(!stage||!active)return;
  videoAnchor.after(document.getElementById('videoGrid'));
  document.getElementById('videoGrid').classList.add('waiting-video-grid');
  for(const node of [...document.getElementById('matchView').children])if(node!==stage)node.hidden=false;
  stage.hidden=true;
  active=false;
 }
 window.DartArenaMatchSceneHost={prepare,enter,restore,isActive:()=>active};
})();