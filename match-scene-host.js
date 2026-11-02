/* Development-only single-document match layout host.
 * Reuses actual camera <video> elements. Scoring engine boot is separate.
 */
(()=>{
 'use strict';
 if(window.DartArenaMatchSceneHost)return;
 let stage=null,videoAnchor=null,active=false,lobbyButton=null,lobbyAnchor=null;
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
 async function prepare(){
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
  // The original match.html is the single source of truth for match layout.
  // Do not duplicate the scoreboard / controls in this module.
  const response=await fetch(new URL('match.html',location.href),{cache:'no-store'});
  if(!response.ok)throw Error('Originalt kamprom kunne ikke lastes ('+response.status+')');
  const doc=new DOMParser().parseFromString(await response.text(),'text/html');
  const original=doc.querySelector('#matchView');
  if(!original)throw Error('Originalt kampoppsett mangler i match.html');
  const originalGrid=original.querySelector('#videoGrid');
  if(!originalGrid)throw Error('Originalt kampoppsett mangler videorutenettet');
  const slot=doc.createElement('div');
  slot.id='daMatchVideoSlot';
  originalGrid.replaceWith(slot);
  // stage itself owns its ID; only adopt the original match-room children.
  stage.append(...Array.from(original.childNodes).map(node=>document.importNode(node,true)));
  // The real lobby button already has handlers from the tournament page.
  // Avoid duplicate IDs: reuse that button instead of cloning its match.html twin.
  lobbyButton=document.getElementById('openLobbyTabBtn');
  const matchLobby=stage.querySelector('#openLobbyTabBtn');
  if(lobbyButton&&matchLobby){
    lobbyAnchor=document.createComment('Tournament lobby button anchor');
    lobbyButton.before(lobbyAnchor);
    matchLobby.replaceWith(lobbyButton);
    lobbyButton.classList.remove('hidden');
  }
  main.appendChild(stage);
  return stage;
 }
 async function enter(){
  if(active)return;
  await prepare();
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
  if(lobbyButton&&lobbyAnchor)lobbyAnchor.after(lobbyButton);
  document.getElementById('videoGrid').classList.add('waiting-video-grid');
  for(const node of [...document.getElementById('matchView').children])if(node!==stage)node.hidden=false;
  stage.hidden=true;
  active=false;
 }
 window.DartArenaMatchSceneHost={prepare,enter,restore,isActive:()=>active};
})();